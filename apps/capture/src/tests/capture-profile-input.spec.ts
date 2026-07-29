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

  it('is pure — the same text yields the same outcome', () => {
    expect(parseBusinessDiscoveryProfileDocument('{"id":"x"}', './p.json')).toEqual(
      parseBusinessDiscoveryProfileDocument('{"id":"x"}', './p.json'),
    );
  });
});
