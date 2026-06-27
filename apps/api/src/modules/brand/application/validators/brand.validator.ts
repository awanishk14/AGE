import { z } from 'zod';

/** Placeholder Zod schema for the brand domain. Fields added later. */
export const brandSchema = z.object({});

export type BrandSchema = z.infer<typeof brandSchema>;
