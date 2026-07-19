import { z } from 'zod';
import { goalHorizonSchema, type GoalHorizon } from './enums';

/**
 * BusinessGoal — a stated outcome the business wants (revenue, growth,
 * positioning). Captured as a statement plus an optional time horizon; discovery
 * does not generate goals, it only records them.
 */
export interface BusinessGoal {
  readonly id: string;
  readonly statement: string;
  readonly horizon?: GoalHorizon;
}

export const businessGoalSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  horizon: goalHorizonSchema.optional(),
});
