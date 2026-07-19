import type { BusinessDiscoveryQuestionnaire } from './questionnaire';

/**
 * DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE — the curated AGE discovery
 * questionnaire. A fixed, hand-authored definition (NOT generated, NOT a form
 * builder) whose sections map to the nine BIF-aligned `DiscoverySectionId`
 * themes and collectively cover the twelve discovery topics AGE onboarding
 * requires:
 *
 *   1. business identity            → business-identity
 *   2. industry & business model    → business-identity
 *   3. offerings / services         → offerings
 *   4. ICP / target customers       → customers-icp
 *   5. geography / markets served   → market-competition
 *   6. competitors                  → market-competition
 *   7. current marketing channels   → channels
 *   8. business goals               → goals-constraints
 *   9. growth constraints           → goals-constraints
 *  10. assets                       → assets
 *  11. brand positioning            → positioning-brand
 *  12. unknowns / assumptions       → evidence-assumptions
 *
 * `critical: true` questions produce a critical discovery gap when unsatisfied;
 * `satisfiedBy` lets structured profile data answer a question in place of a
 * free-text answer, keeping validation deterministic.
 */
export const DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE: BusinessDiscoveryQuestionnaire = {
  id: 'age-business-discovery',
  version: '2026.1',
  name: 'AGE Business Discovery',
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
          critical: true,
          kind: 'text',
          satisfiedBy: 'businessName',
        },
        {
          id: 'bi-industry',
          sectionId: 'business-identity',
          prompt: 'What industry does the business operate in?',
          required: true,
          critical: false,
          kind: 'text',
          satisfiedBy: 'industry',
        },
        {
          id: 'bi-model',
          sectionId: 'business-identity',
          prompt: 'What is the business model (how does it make money)?',
          required: true,
          critical: false,
          kind: 'longText',
          satisfiedBy: 'businessModel',
        },
      ],
    },
    {
      id: 'offerings',
      name: 'Offerings',
      questions: [
        {
          id: 'off-list',
          sectionId: 'offerings',
          prompt: 'What are the core products or services offered?',
          required: true,
          critical: true,
          kind: 'list',
          satisfiedBy: 'offerings',
        },
      ],
    },
    {
      id: 'customers-icp',
      name: 'Customers / ICP',
      questions: [
        {
          id: 'icp-segments',
          sectionId: 'customers-icp',
          prompt: 'Who are the target customers / ideal customer profiles?',
          required: true,
          critical: true,
          kind: 'list',
          satisfiedBy: 'segments',
        },
      ],
    },
    {
      id: 'market-competition',
      name: 'Market & Competition',
      questions: [
        {
          id: 'mkt-geographies',
          sectionId: 'market-competition',
          prompt: 'Which geographies / markets are served?',
          required: true,
          critical: false,
          kind: 'list',
          satisfiedBy: 'geographies',
        },
        {
          id: 'mkt-competitors',
          sectionId: 'market-competition',
          prompt: 'Who are the main competitors?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'competitors',
        },
      ],
    },
    {
      id: 'positioning-brand',
      name: 'Positioning & Brand',
      questions: [
        {
          id: 'brand-positioning',
          sectionId: 'positioning-brand',
          prompt: 'How is the brand positioned relative to alternatives?',
          required: false,
          critical: false,
          kind: 'longText',
          satisfiedBy: 'brandPositioning',
        },
      ],
    },
    {
      id: 'channels',
      name: 'Marketing Channels',
      questions: [
        {
          id: 'ch-current',
          sectionId: 'channels',
          prompt: 'Which marketing channels are currently in use?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'marketingChannels',
        },
      ],
    },
    {
      id: 'goals-constraints',
      name: 'Goals & Constraints',
      questions: [
        {
          id: 'gc-goals',
          sectionId: 'goals-constraints',
          prompt: 'What are the primary business goals?',
          required: true,
          critical: true,
          kind: 'list',
          satisfiedBy: 'goals',
        },
        {
          id: 'gc-constraints',
          sectionId: 'goals-constraints',
          prompt: 'What growth constraints or limitations exist?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'constraints',
        },
      ],
    },
    {
      id: 'assets',
      name: 'Assets',
      questions: [
        {
          id: 'as-available',
          sectionId: 'assets',
          prompt: 'What marketing assets are available (lists, content, audiences)?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'assets',
        },
      ],
    },
    {
      id: 'evidence-assumptions',
      name: 'Evidence & Assumptions',
      questions: [
        {
          id: 'ev-sources',
          sectionId: 'evidence-assumptions',
          prompt: 'What evidence sources back the captured context?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'evidenceSources',
        },
        {
          id: 'ev-assumptions',
          sectionId: 'evidence-assumptions',
          prompt: 'What key assumptions or unknowns remain?',
          required: false,
          critical: false,
          kind: 'longText',
        },
      ],
    },
  ],
};
