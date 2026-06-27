import type { BusinessGraph } from './business-graph';

/**
 * BusinessQuery — a named, typed question asked of the graph. Interface only;
 * no traversal or execution logic is implemented here.
 */
export interface BusinessQuery<TResult> {
  readonly name: string;
  execute(graph: BusinessGraph): TResult;
}
