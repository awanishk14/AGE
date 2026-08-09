# ADR-0061 — ADR K: identity, and the hosted shape it is the precondition for

Status: **Accepted** (2026-08-09, by the Product Owner — see §0.1b), **with Q2–Q6 open** and
**§5 ANSWERED on 2026-08-09 — the hosted product is the DEMO, 🛑 not Studio (see §5).**
🚫 Not self-accepted.
⚠️ **The SaaS build has started.** §4's sequencing is no longer hypothetical and 🚫 is not
negotiable: **Q1 → Q2 → Q3 before any deployment work, and Q4/Q5 before any real client's data
leaves the operator's machine.** 🚫 Deploying first and adding identity after is the one failure
mode this ADR was written to make visible.
⚠️ This is the **"ADR K"** referred to by ADR-0058 §5 and named as the precondition in ADR-0060 §0.2.
Date: 2026-08-08
Relates to: ADR-0046 **D5** (RLS is coherence, NOT authorization), ADR-0053 **D4** (the operator
principal is provenance) and **§2.1 dissent 1** (authentication before a second person), ADR-0055
**D6** (the operator's own local database), **D7** (the row nobody reads) and **D9** (the security
ceiling — recorded, not scheduled), ADR-0057 **D2** (the loopback invariant) and **D4** (the three
action classes), ADR-0058 **D1** (principal ≠ entitlement ≠ scope), **D2** (the three-valued answer),
**D8** (what its acceptance authorized) and **§6 Q1** (the tenant boundary, unanswered),
ADR-0060 **D1/D6** (the local surface, and the database rule left untouched).

---

## 0.1b Acceptance, in the Product Owner's own words (2026-08-09)

> _"al 3 need the work, plan and complete all 3, and then we deploy it on vps"_

⚠️ **The "3" are ADR-0059, ADR-0061 and ADR-0064**, named in the table the owner was answering, and
_"we deploy it on vps"_ is the instruction that starts the SaaS build. 🚫 Not self-accepted.

⚠️ **The acceptance delegates Q2–Q6 rather than answering them.** They are answered in **§2b**, by
the architect under the standing mandate — and each answer says plainly that it is an architect's
answer, so a later reader cannot mistake it for the owner's. 🛑 **Two are the owner's to overrule
on grounds no architect can weigh** and are marked as such: **A2** (which identity provider — a cost
and vendor decision) and **A5** (that a real client's data now lives on a server the operator does
not physically hold).

🛑 **§3's list of what acceptance does NOT authorize is UNCHANGED and is not softened here:**
🚫 no Business Execution (ADR-0057 D4 class 3 is refused, not postponed, and hosting does not
change that) · 🚫 no committing of real client records (ADR-0053 D3 + ADR-0065) · 🚫 no promoting
a BIF status · 🚫 RLS is never authorization. ⚠️ The **model call** that §3 refused is now
authorized — but by **ADR-0059 D5**, accepted the same day, and 🚫 only in the shape D1–D3/D7 give
it.

---

## 0. Standing

Written at the Product Owner's explicit request, in their own words:

> _"i will want this path later when i am building saas … so we need to scope in but currently, local
> Postgres also works."_

⚠️ **"Scope in" is the whole instruction.** The Product Owner asked for the path to be _written down_,
not walked. 🚫 Do not read this ADR's existence as momentum toward accepting it.

---

## 1. Context — what is actually missing

AGE today has **no authentication of any kind**, and since #248 it says so mechanically rather than by
omission: `askEntitlement` returns **`not-established`** for every subject, because AGE has no way to
look at who is asking. The only access control in the product is the transport — ADR-0057 D2's
loopback bind, and ADR-0060 D1's stdio, which is stronger.

⚠️ **The entitlement reason already states the ceiling in the words that matter:** access is limited
by the loopback bind _"which is necessary and not sufficient."_ Every hosted shape removes that
control. 🛑 **Removing the only control while adding none is the failure this ADR exists to prevent**,
and it is what a naive deployment does regardless of how careful the deployer feels.

Three further facts bound the problem:

1. 🚫 **RLS is NOT an authorization boundary** (ADR-0046 D5). It `FORCE`s and fails closed, and it is
   a **coherence** constraint. It must never be cited as the thing that keeps tenants apart.
2. 🚫 **The adapter is not the boundary against a caller that fabricates a key** (finding 3). It
   _derives_ scope from the key. Only an authenticated identity source closes this.
3. 🛑 **The tenant boundary is undecided.** ADR-0058 §6 Q1 — _is it the organization, or the client?_ —
   is unanswered, and ADR-0058's acceptance did **not** answer it. `EntitlementSubject` carries both
   arms, 🚫 neither privileged, and a test asserts both give the **same** answer so that the
   indecision stays visible rather than being settled by accident.

---

## 2. What this ADR must decide before any hosting is possible

🛑 **Each of these is a stop. None may be inferred from another, and 🚫 none may be settled in an
implementation PR.**

### Q1 — The tenant boundary (inherited from ADR-0058 §6 Q1)

Is a tenant an **organization** or a **client**? Everything downstream depends on it: what a session
carries, what an entitlement is granted over, what a shared deployment isolates. ⚠️ Answering it makes
`EntitlementSubject`'s two arms stop being symmetric, and the test that pins their symmetry becomes
the thing that must be deliberately changed.

### Q2 — What authenticates, and what AGE trusts

An identity provider, or AGE's own credential store? ⚠️ ADR-0053 §2.1 **dissent 1** held that
authentication must precede a second person touching the system, and that dissent has been deferred
four times. 🚫 `OperatorPrincipal` **cannot** be promoted into this role — it is caller-asserted
provenance, and accepting it as proof lets a caller grant itself access by naming itself (ADR-0058 D2,
guarded by name).

### Q3 — The real `granted` / `denied` arms

`askEntitlement` has one arm today. Adding authentication adds an arm to `Authentication`, at which
point the `switch` **stops compiling** — deliberately. 🚫 The three-valued answer must survive:
`not-established` is an epistemic state and 🚫 must never collapse into `denied`, because _"nobody has
looked"_ and _"we looked and refused"_ are different facts and the second invites a bypass.
🚫 No `allowAll`, `SYSTEM_PRINCIPAL`, `entitlementOrDefault`, dev-mode or bypass — six guards exist.

### Q4 — Where the operator's files live when the operator is not at the machine

ADR-0054 D2 requires operator file paths to be **explicit and outside the repository**, and refuses
relative paths outright because resolving them reads `cwd`. 🛑 A hosted AGE has no operator machine to
point at. Uploading real client documents to a shared tenant is what **ADR-0053 D3** refuses.
⚠️ **This question is not solved by object storage** — it is solved by deciding who may read the
object, which is Q1 and Q3 again.

### Q5 — The database rule

**ADR-0055 D6** requires the operator's **own local** database, and `assertLocalDatabaseTarget`
enforces it while explicitly naming the evasion: an SSH tunnel from `localhost:5432` to a shared
server _is_ loopback and is precisely what D6 forbids. 🛑 **A hosted AGE requires D6 to be revisited
deliberately, in an ADR that says so.** 🚫 Not a flag, not an `allowRemote` parameter, not a second
function that quietly permits it — ADR-0055's own reasoning is that the copy that gets relaxed still
passes its own tests.

### Q6 — The security ceiling

**ADR-0055 D9** recorded a security ceiling and 🚫 did **not** schedule clearing it. Hosting raises
every item under it — transport security, secret handling, audit, rate limiting, tenant isolation
testing. ⚠️ **D9 being _recorded_ is not D9 being _addressed_** (the standing "recorded is not
authorized" rule).

---

## 2b. The answers (architect's, under the delegation in §0.1b)

🛑 **Each answer below is a STOP that has been cleared, not a question that turned out not to
matter.** 🚫 None may be widened by an implementation PR; each names what it does **not** settle.

### A0 — The §5 open question, answered FIRST because it frames every other answer

**The hosted product is AGE Studio deployed, not a peer product.** 🚫 A peer product would double
every screen, and the screens are the product (the #231 master direction).

⚠️ **But the loopback assumption that shaped those screens is replaced, not carried over.** The
console names files on the operator's disk. Deployed, it names files in a **workspace root derived
from the session** (A4). ⚠️ **That is a real change to what a screen means**, which is why A4 is a
separate answer rather than a detail of this one.

### A2 — What authenticates, and what AGE trusts

**AGE trusts a verified session and nothing else.** The session is minted by an authentication layer
that owns credential verification; AGE's own code never compares a password.

🛑 **`OperatorPrincipal` IS NOT PROMOTED, and this is the load-bearing half of the answer.** It
stays caller-asserted **provenance** — _who says they did this_ — and 🚫 is never evidence of _who
may do this_. ADR-0058 D2's six guards stand unchanged. ⚠️ A session and a principal are different
values with different trust, and 🚫 a slice that lets one be constructed from the other has
reintroduced the exact bypass this refuses.

⚠️ **Implementation, as a default the owner may overrule:** an OIDC-capable authentication layer with
its own store; sessions in Postgres (🚫 not a bearer token the client holds and replays past
revocation); **argon2id** if a credential provider is used at all. The seam is what matters: AGE
consumes _"this request carries a verified subject"_, so the provider can be swapped for a hosted IdP
without touching a screen.

🛑 **THIS DISCHARGES ADR-0053 §2.1 DISSENT 1**, deferred four times: authentication now precedes a
second person touching the system. 🚫 It lands BEFORE deployment, not after.

### A3 — The real `granted` / `denied` arms

`Authentication` gains an authenticated arm; `askEntitlement` gains real `granted` and `denied`.

⚠️ **The `switch` will stop compiling, and that is the design working.** 🚫 Do not add a `default`
arm to make it compile — enumerate the new arm deliberately.

🛑 **THE THREE-VALUED ANSWER SURVIVES.** `not-established` is an **epistemic state** and 🚫 must
never collapse into `denied`: _"nobody has looked"_ and _"we looked and refused"_ are different
facts, and conflating them is what invites a bypass. 🚫 No `allowAll`, no `SYSTEM_PRINCIPAL`, no
`entitlementOrDefault`, no dev-mode, no bypass — the six guards stay.

⚠️ **`EntitlementSubject`'s symmetry test is DELIBERATELY CHANGED in the slice that builds this,
citing ADR-0062 D1** (the tenant is the organization). 🚫 It is never quietly deleted.

### A4 — Where the operator's files live when the operator is not at the machine

**The workspace root is derived from the authenticated organization, and 🚫 never from a request
parameter.**

⚠️ **ADR-0054 D2's rule is preserved by being restated, not dropped.** Its point was that a path is
never _ambient_ — never `cwd`, never a default, never a search. Deployed, the non-ambient source is
the **session**. 🚫 A path segment arriving in a URL, a form field or a header is user input, and a
user-supplied path segment is a traversal into another tenant's files.

🚫 **`assertOperatorFilePathOutsideRepository` keeps its ONE implementation** (ADR-0054 D3). The
deployed root is an additional constraint on top of it, 🚫 not a second copy that relaxes it.

⚠️ **This does not settle who may READ the object** — that is A2 and A3, exactly as §2 Q4 warned.
Object storage is 🚫 not an answer to this question.

### A5 — The database rule: 🛑 ADR-0055 D6 IS REVISITED, DELIBERATELY, AND THIS IS THE OWNER'S CALL

🛑 **State the consequence before the mechanism: a real client's data will live on a server the
operator does not physically hold.** That is precisely what D6 refused, it is a genuine reduction in
safety, and 🚫 it must never be described as anything else. The owner instructed the deployment
knowing the product carries their clients' data; 🚫 this ADR records the trade rather than hiding
it.

**The deployed database is the VPS's own Postgres, reachable only over the VPS's loopback or a
private interface, 🚫 never exposed publicly.**

🛑 **NOT A FLAG, NOT AN `allowRemote` PARAMETER, NOT A QUIETLY-PERMITTING SECOND FUNCTION** — §2 Q5
refuses all three by name, because _"the copy that gets relaxed still passes its own tests"_. It is a
**separate named deployment composition** whose identity is explicit in its name and which 🚫 cannot
be selected by an environment variable alone.

⚠️ **`assertLocalDatabaseTarget` KEEPS ITS TEETH on the local operator path**, which 🚫 is not
deleted and 🚫 is not the same code path. ⚠️ Its named evasion still stands: an SSH tunnel from
`localhost:5432` to a shared server _is_ loopback and 🚫 is still forbidden — the deployed
composition is honest about being remote instead of disguising itself as local.

### A6 — The security ceiling: 🛑 DISCHARGED BEFORE THE FIRST NON-OPERATOR LOGIN, NOT AFTER

**ADR-0055 D9's items become a gate on the deployment slice.** 🛑 Each must be shipped and **made
to fail** before a second human is given a URL:

1. **Transport** — TLS terminated in front of the app; 🚫 no plaintext origin reachable publicly.
2. **Secrets** — from the environment or a secret file, 🚫 never committed, and 🚫 absent at
   startup is a **refusal**, never a default.
3. **Session cookies** — `HttpOnly`, `Secure`, `SameSite`, server-side revocation.
4. **Rate limiting** on the authentication path specifically.
5. **Tenant isolation, TESTED** — a test proving organization A cannot read organization B's row.
   🚫 RLS is **coherence, not authorization** (ADR-0046 D5), and 🚫 the test must not be written
   against RLS as though it were the boundary.
6. **Audit** — who logged in, and what was read, retrievable.

⚠️ **"Recorded" is not "addressed".** 🚫 An item ticked without a failing-then-passing test is not
discharged.

### What §2b does NOT settle

🚫 Business Execution (class 3, refused) · 🚫 multi-organization data sharing · 🚫 client
self-service logins (ADR-0062 D2 records them; 🚫 it does not authorize them) · 🚫 any change to
what a score means · 🚫 making the repository public.

---

## 3. What acceptance would authorize — and what it would still not

⚠️ Written now so that a future acceptance cannot be read more broadly than it was given.

Acceptance of this ADR, **once Q1–Q6 are answered in it**, would authorize: an identity provider and
session, real `granted`/`denied` arms with a caller for `@age/entitlement`, a tenant-scoped read path,
and a deployment target for the console.

🚫 It would **not** authorize: **Business Execution** (ADR-0057 D4 class 3 is refused, not postponed,
and hosting does not change that) · any **model call** inside AGE (ADR-0060 D7) · **committing real
client records** (ADR-0053 D3 — 🚫 and _"private is not a control"_: repo visibility flipped
unnoticed in 2026-08-02) · promoting a **BIF status** · treating **RLS** as authorization.

---

## 4. Sequencing

⚠️ **SUPERSEDED BY EVENTS, 2026-08-09.** This paragraph said _"this ADR is not the next piece of
work, by the Product Owner's own instruction — it is picked up when the SaaS build starts."_
✅ ADR-0060's D8 items are all discharged, and **the owner has now started the SaaS build** (§0.1b).
🚫 The original sentence is kept above so the change of instruction is visible rather than
overwritten.

⚠️ **The order is not negotiable when it does start:** Q1 → Q2 → Q3 before any deployment work, and
Q4/Q5 before any real client's data leaves the operator's machine. 🚫 Deploying first and adding
identity after is the failure mode this ADR is written to make visible — at that point the exposure is
already permanent, because anyone who found the URL was an operator.

---

## 5. ✅ ANSWERED (2026-08-09, by the Product Owner) — the hosted product is the DEMO, not Studio

> The Product Owner chose the demo frontend, after being shown the three options and their costs,
> with the words _"lets go with your recommendation"_ (recommendation = host `apps/web` +
> `apps/api`, the read-only demo). See ADR-0066 §0.2.

**§5-A. The hosted product is `apps/web` + `apps/api` — the read-only demo, over the fixed,
deliberately fictional profile.** Both already have Dockerfiles; 🚫 no invariant is reversed.

**§5-B. 🛑 AGE STUDIO IS NOT DEPLOYED, AND "we deployed" MUST NEVER BE READ AS "Studio is
deployed".** ADR-0057 **OX-INV-1 stands unamended** — `apps/studio` still gets no Dockerfile, still
binds loopback only, and the test asserting the Dockerfile's absence stays. Deploying Studio would
be a **reversal**, needing its own ADR and the six auth slices that are still uncalled.

**§5-C. 🚫 The hosted demo shows NO real business.** It renders the frozen fixture and nothing
else. There is no parameter by which a visitor supplies a company — 🚫 do not add one, and 🚫 do
not "make the fixture more realistic" (ADR-0053 D3: obvious fictionality **is** the guard).

**§5-D. Therefore the hosted demo needs no login, and 🚫 must not grow one.** It protects nothing
private because it holds nothing private. ⚠️ A login on this surface would be the first step
toward §5-B by accident.

⚠️ **Q2–Q6 remain open.** §5's answer does not answer them; it narrows what they are answering
_for_.

---

## 5b. The question as originally posed (superseded by §5 above)

Should the hosted product be **AGE Studio deployed**, or a **different product** that shares the
packages? ⚠️ The console was built under a loopback invariant that shaped its every screen — including
that it names files on the operator's disk. A hosted product may be a **peer product** rather than the
same app with a login bolted on. 🚫 Unanswered, and it changes what Q1–Q6 are answering _for_.
