/**
 * @age/integrations — third-party integration adapters for the AGE platform.
 *
 * Scaffold only. Each provider exposes the common IntegrationProvider contract.
 */
export const AGE_INTEGRATIONS_PACKAGE = '@age/integrations' as const;

export * from './common';
export * from './providers';
