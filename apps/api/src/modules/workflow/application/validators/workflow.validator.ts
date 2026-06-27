import { z } from 'zod';

/** Placeholder Zod schema for the workflow domain. Fields added later. */
export const workflowSchema = z.object({});

export type WorkflowSchema = z.infer<typeof workflowSchema>;
