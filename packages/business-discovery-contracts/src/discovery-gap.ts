import { z } from 'zod';
import {
  discoverySectionIdSchema,
  gapSeveritySchema,
  type DiscoverySectionId,
  type GapSeverity,
} from './enums';

/**
 * DiscoveryGap — a piece of critical information that is absent from the
 * profile, scoped to a section and graded by severity. Discovery flags *what*
 * is unknown; it does not attempt to fill the gap.
 */
export interface DiscoveryGap {
  readonly id: string;
  readonly sectionId: DiscoverySectionId;
  readonly missing: string;
  readonly severity: GapSeverity;
}

export const discoveryGapSchema = z.object({
  id: z.string().min(1),
  sectionId: discoverySectionIdSchema,
  missing: z.string().min(1),
  severity: gapSeveritySchema,
});
