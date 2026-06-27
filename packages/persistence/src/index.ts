/**
 * @age/persistence — the persistence architecture for AGE.
 *
 * Architecture only: base fields, audit/version models, repository &
 * persistence interfaces, and placeholder mappers. No SQL, no Prisma models,
 * no migrations, no business logic.
 */
export const AGE_PERSISTENCE_PACKAGE = '@age/persistence' as const;

export * from './types';
export * from './interfaces';
export * from './repositories';
export * from './mappers';
export * from './database';
