import type { Transaction } from './transaction';
import type { RepositoryFactory } from './repository-factory';

/**
 * UnitOfWork — coordinates repositories within a single transaction.
 * Interface only; no implementation.
 */
export interface UnitOfWork {
  readonly repositories: RepositoryFactory;
  begin(): Promise<Transaction>;
}
