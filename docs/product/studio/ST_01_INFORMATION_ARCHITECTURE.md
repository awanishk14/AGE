# ST_01 — Information architecture and navigation

Status: **Proposed**. 🚫 Authorizes no code.

---

## 1. The three levels

AGE Studio has exactly three navigation levels. The level a screen sits at determines what scope it
may assume, and 🚫 a screen may never assume a scope its level does not carry.

| Level        | Scope in hand                                  | Screens                                                                                                |
| ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Console**  | none                                           | Login, Dashboard, Diagnostics                                                                          |
| **Business** | a `clientId` chosen from resolved records      | Businesses, Business Profile                                                                           |
| **Subject**  | that `clientId` + its derived `organizationId` | Discovery, BIF, Knowledge Graph, Evidence, Contradictions, Strategy, Peer Products, Execution, History |

⚠️ **The subject level is entered by selecting a business, never by typing an id, and never by a URL
that carries a scope the operator did not select from resolved records.** A deep link to
`/b/<clientId>/bif` must re-resolve that id through `@age/client-registry` and **refuse** if it is
unknown — 🚫 it must not render an empty BIF for an id nobody recognised.

## 2. The tree

```
AGE Studio
├── (L0)  Login                          — 🛑 blocked: no identity exists (ADR-0058 D2)
├── (S1)  Dashboard                        /
├── (S2)  Businesses                       /businesses
│           └── Organizations              — a derived band ON this screen. 🚫 NOT a route (ADR-0058 D4)
├── (S3)  Business Profile                 /b/[clientId]
│           ├── (S4)  Discovery            /b/[clientId]/discovery
│           ├── (S5)  Business Intelligence File   /b/[clientId]/bif
│           ├── (S6)  Evidence Timeline    /b/[clientId]/evidence
│           ├── (S7)  Contradictions       /b/[clientId]/contradictions
│           ├── (S8)  Knowledge Graph      /b/[clientId]/graph
│           ├── (S9)  Strategy             /b/[clientId]/strategy
│           ├── (S10) Execution            /b/[clientId]/execution
│           ├── (S11) History & Comparison /b/[clientId]/history
│           └── (S12) Peer Products        /b/[clientId]/peer-products
│                     ├── RankOps widget   — read-only, links out
│                     └── MCP Ads widget   — read-only, links out
└── (S13) Diagnostics                      /diagnostics
```

⚠️ **This supersedes the flat route set shipped in #229.** `@age/studio-shell`'s `STUDIO_AREAS`
currently declares twelve flat routes (`/discovery`, `/bif`, …) with no business in the path. That
was correct for a shell wired to nothing; it is wrong for a product where every subject screen is
_about_ a business. 🚫 The migration is not free — see `ST_06` §3 item 1.

## 3. What is refused as an area, and why

🚫 These are not "not built yet". They are **refused**, and a screen that wants one is a screen with a
design error:

| Refused                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organizations** as a route | `organizationId` has no aggregate and 🚫 **no place where it may be typed** — `--organization-id` is refused by name (ADR-0054 D2). A level you can navigate _into_ is a level you can _select_, and a selectable scope is a typed scope. It is a **derived grouping band** on S2 (ADR-0058 D4). ⚠️ An organization with no client records is not an empty organization — it is **not a thing**, and must not render as a heading with nothing under it. |
| **Settings**                 | There is nothing to configure that is not either an operator-file path (which is never defaulted, ADR-0054 D2) or a policy that must not be configurable (OX-INV-1 admits no override). A Settings screen is where a refusal goes to become a checkbox.                                                                                                                                                                                                  |
| **Administration**           | Implies role and permission management over a multi-user product. There is no identity (ADR-0058 D2) and the console is read-only.                                                                                                                                                                                                                                                                                                                       |
| **A global search**          | Would need an index across scopes the entitlement layer does not yet bound. It returns after ADR-0058's successor.                                                                                                                                                                                                                                                                                                                                       |

⚠️ **The owner's journey asks for organization creation, member invites, roles, permissions,
subscriptions and usage** (step 3). Every one of those is a **write** to a **tenant model that does
not exist**, gated behind an **identity that does not exist**, on a console that is **strictly
read-only** by the owner's own earlier answer. `ST_06` §4 treats this as the single largest decision
in the set. 🚫 It is not resolved here and must not be built by increments.

## 4. Persistent chrome

Present on every screen, at every level:

1. **The System Status indicator** (ADR-0058 D6) — per-subsystem, two facts each: _does it exist_ and
   _is Studio wired to it_. 🚫 Identity is never green. 🚫 "Last onboarding: Never" is never shown;
   it reads **"Not read"** until something has actually read the capture store.
2. **The scope line** — the current `clientId` and its derived `organizationId`, or the words
   **"No business selected"**. 🚫 Never a blank, never a placeholder name.
3. **The trust banner** — _"Read-only · local operator console · no authenticated identity · access
   is limited by the loopback bind only."_ 🚫 It does not disappear on scroll and 🚫 it is not
   dismissible, because the condition it describes does not go away.

## 5. Deep links, refresh and resume

- Every subject route is **bookmarkable** and re-resolves its `clientId` on load.
- 🚫 An unresolvable id **refuses by position**, naming neither the record's contents nor the other
  clients' ids (ADR-0054 D3).
- Discovery **resumes** (the owner asked for it). ⚠️ Resume state is answer-file state; it is the
  operator's own file and 🚫 it is never written by the console under the read-only answer. See
  `ST_06` §4.
