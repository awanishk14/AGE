# ADR-0084 checkpoint — the hop that loses the session

> Evidence for **ADR-0084**, Accepted 2026-08-20 (Option B only). Append-only; 🚫 never renumber a
> section, 🚫 never rewrite one to match a later belief. Each section records **what was measured,
> where, and what it did NOT prove.**

---

## 1. Slice 1 — the measurement, 2026-08-20

🛑 **SLICE 1 WAS A MEASUREMENT AND 🚫 NOT A FIX** (ADR-0084 §6.1). Its purpose was to decide whether
§1 of the ADR describes the real defect, and it was empowered to **withdraw the ADR despite the
owner having accepted it**.

**Result: §1 is CONFIRMED. The ADR is 🚫 not withdrawn, and slice 2 (Option B) may proceed.**

### 1.1 What was captured, and by whom

A **browser HAR**, exported by the **owner** from the deployed console at
`https://age.digitaldadi.agency` — ⚠️ an **owner act**; 🚫 the architect never signs in as them.
44 entries: **three** complete sign-in attempts plus **one** hand-typed navigation, one sitting.

🚫 **The HAR is not committed and never will be.** It carries Google OAuth `code` values and the
operator's identity. ⚠️ It was parsed locally, and only presence/absence and non-secret headers were
recorded below — 🚫 no cookie value, 🚫 no token, 🚫 no address appears in this file.

### 1.2 The chain, observed three times identically

```
POST /sign-in/start              303  ->  accounts.google.com
GET  accounts.google.com/...     302
GET  /sign-in/callback?state=... 303   Location: /
                                       sec-fetch-site: cross-site
                                       referer: https://accounts.google.com/
GET  /                           307   Location: /sign-in          <-- ANONYMOUS
GET  /sign-in                    200
```

⚠️ `/sign-in` — 🚫 **with no `?refused=` parameter at all.** To the operator this is
indistinguishable from never having signed in, exactly as ADR-0084 §0 states.

### 1.3 🛑 THE FINDING — a differential, 🚫 not a single reading

The same HAR contains a **fourth** request to `/`, made moments later, when the owner typed the URL
by hand. It is the control:

| Entry(s)     | Request                         | `sec-fetch-site` | Response                                    |
| ------------ | ------------------------------- | ---------------- | ------------------------------------------- |
| `11, 25, 42` | `GET /`, reached via the `303`  | **`cross-site`** | `307` → `/sign-in` — **no reason string**   |
| `27`         | `GET /`, URL typed into the bar | **`none`**       | `307` → `/sign-in?refused=scope-not-served` |

**Same URL. Same browser. Same cookie jar. Seconds apart. Opposite outcomes.** The only variable is
how the navigation was initiated.

🛑 **ENTRY 27 IS THE PROOF.** `refused=scope-not-served` is produced **only** by
`session-boundary.ts:112`, which is reached **only** by a request that carried a session cookie, had
it verified against a live `operator_sessions` row, and was identified as a **platform principal**
(ADR-0083). A request without a cookie cannot produce that marker — it produces the bare `/sign-in`
seen in entries 11/25/42.

**Therefore the cookie was present in the jar and verifiable throughout.** 🛑 **It is WITHHELD on the
post-callback hop, 🚫 it is not missing, and 🚫 nothing is wrong with issuance.** The browser labels
that hop `cross-site` in its own request header — precisely the condition under which a
`SameSite=Strict` cookie is not sent. That is ADR-0084 §1, mechanism and all.

### 1.4 ⚠️ THE LIMIT ON THIS EVIDENCE — 🚫 do not restate it as more than it is

🛑 **NOBODY HAS DIRECTLY READ THE ABSENCE OF `__Host-age_session` ON THAT HOP.**

The HAR was exported **sanitized** (Chrome's default). Verified rather than assumed: the file
contains **zero** `Cookie` request headers and **zero** `Set-Cookie` response headers **anywhere** —
including on the `accounts.google.com` entries, which certainly carry them, and on the callback
response, which the source proves sets one. The exporter stripped them.

⚠️ **The conclusion in §1.3 is an INFERENCE** — from differential outcome plus the browser's own
`sec-fetch-site` labelling — 🚫 not a direct header observation. It is strong; it is still an
inference. **A later reader must 🚫 not cite §1.3 as a direct reading.**

**What would close it**, and it costs one click: in DevTools → Network → the `307 /` row → **Headers
→ Request Headers**, record whether a `Cookie:` header is present. 🚫 Never record its value — it is
a live credential. ⚠️ Do it in a **clean incognito window**, or a pre-existing cookie makes a
"present" result meaningless.

### 1.5 What this did 🚫 NOT prove

- 🚫 It did not prove anything about **Option B working**. That is slice 3, and it is a **browser**
  gate — 🚫 not CI, 🚫 not `curl`, 🚫 not a route test.
- 🚫 It did not test any browser but the owner's. ⚠️ The site-for-cookies computation is a browser
  behaviour; a second engine has not been observed.
- 🚫 It says nothing about session issuance, revocation or the 8-hour ceiling — all were correct
  throughout, and ADR-0084 §5 forbids touching them.

### 1.6 Two side findings — 🚫 NEITHER belongs to ADR-0084

- **Three attempts, three session rows minted**, from one person in one sitting. ⚠️ This is the
  second observation of the behaviour ADR-0084 §3 gives as its reason for rejecting Option C: a
  failure that looks like success trains operators to retry.
- **The deployed CSP blocked Cloudflare's `beacon.min.js`** (`script-src 'self' 'unsafe-inline'`) —
  ✅ the guard working as written. ⚠️ **A separate decision, unmade:** allow it deliberately, or
  disable the injection at the Cloudflare edge. 🚫 A permanent console error on every page load is
  the worst of the three, and 🚫 it must not be bundled into this ADR.

⚠️ A `share-modal.js` error in the same console came from a **browser extension** in the owner's
normal profile — 🚫 not from AGE, and 🚫 not evidence about the console.

### 1.7 The source facts this rests on, re-verified on `main` `4421ad4`

- `apps/studio/src/app/sign-in/callback/route.ts` — `new Headers({ Location: '/' })`, returned as
  `new Response(null, { status: 303, headers })`. ✅ Read from `main`, 🚫 not recalled.
- `packages/session-cookie/src/session-cookie.ts` — `SESSION_COOKIE_ATTRIBUTES` frozen as `Path=/`,
  `HttpOnly`, `Secure`, **`SameSite=Strict`**. ✅ Read from `main`.
- `packages/session-cookie/src/handshake-cookie.ts` states the browser rule in terms, for the
  handshake pair. ⚠️ **The reasoning was already correct and was applied one hop short of where it
  was needed.**
