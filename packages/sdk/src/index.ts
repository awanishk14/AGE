/**
 * @age/sdk — typed client SDK for the AGE API.
 *
 * Scaffold only. Client methods are intentionally not implemented yet.
 */
import { AGE_TYPES_PACKAGE } from '@age/types';

export const AGE_SDK_PACKAGE = '@age/sdk' as const;
export { AGE_TYPES_PACKAGE };

export * from './base';
export * from './auth';
export * from './config';
export * from './clients';
export * from './exceptions';
