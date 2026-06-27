import { OrganizationModule } from './organization/organization.module';
import { PeopleModule } from './people/people.module';
import { BrandModule } from './brand/brand.module';
import { ProductModule } from './product/product.module';
import { ServiceModule } from './service/service.module';
import { MarketModule } from './market/market.module';
import { IcpModule } from './icp/icp.module';
import { CompetitorModule } from './competitor/competitor.module';
import { StrategyModule } from './strategy/strategy.module';
import { ResearchModule } from './research/research.module';
import { EvidenceModule } from './evidence/evidence.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { CampaignModule } from './campaign/campaign.module';
import { ContentModule } from './content/content.module';
import { ProjectModule } from './project/project.module';
import { DecisionModule } from './decision/decision.module';
import { IntegrationModule } from './integration/integration.module';
import { ReportingModule } from './reporting/reporting.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ProblemModule } from './problem/problem.module';

export * from './organization';
export * from './people';
export * from './brand';
export * from './product';
export * from './service';
export * from './market';
export * from './icp';
export * from './competitor';
export * from './strategy';
export * from './research';
export * from './evidence';
export * from './knowledge';
export * from './campaign';
export * from './content';
export * from './project';
export * from './decision';
export * from './integration';
export * from './reporting';
export * from './workflow';
export * from './problem';

/**
 * DOMAIN_MODULES — every AGE domain module, registered in the modular monolith.
 * Extracting a module into a microservice later only requires moving the folder.
 */
export const DOMAIN_MODULES = [
  OrganizationModule,
  PeopleModule,
  BrandModule,
  ProductModule,
  ServiceModule,
  MarketModule,
  IcpModule,
  CompetitorModule,
  StrategyModule,
  ResearchModule,
  EvidenceModule,
  KnowledgeModule,
  CampaignModule,
  ContentModule,
  ProjectModule,
  DecisionModule,
  IntegrationModule,
  ReportingModule,
  WorkflowModule,
  ProblemModule,
];
