# ADR-0091 — The file the console was never allowed to write

Status: **Accepted** (2026-08-22)

🛑 **ACCEPTED BY THE ARCHITECT, 2026-08-22, AND 🚫 NOT BY THE OWNER.** Under constitution §5 this is
internal, reversible in code, and reachable from the accepted ADRs: it changes what one container
may write to one host **file it already reads**, at a path that is already configuration. It 🚫 does
not provision or name a real person, account, membership, client or organization; it 🚫 does not
change what the outside world can reach; it is 🚫 not a product judgement about the business.
Security **posture** is mine — security **exposure** is the owner's, and 🛑 **no exposure changes
here**: no port, no network, no published address, no route, no credential.

Amends: **ADR-0076 D5** — see §4. Depends on: ADR-0054 (an operator file's path is never defaulted)
· ADR-0074 slice 3 (creating a client record is an entitled console action) · ADR-0076 (the
container boundary) · ADR-0090 (the identity a new client record is given). Supersedes: nothing.

---

## 1. What happened, measured

The owner signed in to the deployed console as an agency operator, opened `/businesses/new`, filled
in the ADR-0090 two-field form and submitted it. The console answered:

> _"The client record file could not be written."_

🛑 **THAT REFUSAL IS CORRECT, AND THE CONSOLE IS BEHAVING EXACTLY AS BUILT.** The write threw, and
`operator-workspace.ts:363` converts the throw into that sentence **without the system error**,
deliberately, because the system error carries the full path.

### 1a — The cause, and it is one line

`deploy/vps/compose/docker-compose.studio.yml:91`:

```yaml
- ${AGE_VPS_CLIENT_RECORD_FILE}:${AGE_VPS_CLIENT_RECORD_FILE}:ro
```

The client record file is bind-mounted **read-only**. `writeFileSync` cannot succeed against it, for
any uid, under any permissions. ⚠️ **The host side is not the problem and must not be "fixed":**
`clients.json` is `0600`, owned by `1002:1002`, and the container runs as exactly that uid — every
read works, which is why every screen that lists businesses is correct.

### 1b — Why it was right when it was written, and stopped being right without anyone touching it

ADR-0076 D5 mounted both operator paths read-only in the same breath as it removed the console's
route to every peer database. ⚠️ **At that moment the console only READ those files.** The sentence
in the compose comment — _"the console writes nothing on the host"_ — was a true description of the
product.

🛑 **ADR-0074 SLICE 3 THEN MADE CREATING A CLIENT RECORD AN ENTITLED CONSOLE ACTION, AND NOBODY
RE-READ THE MOUNT.** The action shipped, its guards passed, CI passed, the deploy passed, ADR-0090
rebuilt the form on top of it and its five guards passed too. ⚠️ **Every one of those gates was
green, and the feature had never once been capable of working.**

### 1c — 🛑 The class of defect, named rather than filed away

This is the fourth time a defect has passed every local gate **and** CI and died on the first real
run on the box, and it is the constitution's own warning arriving on schedule: _"RUN IT WHERE IT
RUNS, AND OPEN THE PAGE — the browser is a gate the repo does not have."_

⚠️ **The repository could not have caught this one, and 🚫 that is not an excuse — it is the
finding.** No test mounts anything. The existing guard in `studio-service-sandbox.spec.ts` asserted
the mounts were `:ro` and **passed**, because at the time it was written that was the rule. 🛑 **A
guard that encodes yesterday's rule does not fail when the rule changes; it defends the stale
answer.** That is what happened here, and it is 🚫 not fixed by deleting the guard — see D3.

## 2. The decision

**D1 — The client record file is bind-mounted READ-WRITE.** It is the one host path the console is
entitled to change, because creating a client record is an entitled console action and that record
file **is** the client registry.

**D2 — 🛑 THE DISCOVERY WORKSPACE STAYS READ-ONLY IN THIS SLICE, AND THAT IS A DEFECT LEFT
STANDING, 🚫 NOT A DECISION THAT IT IS FINE.** By the same reading, every discovery draft and answer
write will fail the same way. ⚠️ **That is a reading of the code and the compose file, 🚫 NOT a
measurement — I have not opened that form**, and I will not describe it as broken until someone
does. It gets its own slice and its own browser gate.

**D3 — The guard is NARROWED TO FOLLOW THE CHANGE, 🚫 NOT WIDENED TO PERMIT IT** (constitution
§3.8). The replacement asserts the mount list **exactly**, and asserts **per path** which mode each
one carries:

- the discovery workspace is `:ro`,
- the client record file is `:rw`,
- and 🛑 **the record file is the ONLY writable mount**, asserted by count, so a third mount cannot
  arrive writable and pass.

🚫 **`expect(mount.endsWith(':ro')).toBe(true)` is NOT relaxed to "has a mode".** A guard that
accepted any mode would pass on `- /:/host:rw`.

**D4 — 🚫 Nothing else about ADR-0076 D5 changes.** Still exactly two host paths. Still 🚫 nothing
else mounted. Still the same paths at the same addresses. ADR-0054 is untouched: the paths are
configuration, 🚫 never defaulted, and still refused if they fall inside the repository.

## 3. The cost, named rather than discovered later

🛑 **A SINGLE-FILE BIND MOUNT CANNOT BE REPLACED BY `rename()`, SO THE WRITE IS NOT ATOMIC.**
`writeFileText` is `writeFileSync`: it truncates and writes in place. A crash between the two leaves
the client registry truncated, and ⚠️ **with `:ro` that was impossible** — this decision creates a
failure mode that did not exist before, on a file that holds real client records.

Two things make it a cost I am willing to take **now** rather than a reason to stop:

- The file is small (a few hundred bytes) and every write is a single `write()` of well under a
  page. ⚠️ **That is a practical mitigation, 🚫 not a guarantee, and POSIX promises nothing here.**
- The alternative that restores atomicity is to bind-mount a **directory** so a temp file can be
  renamed over the target. 🚫 **Refused in this slice:** the only directory available is
  `/var/lib/age-operator`, which also contains the discovery workspace and the operator's other
  files, so mounting it writable would hand the console write access to all of it — **wider than
  the defect**. Moving the record file into a directory of its own is a change to the operator's
  own filesystem layout and to `AGE_VPS_CLIENT_RECORD_FILE`.

🛑 **THE DURABILITY QUESTION IS THEREFORE OPEN AND IS RECORDED AS OPEN.** If it is to be closed it
is by its own ADR — a dedicated parent directory, or a write-then-verify read-back — 🚫 not by a
quiet change to how the file is written.

## 4. The amendment to ADR-0076 D5, said plainly

D5 reads: _"THE OPERATOR'S WORKSPACE AND CLIENT RECORD FILE ARE BIND-MOUNTED READ-ONLY, at the same
paths, and 🚫 nothing else from the host is mounted."_

⚠️ What is amended is the **mode of one of the two paths**, 🚫 not the decision. The client record
file is bind-mounted **read-write**; the workspace stays read-only; **still nothing else from the
host is mounted**, still at the same paths. 🛑 **D5's actual subject — that the console sees almost
nothing of the host — is untouched and this ADR does not weaken it.**

🚫 **D1, D3, D4, D6, D7 AND D8 OF ADR-0076 ARE ALL UNTOUCHED.** No network, no published port, no
credential path, no probe, and 🛑 **D8 remains open and remains the owner's.**

## 5. The guards

1. 🛑 **The mount list is asserted EXACTLY** — two entries, in order, with their full text. A third
   mount fails it.
2. 🛑 **Each path's mode is asserted BY PATH** — workspace `:ro`, record file `:rw`. A swap fails,
   and it fails naming which path is wrong.
3. 🛑 **Exactly ONE mount is writable**, asserted by count over the list, so "a writable mount
   exists" can never be satisfied by a different one.
4. 🛑 **The environment variable NAMES A PATH AND CARRIES NO MODE.** ⚠️ **This guard was
   earned inside this slice.** While changing the mount, a stray `:rw` also landed on
   `AGE_CLIENT_RECORD_FILE` — the path the console OPENS. The console would have opened
   `…/clients.json:rw`, which does not exist, and the failure would have read as _"no client
   record file"_: a deployment silently empty of every business. 🛑 **The existing guard did not
   fail and could not have** — it used `toContain`, and `${VAR}:rw` contains `${VAR}`. A scan
   narrower than its rule, exactly the §3.8 shape this ADR was already about. The replacement
   asserts the value **ends there**.
5. **The console still runs as the derived owner of the record file** — unchanged, and re-asserted
   here because a writable mount makes the uid matter more, not less.

⚠️ Every one of these is proven by **deliberate mutation** before it is believed (constitution §5).
🚫 A guard that has only ever passed is not evidence.

## 6. 🛑 WHAT THIS DOES NOT PROVE

🚫 **A COMPOSE FILE IS NOT A RUNNING CONTAINER, AND A REPOSITORY TEST IS NOT A VPS FACT.** This ADR
is closed by exactly one thing: **the owner opening `/businesses/new` in a browser on the deployed
console and the record being created.** 🚫 CI is not that gate, 🚫 `curl` is not that gate, 🚫 the
merge is not that gate, and 🚫 neither is a successful deploy.

⚠️ **Creating the client record is an OWNER ACT** (constitution §5, §7). I 🚫 do not create one, I
🚫 do not sign in as them, and 🚫 no real client record is committed.

## 7. What this deliberately does NOT do

- 🚫 **It does not touch host permissions.** `0600`, owned by the deploy account, unchanged.
  🛑 `chmod o+w` would be the §3.8 widen-a-guard move against a file holding real client data.
- 🚫 **It does not give the console a route anywhere new.** No network, no port, no address.
- 🚫 **It does not create an outbound write surface.** The constitution's refusal is about AGE
  writing to **the outside world**; this is AGE's own operator record file, on the operator's own
  box, at a path the operator configured.
- 🚫 **It does not make AGE mint anything that grants access.** Untouched across ADR-0068, 0074,
  0079, 0080, 0082, 0083, 0086 and 0090.
