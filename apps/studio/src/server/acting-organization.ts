import { headers } from 'next/headers';

import { readActingOrganizationCookie } from '@age/session-cookie';

import { organizationsThisConsoleServes } from './operator-environment';

/**
 * **WHERE A PLATFORM OPERATOR ASKED TO STAND** — ADR-0085.
 *
 * 🛑 **THE COOKIE IS THE QUESTION, AND THIS FILE IS THE ANSWER.** The browser
 * offers a value; this module compares it against the closed set the HOST
 * configured and returns the value only if it is IN that set. So the cookie
 * cannot name an organization this console does not serve, and editing it
 * cannot reach one. ⚠️ The check runs on **every request** — there is no
 * cached, resolved "current organization" anywhere for a later change to trust.
 *
 * 🚫 **IT GRANTS NOTHING, AND IT IS NOT REACHED BY A TENANT OPERATOR.** A
 * tenant session already carries the one organization it speaks for, straight
 * from its row; this is consulted only on the platform arm, where there is no
 * organization on the principal at all and the operator has to say which one
 * they meant.
 *
 * ⚠️ **READING REQUEST HEADERS IS NOT A PROCESS EFFECT** — the same note as
 * `session-boundary.ts`. `headers()` is the inbound request, not the machine.
 */
export async function chosenActingOrganization(): Promise<string | undefined> {
  const requestHeaders = await headers();
  const offered = readActingOrganizationCookie(requestHeaders.get('cookie') ?? undefined);

  // ⚠️ 🚫 NO CHOICE IS NOT A DEFAULT. An operator who has not chosen is sent to
  // the picker, 🚫 never quietly placed somewhere.
  if (offered === undefined) return undefined;

  // 🛑 **THE ONE LINE THAT MAKES THE COOKIE HARMLESS.** 🚫 Do not replace this
  // with a shape check, a length check, or "it looks like one of ours" — those
  // all say YES to a value the host never configured.
  //
  // 🛑 **AGAINST `id`, AND 🚫 NEVER AGAINST `displayName`** (ADR-0086). The
  // label is text a host wrote for a person to read; matching on it would make
  // it a second identifier, and an organization with two names is an
  // organization whose scope depends on which one a caller happened to use.
  const served = organizationsThisConsoleServes().some(
    (organization) => organization.id === offered,
  );

  return served ? offered : undefined;
}
