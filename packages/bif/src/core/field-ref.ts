import { z } from 'zod';
import { SectionType } from './section-type';

/**
 * BIFFieldRef — the canonical address of a single BIF field.
 *
 * Every mapping / proposal that targets BIF MUST use a BIFFieldRef. The
 * contract guarantees a field reference is:
 *  - **unique** — it identifies exactly one field in the framework, and
 *  - **unambiguous** — the `path` disambiguates nested and array fields.
 *
 * Components:
 *  - `section` — the owning BIF section.
 *  - `fieldKey` — the field's key within that section.
 *  - `path` — a fully-qualified path, e.g. `"organization_identity.legalName"`
 *    or `"products_services.products[0].pricingModel"`.
 *
 * Contract only — no resolution or lookup logic lives here.
 */
export interface BIFFieldRef {
  readonly section: SectionType;
  readonly fieldKey: string;
  readonly path: string;
}

export const bifFieldRefSchema = z.object({
  section: z.nativeEnum(SectionType),
  fieldKey: z.string(),
  path: z.string(),
});
