import { EvidenceSource } from '../types/enums';

/**
 * MVP_SOURCES — the sources targeted for the first RIE iteration.
 * Definitions only; concrete adapters are implemented later (no scraping here).
 */
export const MVP_SOURCES: readonly EvidenceSource[] = [
  EvidenceSource.REDDIT,
  EvidenceSource.G2,
  EvidenceSource.COMPETITOR_SITE,
  EvidenceSource.GOOGLE_SEARCH,
  EvidenceSource.YOUTUBE,
];
