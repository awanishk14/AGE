/** The capability category a strategy opportunity belongs to. */
export enum OpportunityCategory {
  SEO = 'SEO',
  AEO = 'AEO',
  GEO = 'GEO',
  CONTENT = 'CONTENT',
  GOOGLE_ADS = 'GOOGLE_ADS',
  META_ADS = 'META_ADS',
  LINKEDIN_ADS = 'LINKEDIN_ADS',
  LOCAL_SEO = 'LOCAL_SEO',
  CONVERSION = 'CONVERSION',
  EMAIL = 'EMAIL',
  AUTOMATION = 'AUTOMATION',
  TECHNICAL = 'TECHNICAL',
  BUSINESS = 'BUSINESS',
}

/** Priority band of an opportunity. */
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Horizon a roadmap item sits in. */
export enum RoadmapPhase {
  NOW = 'NOW',
  NEXT = 'NEXT',
  LATER = 'LATER',
  BLOCKED = 'BLOCKED',
}
