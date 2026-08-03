# ST_04 — Components and states

Status: **Proposed**. 🚫 Authorizes no code.

---

## 1. The state matrix — every data-bearing component implements all seven

⚠️ **This is the heart of the design.** The four epistemic states of `17_DESIGN_SYSTEM.md` §4 are not
enough on their own: they describe _what AGE knows_. A component also has to describe _what happened
when it tried to find out_. Collapsing the two is how "unknown" comes to mean six different things.

| #   | State            | Renders as                                                                                | Meaning                                                   | 🚫 Never                                                 |
| --- | ---------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| 1   | **Known**        | `●` solid border + value + source                                                         | AGE looked, found it, and can say where it came from      | —                                                        |
| 2   | **Unattributed** | `◐` dashed border + value + "source unknown"                                              | A value with no provenance                                | 🚫 shown identically to Known                            |
| 3   | **Unknown**      | `○` double border + "AGE looked and found nothing here. This is a result, not a failure." | A **measured** absence                                    | 🚫 shown as `0`, `—`, `N/A` or an empty cell             |
| 4   | **Not assessed** | `—` dotted border + "AGE has not looked yet. This is not zero and not empty."             | An **unlooked-at** absence                                | 🚫 shown as `0`; 🚫 shown as Unknown                     |
| 5   | **Not wired**    | dotted panel + the reason + what must happen first                                        | The capability exists; Studio is not connected to it      | 🚫 a spinner                                             |
| 6   | **Refused**      | refusal panel naming a **position**, never contents                                       | A guard said no (unknown id, non-loopback host, bad path) | 🚫 silently degrading to empty                           |
| 7   | **Failed**       | error panel + what was attempted                                                          | The attempt errored                                       | 🚫 rendering as Unknown — a failure is not a measurement |

🚫 **No two states share a treatment, and colour never encodes a state alone** — each has a glyph, a
border style **and** a written label. ⚠️ States 3, 4, 5 and 7 all render "there is no value here" and
are four _different facts_; a design that cannot tell them apart cannot be honest.

🚫 **There is no Loading state that outlives a request, and there is no skeleton, shimmer or
placeholder card** — they all imply data is arriving. A slow read shows a labelled progress
indicator that names what it is waiting for, or it shows nothing.

## 2. Component inventory

**Chrome**
`AppShell` · `Sidebar` (driven by the navigation model, never hand-listed) · `TrustBanner`
(non-dismissible) · `ScopeLine` (clientId + derived organizationId, or "No business selected") ·
`SystemStatusIndicator`

**Primitives**
`StateChip` — 🚫 **the only way any of the seven states is ever rendered.** A second implementation is
how one of them quietly becomes a spinner.
`ValueWithProvenance` — value + source + confidence + timestamp + status, as one unit. ⚠️ **A value
must not be renderable without its provenance slot**, or a caller will render the value alone.
`ConfidenceMeter` — 🚫 never a bare percentage, always with its basis.
`EvidenceLink` · `RefusalPanel` (names a position, never contents) · `NotWiredPanel` ·
`EmptyResult` (state 3) · `NotAssessed` (state 4)

**Domain**
`BusinessCard` · `OrganizationBand` (🚫 not a link) · `QuestionCard` · `SectionProgress` ·
`BifSection` · `EvidenceTimelineItem` · `ContradictionPair` · `GraphCanvas` · `StrategyCard` ·
`ApprovalRow` (🚫 no Approve button) · `SnapshotDiffRow` · `PeerProductWidget` (⚠️ carries fetch time
and a stale state) · `DiagnosticRow`

## 3. The visual language

Notion / Linear / Arc, as asked: minimal, fast, zero clutter, generous whitespace, one accent, type
doing the hierarchy work. Concretely:

- 🚫 **No decorative iconography on data.** An icon beside a number is a claim about the number.
- 🚫 **No card shadows to imply importance** — importance is a real ordering or it is not shown.
- ✅ Density is a real requirement: an operator comparing evidence needs many rows on screen. The
  "premium" feel comes from restraint and speed, 🚫 not from padding that pushes data below the fold.
- ✅ Keyboard-first: command palette, `j`/`k` through lists, `⌘K` to switch business. ⚠️ The palette
  searches **resolved records only** — 🚫 it is not a global search across scopes the entitlement
  layer does not yet bound.
- ✅ Motion is functional only. 🚫 Nothing animates to suggest work is happening when it is not.

## 4. The rule that governs all of it

> **"The primary job is not beauty — it is not lying."** — `17_DESIGN_SYSTEM.md` §0.1

⚠️ Where the visual language and honesty conflict, honesty wins and the design absorbs the cost. A
dashboard full of "Not assessed" is **less beautiful and more valuable** than one full of zeroes.
