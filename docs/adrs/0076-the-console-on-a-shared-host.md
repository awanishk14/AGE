# ADR-0076 — The console on a shared host: what `IPAddressDeny` closed, what it did not, and whether Studio is containerised

Status: **Proposed** (2026-08-16)

🛑 **THIS ADR AUTHORIZES NOTHING.** It is a decision request. 🚫 It must not be self-accepted: the
§2 mandate covers decisions the architect can reason to, and this one turns on how the Product Owner
weighs a residual risk on a host that carries four of their products. ⚠️ Read D-options as options,
🚫 not as a plan.

Depends on: ADR-0074 **D8/D9** (the deployed console and its door) · ADR-0075 **D1–D6** (AGE's own
database and the boundary a peer may never cross) · ADR-0061 **A5/A6** · ADR-0057 **D2** (OX-INV-1,
the loopback bind) · ADR-0071 **D1/D5** (the peer transport is operator-mediated) · ADR-0046 **D5**
(RLS is coherence, never authorization).
Amends: nothing. Supersedes: nothing.

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
- 🚫 **The console does not stop binding loopback.** OX-INV-1 stands: any option that publishes
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

## 4. The architect's recommendation (⚠️ a recommendation, 🚫 not a decision)

**Option A, recorded explicitly as an accepted residual, with Option C as the answer if the risk
appetite is lower** — and 🚫 **not Option B**, on the ground that it buys the same property as C
while demanding an amendment to a refusal (`next.config.mjs`) that is currently doing useful work
elsewhere, and while moving the measured, working build order into an unbuilt image on the same day
the console is first exposed publicly.

⚠️ **Finding 8 applies to this paragraph.** Adopt the evidence in §0.2 and this conclusion
separately; the evidence stands whichever option is chosen, and the architect's recommendation has
been wrong before (ADR-0075 §0.1 records exactly that).

## 5. What the Product Owner is being asked to decide

1. **A, B or C** — the disposition of the loopback residue in §0.2 item 4.
2. If **B**: 🛑 an explicit amendment to `apps/studio/next.config.mjs`'s refusal of a Dockerfile, in
   the owner's own words, plus a decision on how the operator's workspace and client record file
   reach the container.
3. Whether the symmetric fact — **peers can reach AGE's `5442` on host loopback by the same
   argument** — is in scope here or is a separate question about the peers' own deployments.

🛑 **Until this is accepted, the deployment shape does not change.** The public bind proceeds on the
sandbox already verified (#352); this ADR neither blocks it nor is discharged by it.
