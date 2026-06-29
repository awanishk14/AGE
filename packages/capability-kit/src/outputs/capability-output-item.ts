import type { Capability } from '../enums/capability.enum';

export interface CapabilityOutputItem {
  readonly id: string;
  readonly capability: Capability;
  readonly createdAt: Date;
}
