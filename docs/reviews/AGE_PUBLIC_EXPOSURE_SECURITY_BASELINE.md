# AGE Studio — the security baseline at first public exposure

> **Tracked on purpose.** ⚠️ This is the state the console was in on the day it stopped being
> reachable only through an SSH tunnel. 🛑 **A later slice that makes any line here false has
> regressed the product**, whether or not a test noticed. 🚫 Do not edit an entry to match a change;
> add a dated entry saying what changed and under which ADR.
>
> Recorded 2026-08-16, ADR-0074 §7 slice 4. ⚠️ Every fact below was **measured on the real VPS or in
> a real browser**, 🚫 never inferred from source alone. Where something was verified only by a unit
> test, it says so.

---

## 1. The boundary, in one line

```
Internet → Cloudflare → HTTPS → nginx (this box) → 127.0.0.1:3100 → verified session → Studio
```

- 🛑 **The console binds `127.0.0.1:3100` and nothing else.** OX-INV-1 (ADR-0057 D2) is UNAMENDED by
  the public bind; the proxy reaches it, the internet does not.
- 🛑 **The proxy is not the authentication and must never become it.** There is no `auth_basic`, no
  `auth_request`, no IP allow-list. The boundary is the session row checked on every request
  (ADR-0074 slice 2).
- 🛑 **AGE's database is published on `127.0.0.1:5442` only** (ADR-0075). 🚫 Nothing peer-related is
  exposed by AGE, in either direction.

## 2. Findings from the pre-exposure audit, and their disposition

⚠️ Severity is stated as measured, 🚫 not as feared. "Fixed" means fixed **and re-checked on the
box**.

| #   | Severity   | Finding                                                                                                                                      | Disposition                                                                                                                                                |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **HIGH**   | `next@15.5.19` carried 8 advisories, including a Server Action DoS and unauthenticated disclosure of internal Server Function endpoints      | **FIXED** — #351, `next@15.5.23`                                                                                                                           |
| 2   | **HIGH**   | The service ran as an account holding `(ALL) NOPASSWD: ALL`, on a host shared with four peer products, with **no systemd sandboxing at all** | **FIXED** — #352: `NoNewPrivileges`, `IPAddressDeny=any` + loopback only, `ProtectSystem=strict`, `ReadWritePaths` naming two paths                        |
| 3   | **MEDIUM** | The host process could route to six Docker bridge networks carrying peer stores                                                              | **FIXED** — `IPAddressDeny=any`; a bridge connect is **denied**, measured                                                                                  |
| 4   | **MEDIUM** | A peer store is published on `127.0.0.1:5432`, which loopback rules cannot exclude                                                           | ⏸️ **OPEN — ADR-0076 `Proposed`.** Reachable at TCP level; the server answers **SCRAM-SHA-256**, and no peer credential is readable by the service account |
| 5   | **MEDIUM** | No security headers on the origin                                                                                                            | **FIXED** — the vhost, §3 below                                                                                                                            |
| 6   | **MEDIUM** | No rate limiting on `/sign-in/submit`; 20 bad attempts all answered normally                                                                 | ⏸️ **OPEN** — its own slice (Phase 6C). ⚠️ Recorded so it is not mistaken for absent                                                                       |
| 7   | **LOW**    | A malformed POST body to `/sign-in/submit` produced a **500** (unguarded `formData()`)                                                       | **FIXED** — collapses into the same `refused=1`                                                                                                            |
| 8   | **LOW**    | `sharp@0.34.5` (libvips CVEs) is pinned by next and not separately upgradable                                                                | **MITIGATED** — nothing imports `next/image`; `/_next/image` is denied at the proxy                                                                        |
| 9   | **INFO**   | `X-Powered-By: Next.js` disclosed the framework                                                                                              | **FIXED** — `proxy_hide_header`                                                                                                                            |

### Checked and found clean (🚫 not "not tested")

No CORS headers anywhere · no secrets in `.next/static` · no source maps served · no path traversal
via encoded segments · non-allow-listed methods answer **405** · an RSC fetch on a protected route
returns only `NEXT_REDIRECT`, 🚫 no business data · no Host-header open redirect · AGE's database on
`127.0.0.1:5442` only · the operator's data directory is `drwx------` · env files root-owned `0600`.

## 3. The headers the origin sets, always

`Strict-Transport-Security` (1 year, includeSubDomains) · `X-Content-Type-Options: nosniff` ·
`X-Frame-Options: DENY` · `Referrer-Policy: no-referrer` · `Permissions-Policy` ·
`Cross-Origin-Opener-Policy` · `Cross-Origin-Resource-Policy` · a CSP with `frame-ancestors 'none'`,
`form-action 'self'`, `object-src 'none'`, `base-uri 'self'`.

⚠️ **`script-src` CARRIES `'unsafe-inline'`, AND THAT IS A RECORDED WEAKNESS, 🚫 NOT AN OVERSIGHT.**
Next streams its RSC payload as nonce-less inline `<script>` blocks; a strict `script-src` blanks
every page. Closing it needs nonce-issuing middleware in `apps/studio`, which changes how requests
reach the session boundary and therefore needs its own slice. 🚫 Do not "fix" it by deleting the
token.

⚠️ **`always` is on every header on purpose** — without it nginx omits them from 4xx and 5xx, which
are the responses an attacker works hardest to provoke.

## 4. The session properties that must not regress

- `__Host-age_session`: **HttpOnly, Secure, SameSite=Strict, Path=/**, with a lifetime ceiling —
  defined in **exactly one place**, `serializeSessionCookie`.
- 🛑 **Verification is not issuance.** `age_app` holds `GRANT SELECT` plus `GRANT UPDATE
("revoked_at")` and 🚫 no INSERT, so no defect in the sign-in path can become an issuance path.
- 🛑 **Logout writes `revoked_at`.** Clearing a cookie is not logout.
- 🛑 **Every refusal is the same refusal**: `?refused=1` for a wrong token, a revoked token, a
  cross-organization token, a garbage string and a malformed body alike. 🚫 The five internal reasons
  are collapsed on the way OUT, and only there.
- 🛑 **AGE-INV-SEL-1**: selection narrows and never widens. A forged `clientId` is a no-op; "not
  yours" and "no such business" are the SAME opaque refusal — verified byte-for-byte on the box
  (identical length, identical sorted RSC chunk digests; the only difference was streaming order).

## 5. What is deliberately still open

1. **ADR-0076 (`Proposed`)** — the loopback residue in finding 4. 🚫 Not self-accepted; it is a
   decision request.
2. **Rate limiting on sign-in** (finding 6) — its own slice.
3. **A strict `script-src`** — needs nonce middleware and its own slice.
4. 🛑 **Nothing here discharges ADR-0055 D7**, and 🛑 **RLS remains coherence, never authorization**
   (ADR-0046 D5).
