import type { BIFSection } from './section';
import type { BIFStatus } from './enums';
import type { FieldDependency } from './field-dependency';
import type { FieldConflict } from './field-conflict';

/**
 * BusinessIntelligenceFramework — the canonical, versioned representation of an
 * organization. The root of the BIF model.
 */
export interface BusinessIntelligenceFramework {
  readonly id: string;
  readonly organizationId: string;
  readonly version: number;
  readonly status: BIFStatus;
  readonly sections: readonly BIFSection[];
  /** 0–100. */
  readonly confidenceScore: number;
  /** 0–100. */
  readonly completenessScore: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastSyncedAt: Date;
  /** Declared field derivations. Optional for backward compatibility. */
  readonly dependencies?: readonly FieldDependency[];
  /** Tracked field conflicts. Optional for backward compatibility. */
  readonly conflicts?: readonly FieldConflict[];
}
