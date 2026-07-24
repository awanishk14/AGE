import type { Capability } from '../enums/capability.enum';
import type { ExecutionDomain } from '../enums/execution-domain.enum';
import type { CapabilityOutputItem } from './capability-output-item';

interface CapabilityOutputProps<T extends CapabilityOutputItem> {
  clientId: string;
  organizationId: string;
  capability: Capability;
  executionDomains: ExecutionDomain[];
  items: T[];
  /**
   * When the output was produced. Optional and caller-supplied (ADR-0026,
   * Decision 2): a deterministic capability flow passes a fixed timestamp so the
   * same inputs yield the same output, without the envelope reading the wall
   * clock. When omitted, `producedAt` falls back to `new Date()` — a legacy,
   * non-deterministic default preserved so existing callers keep working
   * unchanged. New deterministic flows should pass this explicitly.
   */
  producedAt?: Date;
}

export class CapabilityOutput<T extends CapabilityOutputItem> {
  readonly clientId: string;
  readonly organizationId: string;
  readonly capability: Capability;
  readonly executionDomains: ReadonlyArray<ExecutionDomain>;
  readonly items: ReadonlyArray<T>;
  readonly producedAt: Date;

  constructor(props: CapabilityOutputProps<T>) {
    this.clientId = props.clientId;
    this.organizationId = props.organizationId;
    this.capability = props.capability;
    this.executionDomains = [...props.executionDomains];
    this.items = [...props.items];
    // Caller-supplied timestamp is used exactly when present; otherwise fall
    // back to the wall clock for backward compatibility. `??` (not `||`) so a
    // caller's timestamp is never second-guessed.
    this.producedAt = props.producedAt ?? new Date();
  }
}
