/**
 * `@age/capture` — the capture CLI (ADR-0043 D2), Slice B1: the pure core only.
 *
 * WHAT SLICE B1 IS. Argument parsing and profile-document validation, and
 * nothing else. No `PrismaClient`, no composition root, no `node:fs`, no clock,
 * no `process`, no CI change. Every module here is a pure function over its
 * inputs, so the whole core is testable without a database and without a
 * filesystem.
 *
 * WHAT IS DELIBERATELY ABSENT. The entry point (Slice B2) owns the things that
 * touch the world: reading the profile file, minting `snapshotId`, reading the
 * capture instant (ADR-0043 D5 — the clock and the id source live in the entry
 * point and nowhere else), constructing the
 * `PrismaClient → PrismaScoredBifSnapshotScopeRunner →
 * ScopedScoredBifSnapshotRepository → ScoredBifSnapshotCaptureOrchestrator →
 * BusinessDiscoveryScoredBifCaptureOrchestrator` chain, printing, and exiting.
 *
 * There is no `bin` entry yet, on purpose: a package that can be executed but
 * whose executable half does not exist is worse than one that cannot.
 */

export { parseCaptureArguments } from './capture-arguments';
export type { CaptureCommand, ParsedCaptureArguments } from './capture-arguments';

export { parseBusinessDiscoveryProfileDocument } from './capture-profile-input';
export type { ParsedBusinessDiscoveryProfileDocument } from './capture-profile-input';
