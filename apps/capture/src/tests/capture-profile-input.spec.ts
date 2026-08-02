import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';
import { parseBusinessDiscoveryProfileDocument } from '../capture-profile-input';

/**
 * ADR-0043 D3, Slice B1.
 *
 * This is the friendlier, earlier boundary — NOT a replacement for the mapper's
 * own guard, which ADR-0040 D10 deliberately does not swallow. It takes text
 * rather than a path so that the filesystem read stays in the entry point
 * (Slice B2) and this stays pure and testable.
 */

const validJson = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);

describe('parseBusinessDiscoveryProfileDocument', () => {
  it('accepts a document the schema accepts', () => {
    const parsed = parseBusinessDiscoveryProfileDocument(validJson, './profile.json');

    expect(parsed.ok).toBe(true);
  });

  it('returns the validated profile, not the raw parse', () => {
    const parsed = parseBusinessDiscoveryProfileDocument(validJson, './profile.json');
    if (!parsed.ok) {
      throw new Error(parsed.errors.join('; '));
    }

    expect(parsed.profile.id).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
  });

  it('reports unparseable JSON without throwing', () => {
    const parsed = parseBusinessDiscoveryProfileDocument('{ not json', './profile.json');

    expect(parsed.ok).toBe(false);
  });

  it('names the source in a JSON syntax failure, so the operator knows which file', () => {
    const parsed = parseBusinessDiscoveryProfileDocument('{ not json', './broken.json');
    if (parsed.ok) {
      throw new Error('expected failure');
    }

    expect(parsed.errors.join('; ')).toContain('./broken.json');
  });

  it('rejects valid JSON that is not a discovery profile', () => {
    const parsed = parseBusinessDiscoveryProfileDocument('{"id":"x"}', './profile.json');

    expect(parsed.ok).toBe(false);
  });

  it('reports the schema’s own field-level issues rather than a generic message', () => {
    const parsed = parseBusinessDiscoveryProfileDocument('{"id":"x"}', './profile.json');
    if (parsed.ok) {
      throw new Error('expected failure');
    }

    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.join('; ')).not.toBe('');
  });

  it.each([
    ['a JSON array', '[]'],
    ['a JSON string', '"profile"'],
    ['a JSON number', '42'],
    ['JSON null', 'null'],
    ['an empty document', ''],
  ])('rejects %s', (_label, text) => {
    expect(parseBusinessDiscoveryProfileDocument(text, './profile.json').ok).toBe(false);
  });

  /**
   * The same defect PR #220 fixed in the two operator-file loaders, in the
   * third place it shipped. V8's "Unexpected token" `SyntaxError` QUOTES A
   * WINDOW OF THE SOURCE, and this boundary spliced that message into its own
   * refusal — so a malformed profile printed a fragment of a real business's
   * discovery profile onto stderr.
   *
   * ⚠️ The unquoted-value fixture below is chosen BECAUSE it produces that
   * class. The POSITIONAL class ("at position 59") does not quote the source at
   * all, so a fixture producing one would leave this guard vacuous — that is
   * exactly how two of #220's guards passed against the unfixed code.
   */
  const LEAKY = `{"id":"profile-1","businessName":Wholly Invented Widgets}`;

  it('the fixture really does make the parser quote the file', () => {
    // Otherwise a future Node that stopped quoting would leave the guard below
    // passing while proving nothing.
    let raw = '';
    try {
      JSON.parse(LEAKY);
    } catch (error) {
      raw = (error as Error).message;
    }
    expect(raw).toContain('Wholly');
    expect(raw).toContain('essName');
  });

  it('says only what it is allowed to say about a malformed profile', () => {
    const parsed = parseBusinessDiscoveryProfileDocument(LEAKY, './profile.json');
    if (parsed.ok) {
      throw new Error('expected failure');
    }

    // An EXACT match, not a set of absent substrings: it is the only assertion
    // that cannot be satisfied by a message that leaks something unlisted.
    expect(parsed.errors).toEqual([
      './profile.json is not valid JSON (at an unreported position).',
    ]);
  });

  it('reports the position when the parser gives one', () => {
    const parsed = parseBusinessDiscoveryProfileDocument('{"id":"x"} broken', './profile.json');
    if (parsed.ok) {
      throw new Error('expected failure');
    }

    expect(parsed.errors[0]).toMatch(/^\.\/profile\.json is not valid JSON \(at position \d+\)\.$/);
  });

  it('is pure — the same text yields the same outcome', () => {
    expect(parseBusinessDiscoveryProfileDocument('{"id":"x"}', './p.json')).toEqual(
      parseBusinessDiscoveryProfileDocument('{"id":"x"}', './p.json'),
    );
  });
});
