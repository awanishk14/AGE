/** Lifecycle status of a Business Intelligence Framework. */
export enum BIFStatus {
  Draft = 'Draft',
  Active = 'Active',
  NeedsReview = 'NeedsReview',
}

/** The data type a BIF field carries. */
export enum FieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Array = 'array',
  Object = 'object',
  Enum = 'enum',
}

/** Where a field value originated. */
export enum FieldSource {
  USER = 'USER',
  WEBSITE = 'WEBSITE',
  GA4 = 'GA4',
  GSC = 'GSC',
  GOOGLE_ADS = 'GOOGLE_ADS',
  META_ADS = 'META_ADS',
  LINKEDIN = 'LINKEDIN',
  CRM = 'CRM',
  DOCUMENT = 'DOCUMENT',
  RESEARCH = 'RESEARCH',
  AI_INFERRED = 'AI_INFERRED',
}

/** How trustworthy a field value is. */
export enum FieldConfidence {
  USER_CONFIRMED = 'USER_CONFIRMED',
  EVIDENCE_VERIFIED = 'EVIDENCE_VERIFIED',
  AI_INFERRED = 'AI_INFERRED',
}
