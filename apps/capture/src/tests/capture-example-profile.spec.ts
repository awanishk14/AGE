import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { parseBusinessDiscoveryProfileDocument } from '../capture-profile-input';

/**
 * ADR-0046 D3 gap G3, Slice 2 — the committed example profile.
 *
 * WHY A FILE EXISTS AT ALL. `--profile <path>` takes a JSON document, and until
 * this file the repository contained none: the sample profile lived only as a
 * TypeScript constant, so the documented way to run the CLI began with "first
 * write your own profile document". A CLI whose safe mode cannot be invoked
 * without authoring a fixture is a CLI nobody invokes.
 *
 * WHY IT IS PINNED TO THE CONSTANT. A hand-maintained copy drifts, and a drifted
 * example is worse than none — it would produce different scores from every
 * other surface in the repo while looking like the same input. This asserts the
 * committed bytes still deserialize to `SAMPLE_BUSINESS_DISCOVERY_PROFILE`, so
 * a change to the constant fails here rather than silently ageing the file.
 */

const EXAMPLE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'examples',
  'sample-business-discovery-profile.json',
);

describe('the committed example profile document', () => {
  const text = readFileSync(EXAMPLE_PATH, 'utf8');

  it('was read', () => {
    expect(text.length).toBeGreaterThan(0);
  });

  it('parses through the CLI’s own profile boundary', () => {
    const parsed = parseBusinessDiscoveryProfileDocument(text, EXAMPLE_PATH);

    // Not `parsed.ok === true` alone: on failure the errors are what an
    // operator would see, so surface them.
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  it('is the same profile every other surface in the repo uses', () => {
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)));
  });
});
