# ADR-0081 — Writing a setting without becoming root: a fifth `age-deploy` wrapper

Status: **Accepted** (2026-08-19) — accepted by the Product Owner, whose words are recorded
verbatim in §9 below. 🚫 This was not self-accepted: the proposal was PR #386 and this line was
flipped by a separate PR.
⚠️ **WHAT IT AUTHORIZES IS STILL EXACTLY WHAT §1 SAYS AND 🚫 NOTHING MORE.** It amends the root
surface of a deployment identity on a host AGE shares with four peer products it does not own, and
§2.2 states plainly that this is a **widening** — acceptance does 🚫 not turn that into a narrowing.

Depends on: ADR-0077 **D1–D3, D6** (the deployment identity and its four fixed-argument wrappers) ·
ADR-0076 **D6** (a settings value is never printed, echoed or logged) · ADR-0078 **C3** (the
provisioned `DATABASE_URL` already names the container route) · ADR-0079 **§6** (Google sign-in
needs three settings the console cannot start without).
Amends: **ADR-0077 D3** — it adds a fifth wrapper to an enumerated set of four. 🚫 It does not amend
D2, D4 or D5. Supersedes: nothing.

---

## 0.1 Why this ADR exists — a measured cost, 🚫 not a discomfort

On 2026-08-18, deploying ADR-0079 slice 3 required exactly one new fact on the box: three settings —
`AGE_STUDIO_GOOGLE_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI` — appended to
`/etc/age-studio/age-studio.env`. Without them `googleSignInConfiguration()` returns `undefined` and
the console refuses everyone with `not-configured`, by design.

🛑 **`age-deploy` cannot write that file, and no wrapper does it.** Measured, that day:

1. `/etc/age-studio/age-studio.env` is `root:root 0600`. `age-deploy` is not the owner and is in no
   group that reaches it.
2. The four ADR-0077 D3 wrappers are `compose-up`, `derive-env`, `nginx-apply` and `docker-probe`.
   **None writes a setting.** `derive-env` only COPIES the file and verifies the result; since
   ADR-0078 C3 it does not even substitute.
3. `scripts/provision-studio-database.sh` writes the file — via `sudo tee` — but it is a **whole-file
   provisioning run** that also creates the database role and applies migrations. 🚫 Re-running it to
   add one setting is not a narrow act.
4. The only identity on the host that could therefore write the file is the **root-equivalent peer
   deployment account** (`drishti`: `(ALL) NOPASSWD: ALL`, plus the `docker` group).

So the settings were installed **as that account**. It worked, and 🛑 **that is exactly the problem
this ADR reports.** ADR-0077's entire benefit is that AGE stopped needing that account; a
configuration change that reaches for it again spends the benefit quietly, once per setting, forever.

⚠️ **The Product Owner named the cost first**, 2026-08-18: _"why cant you update it, i dont
understand, we can[not] keep deployment process this tough, you need to find a solution"_. 🚫 This
ADR does not treat that as a request for convenience. The convenient answer — give `age-deploy` a
`tee` or a `sudo sh -c` — is root by another name and is refused in §3 B by name.

## 0.2 What this is NOT

- 🚫 **Not a secrets manager.** No rotation, no versioning, no fetching from a remote service. AGE
  makes 🚫 no external calls, and this ADR introduces none.
- 🚫 **Not a way to READ a setting.** The wrapper is write-and-verify-by-name only. 🚫 There is no
  code path in it that emits a value (ADR-0076 D6 preserved unchanged).
- 🚫 **Not a replacement for provisioning.** `provision-studio-database.sh` still creates the
  database, the role and the initial file. This wrapper only appends or replaces a setting in a file
  that **already exists** — and refuses if it does not.

---

## 1. Decision

### D1 — A fifth wrapper, `age-deploy-settings-apply`, and it is the ONLY new privilege

Root-owned `0755 root:root` in `/usr/local/sbin`, 🚫 not writable by `age-deploy`, `set -euo
pipefail`, exactly as the four existing wrappers. One sudoers line, with the load-bearing trailing
`""` that permits it with **no arguments at all**:

```
age-deploy ALL=(root) NOPASSWD: /usr/local/sbin/age-deploy-settings-apply ""
```

🚫 **No other sudoers change.** 🚫 `age-deploy` still joins no group, and specifically 🚫 not
`docker` and 🚫 not `sudo`.

### D2 — It takes NO arguments. The settings arrive on **stdin**, and the NAMES are allow-listed

⚠️ **This is the whole security argument, so it is stated as a rule rather than a style:**

- The **file path is a literal inside the wrapper** — `/etc/age-studio/age-studio.env`. 🚫 Never an
  argument, 🚫 never an environment variable read from the caller. A caller-supplied path is a
  caller-supplied arbitrary root write, which is the `sudo tee "$VARIABLE"` shape ADR-0077 D3
  refused for nginx by name.
- Input is read on **stdin** as `NAME=value` lines, one per line.
- 🛑 **Every NAME is checked against a literal allow-list inside the wrapper.** An unknown name is a
  **refusal of the whole input**, 🚫 not a skip:

  ```
  AGE_STUDIO_GOOGLE_CLIENT_ID
  AGE_STUDIO_GOOGLE_CLIENT_SECRET
  AGE_STUDIO_GOOGLE_REDIRECT_URI
  AGE_STUDIO_ORGANIZATION_ID
  ```

  🚫 **`DATABASE_URL_APP` IS DELIBERATELY NOT ON THIS LIST.** It is written once by the provisioning
  run, it names the container route (ADR-0078 C3), and a path that could rewrite it is a path that
  could point the console at a database of the caller's choosing. That is the single most valuable
  thing this wrapper could be tricked into doing, so it cannot do it at all.

- ⚠️ **A value is never interpreted.** It is written literally after the first `=`; the wrapper 🚫
  never `eval`s, 🚫 never expands, and 🚫 never passes it to another program as an argument
  (ADR-0077's shared-host rule: credentials never enter `argv`).
- ⚠️ **A line whose name parses but whose shape is unexpected refuses.** 🚫 There is no branch that
  echoes an unparsed line — that branch is precisely how a redactor leaks.

### D3 — Append-or-replace, atomically, with the same mode it found

For each allow-listed name: remove any existing line for that name, append the new one, write to a
temporary file in the same directory, `chmod 600`, `chown root:root`, then `mv` into place. A
partial write must never be a readable state.

The wrapper **refuses** if: it is given any argument · the target file does not exist · stdin is
empty · any name is not on the allow-list · any line lacks an `=` · a duplicate name appears twice
in one input · the resulting file no longer contains `DATABASE_URL_APP`.

⚠️ The last refusal is the one that catches the realistic accident rather than the attack: a
truncating edit that leaves a console unable to reach its own store.

### D4 — It reports by NAME and length, 🚫 never by value

On success it prints one line per setting: the **name**, `len=N`, and nothing else. 🚫 No value, 🚫
no `sha256` of a value, 🚫 no diff, 🚫 no `set -x`. ⚠️ The wrapper sets no shell trace, and any
future `set -x` in it is a defect, 🚫 not a debugging aid.

### D5 — It re-derives the container copy itself, or the change does not take effect

After a successful write it invokes the existing derive step's logic so
`/etc/age-studio/age-studio.container.env` is regenerated, `600`, `age-deploy`-owned.

⚠️ **WHY THIS IS PART OF THE WRAPPER AND NOT THE CALLER'S JOB.** A settings write that is not
followed by a re-derive leaves two files disagreeing, the container keeps the OLD value, and
**nothing fails** — the deploy is green and the console is misconfigured. That silence is the exact
failure mode this ADR exists to remove, and a caller who forgets a second command reproduces it.

### D6 — Guards, split honestly between repository facts and host facts

**Repository facts (added to `packages/deployed-origin/src/tests/deploy-wrapper-boundary.spec.ts`,
which already scans the wrapper directory and strips comments before scanning):**

1. The expected-wrapper list becomes **five**, and the no-argument list becomes **four**. ⚠️ The
   existing guard asserts the set exactly, so a fifth file is a FAILURE until this is done — 🚫 the
   guard is not widened to tolerate an unknown wrapper.
2. The new wrapper contains 🚫 no `docker`, `nginx`, `certbot`, `systemctl`, `eval`, `set -x`, and
   🚫 no `$1`/`$@`/`$*` — the existing scan already asserts this shape for the other four.
3. **The allow-list is asserted by name, and `DATABASE_URL_APP` is asserted ABSENT from it.** ⚠️ A
   guard that only checked "an allow-list exists" would pass after someone added one more name to it,
   and adding one more name is exactly how this wrapper becomes an arbitrary root write.
4. The sudoers drop-in contains exactly **five** lines, and the new one carries the trailing `""`.

**Host facts, 🚫 which a repository test cannot assert and must not pretend to:** that the wrapper is
root-owned `0755`, that `sudo -n -l` for `age-deploy` lists five entries and nothing else, and that
`age-deploy` is still in no group but its own. These are measured on the box in the installation
slice and recorded in `docs/reviews/ADR0077_DEPLOY_IDENTITY_CHECKPOINT.md`.

⚠️ **Each guard is made to FAIL before it is trusted** — an unlisted name accepted, the
`DATABASE_URL_APP` assertion inverted, a `$1` introduced — and restored by a targeted inverse edit,
🔴 never `git checkout <file>`.

### D7 — The negative case is part of acceptance, 🚫 not a follow-up

On the real box, `age-deploy` must be shown to be **refused** when it: passes an argument · sends
`DATABASE_URL_APP=…` · sends an unknown name · sends a line with no `=`. 🚫 A slice that only
demonstrates a successful write has demonstrated the wrong half.

---

## 2. What this ADR explicitly does NOT claim

### 2.1 🚫 It does not shrink the peer account

`drishti` keeps `(ALL) NOPASSWD: ALL` and the `docker` group. ADR-0077 §2.1 stands unchanged. What
changes is only that **AGE stops needing it for configuration** — one more reason to reach for it,
removed. 🚫 This ADR must never be cited as having narrowed the peer identity.

### 2.2 ⚠️ It WIDENS `age-deploy`, and the widening is real

Before: `age-deploy` could not write any root-owned file. After: it can write **four named settings**
into **one named file**. 🛑 That is a genuine increase in what a compromised deploy key can do, and
🚫 it is not neutralised by calling the wrapper narrow.

What bounds it: the path is a literal, the names are a literal allow-list, `DATABASE_URL_APP` is
excluded, and 🚫 nothing in the wrapper reaches `docker`, a shell, or a caller-supplied path. The
worst outcome of a compromised key becomes **a console pointed at an attacker's Google client** —
serious, and strictly smaller than today's alternative, where the same task is performed by an
account that can read every peer's secrets.

### 2.3 🚫 It does not resolve ADR-0076 D8, and 🚫 it does not touch the console's isolation

Neither is affected in any direction. 🛑 D8 remains open and the owner's.

### 2.4 🚫 It does not make sign-in work

Sign-in already works (deployed and exercised 2026-08-18). This ADR is about the **next** setting
change, and the one after that. ⚠️ It is written now precisely because nothing is currently broken —
🚫 a boundary decision taken under pressure to unblock a deploy is the one that gets widened.

---

## 3. Alternatives considered

**A. Leave it: use the root-equivalent peer account for AGE's config.** 🚫 Rejected. It is what
happened on 2026-08-18, it worked, and that is the danger — an unrecorded habit that spends
ADR-0077's benefit a little at a time, with no test that ever fails.

**B. Give `age-deploy` `NOPASSWD` on `tee`, `sed -i` or `sh -c` for that path.** 🚫 Rejected, and it
is the tempting one. Free arguments to `tee` write **any** root-owned file; `sed -i` with a
caller-supplied expression is an arbitrary root write with extra steps; `sh -c` is a root shell. This
is the shape ADR-0077 §3 C called "looks narrow in a sudoers file and is not".

**C. Widen `age-deploy-derive-env` to accept settings.** 🚫 Rejected. It would make one wrapper both
a reader and a writer of the same file, and 🛑 **it is a widened guard in wrapper form** — the
existing no-argument refusal would have to be relaxed to let it through. The repo's standing rule is
to narrow a guard to follow a change, 🚫 never to widen one to make something pass.

**D. Re-run `provision-studio-database.sh` for every setting change.** 🚫 Rejected. It requires the
superuser password, creates roles and applies migrations. Using a whole-database provisioning run to
change one string is how an unrelated destructive step gets normalised.

**E. A fifth fixed-argument wrapper taking allow-listed names on stdin (chosen).** The only option
where the sudoers entry means what it appears to mean. Its cost is honest: **a fifth root-owned file
to maintain**, and one more thing that can drift from the scripts calling it — which is why D6 guard
3 asserts the allow-list by name rather than merely asserting one exists.

**F. Move the settings into the container image or the compose file.** 🚫 Rejected. A client secret
in an image is a client secret in the registry and in every layer cache; a compose file lives in the
checkout, and 🚫 secrets are never committed.

---

## 4. Consequences

- A setting change becomes one narrow command run as `age-deploy`, and the deploy stops requiring a
  root-equivalent login. This is the entire benefit, and it is the owner's stated complaint answered.
- `age-deploy` gains a real, bounded write privilege (§2.2). 🚫 Not free, and 🚫 not hidden.
- A fifth root-owned file joins AGE's deployment surface. D6 guards 1–4 catch drift in **shape**;
  🚫 they cannot catch drift in **intent** — adding a fifth name to the allow-list will always be one
  small edit away, and guard 3 is what makes that edit visible in a diff.
- The container copy can no longer silently disagree with the source file (D5).
- ⚠️ **AGE's credentials still live in one place on one box.** The local backup taken 2026-08-18
  mitigates loss, 🚫 not compromise. Out of scope here; worth its own decision.

## 5. What this ADR does not authorize

🚫 Any change to `drishti`'s sudo rights, groups, or ownership of anything under `/opt`.
🚫 Any new group membership for `age-deploy`.
🚫 Adding `DATABASE_URL_APP`, or any name not in D2, to the allow-list.
🚫 A wrapper that READS or PRINTS a setting value.
🚫 Any external call, secrets service, or fetch — AGE's hard boundaries are unchanged.
🚫 Touching any peer container, network, vhost, certificate or `.env`.
🚫 Discharging ADR-0076 D8, or any change to the public URL or its exposure.

---

## 6. Slices

**Slice 1 — this ADR.** Records the decision and the measured cost. 🚫 Authorizes no host change.

**Slice 2 — the wrapper and its guards**, only after acceptance: add
`deploy/vps/wrappers/age-deploy-settings-apply`, add the fifth sudoers line, extend
`deploy-wrapper-boundary.spec.ts` per D6, each guard made to fail first. 🚫 No host change in this
slice — it is a repository slice, and the wrapper file is inert until installed.

**Slice 3 — the installation**, on the real box: install the wrapper root-owned `0755`, install the
sudoers drop-in, then **demonstrate the four refusals of D7 as `age-deploy`** before demonstrating a
successful write. ⚠️ Report only what was measured on the VPS; 🚫 CI green is not host-level proof.

---

## 7. The one-sentence summary a later reader will need

🛑 **This ADR gives the AGE deployment account a bounded ability to write four named settings into
one named file, so that changing configuration no longer requires the root-equivalent account that
ADR-0077 removed AGE from — and it widens `age-deploy` to do so, which is stated plainly in §2.2
rather than described as a narrowing.**

## 8. Standing rules this ADR does not repeal

⚠️ A guard is evidence only once it has been **made to fail**; restore with a targeted inverse edit,
🔴 never `git checkout <file>`. ⚠️ A walk-the-repo guard must first assert the walk found files.
⚠️ Strip comments before scanning source for a banned token. 🛑 **A NARROW SCAN IS NOT A NARROW
RULE** — a guard whose scope is narrower than the rule it asserts is the pattern that produced every
audit gap in this repository. 🚫 Credentials never enter `argv` on this shared host. 🚫 Never claim
verification that did not happen: `curl` is not a browser, and a repository test is not a VPS fact.

---

## 9. The Product Owner's decision (2026-08-19)

Asked whether to build the fifth wrapper, the owner answered, **verbatim**:

> add the fifth wrapper

⚠️ That is the whole of the answer, and 🚫 nothing is read into it beyond §1.

### What it settles, and what it does 🚫 NOT

- **Slices 2 and 3 of §6 are authorized**, in that order. 🛑 Slice 2 is a **repository** slice: the
  wrapper file is **inert until installed**, and 🚫 no host changes in it.
- 🛑 **Slice 3 touches the real box, and 🚫 it is not done by inference.** The **four refusals of
  D7 are demonstrated as `age-deploy` BEFORE** the first successful write — 🚫 a wrapper that has only
  ever succeeded is not evidence, exactly as a guard that has only ever passed is not.
- 🚫 **The four settable names stay the enumerated four.** A fifth name is a new decision, 🚫 not an
  extension of this one.
- 🚫 **Nothing here relaxes §8.** 🛑 A settings value is still 🚫 never printed, echoed or logged
  (ADR-0076 D6), credentials still 🚫 never enter `argv`, and 🚫 `sudo -E` is still refused.
- ⚠️ **The docker-capable peer account remains root-equivalent.** This ADR removes a reason to
  borrow it; 🚫 it does 🚫 not reduce what that account can do, and 🚫 no report may claim it did.
