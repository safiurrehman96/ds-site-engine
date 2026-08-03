import { describe, expect, it } from 'vitest';
import {
  paragraphs,
  proseBlocks,
  areaLabel,
} from '../src/lib/content';

describe('paragraphs', () => {
  it('splits on blank lines and trims', () => {
    expect(paragraphs('one\n\ntwo\n \nthree')).toEqual(['one', 'two', 'three']);
  });

  it('drops empty segments', () => {
    expect(paragraphs('\n\nonly\n\n')).toEqual(['only']);
  });
});

describe('proseBlocks', () => {
  it('classifies a plain paragraph as text', () => {
    expect(proseBlocks('Just a sentence.')).toEqual([{ kind: 'text', text: 'Just a sentence.' }]);
  });

  it('classifies an all-dash block as a list', () => {
    const body = '- wash\n- dry\n- wax';
    expect(proseBlocks(body)).toEqual([{ kind: 'list', items: ['wash', 'dry', 'wax'] }]);
  });

  it('does not treat a paragraph containing one dash line as a list', () => {
    const body = 'Intro line\n- not a full list';
    expect(proseBlocks(body)).toEqual([{ kind: 'text', text: body }]);
  });

  // The core convention from real payloads: "**Label.** explanation" runs.
  it('promotes two or more consecutive lead-in paragraphs to points', () => {
    const body =
      '**Insured.** We carry $200,000 in coverage.\n\n**Mobile.** We come to you.';
    expect(proseBlocks(body)).toEqual([
      {
        kind: 'points',
        items: [
          { label: 'Insured', body: 'We carry $200,000 in coverage.' },
          { label: 'Mobile', body: 'We come to you.' },
        ],
      },
    ]);
  });

  it('leaves a lone lead-in paragraph as text — one point is emphasis, not a list', () => {
    const body = '**Insured.** We carry $200,000 in coverage.';
    expect(proseBlocks(body)).toEqual([{ kind: 'text', text: body }]);
  });

  // The distinction documented in asPoint(): bold *subject* vs bold *label*.
  it('does not promote a bold sentence-subject without a terminating period', () => {
    const body =
      '**Weather at KTEB** includes cold winters.\n\n**Salt on Route 28** is corrosive.';
    const blocks = proseBlocks(body);
    expect(blocks.every((b) => b.kind === 'text')).toBe(true);
  });

  it('accepts a colon as the label terminator', () => {
    const body = '**Step one:** rinse.\n\n**Step two:** wash.';
    expect(proseBlocks(body)[0].kind).toBe('points');
  });

  it('rejects a label longer than 60 characters', () => {
    const long = 'A'.repeat(61);
    const body = `**${long}.** body.\n\n**${long}.** body.`;
    expect(proseBlocks(body).every((b) => b.kind === 'text')).toBe(true);
  });

  it('rejects a wholly bold paragraph with no body after it', () => {
    const body = '**Loud statement.**\n\n**Another.**';
    expect(proseBlocks(body).every((b) => b.kind === 'text')).toBe(true);
  });

  it('flushes a point run when a list interrupts it', () => {
    const body = '**A.** one.\n\n- x\n- y\n\n**B.** two.';
    expect(proseBlocks(body).map((b) => b.kind)).toEqual(['text', 'list', 'text']);
  });

  it('handles mixed bodies in order', () => {
    const body = 'Intro.\n\n**A.** one.\n\n**B.** two.\n\n- x\n- y\n\nOutro.';
    expect(proseBlocks(body).map((b) => b.kind)).toEqual(['text', 'points', 'list', 'text']);
  });
});

describe('areaLabel', () => {
  it('appends the state only for US-city areas', () => {
    expect(areaLabel({ name: 'Ashburn', state: 'VA' })).toBe('Ashburn, VA');
    expect(areaLabel({ name: 'Teterboro Airport (KTEB)' })).toBe('Teterboro Airport (KTEB)');
  });
});
