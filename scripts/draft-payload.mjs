/**
 * Draft collection files from an imported export.
 *
 *   pnpm run draft jetspa            preview what would be written
 *   pnpm run draft jetspa -- --write
 *
 * SCOPE, AND WHY IT IS NARROW
 * scripts/import-notion.mjs deliberately stops before mapping prose onto schema
 * fields, because a wrong guess builds cleanly and reads like nonsense. This script
 * makes that mapping — but only for exports that follow the section template the
 * client's page generator produces:
 *
 *   Service:  <lead> · What Is X · What Is Included · Our X Process ·
 *             Why X Matters · Add-On Services · Frequently Asked Questions · <cta>
 *   Location: <lead> · Why X Requires a Specialist · Our Services at X ·
 *             X-Specific Considerations · The Brand Guarantee · <cta>
 *
 * Sections are matched by shape and position, not by exact wording, and anything it
 * cannot place is reported rather than dropped silently. Output is a DRAFT: the
 * one-line shortDescription fields in particular are compressed from the client's own
 * copy and need a human to read them back.
 *
 * Singletons (home, about, faqs, get-quote, legal) are
 * mapped too, each by its own explicit rule rather than a shared template.
 *
 * Deliberately dropped, not lost: the bulleted service and airport lists on the home
 * page, and the service list on each area page. The engine renders those from the
 * collections themselves — ServicesGrid and AreasGrid — so carrying them as prose
 * would duplicate every link and let the two copies drift apart.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('-'));
const WRITE = args.includes('--write');

if (!slug) {
  console.error('Usage: pnpm run draft <slug> [-- --write]');
  process.exit(1);
}

const IN = path.join('.import', slug);
const OUT = path.join('clients', slug, 'content');

/* ------------------------------------------------------------------ yaml output */

/** Block scalar. Prose contains colons, quotes and em dashes; nothing else is safe. */
function block(key, text, indent = '') {
  const body = String(text)
    .split('\n')
    .map((l) => (l.trim() ? `${indent}  ${l}` : ''))
    .join('\n');
  return `${indent}${key}: |\n${body}\n`;
}

const quote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** A YAML list of block scalars — `intro:` and legal `body:` are lists of paragraphs. */
function blockList(key, items, indent = '') {
  let out = `${indent}${key}:\n`;
  for (const item of items) {
    out += `${indent}  - |\n`;
    out += String(item)
      .split('\n')
      .map((l) => (l.trim() ? `${indent}    ${l}` : ''))
      .join('\n');
    out += '\n';
  }
  return out;
}

/**
 * Paragraphs of a legal section, minus the generator's own scaffolding: a
 * "Last Updated" line (the engine renders legal.effectiveDate itself) and the
 * blockquoted "this is a template, have a lawyer review it" disclaimer, which is a
 * note to us and must never render as site copy.
 */
function legalParagraphs(body) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^>/.test(p))
    .filter((p) => !/^\*\*Last Updated:/i.test(p));
}

/* ---------------------------------------------------------------- section utils */

const find = (page, re) => page.sections.find((s) => s.heading && re.test(s.heading));
const lead = (page) => page.sections.find((s) => !s.heading || s.level === 1);

/** First sentence of a body, for the one-line grid description. */
function firstSentence(text) {
  const flat = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = flat.match(/^(.{40,180}?[.!?])\s/);
  return (m ? m[1] : flat.slice(0, 160)).trim();
}

/** "Step one: **Title.** Body" → { title, body }. Falls back to an untitled step. */
function parseSteps(body) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^Step\s+\w+:\s*\*\*(.+?)\.?\*\*\s*(.*)$/s);
      if (m) return { title: m[1].trim(), body: m[2].trim() };
      return { body: p };
    })
    .filter((s) => s.body);
}

/* --------------------------------------------------------------------- services */

function serviceFile(page, meta) {
  const explainer = find(page, /^What Is/i);
  const included = find(page, /What Is Included/i);
  const process = find(page, /^Our .*(Process|Detailing|Response)/i);
  const why = find(page, /^Why /i);
  const addons = find(page, /Add-?On/i);
  const faqSection = page.sections.find((s) => s.faqs?.length);
  const cta = page.sections[page.sections.length - 1];
  const leadSection = lead(page);

  const missing = [];
  if (!explainer) missing.push('What Is …');
  if (!process) missing.push('Our … Process');
  if (!faqSection) missing.push('FAQs');
  if (!included) missing.push('What Is Included');

  let out = '---\n';
  out += `name: ${quote(meta.name)}\n`;
  out += `slug: ${quote(meta.slug)}\n`;
  out += `order: ${meta.order}\n`;
  out += `kind: ${quote(meta.kind)}\n`.replace(/^kind.*\n/, ''); // not in schema; drop
  out += `metaDescription: ${quote(page.seo.metaDescription)}\n`;
  if (page.seo.title) out += `title: ${quote(page.seo.title)}\n`;
  out += `h1: ${quote(page.title)}\n\n`;
  out += `shortDescription: ${quote(firstSentence(explainer?.body ?? leadSection.body))}\n\n`;
  out += `heroImage:\n  src: ${quote(`./assets/service-${meta.slug}.jpg`)}\n`;
  out += `  alt: ${quote(`PLACEHOLDER ${meta.name.toLowerCase()} image — JetSpa`)}\n\n`;
  out += block('heroIntro', leadSection.body);
  out += '\n';

  out += `intro:\n  heading: ${quote(explainer.heading)}\n`;
  out += block('body', explainer.body, '  ');
  out += '\n';

  if (included) {
    out += `explainer:\n  heading: ${quote(included.heading)}\n`;
    out += block('body', included.body, '  ');
    out += '\n';
  }

  out += `processHeading: ${quote(process.heading)}\n`;
  out += 'processSteps:\n';
  for (const step of parseSteps(process.body)) {
    out += step.title ? `  - title: ${quote(step.title)}\n` : '  - body: |\n';
    if (step.title) {
      out += block('body', step.body, '    ');
    } else {
      out += String(step.body)
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n') + '\n';
    }
  }
  out += '\n';

  if (addons) {
    out += `crossSell:\n  heading: ${quote(addons.heading)}\n`;
    out += block('body', addons.body, '  ');
    out += '\n';
  }

  if (why) {
    out += `whyItMatters:\n  heading: ${quote(why.heading)}\n`;
    out += block('body', why.body, '  ');
    out += '\n';
  }

  out += 'faqs:\n';
  for (const f of faqSection.faqs) {
    out += `  - q: ${quote(f.q)}\n`;
    out += block('a', f.a, '    ');
  }
  out += '\n';
  out += `ctaHeadline: ${quote(cta.heading ?? 'Book Your Next Detail')}\n`;
  out += '---\n';

  return { out, missing };
}

/* ------------------------------------------------------------------------ areas */

function areaFile(page, meta) {
  const specialist = find(page, /Requires a Specialist|Why /i);
  const services = find(page, /^Our .*Services/i);
  const considerations = find(page, /Considerations/i);
  const guarantee = find(page, /Guarantee/i);
  const cta = page.sections[page.sections.length - 1];
  const leadSection = lead(page);

  const missing = [];
  if (!specialist) missing.push('Why … Requires a Specialist');
  if (!guarantee) missing.push('… Guarantee');

  let out = '---\n';
  out += `name: ${quote(meta.name)}\n`;
  out += `slug: ${quote(meta.slug)}\n`;
  out += `order: ${meta.order}\n`;
  if (meta.state) out += `state: ${quote(meta.state)}\n`;
  if (meta.shortName) out += `shortName: ${quote(meta.shortName)}\n`;
  if (meta.isHeadquarters) out += 'isHeadquarters: true\n';
  out += `metaDescription: ${quote(page.seo.metaDescription)}\n`;
  if (page.seo.title) out += `title: ${quote(page.seo.title)}\n`;
  out += `h1: ${quote(page.title)}\n\n`;
  out += block('heroIntro', leadSection.body);
  out += '\n';

  // The services section is a bulleted list of links the engine renders as a grid;
  // only its lead-in sentence survives, as the grid's intro.
  const servicesLead = services ? firstSentence(services.body) : `Every service we offer is available at ${meta.name}.`;
  out += `servicesIntro: ${quote(servicesLead)}\n\n`;

  out += `localCopy:\n  heading: ${quote(specialist.heading)}\n`;
  out += block('body', specialist.body, '  ');
  out += '\n';

  if (considerations) {
    out += `localDetail:\n  heading: ${quote(considerations.heading)}\n`;
    out += block('body', considerations.body, '  ');
    out += '\n';
  }

  out += `whyUs:\n  heading: ${quote(guarantee.heading)}\n`;
  out += block('body', guarantee.body, '  ');
  out += '\n';
  out += `ctaHeadline: ${quote(cta.heading ?? 'Schedule Service')}\n`;
  out += '---\n';

  return { out, missing };
}

/* -------------------------------------------------------------------- singletons */

const proseBlock = (key, section) =>
  `${key}:\n  heading: ${quote(section.heading)}\n${block('body', section.body, '  ')}\n`;

/** "#### Question" + following prose, wherever it appears — not only under a FAQ heading. */
function faqsIn(body) {
  const faqs = [];
  let q = null;
  let a = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^####\s+(.*)$/);
    if (m) {
      if (q) faqs.push({ q, a: a.join('\n').trim() });
      q = m[1].trim();
      a = [];
    } else if (q) a.push(line);
  }
  if (q) faqs.push({ q, a: a.join('\n').trim() });
  return faqs;
}

/** Strips the bulleted list blocks the engine renders from collections instead. */
const withoutLists = (body) =>
  body
    .split(/\n\s*\n/)
    .filter((p) => !p.trim().split('\n').every((l) => l.trim().startsWith('- ') || /^\*\*.+:\*\*$/.test(l.trim())))
    .join('\n\n')
    .trim();

function singletons(pages) {
  const files = [];
  const get = (slug) => pages.get(slug);
  const at = (page, re) => find(page, re);

  /* ---- home */
  const home = get('/');
  if (home) {
    const leadSection = lead(home);
    const why = at(home, /^Why /i);
    const working = at(home, /Working with Us/i);
    const offer = at(home, /What We Offer/i);
    const fly = at(home, /Where We Fly/i);
    const cta = home.sections[home.sections.length - 1];

    let out = '---\n';
    out += `metaDescription: ${quote(home.seo.metaDescription)}\n`;
    out += `heroHeadline: ${quote(leadSection.heading)}\n`;
    out += block('heroIntro', leadSection.body);
    out += '\n';
    out += proseBlock('intro', why);
    out += `introImage:\n  src: "./assets/intro.jpg"\n  alt: "PLACEHOLDER home intro image — JetSpa"\n\n`;
    out += proseBlock('trust', working);
    out += `servicesIntro: ${quote(firstSentence(offer.body))}\n`;
    out += `areasIntro: ${quote(firstSentence(fly.body))}\n`;
    out += `ctaHeadline: ${quote(cta.heading)}\n`;
    out += '---\n';
    files.push({ file: path.join(OUT, 'home.md'), out });
  }

  /* ---- about: every mid-page section becomes a block */
  const about = get('/about');
  if (about) {
    const leadSection = lead(about);
    const blocks = about.sections.filter((s) => s.heading && s !== leadSection).slice(0, -1);
    const cta = about.sections[about.sections.length - 1];

    let out = '---\n';
    out += `metaDescription: ${quote(about.seo.metaDescription)}\n`;
    out += `heroHeadline: ${quote(leadSection.heading)}\n`;
    out += `heroImage:\n  src: "./assets/intro.jpg"\n  alt: "PLACEHOLDER team image — JetSpa"\n\n`;
    out += 'blocks:\n';
    for (const b of blocks) {
      out += `  - heading: ${quote(b.heading)}\n`;
      out += block('body', b.body, '    ');
    }
    out += `\nctaHeadline: ${quote(cta.heading)}\n---\n`;
    files.push({ file: path.join(OUT, 'about.md'), out });
  }

  /* ---- faqs: one group per mid-page section */
  const faqs = get('/faqs');
  if (faqs) {
    const leadSection = lead(faqs);
    const groups = faqs.sections.filter((s) => faqsIn(s.body).length);
    const cta = faqs.sections[faqs.sections.length - 1];

    let out = '---\n';
    out += `metaDescription: ${quote(faqs.seo.metaDescription)}\n`;
    out += `heroHeadline: ${quote(leadSection.heading)}\n`;
    out += block('heroIntro', leadSection.body);
    out += '\ngroups:\n';
    for (const g of groups) {
      out += `  - heading: ${quote(g.heading)}\n    faqs:\n`;
      for (const f of faqsIn(g.body)) {
        out += `      - q: ${quote(f.q)}\n`;
        out += block('a', f.a, '        ');
      }
    }
    out += `\nctaHeadline: ${quote(cta.heading)}\n`;
    out += `ctaBody: ${quote(firstSentence(cta.body))}\n---\n`;
    files.push({ file: path.join(OUT, 'faqs.md'), out });
  }

  /* ---- get-quote */
  const quoteP = get('/get-quote');
  if (quoteP) {
    const leadSection = lead(quoteP);
    let out = '---\n';
    out += `title: ${quote(quoteP.seo.title)}\n`;
    out += `metaDescription: ${quote(quoteP.seo.metaDescription)}\n`;
    out += `heroHeadline: ${quote(leadSection.heading)}\n`;
    out += block('heroIntro', withoutLists(leadSection.body));
    out += `\nservicesHeading: "What We Detail"\n`;
    out += `panelHeading: "Talk to the JetSpa Team"\n`;
    out += `ctaHeadline: "Book Your Aircraft's Next Detail"\n---\n`;
    files.push({ file: path.join(OUT, 'get-quote.md'), out });
  }

  /* ---- legal: authored by the client, so it overrides the generated template */
  for (const [slugName, file] of [
    ['/privacy-policy', 'privacy-policy.md'],
    ['/tos', 'tos.md'],
  ]) {
    const page = get(slugName);
    if (!page) continue;
    const leadSection = lead(page);
    const sections = page.sections.filter((s) => s.heading && s !== leadSection);
    const contact = sections.find((s) => /^Contact/i.test(s.heading));

    let out = '---\n';
    out += `title: ${quote(page.title)}\n`;
    out += `metaDescription: ${quote(page.seo.metaDescription)}\n`;
    out += blockList('intro', legalParagraphs(leadSection.body));
    out += 'sections:\n';
    for (const sec of sections.filter((x) => x !== contact)) {
      out += `  - heading: ${quote(sec.heading)}\n`;
      out += blockList('body', legalParagraphs(sec.body), '    ');
    }
    if (contact) {
      // Only the lead sentence: LegalDoc renders the phone/email/website bullets
      // itself from config, so repeating the client's own NAP lines here would print
      // them twice — and firstSentence() would cut a markdown link in half doing it.
      out += `contact:\n  heading: ${quote(contact.heading)}\n`;
      out += block('intro', contact.body.split('\n')[0].trim(), '  ');
    }
    out += `ctaHeadline: "Book Your Aircraft's Next Detail"\n---\n`;
    files.push({ file: path.join(OUT, 'legal', file), out });
  }

  return files;
}

/* -------------------------------------------------------------------------- run */

async function main() {
  if (!existsSync(IN)) {
    console.error(`✗ No import at ${IN}/ — run: pnpm run import ${slug} -- --write`);
    process.exit(1);
  }

  const intake = JSON.parse(await readFile(path.join('clients', slug, 'source', 'intake.json'), 'utf8'));
  const files = (await readdir(IN)).filter((f) => f.endsWith('.json') && f !== '_report.json');
  const pages = new Map();
  for (const f of files) {
    const page = JSON.parse(await readFile(path.join(IN, f), 'utf8'));
    pages.set(page.slug, page);
  }

  const written = [];
  const problems = [];

  for (const meta of intake.pages.services) {
    const page = pages.get(`/${meta.slug}`);
    if (!page) {
      problems.push(`service ${meta.slug}: no page in the export`);
      continue;
    }
    const { out, missing } = serviceFile(page, meta);
    written.push({ file: path.join(OUT, 'services', `${meta.slug}.md`), out });
    if (missing.length) problems.push(`service ${meta.slug}: missing ${missing.join(', ')}`);
  }

  for (const meta of intake.pages.areas) {
    const page = pages.get(`/${meta.slug}`);
    if (!page) {
      problems.push(`area ${meta.slug}: no page in the export`);
      continue;
    }
    const { out, missing } = areaFile(page, meta);
    written.push({ file: path.join(OUT, 'areas', `${meta.slug}.md`), out });
    if (missing.length) problems.push(`area ${meta.slug}: missing ${missing.join(', ')}`);
  }

  written.push(...singletons(pages));

  for (const w of written) console.log(`  ${WRITE ? '▸' : '·'} ${w.file}`);
  if (problems.length) {
    console.log('\n! sections that could not be placed:');
    for (const p of problems) console.log(`  · ${p}`);
  }

  if (!WRITE) {
    console.log(`\n(dry run — ${written.length} file(s) would be written. Re-run with --write)`);
    return;
  }

  for (const dir of ['services', 'areas', 'legal']) {
    await mkdir(path.join(OUT, dir), { recursive: true });
  }
  for (const w of written) await writeFile(w.file, w.out);
  console.log(`\n✓ ${written.length} draft file(s) written. Read them before trusting them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
