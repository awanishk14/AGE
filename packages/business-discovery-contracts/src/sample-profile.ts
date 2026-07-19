import type { BusinessDiscoveryProfile } from './business-discovery-profile';

/**
 * SAMPLE_BUSINESS_DISCOVERY_PROFILE — a realistic, fully-populated fixture for a
 * fictional business. Used by tests and (later slices) demos. Entirely generic
 * invented data — NO real client or private information. Deterministic:
 * `capturedAt` is a fixed, input-derived ISO timestamp (no wall-clock).
 *
 * It exercises every discovery concept — identity, industry, business model,
 * offerings, ICP/segments, geographies, competitors, marketing channels, goals,
 * constraints, assets, evidence sources, brand positioning, assumptions and
 * gaps — and satisfies every required question in the default questionnaire.
 */
export const SAMPLE_BUSINESS_DISCOVERY_PROFILE: BusinessDiscoveryProfile = {
  id: 'sample-business-discovery-profile',
  businessName: 'Northwind Ledger',
  industry: 'B2B SaaS — accounting software',
  businessModel: 'Per-seat monthly subscription with an annual plan discount',
  geographies: ['United States', 'Canada', 'United Kingdom'],
  marketingChannels: ['Organic search', 'Content marketing', 'Email', 'Partner referrals'],
  brandPositioning: 'The approachable accounting platform built for growing service businesses',

  sections: [
    {
      id: 'business-identity',
      name: 'Business Identity',
      questions: [
        {
          id: 'bi-name',
          sectionId: 'business-identity',
          prompt: 'What is the business name?',
          required: true,
          kind: 'text',
        },
      ],
      answers: [
        { questionId: 'bi-name', value: 'Northwind Ledger', evidenceSourceIds: ['ev-kickoff'] },
      ],
    },
  ],

  segments: [
    {
      id: 'seg-service-smb',
      name: 'Growing service SMBs',
      industry: 'Professional services',
      companySize: '10–50 employees',
      geography: 'North America',
      description: 'Owner-led firms that have outgrown spreadsheets but not yet enterprise ERP',
    },
    {
      id: 'seg-bookkeepers',
      name: 'Independent bookkeepers',
      companySize: '1–5 employees',
      description: 'Practitioners managing several small-business clients',
    },
  ],

  offerings: [
    {
      id: 'off-core',
      name: 'Ledger Core',
      type: 'service',
      description: 'Cloud bookkeeping, invoicing and reconciliation',
      valueProposition: 'Close the books in hours, not days',
    },
    {
      id: 'off-payroll',
      name: 'Ledger Payroll',
      type: 'service',
      description: 'Add-on payroll runs and filings',
      valueProposition: 'Run payroll without leaving your books',
    },
  ],

  competitors: [
    { id: 'comp-a', name: 'BooksBee', note: 'Incumbent aimed at micro-businesses' },
    { id: 'comp-b', name: 'AccuStack', note: 'Enterprise-leaning, higher price point' },
  ],

  goals: [
    { id: 'goal-mrr', statement: 'Grow MRR by 40% within the fiscal year', horizon: 'medium' },
    { id: 'goal-churn', statement: 'Reduce logo churn below 3% monthly', horizon: 'short' },
    { id: 'goal-uk', statement: 'Establish a foothold in the UK market', horizon: 'long' },
  ],

  constraints: [
    'Small marketing team (three people)',
    'Limited paid-acquisition budget',
    'No dedicated data analyst',
  ],

  assets: [
    'Newsletter list of 12,000 subscribers',
    'Library of 80 SEO blog articles',
    'Partner network of 40 accounting firms',
  ],

  evidenceSources: [
    { id: 'ev-kickoff', label: 'Discovery kickoff call', kind: 'client-statement' },
    {
      id: 'ev-deck',
      label: 'Company positioning deck',
      kind: 'document',
      locator: 'northwind-positioning-2026.pdf',
    },
    {
      id: 'ev-site',
      label: 'Marketing website',
      kind: 'url',
      locator: 'https://example.com/northwind-ledger',
    },
  ],

  assumptions: [
    { id: 'asm-buyer', statement: 'The primary buyer is the business owner', confidence: 'medium' },
    {
      id: 'asm-uk-fit',
      statement: 'Current feature set is sufficient for UK compliance',
      confidence: 'low',
    },
  ],

  gaps: [
    {
      id: 'gap-icp-budget',
      sectionId: 'customers-icp',
      missing: 'Typical software budget per segment',
      severity: 'important',
    },
    {
      id: 'gap-uk-competitors',
      sectionId: 'market-competition',
      missing: 'Named competitors in the UK market',
      severity: 'critical',
    },
  ],

  capturedAt: '2026-07-19T09:00:00.000Z',
};
