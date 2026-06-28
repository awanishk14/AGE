import type { RoadmapPhase } from '../types/enums';

/** A single item on the strategy roadmap. */
export interface RoadmapItem {
  readonly title: string;
  readonly description: string;
  readonly phase: RoadmapPhase;
  readonly owner: string;
  readonly estimatedDuration: string;
  readonly dependencies: readonly string[];
  readonly successMetrics: readonly string[];
}
