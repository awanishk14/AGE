# ADR-0061 — ADR K: identity, and the hosted shape it is the precondition for

Status: **Proposed** — 🚫 **MUST NOT be self-accepted.**
⚠️ **THIS ADR AUTHORIZES NOTHING.** It exists to make the SaaS path a _decision the Product Owner can
take_, rather than a blocker the architect keeps citing. 🚫 No code follows from it while it is
`Proposed` — not a login screen, not a session, not a deployment, not a schema change.
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

🛑 **This ADR is not the next piece of work, by the Product Owner's own instruction.** ADR-0060's D8
items are. This one is picked up when the SaaS build starts.

⚠️ **The order is not negotiable when it does start:** Q1 → Q2 → Q3 before any deployment work, and
Q4/Q5 before any real client's data leaves the operator's machine. 🚫 Deploying first and adding
identity after is the failure mode this ADR is written to make visible — at that point the exposure is
already permanent, because anyone who found the URL was an operator.

---

## 5. Open question about this ADR itself

Should the hosted product be **AGE Studio deployed**, or a **different product** that shares the
packages? ⚠️ The console was built under a loopback invariant that shaped its every screen — including
that it names files on the operator's disk. A hosted product may be a **peer product** rather than the
same app with a login bolted on. 🚫 Unanswered, and it changes what Q1–Q6 are answering _for_.
