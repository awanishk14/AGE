import type { Repository } from '@age/shared';
import type { ReportingAggregate } from '../aggregates/reporting.aggregate';

/**
 * ReportingRepository — persistence port for the ReportingAggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ReportingRepository = Repository<ReportingAggregate>;
