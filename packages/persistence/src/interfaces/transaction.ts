/**
 * Transaction — a unit of atomic work. Interface only; no implementation.
 */
export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
