/**
 * What the source actually SAW — as a direction and a materiality band, and
 * never as a vendor's number.
 *
 * ⚠️ The absence of a numeric field is the design. A number invites AGE to
 * compare across systems that measure different things by different methods, and
 * the comparison would look rigorous while meaning nothing. A direction and a
 * band are what AGE can honestly reason about, and 🚫 anything finer belongs to
 * the source system, which keeps it.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * ⚠️ `absent` is NOT `flat`. `flat` means the source looked and the thing did not
 * move; `absent` means the source looked and the thing is **not there at all** —
 * a service AGE knows about with no organic presence, a prioritised service with
 * no paid presence. That distinction is the single most useful SEO/ads fact AGE
 * can hold, and collapsing it into `flat` would destroy it.
 */
export type ClaimDirection = 'up' | 'down' | 'flat' | 'absent';

export const CLAIM_DIRECTIONS: readonly ClaimDirection[] = Object.freeze([
  'up',
  'down',
  'flat',
  'absent',
]);

/**
 * How much it moved, in bands the source itself assigns.
 *
 * 🚫 AGE does not compute a band, re-band, or convert one vendor's band into
 * another's. It records what the source asserted.
 */
export type MaterialityBand = 'slight' | 'moderate' | 'substantial';

export const MATERIALITY_BANDS: readonly MaterialityBand[] = Object.freeze([
  'slight',
  'moderate',
  'substantial',
]);

export interface ObservationClaim {
  readonly direction: ClaimDirection;
  /**
   * ⚠️ Required even for `absent` and `flat`. A source that cannot say how
   * material its own observation is has not made an observation AGE can weigh,
   * and 🚫 the missing band is never defaulted to `slight` to let it through.
   */
  readonly materiality: MaterialityBand;
}
