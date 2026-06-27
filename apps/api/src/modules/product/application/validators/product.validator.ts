import { z } from 'zod';

/** Placeholder Zod schema for the product domain. Fields added later. */
export const productSchema = z.object({});

export type ProductSchema = z.infer<typeof productSchema>;
