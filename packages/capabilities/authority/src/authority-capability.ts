import type { ClientContext } from '@age/capability-kit';
import type { AuthorityInput } from '@age/authority-contracts';
import type { AuthorityResult } from './authority-result';
import { processAuthority } from './processing/process-authority';

/**
 * AuthorityCapability — produces authority plan candidates (content-strategy,
 * thought-leadership, digital-PR, backlink, review, video, podcast plays) from
 * an in-memory AuthorityInput.
 *
 * Pure producer: reads an input contract, produces an AuthorityResult. Never
 * executes, never persists, never performs side effects. Depends only on
 * @age/capability-kit and @age/authority-contracts (ADR-0017) — never on Market
 * Discovery, Growth, SIE, BIF, BKG, or RIE.
 *
 * Authority rule: the produced CapabilityOutput is scoped by ClientContext, not
 * by the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * The full deterministic pipeline (derive → validate → deduplicate →
 * score/prioritize → assemble) lives in processAuthority (T29); `run()` only
 * delegates to it and adds no behavior of its own.
 */
export class AuthorityCapability {
  async run(context: ClientContext, input: AuthorityInput): Promise<AuthorityResult> {
    return processAuthority(context, input);
  }
}
