/**
 * Validates a client's intake file and reports what is still outstanding.
 *
 *   pnpm run intake jetspa        check clients/jetspa/source/intake.json
 *   pnpm run intake --all         check every client
 *
 * Two different kinds of finding, deliberately separated:
 *
 *   errors   — the file is wrong (bad shape, malformed phone, unknown preset).
 *              Fix these; nothing downstream will work.
 *   pending  — the file is right but incomplete: a fact nobody has supplied yet.
 *              These are chased with the client, and the build will refuse to
 *              produce a site until every one is filled.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { intakeSchema, classifyPending, tokenMaps } from './intake-schema.mjs';

const CLIENTS = 'clients';
const intakePath = (slug) => path.join(CLIENTS, slug, 'source', 'intake.json');

async function check(slug) {
  const file = intakePath(slug);
  if (!existsSync(file)) {
    console.log(`\n${slug}\n  ✗ no intake at ${file}`);
    return false;
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    console.log(`\n${slug}\n  ✗ ${file} is not valid JSON — ${err.message}`);
    return false;
  }

  const parsed = intakeSchema.safeParse(raw);
  console.log(`\n${slug}  (${file})`);

  if (!parsed.success) {
    console.log('  ✗ schema errors:');
    for (const issue of parsed.error.issues) {
      console.log(`      · ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return false;
  }

  const data = parsed.data;
  const { blocking, launch, optional } = classifyPending(data);

  console.log(
    `  ✓ schema valid — ${data.pages.services.length} services, ${data.pages.areas.length} areas, ` +
      `${data.ghl.bookingUrls?.length ?? 0} booking calendars`,
  );

  if (blocking.length) {
    console.log(`  ! ${blocking.length} fact(s) needed before the site can build:`);
    for (const p of blocking) console.log(`      · ${p}`);
  }
  if (launch.length) {
    console.log(`  · ${launch.length} wanted before launch, not before build:`);
    for (const p of launch) console.log(`      · ${p}`);
  }
  if (optional.length) {
    console.log(`  · ${optional.length} optional field(s) left empty (fine)`);
  }

  // The token map is what the content import resolves against; an unresolved token
  // fails the build later, so it is worth seeing the coverage now.
  const { prose } = tokenMaps(data);
  console.log(`  · ${Object.keys(prose).length} merge field(s) resolvable`);

  if (data.notes.length) {
    console.log('  · notes:');
    for (const n of data.notes) console.log(`      · ${n}`);
  }

  return blocking.length === 0;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const all = args.includes('--all');
  const slugs = all
    ? (await readdir(CLIENTS, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    : args.filter((a) => !a.startsWith('-'));

  if (!slugs.length) {
    console.error('Usage: pnpm run intake <slug> | --all');
    process.exit(1);
  }

  const results = await Promise.all(slugs.map(check));
  const ready = results.filter(Boolean).length;
  console.log(`\n${ready}/${slugs.length} ready to build\n`);
  // Incomplete intake is the normal state during onboarding, not a failure.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
