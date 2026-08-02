/**
 * @age/operator-file-policy — where an operator-authored file carrying real
 * client data is allowed to live (ADR-0054 D2, applied again by D3).
 *
 * A pure guard. It performs no I/O, reads no clock, and consults neither the
 * filesystem nor the working directory: it decides about a STRING, and the
 * caller owns the read.
 *
 * ⚠️ It is a path policy, not a secrecy mechanism. It refuses a path inside the
 * working tree; it cannot stop an operator copying the file in afterwards. The
 * rule it enforces is "outside the repository", nothing broader.
 */

export {
  OperatorFilePathRefusedError,
  assertOperatorFilePathOutsideRepository,
} from './operator-file-path-policy';
