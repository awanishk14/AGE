import type { OrganizationPersistenceRepository } from '../repositories/organization.repository';
import type { StrategyPersistenceRepository } from '../repositories/strategy.repository';
import type { ResearchPersistenceRepository } from '../repositories/research.repository';
import type { DecisionPersistenceRepository } from '../repositories/decision.repository';
import type { CampaignPersistenceRepository } from '../repositories/campaign.repository';
import type { ProjectPersistenceRepository } from '../repositories/project.repository';
import type { ContentPersistenceRepository } from '../repositories/content.repository';
import type { EvidencePersistenceRepository } from '../repositories/evidence.repository';
import type { ProblemPersistenceRepository } from '../repositories/problem.repository';
import type { OpportunityPersistenceRepository } from '../repositories/opportunity.repository';

/**
 * RepositoryFactory — resolves the persistence repository for each aggregate.
 * Interface only; no implementation.
 */
export interface RepositoryFactory {
  organization(): OrganizationPersistenceRepository;
  strategy(): StrategyPersistenceRepository;
  research(): ResearchPersistenceRepository;
  decision(): DecisionPersistenceRepository;
  campaign(): CampaignPersistenceRepository;
  project(): ProjectPersistenceRepository;
  content(): ContentPersistenceRepository;
  evidence(): EvidencePersistenceRepository;
  problem(): ProblemPersistenceRepository;
  opportunity(): OpportunityPersistenceRepository;
}
