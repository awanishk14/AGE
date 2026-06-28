import type { Polarity } from '../types/enums';

/** A single signal extracted from a normalized document. */
export interface ExtractedSignal {
  readonly type: string;
  readonly value: unknown;
  /** BIF field reference this signal targets. */
  readonly targetField: string;
  /** 0–100. */
  readonly strength: number;
  readonly polarity: Polarity;
}
