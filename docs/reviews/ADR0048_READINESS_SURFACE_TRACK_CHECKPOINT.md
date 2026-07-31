# ADR-0048 readiness-surface track — checkpoint

> Per-PR record for the track opened by ADR-0048 (which split ADR-0047 D8).
> **Append a section per merged PR.** The working-memory handover keeps pointers only.
>
> Track state: **D5 shipped (#179), D4 shipped (#181).** Next is **D3 step 4** — the readiness block
> on API + smoke. **D3's web step remains deferred**, though its D4 harness precondition is now met.

| PR   | SHA       | What                                                           | Kind                |
| ---- | --------- | -------------------------------------------------------------- | ------------------- |
| #177 | `dbeaa18` | ADR-0048 `Status: Proposed`                                    | docs                |
| #178 | `e037893` | ADR-0048 `Status: Accepted` (self-accepted under the §2 grant) | docs                |
| #179 | `a61f59e` | D5 — the published-item-surface guard                          | tests               |
| #180 | `168b5fa` | Standing-residuals extraction                                  | docs                |
| #181 | `3fca556` | D4 — a web rendering test that executes in `ci.yml`            | tests + test config |

---

## §1 — How the track was framed (#177, #178)

ADR-0047 D8 deferred readiness over API, web and smoke, and warned that readiness outputs carry
`clientId`/`organizationId` that would reach a public payload. A four-lens council was convened
(security-and-invariants, adversarial skeptic, architecture-and-sequencing, product-and-honesty),
**every lens given the code and the ADRs, none given the architect's prose.**

**The council did not converge, and both dissents are recorded unresolved in ADR-0048 §4.** The
skeptic recommended doing none of it; the product lens argued that _withholding_ readiness is the
less honest option, because six identical cards showing per-item confidence in the 66–70 range make
an implicit trust claim that a BIF confidence of 17 contradicts. **Both dissents point at the web
rendering step.** Neither is dissolved by deferring it.

⚠️ **Two lenses independently surfaced a finding nobody asked about**: the web layer had no
rendering-test capability at all. That is the ADR-0046 D2 lesson repeating exactly — the track
reported itself blocked on a scope-identifier question, and the highest-value gap was somewhere else
and gated by nothing.

⚠️ **D1 is errata, not a deferral.** `ContextReadinessEntry` never carried scope; #170 already did
what D8 asked. **Do not re-open it as though it were live** — re-asking a settled question invites
re-deciding it the other way by accident.

⚠️ **D2 is permanent:** scope identifiers may never reach a public read-only payload. The demo scope
values are synthetic, which is _why_ the rule is stated now — this DTO shape is the template a real
authenticated deployment inherits, and the demo route has no auth to contain a mistake.

---

## §2 — D5: the published-item-surface guard (#179 @ `a61f59e`)

`apps/api/src/modules/demo/tests/published-item-surface.spec.ts` pins the **exact** key set the
public endpoint publishes, per capability, for all three item arrays (**18 arrays, 6×3**), and
enforces D2 by scanning the serialized response for **five** scope spellings.

The defect: `toBusinessDiscoverySummary` projects the intake block field-by-field and says why in
its own docstring — _"the runtime summary is free to grow fields that the read-only endpoint has not
decided to expose, and a spread would publish them silently"_ — while thirty lines below,
`toDemoReport` passed `acceptedItems`, `rejectedReasons` and `duplicateReferences` through
**verbatim**, typed `readonly unknown[]`. The discipline was real for one block and absent for the
other, and D8 had rested part of its confidence on it.

⚠️ **A projection was considered and REJECTED — the spec's header records why.** The six
capabilities emit **six different shapes (7–17 keys)** and `apps/web` renders every item; narrowing
to `CapabilityOutputItem`'s three declared fields would publish `id`/`capability`/`createdAt` and
throw away every recommendation the demo exists to show. Narrowing would not make the endpoint
honest; it would make it empty.

⚠️ **The hole closed is SILENCE, not breadth.** A capability may publish a rich object; it may not
publish a **new** field without someone editing that file and thereby deciding to.

⚠️ If it fails for a field you added, add it **deliberately** — after checking it belongs in an
unauthenticated public payload. **Never loosen `toEqual` to `toContain`**, and **never delete a
capability's entry**: an unpinned capability is exactly an unguarded one.

⚠️ Non-vacuity: `reports` length asserted **first**; arrays counted and asserted **after** the loop
(`toBe(18)`). Proven by mutation — injecting `clientId` into `toDemoReport` failed **both** tests by
name, then `demo.service.ts` was restored byte-identical.

---

## §3 — D4: the first rendering test, and it runs in CI (#181 @ `3fca556`)

`apps/web/src/app/demo/page.test.tsx`, **7 tests**. **Confirmed executed in `ci.yml` by reading the
job log** (`✓ src/app/demo/page.test.tsx (7 tests)`), not inferred from a green tick.

**No workflow change was needed** — `ci.yml` → `pnpm test` → `nx run-many -t test` → `@age/web`
already reaches it. ⚠️ **Do not add a workflow step "to make it run."**

### What was actually wrong

Not "web has no tests" — worse:

- `vitest.config.ts` declared `environment: 'jsdom'` while **`jsdom` appeared in no `package.json`
  in the repository.**
- `test` was `vitest run --passWithNoTests` over an `include` glob matching **zero files**. The
  package reported success on every CI run and had **never loaded the environment it declared.**
- `test:e2e: playwright test` was declared and **`.github/workflows/` referenced neither
  `playwright` nor `e2e`.**

Green produced by the _absence_ of tests is indistinguishable from green produced by passing ones.
That is why **D4's bar is EXECUTES IN `ci.yml`**, not "harness installed."

⚠️ **`--passWithNoTests` is REMOVED and must stay removed.** Verified: with the spec gone the
package prints `No test files found, exiting with code 1`. Restoring the flag re-opens the exact
hole D4 was written to close.

⚠️ Playwright was **not** the mechanism chosen. jsdom + `@testing-library/react` under the existing
`pnpm test` was — precisely because it satisfies the _executes_ bar with no workflow change.

### Config that is load-bearing, not cosmetic

- `resolve.alias` restates the tsconfig `@/*` path: **vitest does not read tsconfig `paths`.**
- `esbuild.jsx: 'automatic'` transforms JSX for the runner **instead of weakening the app's
  `jsx: preserve` build config to suit tests.**

### What it pins

`page.tsx` stated binding ADR-0046 slice-1 rules **as comments** — the four scores are _"never
summed, averaged or shown as one headline number"_, omitted sections are _"neutral limitations —
never warnings, never negative evidence about the business."_ A comment does not survive a refactor
by someone who has not read it. These are now enforced.

⚠️ The fixture uses the pinned demo baseline: **97/63 intake vs 12/17 BIF**, 7 populated + 5 omitted
sections, 6 capabilities. **If a change makes those pairs converge, this file is not the one to
edit.**

### Proven non-vacuous by three mutations of `page.tsx`, each failing by name, each restored

| Mutation                                     | Failure                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A combined headline score                    | `a combined score of 109 is rendered — the four measurements must never be summed or averaged` |
| `text-amber-700` on the omitted-section note | `renders the omitted-section block in neutral styling, never as an alarm`                      |
| `<Notice ok={report.acceptedCount > 0}>`     | `is driven by a graded value, not a boolean invariant`                                         |

⚠️ The third is the mechanism **ADR-0048 D4 named concretely**: `Notice` renders an emerald/amber
pair off a boolean, so reusing it for a graded value would introduce an ordinal colour scale **by
component reuse rather than by anyone deciding to** — the class of change a reviewer does not notice.

⚠️ The `Notice` source scan is **case-SENSITIVE on purpose.** A case-insensitive `count` matches
`accountingHolds`, which is a legitimate boolean invariant; a scan that cried wolf on its first run
would be edited into uselessness. It also **strips comments before scanning**, or the file's own
explanation of the rule would match it, and it **asserts it found call sites** before judging them.

⚠️ Loading is asserted **before** every absence-based assertion — a page stuck on "Loading…" must
never read as a page with no combined score. The combination scan **counts what it checked and
asserts the count after the loop.**

---

## §4 — What remains on this track

| Step                                     | State                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3 step 4 — readiness on **API + smoke** | ⬅️ **Next. Gated by nothing.** Field-by-field, **no aggregate**. `DEMO_SCENARIO_METADATA.constructedAt` already supplies ADR-0047 D3's `producedAt`. ⚠️ ADR-0048 §4 records the skeptic's view that this is **low-value on its own**, authorized mainly so the web step has something to render — **keep it small.** |
| D3 step 5 — readiness on **web**         | Harness precondition now met by #181. ⚠️ **Read ADR-0048 §4 first** — both unresolved dissents point here.                                                                                                                                                                                                           |

**D7 binds every surface, forever:** fixed registry order, each state adjacent to its **own**
`requiredSectionTypes` and `thresholds`, **no aggregate of any kind**, no ordinal colour scale. The
three states are incommensurable in **denominator**, not threshold.

**D8 authorizes none of:** capture writes (the ADR-0046 D7 prohibition stands) · auth · a client
registry (ADR-0046 D1) · snapshot readers · any change to the three assessors · reordering or
aggregating readiness states · removing the scope-stripping at the `context-readiness.ts` boundary.
