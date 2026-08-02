/**
 * ⚠️ The path rule is NOT implemented here. It lives in
 * `@age/operator-file-policy` because ADR-0054 D3 puts a second kind of file
 * behind the same rule, and two copies of one fail-closed rule drift silently.
 * It is re-exported so a caller of this package still reaches the refusal.
 */
export {
  OperatorFilePathRefusedError,
  assertOperatorFilePathOutsideRepository,
} from '@age/operator-file-policy';
export { DiscoveryAnswerFileError, parseDiscoveryAnswerFile } from './parse-discovery-answer-file';
export { loadDiscoveryAnswerFile } from './load-discovery-answer-file';
export type {
  AnswerFileReader,
  LoadDiscoveryAnswerFileOptions,
} from './load-discovery-answer-file';
