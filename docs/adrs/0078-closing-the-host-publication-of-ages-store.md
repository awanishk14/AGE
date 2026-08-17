# ADR-0078 — Closing the host publication of AGE's store: what replaces `127.0.0.1:5442`

Status: **Accepted** (2026-08-17) — ⚠️ **BY THE PRODUCT OWNER, 🚫 NOT self-accepted.**
ADR-0077 §0.1b established the class: this ADR redraws the privilege boundary of a box AGE **shares
with four products it does not own**, and the §2 mandate covers architecture _inside_ AGE. It was a
decision request for the **Product Owner** and was answered by them — §0.2b, verbatim.

🛑 **ACCEPTED ONLY AFTER THE §1.5 MEASUREMENT WAS TAKEN AND RECORDED**, on the owner's own
instruction. ⚠️ The measurement **changed what this ADR claims to close** — see §1.5b. 🚫 Do not read
§0.1 as though the exposure it names had been demonstrated; the half that was demonstrated is
narrower, and §7 pins the only wording that may be used.

Discharges: **ADR-0076 D8** — the symmetric question ADR-0076 recorded as open by name.
Depends on: ADR-0076 **D1–D7** · ADR-0075 **D1–D6** (AGE's own database) · ADR-0077 **D1–D7**
(the account that deploys AGE) · ADR-0061 **A5** (a target is an ADDRESS, never a name) · ADR-0055 /
ADR-0060 (the host-side capture CLI) · ADR-0054 **D2/D3** (an operator file's path lives outside the
checkout) · ADR-0046 **D4/D5** (the non-owner role; RLS is coherence, 🚫 not authorization).
Supersedes: nothing. Amends: nothing.

---

## 0.1 The invariant this ADR must satisfy, in the owner's words

> _"AGE PostgreSQL must not be reachable from peer applications or arbitrary host processes merely
> because they share the VPS."_

⚠️ **READ THE SECOND HALF AS CAREFULLY AS THE FIRST.** "Arbitrary host processes" is the harder
clause and it is the one that eliminates most of the cheap answers. A control that stops a _peer
container_ while leaving every _host process_ able to dial the port satisfies the sentence's first
half and fails the invariant.

Two constraints ride along with it, and 🚫 neither is negotiable in this ADR:

- **`age.peer.v1` is preserved unchanged.** It is the baseline for every later peer
  (ADR-0071 round trip). 🚫 Nothing here touches the envelope, the pinned key set, or the
  operator-mediated relay.
- **All current Studio functionality is preserved.** The console is already **not** a consumer of
  the host publication — see §1.2. That is what makes this tractable.

---

## 0.2b The acceptance, verbatim (Product Owner, 2026-08-17)

The owner answered §6 in two parts. First the choice and the condition on it:

> _"Yes. I would choose Option C: move age-capture into the AGE internal Docker network and remove the
> host publication._
>
> _But I would allow Slice 0 measurement first, before implementing C._ […]
>
> _It preserves the strongest parts of the architecture already established: […] No relaxation of the
> loopback database-target rule is required. […] Most importantly, C doesn't require us to weaken
> ADR-0061 A5 / ADR-0075 D4 merely to make the capture CLI work._
>
> _The statement: "Peers can reach 5442" shouldn't be treated as proven simply because the port
> exists on the host._ […]
>
> _If Slice 0 confirms that peer containers cannot actually reach 5442, that doesn't make D8
> unnecessary. The host publication is still an unnecessary attack surface, and C is still the
> cleaner architecture._ […]
>
> _Do not report this as "AGE's database is now unreachable."_ […] _drishti remains root-equivalent
> and can ultimately enter Docker namespaces. That is a separate host-identity problem already
> addressed partially by ADR-0077, not something D8 can magically eliminate."_

Then, after the measurement was reported, the acceptance itself:

> _"Proceed with ADR-0078 based on the Slice 0 evidence._
>
> _First update ADR-0078 with the measured result: peer containers were already unable to reach AGE
> PostgreSQL; the actual D8 exposure is host-level TCP reachability through 127.0.0.1:5442._
>
> _Accept ADR-0078 only after recording that distinction._
>
> _Then implement Option C in three explicit slices:_
>
> _C1 — capture path: move age-capture and all production provisioning/migration operations that
> currently depend on host 127.0.0.1:5442 into the AGE container network. Do not relax
> assertLocalDatabaseTarget, ADR-0061 A5, or ADR-0075 D4._
>
> _C2 — prove the replacement path: run the actual capture/provisioning/migration workflow against the
> real VPS. Prove AGE capture works through age-internal → age-postgres:5432, not merely that the
> container can open a TCP connection._
>
> _C3 — remove publication_ […] _and verify that: AGE Studio still works; age-capture still works;
> provisioning/migrations still work; AGE PostgreSQL has no host TCP publication; host accounts cannot
> connect to the old port; peer containers remain unable to reach AGE PostgreSQL; no code, script,
> compose file or documentation still depends on AGE_DB_HOST_PORT=5442._
>
> _Then perform the full real-VPS acceptance again and report only measured results._
>
> _Do not touch the deploy-identity architecture, peer networking, or public URL. Those are already
> working and are outside this slice."_

⚠️ **THE ACCEPTANCE IS OF OPTION C AS ARGUED, 🚫 IT DID NOT WIDEN THE ADR.** §5 stands unchanged, and
the owner named the two limits by hand: 🚫 no relaxation of `assertLocalDatabaseTarget` / A5 / D4, and
🚫 the wording rule now pinned as **§7**.

---

## 1. THE MEASURED CURRENT STATE

⚠️ **Measured against `main` at `b324c844c5`, by reading the shipped compose files, scripts and
guards — 🚫 not against any document's claim about them.** The VPS-side half of §1.5 is marked as
**unmeasured** where it is unmeasured. 🚫 A green CI run is evidence for nothing in this section.

### 1.1 The publication itself

`deploy/vps/docker-compose.age-postgres.yml:68-70`:

```yaml
ports:
  - '127.0.0.1:${AGE_DB_HOST_PORT:?the host port must be stated}:5432'
```

On the VPS `AGE_DB_HOST_PORT=5442`. It is loopback-only, the address half is written out, the port
is required with no default, and `provision-studio-database.sh:120` refuses `5432` outright because
that is SNARA's. 🛑 **EVERY ONE OF THOSE PROPERTIES IS CORRECT AND NONE OF THEM ADDRESSES D8.**
Loopback excludes the internet; it does 🚫 **not** exclude a process on the same box.

`ss -ltn` on the VPS after the ADR-0077 migration (checkpoint §5): `127.0.0.1:3100` and
`127.0.0.1:5442`. Nothing on `0.0.0.0`.

### 1.2 🛑 THE CONSOLE DOES NOT USE IT — this is the load-bearing fact

`deploy/vps/compose/docker-compose.studio.yml` names `age-postgres:5432`, **the container address on
`age-internal`**, and its guard at `studio-service-sandbox.spec.ts:157-161` asserts the studio compose
file contains neither `5442` nor `5432:`. ADR-0076 D1 already moved the console off the host path.

⚠️ **SO REMOVING THE PUBLICATION DOES NOT TOUCH THE STUDIO AT ALL.** The "preserve all current Studio
functionality" constraint is satisfied by every option below, trivially. The whole difficulty is
**one host-side consumer**, §1.3.

### 1.3 Who actually consumes `5442`

| Consumer                                              | What it is                                           | Needs the publication?                                                    |
| ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `age-capture` CLI (`apps/capture`, bin `age-capture`) | the operator's host-side capture/relay/inspect chain | ✅ **yes — the only real one**                                            |
| `provision-studio-database.sh`                        | owner-role migration + role provisioning             | ✅ yes, but it is an **owner act**, run rarely, with the owner credential |
| `psql` during a migration                             | human, occasional                                    | ✅ yes, same class as above                                               |
| AGE Studio container                                  | —                                                    | 🚫 **no** (§1.2)                                                          |

### 1.4 🛑 THE GUARD THAT MAKES THE OBVIOUS OPTION HARD

`apps/capture/src/local-database-target.ts` — `assertLocalDatabaseTarget`, called at
`capture-composition.ts:141`, **above** the only production `new PrismaClient(` in the repository:

- the accepted host set is exactly `localhost`, `127.0.0.1` (and the loopback forms);
- ⚠️ **a NAME is refused on purpose** (ADR-0061 A5) — "a name that resolves to loopback today may
  not tomorrow";
- an empty hostname returns `undefined` and the caller **refuses** — the fail-closed direction;
- the module's own comment already concedes what it cannot claim: loopback is **necessary, not
  sufficient** — an SSH tunnel is loopback too.

🛑 **THIS IS WHY OPTION A IS NOT FREE.** Inside a container on `age-internal`, the store is
`age-postgres:5432` (**a name — refused**) or `172.23.0.2:5432` (**not loopback — refused**). Option A
cannot be implemented without either weakening this guard or choosing a topology in which `127.0.0.1`
_is_ the database (Option C).

### 1.5 ⚠️ WHAT HAS **NOT** BEEN MEASURED, AND MUST BE BEFORE ANY SLICE

🛑 **THE REACHABILITY D8 ASSERTS HAS NEVER BEEN MEASURED IN THE PEER → AGE DIRECTION.** ADR-0076 D8
says peers "can still reach AGE's `127.0.0.1:5442` **by the same argument**". That is an argument by
symmetry, 🚫 not a raw TCP connect, and ADR-0076 D7 is the standard this repository holds itself to:
**test reachability directly, from inside the thing you are making a claim about.**

The symmetry is 🚫 **not obviously exact**, and the difference decides which options are even
responsive:

- A peer **container** on its own bridge network reaches the host's `127.0.0.1` **not at all** by
  default — host loopback is not the container's loopback. It would need `network_mode: host`, or to
  dial the bridge gateway, which `127.0.0.1:5442` does 🚫 **not** answer on.
- A peer **process running directly on the host** reaches it immediately.
- ⚠️ `drishti` owns every peer tree and is root-equivalent (ADR-0077 §2.1, unchanged), so **for
  `drishti` no port-level control is a control at all.**

🛠️ **PREREQUISITE MEASUREMENT (slice 0 of whichever option is chosen), in ADR-0076 D7's style:** a
raw TCP connect to `127.0.0.1:5442` **from inside each peer container** and **from a host shell as a
non-`drishti`, non-`age-deploy` account**, recorded as output. 🚫 Do not modify a peer to run it —
ADR-0076 §2 stands: no peer's container, network or configuration is changed to accommodate AGE.

⚠️ **IF THE MEASUREMENT SHOWS NO PEER CONTAINER CAN REACH IT**, D8's exposure is narrower than stated
— it is "arbitrary host processes", 🚫 not "peer applications" — and Option E stops being obviously
wrong. 🛑 **THE OWNER SHOULD NOT BE ASKED TO CHOOSE UNTIL THIS IS ON THE TABLE.** Recording the
measurement is cheap; guessing it is how a fence gets built facing the wrong way.

### 1.5b 🛑 THE MEASUREMENT WAS TAKEN (2026-08-17). IT CHANGED THE ANSWER.

Slice 0 ran on the real VPS as `drishti`, measurement-only: raw TCP connect attempts, nothing
modified, no file written, no peer changed. **Every row below is command output.**

**Peer container → AGE's store:**

| From              | Network                 | → host `:5442`                     | → `172.23.0.2:5432`  |
| ----------------- | ----------------------- | ---------------------------------- | -------------------- |
| `rankops-backend` | `rankops-internal`      | **DENIED** (`172.21.0.1`)          | **DENIED**           |
| `snara-api`       | `infra_default`         | **DENIED** (`172.19.0.1`, timeout) | **DENIED** (timeout) |
| `drishti-api`     | `drishti_internal`      | **DENIED** (`172.18.0.1`, timeout) | **DENIED** (timeout) |
| `dd-agency-web`   | `dd-agency_default`     | **DENIED** (`172.22.0.1`)          | **DENIED**           |
| `dd-scanner-api`  | `scanner-infra_default` | **DENIED** (`172.20.0.1`, timeout) | **DENIED** (timeout) |

🛑 **A DENIED-EVERYWHERE TABLE IS EXACTLY WHAT A BROKEN PROBE PRODUCES, SO THE PROBE WAS FALSIFIED
FIRST.** Control: `rankops-backend → 172.21.0.1` on **80, 443, 22 → ALLOWED**. The method reaches the
host on other ports and is refused on `5442` specifically. ⚠️ **A REACHABILITY TABLE WITHOUT THIS
CONTROL IS NOT EVIDENCE** — record one every time this is re-run.

The mechanism, from the live `nft` ruleset (Docker's own generated rules):

```
ip daddr 127.0.0.1 iifname != "br-f40303763061" tcp dport 5442 … dnat to 172.23.0.2:5432  [packets 0]
ip daddr 127.0.0.1 iifname != "lo"              tcp dport 5442 counter packets 0 … drop
ip daddr 172.23.0.2 iifname != "br-f40303763061"      counter packets 25 bytes 1500 drop
```

⚠️ The **25 dropped packets** on the third rule are Slice 0's own probes. So peer isolation is
**ENFORCED**, 🚫 not incidental: it follows from the `127.0.0.1:` bind half of D-0075's publication.

**AGE's own legitimate path — all ALLOWED:** `age-studio → age-postgres:5432` over `age-internal`,
`age-studio → 172.23.0.2:5432`, and host `127.0.0.1:5442`. `age-internal` holds exactly two members:
`age-postgres 172.23.0.2`, `age-studio 172.23.0.3`.

**"Arbitrary host processes" — the second clause:** host `127.0.0.1:5442` is **ALLOWED as
`age-deploy`** (no Docker, no sudo) and **ALLOWED as `drishti`**. `-P OUTPUT ACCEPT`; no uid filter.

🛑 **SO D8 SPLITS IN TWO, AND ONLY ONE HALF WAS EVER REAL:**

- **"peer applications" — ALREADY SATISFIED BEFORE THIS ADR.** ⚠️ **ADR-0076 D8's claim that peers
  can reach `5442` "by the same argument" IS NOT BORNE OUT.** The symmetry with D1 is **not exact**,
  because **host loopback is not container loopback**. 🚫 This ADR must never be credited with
  closing peer→AGE reachability; it was closed by the loopback bind, and §1.5's own warning that
  the symmetry might not hold is the reason the measurement was demanded before the choice.
- **"arbitrary host processes" — NOT SATISFIED, AND THIS IS THE LIVE EXPOSURE.** Every account on
  the box, including one with no Docker and no sudo, connects to AGE's database port. 🛑 **THIS IS
  THE HALF OPTION C ACTUALLY CLOSES.**

⚠️ **THIS DOES NOT MAKE C UNNECESSARY**, and the owner said so before the result was known: a host
publication reachable by every account is unnecessary attack surface whether or not a peer can use
it today, and a peer's networking could change tomorrow **without AGE being told**.

---

## 2. THE OPTIONS

Each is judged against: **(i)** does it satisfy §0.1 including "arbitrary host processes"; **(ii)**
does `age-capture` still work; **(iii)** what does it cost; **(iv)** what does it _refuse to touch_.

### Option A — 🛠️ **THE OWNER NAMED THIS ONE.** Containerise `age-capture` onto `age-internal`, then remove the publication

Run the capture CLI as a container attached to `age-internal`; it dials `age-postgres:5432`
internally; the `ports:` block is deleted.

- **Invariant:** ✅ **fully satisfied.** No host port exists, so no host process — `drishti`
  included — can dial one. This is the strongest answer available, and it is strong for the same
  reason ADR-0075 D3 was: it makes the reach **impossible rather than ungranted**.
- **`age.peer.v1`:** ✅ untouched. **Studio:** ✅ untouched (§1.2).
- 🛑 **COST 1 — IT COLLIDES WITH §1.4 HEAD ON.** `age-postgres` is a name and `172.23.0.2` is not
  loopback. Implementing A means **relaxing `assertLocalDatabaseTarget`**, and that guard is one of
  the shipped refusals. ⚠️ Relaxing it to accept `172.23.0.2` admits _any_ bridge address, which is
  precisely **ADR-0075 D4** — reaching a peer's bridge address. 🚫 That trade must not be made
  silently, and it is the single strongest argument against A as written.
- 🛑 **COST 2 — THE OPERATOR'S FILES.** `apps/capture/src/main.ts:30-31` reads the profile and the
  operator record from the **host filesystem** by absolute path, and ADR-0054 D2/D3 requires those
  paths to live **outside the checkout** and refuses relative ones. A containerised CLI needs
  `/var/lib/age-operator` bind-mounted, and every ad-hoc document the operator points it at needs a
  mount too — 🚫 or the CLI silently stops being able to read the operator's own machine, which is
  what it is _for_.
- ⚠️ **COST 3 — WHO MAY RUN IT.** `docker run` requires Docker access. `age-deploy` deliberately has
  none (ADR-0077, measured). So either the operator keeps running it as `drishti` (which has Docker,
  and is the account this whole track is narrowing) or a **fifth wrapper** joins ADR-0077's four —
  and a wrapper that runs a container with a bind-mount of an operator-supplied path is a much wider
  wrapper than the four that exist.
- **Migrations:** ⚠️ `provision-studio-database.sh` and `psql` also lose the port and need the same
  containerised treatment or `docker exec`.

### Option B — Keep the publication, filter it at the kernel by owning uid

Leave `127.0.0.1:5442` and add an `iptables`/`nftables` OUTPUT rule with an owner match, permitting
only the operator's uid to reach it.

- **Invariant:** ⚠️ **PARTIAL, AND IT FAILS THE CLAUSE THAT MATTERS.** It stops unprivileged host
  processes. 🚫 It does **not** stop `drishti`, which is root-equivalent and can simply remove the
  rule. **A control the adversary can delete is not a control** — and on this host the most plausible
  "compromised peer" path _is_ `drishti`.
- ✅ Zero code change; ✅ `age-capture` untouched; ✅ guard untouched.
- 🚫 **REJECTED as the primary answer.** It is a promise where §1.5's own standard asks for a fence.
  ⚠️ It may still be worth having as **defence in depth** alongside the chosen option.

### Option C — 🛠️ **RECOMMENDED.** Give the capture container the store's own network namespace, then remove the publication

Run `age-capture` as a short-lived container with `network_mode: "container:age-postgres"` (or a
compose service equivalent). Inside that namespace **`127.0.0.1:5432` IS the database**.

- **Invariant:** ✅ **fully satisfied, identically to A** — the host publication is deleted, so there
  is no host port for anyone to dial.
- 🛑 **AND IT KEEPS §1.4 EXACTLY AS SHIPPED.** The target is literally `127.0.0.1`. `DATABASE_URL_APP`
  becomes `postgresql://age_app:…@127.0.0.1:5432/…`. ⚠️ **`assertLocalDatabaseTarget` PASSES
  UNMODIFIED, ADR-0061 A5 IS NOT WEAKENED, AND ADR-0075 D4 IS NOT APPROACHED.** No shipped refusal is
  relaxed to obtain the invariant — which is the property that distinguishes this option from A and
  the reason it is the recommendation.
- ⚠️ **It shares Option A's costs 2 and 3** — the operator files still need mounting, and running a
  container still needs Docker access or a wrapper. 🚫 Do not read C as cost-free; read it as A
  **minus the guard relaxation**.
- ⚠️ **Honest limit:** sharing a namespace with the store means the capture container sees the
  store's network view. That is a _tighter_ namespace than `age-internal`, not a looser one, but it
  should be stated rather than glossed.
- ⚠️ **Its own risk:** `network_mode: container:` binds to a container **lifecycle**. If
  `age-postgres` is recreated, the capture container's namespace target is gone. For a short-lived
  invocation that is acceptable; 🚫 it must not be used for anything long-running.

### Option D — Replace the TCP publication with a Unix domain socket, guarded by filesystem permissions

Bind-mount the store's socket directory to a host path owned `root:age-operator 0750`; delete the
`ports:` block.

- **Invariant:** ✅ satisfied against unprivileged host processes and ✅ against every peer container
  (no port exists). ⚠️ `drishti`/root still reach it — but that is true of **every** option including
  A and C, because root can enter any namespace. 🚫 Do not treat this as D's specific weakness.
- 🛑 **COST — IT BREAKS §1.4 IN A DIFFERENT WAY.** A socket URL has an **empty hostname**, and
  `databaseTargetHost` returns `undefined` for that, which the caller **refuses**. The guard would
  need a new, explicitly-reasoned socket branch. ⚠️ That is arguably a _better_ change than A's
  (a socket path is not a network target at all), but it is still a change to a shipped refusal.
- ⚠️ `age-capture` keeps running as a **host process** — 🚫 no container, no bind-mount problem, no
  fifth wrapper. **That is D's real advantage over A and C** and it is substantial.
- ⚠️ Prisma/`libpq` socket support is real but is a materially different connection path than the one
  every existing test exercises.

### Option E — Do nothing; record the exposure as accepted

- **Invariant:** ❌ not satisfied.
- ⚠️ **🚫 NOT DISMISSED OUT OF HAND**, but only for the reason in §1.5: if the prerequisite
  measurement shows **no peer container can reach the port**, then the residual exposure is
  "arbitrary host processes on a box where `drishti` is already root-equivalent" — and every option
  above leaves _that_ untouched. 🛑 **In that case the honest answer may be that D8 is smaller than
  ADR-0076 stated and is dominated by ADR-0077 §2.1**, which is an owner decision about `drishti`,
  not about a port. ⚠️ Choosing E without the measurement is 🚫 not available.

---

## 3. COMPARISON

|                                     | A (age-internal)          | B (uid filter) | **C (shared netns)** | D (unix socket)        | E (nothing) |
| ----------------------------------- | ------------------------- | -------------- | -------------------- | ---------------------- | ----------- |
| Host port removed                   | ✅                        | 🚫             | ✅                   | ✅                     | 🚫          |
| Stops arbitrary host processes      | ✅                        | ⚠️ except root | ✅                   | ✅                     | 🚫          |
| Stops a root-equivalent `drishti`   | 🚫                        | 🚫             | 🚫                   | 🚫                     | 🚫          |
| **Relaxes a shipped refusal**       | 🛑 **yes — A5 + D4 risk** | ✅ no          | ✅ **no**            | ⚠️ yes — socket branch | ✅ no       |
| `age-capture` stays a host process  | 🚫                        | ✅             | 🚫                   | ✅                     | ✅          |
| Needs operator-file bind mounts     | 🛑 yes                    | ✅ no          | 🛑 yes               | ✅ no                  | ✅ no       |
| Needs Docker access / a 5th wrapper | ⚠️ yes                    | ✅ no          | ⚠️ yes               | ✅ no                  | ✅ no       |
| `age.peer.v1` untouched             | ✅                        | ✅             | ✅                   | ✅                     | ✅          |
| Studio untouched                    | ✅                        | ✅             | ✅                   | ✅                     | ✅          |

🛑 **THE ROW THAT DECIDES IT IS "RELAXES A SHIPPED REFUSAL".** A obtains the invariant by weakening
the one guard standing between the capture chain and a peer's bridge address. C obtains **the same
invariant** without touching it. ⚠️ **That is not a preference; it is the whole difference.**

⚠️ **AND THE ROW NOBODY SHOULD SKIP IS "STOPS A ROOT-EQUIVALENT `drishti`" — 🚫 EVERY COLUMN IS `🚫`.**
No option in this ADR reduces `drishti`'s reach. 🛑 **D8 IS THEREFORE NOT THE LAST WORD ON THIS HOST**,
and closing it must 🚫 never be reported as "AGE's database is now unreachable".

---

## 4. RECOMMENDATION

🛠️ **Option C, in three slices, with §1.5's measurement as slice 0 and a hard stop after it.**

0. ✅ **DONE — §1.5b.** Raw TCP connect from inside each peer container and from a non-privileged host
   account, with a falsifying control. ⚠️ It was re-presented to the owner, who confirmed C stands:
   the exposure is host-level, 🚫 not peer-level, and the publication is surface either way.
1. Move `age-capture`'s invocation into a container sharing `age-postgres`'s namespace, with the
   operator workspace mounted. 🚫 The publication stays up in this slice — the CLI must be proven
   working on the new path **before** the old one is removed. ⚠️ ADR-0077 D7's rollback discipline.
2. Delete the `ports:` block. Re-run slice 0's probes and confirm they now fail. Add a guard
   asserting the compose file publishes nothing.

⚠️ **`provision-studio-database.sh` and the migration path are part of slice 1, 🚫 not an afterthought**
— they use the same port and will break with it.

🚫 **What this recommendation does not do:** it does not touch `age.peer.v1`, does not touch the
Studio, does not modify any peer, does not alter `drishti`'s rights, and does not relax
`assertLocalDatabaseTarget`, ADR-0061 A5 or ADR-0075 D4.

---

## 5. 🚫 OUT OF SCOPE

🚫 Changing `drishti`'s sudo rights, group membership or ownership of anything under `/opt`.
🚫 Modifying any peer's container, network, configuration or database (ADR-0076 §2, unchanged).
🚫 Any change to `age.peer.v1`, the pinned key set, or the operator-mediated relay.
🚫 Any Studio functional change. 🚫 Any new inbound endpoint (ADR-0069 D7).
🚫 Building session provisioning. 🚫 Deleting `/home/drishti/age` (ADR-0077 D7's rollback path).

---

## 6. THE DECISION — ANSWERED

✅ **OPTION C.** Slice 0 was taken first, on the owner's instruction, and is recorded as §1.5b.
🛠️ Authorized: **C1 → C2 → C3**, in that order, exactly as §0.2b states them, then a full real-VPS
acceptance. 🚫 Nothing beyond C3 and its acceptance is authorized by this ADR.

🛑 **C1 SCOPE INCLUDES THE MIGRATION PATH.** `provision-studio-database.sh` and any `psql` migration
step use the same port and are part of C1 — 🚫 they must not be discovered during C3.

🛑 **C3 IS NOT REACHED UNTIL C2 HAS PROVEN THE REPLACEMENT PATH DOES REAL WORK.** In the owner's
words: _"not merely that the container can open a TCP connection."_ ⚠️ A TCP connect is what Slice 0
measured; it is 🚫 not evidence that the capture chain writes a row.

---

## 7. 🛑 THE WORDING RULE — THE ONLY CLAIM THIS ADR MAY BE REPORTED AS

The owner pinned this by hand, and §1.5b is why it is not pedantry.

✅ **PERMITTED, and this is the whole of it:**

> **AGE PostgreSQL is no longer host-published and is reachable only through the AGE internal network
> by the components authorised to use it.**

🚫 **FORBIDDEN, BY NAME:** _"AGE's database is unreachable"_ · _"AGE's database is now isolated"_ ·
any sentence crediting this ADR with closing **peer → AGE** reachability, which §1.5b measured as
**already closed before the work started**.

⚠️ **AND THE CAVEAT TRAVELS WITH THE CLAIM:** `drishti` remains **root-equivalent** and can enter
Docker namespaces. 🛑 **NO OPTION IN THIS ADR CHANGES THAT** — §3's own comparison row is `🚫` in
every column. It is a **host-identity** problem, partially addressed by ADR-0077 §2.1, and 🚫 it is
not something D8 can eliminate.
