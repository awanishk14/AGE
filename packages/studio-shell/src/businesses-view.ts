import type { ClientRecord } from '@age/client-registry';

/**
 * What the Businesses screen (S2) shows, decided as data rather than in JSX.
 *
 * ⚠️ The four outcomes below are deliberately four, not two. "Nobody told the
 * console where to look", "the console looked and was refused", "the console
 * looked and the file names no businesses" and "here are the businesses" are
 * different facts about the world, and collapsing any pair of them into an
 * empty list is exactly the failure `17_DESIGN_SYSTEM.md` §0.1 forbids.
 */
export type BusinessesView =
  /** No path configured. AGE has not looked. ⚠️ Renders "not assessed". */
  | { readonly kind: 'not-configured'; readonly variable: string }
  /**
   * The console tried and was refused — a bad path, an unreadable file, a
   * malformed record. ⚠️ Renders the refusal, never an empty list.
   */
  | { readonly kind: 'refused'; readonly reason: string }
  /**
   * The file was read and validated, and it names no businesses.
   * ⚠️ AGE looked and there is nothing: "unknown", not "not assessed".
   *
   * 🚫 Unreachable through `loadClientRecordFile`, which refuses an empty
   * `records` array outright — and it is modelled anyway, because the screen
   * must not depend on a loader's refusal to stay honest.
   */
  | { readonly kind: 'none' }
  /** Businesses, grouped into derived organization bands. */
  | { readonly kind: 'listed'; readonly bands: readonly OrganizationBand[] };

/**
 * A grouping of businesses that share an `organizationId`.
 *
 * 🚫 This is a DERIVED BAND, not a level and not an entity. There is no
 * organization route, no organization picker, no "current organization" in
 * state, and no organization id anyone can type (ADR-0058 D4, ADR-0054 D2).
 * The value is read OFF the resolved records and exists only to group a list.
 *
 * ⚠️ A level you can navigate into is a level you can select, and a selectable
 * scope is a typed scope — the thing ADR-0054 D2 refuses by name.
 */
export interface OrganizationBand {
  /** Read off the records in this band. 🚫 Never typed, never selected. */
  readonly organizationId: string;
  readonly clients: readonly ClientRecord[];
}

/**
 * Group records into organization bands.
 *
 * Ordering is deterministic — bands by `organizationId`, clients by `clientId`,
 * both lexicographic — so the screen does not reorder itself between reads and
 * the operator can trust that a change on screen means a change in the file.
 *
 * ⚠️ Pure and total: it invents no band, drops no record, and every input
 * record appears in exactly one band.
 */
export function groupIntoOrganizationBands(
  records: readonly ClientRecord[],
): readonly OrganizationBand[] {
  const byOrganization = new Map<string, ClientRecord[]>();

  for (const record of records) {
    const existing = byOrganization.get(record.organizationId);
    if (existing === undefined) {
      byOrganization.set(record.organizationId, [record]);
    } else {
      existing.push(record);
    }
  }

  return Object.freeze(
    [...byOrganization.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([organizationId, clients]) =>
        Object.freeze({
          organizationId,
          clients: Object.freeze(
            [...clients].sort((left, right) => left.clientId.localeCompare(right.clientId)),
          ),
        }),
      ),
  );
}

/** The view for a successful read. Empty input is `none`, never an empty list. */
export function presentBusinesses(records: readonly ClientRecord[]): BusinessesView {
  if (records.length === 0) {
    return Object.freeze({ kind: 'none' });
  }

  return Object.freeze({ kind: 'listed', bands: groupIntoOrganizationBands(records) });
}

/** How many businesses a view accounts for. ⚠️ `undefined` when none was read. */
export function countBusinesses(view: BusinessesView): number | undefined {
  switch (view.kind) {
    case 'not-configured':
    case 'refused':
      // 🚫 NOT zero. Nothing was read, so there is no count to report, and a
      // zero here would be a measured-looking number nobody measured.
      return undefined;
    case 'none':
      return 0;
    case 'listed':
      return view.bands.reduce((total, band) => total + band.clients.length, 0);
  }
}
