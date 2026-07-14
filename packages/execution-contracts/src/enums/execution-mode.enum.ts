/**
 * ExecutionMode — how an execution is carried out.
 *
 * Only DRY_RUN exists in this slice. A real (side-effecting) mode is explicitly
 * out of scope and gated on a separate future ADR (ADR-0021).
 */
export enum ExecutionMode {
  DRY_RUN = 'dry_run',
}
