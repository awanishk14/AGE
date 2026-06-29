import type { Capability } from '../enums/capability.enum';

export class CapabilityError extends Error {
  constructor(
    message: string,
    readonly capability: Capability,
  ) {
    super(message);
    this.name = 'CapabilityError';
  }
}
