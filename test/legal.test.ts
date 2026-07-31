import { describe, expect, it } from 'vitest';
import { privacyPolicy, termsOfService, defaultLegalContact } from '../src/lib/legal';
import { testConfig } from './fixtures/site-config';

const flatten = (doc: {
  intro: string[];
  sections: Array<{
    heading: string;
    body?: string[];
    bullets?: Array<{ term?: string; text: string }>;
  }>;
  contact: { heading: string; intro: string };
}): string =>
  [
    ...doc.intro,
    ...doc.sections.flatMap((s) => [
      s.heading,
      ...(s.body ?? []),
      ...(s.bullets ?? []).flatMap((b) => [b.term ?? '', b.text]),
    ]),
    doc.contact.heading,
    doc.contact.intro,
  ].join('\n');

describe.each([
  ['privacyPolicy', () => privacyPolicy(testConfig)],
  ['termsOfService', () => termsOfService(testConfig, ['Auto Detailing', 'ATV Detailing'])],
])('%s', (_name, template) => {
  const doc = template();
  const text = flatten(doc);

  it('interpolates the brand and carries no unresolved tokens', () => {
    expect(text).toContain('Acme Detailing');
    expect(text).not.toMatch(/\{\{|\$\{|undefined|null/);
  });

  it('has a non-empty intro and sections, and a contact block', () => {
    expect(doc.intro.length).toBeGreaterThan(0);
    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.contact.intro).toContain('hello@acme.example');
  });
});

describe('defaultLegalContact', () => {
  it('names the document and routes to the configured contacts', () => {
    const contact = defaultLegalContact(testConfig, 'Privacy Policy');
    expect(contact.intro).toContain('Privacy Policy');
    expect(contact.intro).toContain('(703) 555-0100');
  });
});
