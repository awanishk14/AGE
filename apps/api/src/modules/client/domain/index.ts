export { ClientAggregate } from './aggregates';
export type { ClientRepository } from './repositories';
export { ClientLifecycleState } from './types';
export type { ClientProps, CreateClientProps } from './types';
export {
  ClientCreated,
  ClientActivated,
  ClientPaused,
  ClientOffboarding,
  ClientArchived,
} from './events';
export { ClientName, ClientSlug } from './value-objects';
