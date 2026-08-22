import type { SessionPrincipal } from '@age/session-store';

import {
  readDirectoryEntryByAccount,
  readPlatformDirectoryEntryByAccount,
} from './operator-environment';

/**
 * **WHO IS SIGNED IN, FOR DISPLAY ONLY.**
 *
 * 🛑 **THIS IS NOT A BOUNDARY AND MUST NEVER BECOME ONE.** Its only caller is
 * the root layout, which `assessRequestSession()` deliberately allows to REPORT
 * rather than redirect (ADR-0074 §7 slice 2) — a layout that redirected would
 * also redirect `/sign-in`, and the door cannot stand behind itself. So every
 * failure here returns `undefined` and 🚫 nothing here ever calls `redirect`.
 *
 * 🚫 **AND IT AUTHORIZES NOTHING.** It answers *"whose address is this?"*, 🚫 not
 * *"what may they reach?"* — the second question is `requireRequestScope()`'s,
 * over capability atoms, and it is asked on the ROUTE where
 * `route-protection.test.ts` can see it. An address rendered in a sidebar is a
 * label; a caller that read a permission out of it would be reading a scope out
 * of a name.
 *
 * ⚠️ **THE READ DIFFERS BY PRINCIPAL, AND THAT IS ADR-0082 D4, NOT A DETAIL.** A
 * platform principal has 🚫 no organization, so it CANNOT be looked up within
 * one; it uses the account-keyed platform read, fenced by the ADR-0089 RLS
 * policy. 🚫 There is no `organizationId ?? …` here and there must never be —
 * that substitution is exactly what D4 refuses.
 */
export interface SignedInIdentity {
  readonly email: string;
}

/**
 * The address on the account this session already proved, or `undefined`.
 *
 * ⚠️ **`undefined` IS A RENDERABLE ANSWER, 🚫 NOT AN ERROR TO REPORT.** The
 * sidebar shows the sign-out control either way: an operator who can act must
 * always be able to stop acting, whatever the directory said. 🚫 Never make the
 * control conditional on this succeeding.
 *
 * ⚠️ **THE ACCOUNT ID COMES FROM THE SESSION, 🚫 NEVER FROM A URL OR A HEADER.**
 * It is the id the boundary verified, so this read cannot be pointed at someone
 * else's account by anything the caller controls.
 *
 * @param principal the admitted principal. 🚫 A refused request never gets here.
 */
export async function signedInIdentity(
  principal: SessionPrincipal,
): Promise<SignedInIdentity | undefined> {
  // 🛑 THE `catch` IS DELIBERATE AND IS SCOPED TO A LABEL. A directory read that
  // fails must cost the operator their NAME in the corner, 🚫 not their console
  // and 🚫 not their way out of it. It is not a swallowed error in the sense the
  // house rules forbid: nothing downstream depends on the value, and the
  // failure is VISIBLE — the line simply is not there.
  try {
    const entry =
      principal.scope === 'platform'
        ? await readPlatformDirectoryEntryByAccount(principal.session.accountId)
        : await readDirectoryEntryByAccount(
            principal.session.organizationId,
            principal.session.accountId,
          );

    const email = entry.account?.email;

    // 🚫 An empty address is not an address. Rendering `''` would draw a label
    // that says nothing while claiming the read succeeded.
    return email === undefined || email.trim() === '' ? undefined : { email };
  } catch {
    return undefined;
  }
}
