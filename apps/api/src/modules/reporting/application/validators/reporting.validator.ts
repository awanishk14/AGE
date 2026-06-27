import { z } from 'zod';

/** Placeholder Zod schema for the reporting domain. Fields added later. */
export const reportingSchema = z.object({});

export type ReportingSchema = z.infer<typeof reportingSchema>;
