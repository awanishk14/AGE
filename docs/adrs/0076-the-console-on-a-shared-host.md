# ADR-0076 — The console on a shared host: what `IPAddressDeny` closed, what it did not, and whether Studio is containerised

Status: **Accepted** (2026-08-16) — by the **Product Owner**, in their own words (§0.3).
🚫 **NOT self-accepted.** ⚠️ The acceptance is **bounded by §0.3b**: the owner rejected option A and
set the principle; the residual engineering choice — B's exact shape — is the architect's under the §2
mandate and is recorded as D1–D8, 🚫 not as the owner's words.

Depends on: ADR-0074 **D8/D9** (the deployed console and its door) · ADR-0075 **D1–D6** (AGE's own
database and the boundary a peer may never cross) · ADR-0061 **A5/A6** · ADR-0057 **D2** (OX-INV-1,
the loopback bind) · ADR-0071 **D1/D5** (the peer transport is operator-mediated) · ADR-0046 **D5**
(RLS is coherence, never authorization).
Amends: **ADR-0057 D2 (OX-INV-1)** — see D2, explicitly and in one place. Supersedes: nothing.

---

## 0.1 Why this ADR exists

ADR-0075 D3 states the principle in the owner's own words: _"AGE has no database access to RankOps,
SNARA, Drishti or any other peer database"_ and _"peer products communicate with AGE through the AGE
semantic contracts, never through database sharing."_

⚠️ **That is a statement about what AGE DOES. It has never been a statement about what the process
CAN DO**, and until slice 4 the difference did not matter, because the console was reachable only
through an SSH tunnel by somebody who had already authenticated to the host. The public bind removes
that, and the question becomes whether the principle is a mechanism or a promise.

The Product Owner asked it directly:

> _"If the existing architecture means the host-level Studio process can reach peer-product database
> bridge networks, inspect whether that violates the intended production security boundary. If
> containerising Studio is the correct solution, draft/implement ADR-0076 as required by the
> existing roadmap. Do not silently override the ADR."_

## 0.2 What was measured (2026-08-15/16, on the real VPS)

🚫 Not inferred from configuration files. Every line below was executed on the box.

1. **The service account is highly privileged.** `age-studio` runs as the deploy user, and
   `sudo -n -l` for that user reports `(ALL) NOPASSWD: ALL`. ⚠️ The host carries four products.
2. **The unit had no sandboxing at all.** `NoNewPrivileges=no`, `ProtectSystem=no`,
   `ProtectHome=no`, `PrivateTmp=no`.
3. **Six Docker bridge networks exist on the host**, carrying the peer stores. A host process could
   route to them.
4. **Three PostgreSQL ports are published on host loopback**: `127.0.0.1:5432` (a peer's),
   `127.0.0.1:5442` (AGE's own, ADR-0075), `127.0.0.1:6379` (a peer's Redis). All three are
   `docker-proxy` publications — 🚫 none is reachable from off-box, and 🚫 none from inside another
   container.
5. **A TCP connection from the host to the peer store SUCCEEDS**, and the server answers the startup
   packet with authentication request **code 10 — SCRAM-SHA-256**. ⚠️ So reachability is real and
   authentication is the only thing in the way; 🚫 it is not `trust`.
6. **No peer credential is readable by the service account.** Its home contains only AGE's checkout;
   the peers' env files are root-owned.

### What has already been done about it (#352, merged separately, authorizing nothing here)

The unit now carries `NoNewPrivileges=yes`, `IPAddressDeny=any` with `IPAddressAllow=127.0.0.1/32`
and `::1/128`, `RestrictAddressFamilies`, `ProtectSystem=strict` with `ReadWritePaths` naming only
the checkout and the operator workspace, and the usual kernel protections. Verified on the box:
service active, loopback-only, its own store still reachable, and a **Docker bridge address denied**.

🛑 **THAT CLOSES ITEM 3 AND DOES NOT TOUCH ITEM 4.** Loopback must stay open for AGE's own store on
`127.0.0.1:5442`, and a systemd address rule cannot express a port. So the console process can still
open a socket to a peer's database. **That residue is the whole subject of this ADR.**

## 0.3 THE OWNER'S DECISION (2026-08-16), VERBATIM

> _"One important architectural clarification: all my applications on the VPS are containerised
> specifically so that if one application is compromised, it cannot automatically reach the others.
> Therefore, before public exposure of AGE, reassess ADR-0076 against this principle. I do not want
> to simply accept AGE Studio's current host-level ability to reach peer PostgreSQL services."_
>
> _"Test network reachability directly, not merely whether an application query returns data."_
>
> _"If containerising Studio is the cleanest way to achieve the same isolation model as the other
> applications, pursue that through the required ADR rather than silently overriding an existing
> decision."_

🛑 **OPTION A IS REJECTED.** 🚫 The residue in §0.2 item 4 may not be accepted as a residual risk,
and 🚫 the public bind may not proceed on the #352 sandbox alone — which is what §5's closing line
previously contemplated and what §4 previously recommended. ⚠️ **The architect's recommendation was
WRONG against the owner's actual security model**, and finding 8 is why the evidence in §0.2 stands
while the conclusion drawn from it did not.

⚠️ **THE PRINCIPLE IS NOW EXPLICIT AND IS THE THING TO SATISFY:** isolation is a **containment
boundary**, 🚫 not a credential. The question is 🚫 never "could AGE authenticate to a peer store" but
**"if the console is compromised, what can the compromised process reach at all."**

### 0.3b 🚫 WHAT THE OWNER DID _NOT_ DECIDE

⚠️ Recorded so no later reader mistakes the architect's work for the owner's instruction:

- 🚫 They did **not** choose between B and C. They said containerise **if it is the cleanest way to
  achieve the same isolation model**. §4 now argues that it is, on the measurement in §0.4 — that
  argument is the architect's.
- 🚫 They did **not** specify how the operator workspace and client record file reach the container
  (§5 item 2), nor the container's own bind/publication shape. D4–D6 decide those.
- 🚫 They did **not** answer §5 item 3 — whether the symmetric fact that **peers can reach AGE's
  `5442`** is in scope. D8 records it as still open, 🚫 not as closed.

## 0.4 THE DIRECT REACHABILITY MEASUREMENT (2026-08-16) — the owner's test, run their way

🛑 **A RAW TCP CONNECT FROM THE CONSOLE'S OWN SANDBOX CONTEXT, 🚫 NOT AN APPLICATION QUERY.** Run via
`systemd-run` carrying the shipped unit's rules, as the service user, on the real VPS:

| From the console process, to                    | Result                            |
| ----------------------------------------------- | --------------------------------- |
| AGE postgres `127.0.0.1:5442`                   | **REACHABLE** — required, correct |
| **SNARA postgres `127.0.0.1:5432`**             | 🛑 **REACHABLE — THE VIOLATION**  |
| **SNARA redis `127.0.0.1:6379`**                | 🛑 **REACHABLE — THE VIOLATION**  |
| SNARA postgres `172.19.0.4:5432` (container IP) | denied                            |
| RankOps postgres `172.21.0.2:5432`              | denied                            |
| Drishti postgres `172.18.0.2:5432`              | denied                            |
| Scanner MySQL `172.20.0.3:3306`                 | denied                            |
| AGE postgres `172.23.0.2:5432` (container IP)   | denied                            |

⚠️ **ONE CORRECTION TO §0.2 ITEM 4:** the peer store published on `127.0.0.1:5432` is **SNARA's**,
🚫 not RankOps'. RankOps', Drishti's and the scanner's stores are **not published to the host at
all** — they are reachable only inside their own bridge networks, which `IPAddressDeny=any` already
closes. 🛑 **So the entire violation is the loopback-published SNARA pair, and nothing else.**

⚠️ **AND THE TOPOLOGY IS THE ARGUMENT FOR B:** every peer product already sits on its own Docker
network (`rankops-internal`, `drishti_internal`, `infra_default`, `scanner-infra_default`), and AGE
already has `age-internal` carrying `age-postgres`. 🛑 **The console is the ONLY component of any
product on that host still running outside a container.** That is precisely the asymmetry the owner
described, measured rather than asserted.

## 0.4b ⚠️ ERRATUM — D3's "PUBLISHES NO PORT AT ALL" WAS DRAFTED ON A PREMISE THAT MEASURED FALSE

🛑 **MEASURED ON THE REAL VPS AFTER THE DECISIONS BELOW WERE WRITTEN:** the host's own nginx binds
`0.0.0.0:80` and `0.0.0.0:443` and already serves **five other products' vhosts**
(`aivisibilityscanner`, `digitaldadi.agency`, `drishti`, `rankops`, `snara`). D4's reverse proxy was
drafted as a container publishing `80:80`/`443:443`. 🚫 **It cannot: those ports are taken, and
taking them would take five live sites down.** ⚠️ This ADR's own §2 forbids touching a peer's
deployment, so migrating their vhosts into an AGE-owned proxy is 🚫 refused, not deferred.

⚠️ **AND THE OBVIOUS REPAIR IS WORTH LESS THAN IT LOOKS.** A container proxy published on
`127.0.0.1:8100`, fronted by the host nginx, would keep D3 literally true — and would forward every
request to the console unconditionally, so **any process on that host could reach the console
through it exactly as it could reach a published `127.0.0.1:3100`.** 🛑 **The security difference is
nil**; the difference is one more hop and one more config file. A shape that reads as stronger
without being stronger is the kind of thing this repository refuses by name.

🛑 **SO D3 IS AMENDED, AND ITS FALSIFIED SENTENCE IS KEPT BELOW RATHER THAN ERASED.** The studio
container publishes **exactly one port, on host loopback only**: `127.0.0.1:3100:3100`. The
enumerated boundary of amended OX-INV-1 is therefore **host loopback** — the same boundary the
console has had since ADR-0057 D2, now reached through a publication rather than a bind.

⚠️ **WHAT THIS DOES NOT COST.** 🛑 **D1 IS UNTOUCHED, AND D1 IS THE OWNER'S PRINCIPLE.** The console
still runs in a namespace attached to `age-internal` and nothing else, so it still has **no route to
SNARA's postgres, SNARA's redis, or any peer's store** — publication is inbound, and it grants the
console no outbound reach whatever. The violation §0.4 measured is removed in full. What is lost is
only D3's extra claim, which this topology never supported.

🚫 **THIS IS AN ERRATUM ON A MEASUREMENT, 🚫 NOT A RELAXATION OF THE OWNER'S DECISION**, and it is
flagged for the Product Owner's confirmation rather than presented as settled.

## 1. The question, stated precisely

> Is "the AGE process can open a TCP socket to a peer's database, but holds no credential for it and
> speaks SCRAM to nothing" an acceptable production boundary — or must the process be placed
> somewhere it cannot reach those ports at all?

⚠️ **Note what is NOT in question.** 🚫 No AGE code connects anywhere but its own store; that is
guarded, and `packages/deployed-origin` asserts the single `new PrismaClient(` site. The risk here
is **post-exploitation reach**, not intended behaviour. The honest framing: if an attacker achieves
code execution inside the console, what is one hop away?

## 2. What is refused regardless of which option is chosen

- 🚫 **No AGE code gains a peer database client, connection string, driver or credential** — not
  behind a flag, not for diagnostics, not "read-only". ADR-0075 D3 is unamended by this ADR.
- 🚫 **The console's listener never becomes reachable from the network.** ⚠️ **D2 AMENDS HOW THIS IS
  EXPRESSED** — the boundary, not the literal string `127.0.0.1` — but any option that publishes
  `3100` on a public interface is refused, whatever else it does.
- 🚫 **No peer's container, network, volume or configuration is modified to accommodate AGE.**
- 🚫 **The reverse proxy does not become the authentication** (ADR-0074), whichever option is taken.

## 3. Options

### Option A — Accept the residue; the sandbox as shipped is the boundary

The process can reach the port and cannot authenticate to it. Credentials are the boundary, as they
are for every other pair of services on the host, in both directions — ⚠️ **the peers can reach
AGE's `5442` today by exactly the same argument**, and nothing in ADR-0075 treats that as a breach.

- ✅ Nothing further to build; no new failure mode introduced.
- ✅ Honest about where the boundary actually is.
- 🚫 A promise plus a password, not a mechanism. A credential-disclosure defect anywhere on the box
  becomes cross-product.

### Option B — Containerise `apps/studio`

Run the console in its own container on AGE's own Docker network, with no route to the other bridges
and no host loopback. Peer ports become unreachable by construction.

- ✅ The strongest form of the boundary, and it matches ADR-0075's shape for the database.
- 🚫 **`apps/studio/next.config.mjs` REFUSES A DOCKERFILE BY NAME** — that refusal is on `main` and
  is load-bearing for OX-INV-1's argument. This option requires amending it explicitly, 🚫 never
  quietly.
- 🚫 The operator's workspace and client record file (ADR-0054) live on the host outside the
  checkout; they would have to be bind-mounted, which is a new surface with its own decision.
- 🚫 Deployment, build ordering (`prisma:generate` before `next build` — measured, load-bearing) and
  the sandbox all move into an image nobody has built.

### Option C — A network namespace without a container image

Keep the deployment shape exactly as it is and restrict egress at the socket level instead, so the
process may reach `127.0.0.1:5442` and nothing else on loopback.

- ✅ No Dockerfile, no image, no bind mounts — nothing in ADR-0057/0061's shape changes.
- 🚫 systemd has no port-level address rule; this needs either an nftables rule keyed on the
  service's cgroup, or `PrivateNetwork=yes` plus a dedicated veth — both real mechanisms, both
  materially more operational machinery than the risk may warrant.
- ⚠️ It is the option that gets the security property of B without B's cost, and the option most
  likely to break in a way nobody notices until the console cannot reach its own database.

## 4. ⚠️ THE SUPERSEDED RECOMMENDATION — kept, 🚫 not deleted

The architect recommended **A, with C as fallback, explicitly not B**, on the ground that B demanded
an amendment to `next.config.mjs`'s refusal and moved a measured build order into an unbuilt image
on the day of first exposure.

🛑 **THAT RECOMMENDATION IS SUPERSEDED BY §0.3 AND IS LEFT HERE ON PURPOSE.** It weighed build risk
against a boundary the owner had already decided elsewhere — every other application on the host is
containerised for exactly this reason. ⚠️ **A cost argument is not a security argument**, and
"nothing further to build" was doing more work in that paragraph than it was entitled to.

### 4b Why B and 🚫 not C, on the measurement

C (an nftables rule or a private netns) can produce the same table as B. It is refused because:

- 🚫 **It is a mechanism unique to AGE.** Five products on the host already express this boundary one
  way — a container on its own network. A sixth, bespoke, socket-level rule is the copy that gets
  relaxed, and the one nobody else on the host knows exists.
- 🚫 **It fails silently in the dangerous direction.** A dropped nftables rule after a reboot or a
  Docker restart restores peer reachability with the console still running and every screen green.
  A container with no route cannot regain one by forgetting a rule.
- ✅ **B removes the reach rather than filtering it** — the property the owner asked for, by
  construction rather than by policy.

## 5. DECISIONS

**D1 — `apps/studio` IS CONTAINERISED**, on AGE's own Docker network, as every other product on the
host already is. Option A is refused; option C is refused.

**D2 — 🛑 OX-INV-1 IS AMENDED, EXPLICITLY AND IN ONE PLACE.** ADR-0057 D2 said the console binds
loopback or refuses to start, and `next.config.mjs` refused a Dockerfile **by name** because "a
published container port in front of a loopback listener defeats the whole invariant."
⚠️ **THAT SENTENCE IS STILL TRUE, AND D3 IS WHY IT DOES NOT APPLY.** The invariant's _purpose_ was
never the string `127.0.0.1`; it was **"the console listener is not reachable from the network."**
The amended invariant states the boundary rather than one implementation of it:

> **OX-INV-1 (amended): the console's listener is reachable only from an explicitly enumerated
> boundary — host loopback when it runs on a host, or an UNPUBLISHED container network when it runs
> in a container. 🚫 There is no third mode, and 🚫 neither mode is selectable by an environment
> variable.**

**D3 — 🛑 THE STUDIO CONTAINER PUBLISHES ONE PORT, ON HOST LOOPBACK, AND 🚫 NOTHING ELSE.**
⚠️ **AMENDED BY §0.4b — READ IT.** The published mapping is exactly `127.0.0.1:3100:3100`; 🚫 never
`0.0.0.0`, 🚫 never a second port, 🚫 never the database. **As originally drafted D3 read:**
_"THE STUDIO CONTAINER PUBLISHES NO PORT AT ALL … strictly stronger than the host-loopback bind it
replaces"_ — ⚠️ **that was measured false**: the host's nginx already owns `80`/`443` for five peer
vhosts, and the only D3-preserving alternative forwards to the console from host loopback anyway.
🚫 **The falsified sentence is kept here on purpose**, so nobody re-derives it from scratch.

**D4 — ONE NETWORK, AND IT CARRIES NO PEER.** `age-internal` carries the console and `age-postgres`;
🛑 **the console is attached to that network and to nothing else.** ⚠️ **AMENDED BY §0.4b:** the
separate edge network and the AGE-owned reverse-proxy container are 🚫 **not built** — the host's
existing nginx is the public terminator, it reaches the console over host loopback, and it has no
Docker network membership at all, so **the public-facing component still has no route to any
database** (the owner's fifth and sixth proofs) by a plainer construction than the one drafted.

**D5 — THE OPERATOR'S WORKSPACE AND CLIENT RECORD FILE ARE BIND-MOUNTED READ-ONLY**, at the same
paths, and 🚫 nothing else from the host is mounted. ⚠️ ADR-0054's rule that an operator file's path
is never defaulted is unchanged: the paths still arrive as configuration and are still refused if
they fall inside the repository.

**D6 — 🚫 NO SECRET REACHES THE CONTAINER THROUGH A COMMAND LINE OR AN IMAGE LAYER.** The database
URL arrives as an env file readable only by the deploy user, 🚫 never `--build-arg`, 🚫 never `ENV` in
the Dockerfile, 🚫 never a compose literal. ⚠️ #350's rule extends unchanged: a command line is
public on that host.

**D7 — 🛑 THE BOUNDARY IS PROVEN BY DIRECT REACHABILITY FROM INSIDE THE RUNNING CONTAINER**, in the
owner's words: _"Test network reachability directly, not merely whether an application query returns
data."_ 🚫 A green screen is not proof. The §0.4 table is re-run **from inside the container** and
must invert for the two SNARA rows.

**D8 — ⚠️ THE SYMMETRIC QUESTION STAYS OPEN.** Peers can still reach AGE's `127.0.0.1:5442` on host
loopback by the same argument. 🚫 That is **NOT** discharged here and 🚫 must not be described as
closed; it is a question about the peers' deployments and AGE's publication, and it needs its own
decision. ⚠️ Removing the `5442` publication would break the host-side capture CLI (ADR-0055/0060),
so it is 🚫 not a free change.

🛑 **WHAT IS STILL REFUSED, UNCHANGED BY D1:** §2 stands in full — 🚫 no peer database client,
credential or connection string enters AGE; 🚫 no peer's container, network or configuration is
modified to accommodate AGE; 🚫 the reverse proxy does not become the authentication.
