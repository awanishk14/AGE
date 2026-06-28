/**
 * ScoreDimension — the dimensions a PriorityScore is composed of.
 * Definitions only; no weights or formulas are defined here.
 */
export enum ScoreDimension {
  BusinessImpact = 'businessImpact',
  RevenueImpact = 'revenueImpact',
  MarketingImpact = 'marketingImpact',
  CustomerImpact = 'customerImpact',
  TechnicalImpact = 'technicalImpact',
  Risk = 'risk',
  Urgency = 'urgency',
  Effort = 'effort',
  OverallScore = 'overallScore',
}
