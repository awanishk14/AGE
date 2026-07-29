import type { BusinessDiscoveryProfile } from '@age/business-discovery-contracts';
import { businessDiscoveryProfileSchema } from '@age/business-discovery-contracts';

/**
 * The CLI's profile-document boundary (ADR-0043 D3, Slice B1).
 *
 * TAKES TEXT, NOT A PATH. The filesystem read is the entry point's job
 * (Slice B2) — the first production `node:fs` read in the repo, and it stays
 * exactly one line in exactly one place. Keeping this function on text is what
 * lets it be pure, exhaustively testable, and free of the repo-wide purity
 * guard's forbidden imports.
 *
 * IT DOES NOT REPLACE THE MAPPER'S GUARD. `mapBusinessDiscoveryToBifDraft`
 * validates the profile itself and THROWS on invalid input, and ADR-0040 D10
 * deliberately does not swallow that: a caller error must not be reported as a
 * degraded result. This is the earlier, friendlier boundary — it turns
 * "unhandled exception at the mapper" into a named file and a list of field
 * paths, before any scope is echoed and before anything is written. Both guards
 * stay; the redundancy is the point.
 */

export type ParsedBusinessDiscoveryProfileDocument =
  | { readonly ok: true; readonly profile: BusinessDiscoveryProfile }
  | { readonly ok: false; readonly errors: readonly string[] };

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describeUnexpectedRoot = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  return `a JSON ${typeof value}`;
};

/**
 * Parses and validates a discovery profile document.
 *
 * Never throws. A malformed document is an operator mistake with a clear cause,
 * and the caller needs every cause at once rather than the first one.
 *
 * @param text the raw file contents
 * @param source the path to name in errors, so the operator knows which file
 */
export function parseBusinessDiscoveryProfileDocument(
  text: string,
  source: string,
): ParsedBusinessDiscoveryProfileDocument {
  let document: unknown;

  try {
    document = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`${source} is not valid JSON: ${reason}`] };
  }

  if (!isJsonObject(document)) {
    return {
      ok: false,
      errors: [
        `${source} must contain a JSON object describing a business discovery profile, but it contains ${describeUnexpectedRoot(document)}.`,
      ],
    };
  }

  const parsed = businessDiscoveryProfileSchema.safeParse(document);

  if (!parsed.success) {
    // The schema's own field-level issues, not a generic "invalid profile" —
    // the operator has to be able to fix the file.
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path.length === 0
        ? `${source}: ${issue.message}`
        : `${source}: ${path} — ${issue.message}`;
    });

    return {
      ok: false,
      errors:
        errors.length === 0 ? [`${source} is not a valid business discovery profile.`] : errors,
    };
  }

  // The validated value, not the raw parse: the schema normalises, and the
  // normalised profile is the one the mapper will see.
  return { ok: true, profile: parsed.data };
}
