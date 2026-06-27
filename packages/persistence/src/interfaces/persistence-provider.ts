import type { UnitOfWork } from './unit-of-work';

/**
 * PersistenceProvider — the entry point to the persistence layer (e.g. a Prisma
 * provider). Interface only; no implementation.
 */
export interface PersistenceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  unitOfWork(): UnitOfWork;
}
