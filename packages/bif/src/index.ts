/**
 * @age/bif — the Business Intelligence Framework (BIF).
 *
 * The canonical business model of AGE: a living, versioned representation of an
 * organization. Types, interfaces and Zod validators only — no business logic,
 * no API, no database, no persistence.
 */
export const AGE_BIF_PACKAGE = '@age/bif' as const;

export * from './core';
export * from './submodels';
export * from './sections';
