import { z } from 'zod';

/** Placeholder Zod schema for the people domain. Fields added later. */
export const peopleSchema = z.object({});

export type PeopleSchema = z.infer<typeof peopleSchema>;
