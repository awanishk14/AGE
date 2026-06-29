/**
 * ExecutionDomain — the channels / domains where work is executed.
 *
 * These answer "where will this be executed?" (CAPABILITY_ARCHITECTURE §2).
 * A StrategyOpportunity carries both a Capability (why) and ExecutionDomains[] (where).
 */
export enum ExecutionDomain {
  SEO = 'SEO',
  AEO = 'AEO',
  GEO = 'GEO',
  LocalSEO = 'LocalSEO',
  GoogleAds = 'GoogleAds',
  MetaAds = 'MetaAds',
  LinkedInAds = 'LinkedInAds',
  CRO = 'CRO',
  Content = 'Content',
  Email = 'Email',
  PR = 'PR',
  CRM = 'CRM',
  Reporting = 'Reporting',
  Automation = 'Automation',
  SSH = 'SSH',
  Publishing = 'Publishing',
}
