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
        // ADR-0051 D1/D2 — one question per `OfferingKind`, because the kind is
        // pinned by the AUTHOR here and never read out of the operator's prose.
        // The single "products or services" question it replaces could not
        // produce an `Offering` at all: `Offering.type` is required and its
        // answer does not contain it, so every answers-built profile had
        // `offerings: []` and `products_services` was always omitted.
        //
        // ⚠️ Do NOT collapse these back into one question and ask the operator
        // "products or services?". That applies a whole-business answer to every
        // entry, and a business selling both has no honest answer to give.
        {
          id: 'off-products',
          sectionId: 'offerings',
          prompt: 'Which products does the business sell? List them by name.',
          required: true,
          critical: true,
          kind: 'list',
          satisfiedBy: 'offerings',
          entryKind: 'product',
        },
        {
          id: 'off-services',
          sectionId: 'offerings',
          prompt: 'Which services does the business provide? List them by name.',
          required: true,
          critical: true,
          kind: 'list',
          satisfiedBy: 'offerings',
          entryKind: 'service',
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
        // ADR-0051 D1/D3 — one question per `EvidenceSourceKind`, for the same
        // reason as offerings above. This is what lifts `evidenceSources` off
        // empty, and therefore what lifts `noEvidenceCap: 35` — by making the
        // evidence real, never by relaxing the cap.
        //
        // ⚠️ A 'url' answer is a plain reference string. It is recorded and
        // never fetched; nothing here performs or authorizes retrieval.
        {
          id: 'ev-documents',
          sectionId: 'evidence-assumptions',
          prompt: 'Which documents back the captured context? List them by title.',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'evidenceSources',
          entryKind: 'document',
        },
        {
          id: 'ev-urls',
          sectionId: 'evidence-assumptions',
          prompt: 'Which web references back the captured context? List their addresses.',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'evidenceSources',
          entryKind: 'url',
        },
        {
          id: 'ev-statements',
          sectionId: 'evidence-assumptions',
          prompt: 'Which statements from the client back the captured context?',
          required: false,
          critical: false,
          kind: 'list',
          satisfiedBy: 'evidenceSources',
          entryKind: 'client-statement',
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
