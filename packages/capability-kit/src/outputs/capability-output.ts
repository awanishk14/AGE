import type { Capability } from '../enums/capability.enum';
import type { ExecutionDomain } from '../enums/execution-domain.enum';
import type { CapabilityOutputItem } from './capability-output-item';

interface CapabilityOutputProps<T extends CapabilityOutputItem> {
  clientId: string;
  organizationId: string;
  capability: Capability;
  executionDomains: ExecutionDomain[];
  items: T[];
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
    this.producedAt = new Date();
  }
}
