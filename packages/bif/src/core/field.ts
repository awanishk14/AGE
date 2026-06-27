import type { FieldConfidence, FieldSource, FieldType } from './enums';

/**
 * A single historical version of a field value.
 *
 * BIF is a living, versioned model: every change to a field appends a
 * FieldVersion so provenance and history are never lost.
 */
export interface FieldVersion<TValue = unknown> {
  readonly value: TValue;
  readonly timestamp: Date;
  readonly source: FieldSource;
  readonly confidence: FieldConfidence;
  readonly changedBy: string;
  readonly reason?: string;
}

/**
 * BIFField — the atomic unit of the Business Intelligence Framework.
 *
 * Every field carries its value plus provenance: where it came from (source),
 * how trustworthy it is (confidence), when it was last verified, and its full
 * change history.
 */
export interface BIFField<TValue = unknown> {
  readonly key: string;
  readonly value: TValue;
  readonly type: FieldType;
  readonly required: boolean;
  readonly source: FieldSource;
  readonly confidence: FieldConfidence;
  readonly lastVerifiedAt: Date;
  readonly history: readonly FieldVersion<TValue>[];
}

/**
 * BIFFieldDefinition — the static schema of a field within a section
 * (its key, expected type and whether it is required). Definitions describe the
 * shape of the framework; BIFField instances hold actual values.
 */
export interface BIFFieldDefinition {
  readonly key: string;
  readonly type: FieldType;
  readonly required: boolean;
}
