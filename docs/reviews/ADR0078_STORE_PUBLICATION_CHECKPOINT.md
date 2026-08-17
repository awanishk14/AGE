# ADR-0078 — closing the host publication of AGE's store

Evidence for C1, C2 and C3. **Measured facts are labelled by where they were measured**, because a
repository test is not a VPS fact and CI green is not host-level proof.

---

## C1 — container routes for the two host consumers (shipped, PRs #370–#374)

`age-capture` and `age-migrate` were moved into containers that join AGE's store with
`network_mode: "container:age-postgres"`. Inside that shared namespace `127.0.0.1:5432` **is** AGE's
store, so `assertLocalDatabaseTarget`, ADR-0061 A5 and ADR-0075 D4 all pass **unmodified** — the
guards were not widened to accommodate the move, which was the point of choosing option C.

🚫 **C1 is not re-audited here.**

---

## C2 — the container route proven to do real work

🛑 **C2 was NOT considered proven by a TCP connect or by a CLI exit code.** The user's acceptance
condition was a stored row under the expected scope, and that is what was measured.

**Measured on the VPS**, in this order:

| #   | Step                                                                  | Result                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Baseline read of `scored_bif_snapshots`                               | **0 rows** — an unusually clean baseline                                                                                                                                                   |
| 2   | Namespace route probe, from inside `--network container:age-postgres` | `5432=open`, `5442=closed`                                                                                                                                                                 |
| 3   | Non-writing rehearsal (`produceOnly`) against the real store          | **still 0 rows** — `produceOnly` is genuinely non-writing                                                                                                                                  |
| 4   | Real capture (`--capture --confirm`)                                  | `snapshotId e132467a-429c-4fff-b91f-4a4944d4761b`                                                                                                                                          |
| 5   | Read back                                                             | **exactly 1 row**, `client_id fictional-northwind-ledger`, `organization_id org-fictional-nowhere`, `bif_id bif-sample-business-discovery-profile`, `captured_at 2026-08-17T17:56:46.378Z` |

⚠️ The rehearsal at step 3 reproduced the documented honesty-proof output — confidence 17,
completeness 12, **7 sections present and 5 omitted** — which is how we know the whole pipeline ran
rather than a stub. **The omissions are the correct result**, not a defect: absence is never a
conclusion, and a partial BIF omits.

⚠️ **PROVENANCE.** The client is **fictional by construction** and obviously so. 🚫 No real client
record, organization or business answer was authored to produce this evidence. Step 2 also settles
that the write could only have travelled the namespace, so removing the publication could not
affect it.

---

## C3 — the publication removed

### What changed in the repository

| File                                                                                                            | Change                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/vps/docker-compose.age-postgres.yml`                                                                    | the entire `ports:` block removed; **its absence is now the documented decision**                                                                  |
| `scripts/provision-studio-database.sh`                                                                          | `AGE_DB_HOST_PORT` **removed as a concept**, 🚫 not renamed and 🚫 not defaulted; the console's URL now writes the container route directly        |
| `deploy/vps/wrappers/age-deploy-derive-env`                                                                     | the `sed` that rewrote `@127.0.0.1:5442/` → `@172.23.0.2:5432/` became `cp`; the step survives because its **verification** now carries the weight |
| `scripts/expose-studio-public.sh`                                                                               | the public-exposure check narrowed so it 🚫 cannot pass vacuously                                                                                  |
| `apps/capture/docker-entrypoint.sh`, `deploy/vps/compose/docker-compose.studio.yml`, `scripts/deploy-studio.sh` | present-tense comments asserting the publication exists rewritten to past tense                                                                    |

### 🛑 Guards were narrowed to follow the change, 🚫 never widened

Three guards had to be **inverted**, and each was replaced by a stricter successor rather than
deleted:

- `expect(publishedPorts(COMPOSE)).toBe(1)` → `toEqual([])`, **plus** a direct key scan, because
  `[]` is equally true of an empty list and of a parser that found nothing.
- The two `AGE_DB_OWNER_URL` **port** refusals lost their subject. Replaced by a successor guarding
  the half that survives the container rewrite — **the database name**.
- The ADR-0074 D9 carve-out for `0.0.0.0` lost its subject; narrowed to banning `0.0.0.0` outright.

⚠️ **Guard discipline was performed, 🚫 not assumed.** M-A (re-add `ports:`) produced **3** failures
naming the exact violation; M-B (re-add `require AGE_DB_HOST_PORT`) produced **2**. Both were
restored by **targeted inverse edit**, 🚫 never `git checkout <file>`.

### 🛑 A DEFECT IN THIS SLICE'S OWN NEW GUARD, FOUND ONLY ON THE BOX

The rewritten running-container check was first written as:

```sh
case "$binding" in '{}') ;;   # ← WRONG
```

A correctly-unpublished `age-postgres` reports **`{"5432/tcp":null}`**, 🚫 not `{}`, because the
`postgres` image `EXPOSE`s 5432. **This guard would have REFUSED a correct store on the real box
while passing every gate in the repository.** Corrected to key on `*'"HostPort"'*`.

⚠️ This is the fourth defect in this track that passed every local gate **and** CI and was caught
only by running it where it runs. 🛠️ **RUN IT WHERE IT RUNS.**

### Measured on the VPS, after C3

| Criterion (ADR-0078 §0.2b)                            | Measurement                                                     | Result                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AGE PostgreSQL has no host TCP publication            | `docker inspect age-postgres`                                   | `{"5432/tcp":null}` — ✅ nothing published                                                                                                       |
| Host accounts cannot connect to the old port          | `ss -ltn`                                                       | ✅ **no listener on 5442 at all**                                                                                                                |
| —                                                     | `ss -ltnp` shows `127.0.0.1:5432`                               | ⚠️ that is **`snara_postgres`**, a **peer's** store (ADR-0075 header already records 5432 as SNARA's). 🚫 It is not AGE's.                       |
| Peer containers remain unable to reach AGE PostgreSQL | `age-internal` membership                                       | ✅ exactly two members: `age-postgres 172.23.0.2`, `age-studio 172.23.0.3`                                                                       |
| —                                                     | read-only TCP connect from `snara_postgres` → `172.23.0.2:5432` | ✅ refused/unreachable                                                                                                                           |
| AGE Studio still works                                | container status + `127.0.0.1:3100/sign-in`                     | ✅ `Up (healthy)`, `200`                                                                                                                         |
| —                                                     | public `https://age.digitaldadi.agency/`                        | ✅ `307` → `/sign-in` `200`, HTTPS. ⚠️ **`curl` is not a browser — see the open gate below.**                                                    |
| `age-capture` still works                             | full real capture, post-C3                                      | ✅ `snapshotId bd46a935-d3eb-4e8f-b124-63d424591b0c` at `2026-08-17T18:20:56.009Z`, same fictional scope                                         |
| —                                                     | read back                                                       | ✅ **2 rows**, both `fictional-northwind-ledger` / `org-fictional-nowhere`. The C2 row **survived container recreation** — the volume is intact. |
| Nothing still depends on `AGE_DB_HOST_PORT=5442`      | repo grep + installed wrapper                                   | ✅ the only surviving `5442` is a **comment recording the removal**, 🚫 not a dependency                                                         |

⚠️ The env authority `/etc/age-studio/age-studio.env` was rewritten `@127.0.0.1:5442/` →
`@172.23.0.2:5432/`, with a backup at `/etc/age-studio/age-studio.env.pre-c3.bak`. Keys unchanged.
🚫 No credential entered `argv`.

⚠️ The updated `age-deploy-derive-env` was installed to `/usr/local/sbin` **with LF endings** —
`bfde0b0` exists because dash executes bytes and a CRLF wrapper is a broken wrapper. Prior version
backed up at `/root/age-deploy-derive-env.pre-c3.bak`. 🚫 The ADR-0077 wrapper **surface** is
unchanged: no fifth wrapper, no new subcommand. An earlier draft of `expose-studio-public.sh` called
a `age-deploy-docker-probe published-ports` subcommand that **does not exist**; inventing it would
have altered the deploy-identity surface, and it was removed.

### 🛑 THE HONEST CLAIM, AND IT MUST NOT BE WIDENED (ADR-0078 §7)

AGE's store is **no longer host-published, and reachable only inside the `age-internal` network by
authorised AGE components.**

🚫 **NEVER "AGE's database is now unreachable."** A root-equivalent account on this box can still
`docker exec` or enter the namespace. That is **ADR-0077's host-identity problem**, still open, and
🚫 not something C3 closes or claims to.

### Rollback

Re-add the `ports:` line to `docker-compose.age-postgres.yml`; restore
`/etc/age-studio/age-studio.env` from `.pre-c3.bak`; restore the wrapper from
`/root/age-deploy-derive-env.pre-c3.bak`.

---

## Gates

- `pnpm --filter @age/deployed-origin test -- --maxWorkers=2` → **189 passed / 9 files**.
- `pnpm nx run-many -t test --parallel=2 --skipNxCache` → **59 projects, all green**. ⚠️ The cache
  was bypassed deliberately: the first run reported 59/59 **from cache**, which is not evidence that
  this slice's edits pass.

## 🛑 Open gates — 🚫 NOT claimed as verified

1. **The browser gate is NOT closed.** The Chrome extension was not connected in this session, so
   the console was measured by `curl` and by its container healthcheck **only**. 🚫 `curl` is not a
   browser: it does not execute the app, does not run the session boundary in a real client, and
   does not prove a page renders. **An operator must open `https://age.digitaldadi.agency`, sign in,
   and confirm a snapshot reads back.**
2. **Provisioning/migrations were NOT re-run end to end.** `scripts/provision-studio-database.sh`
   requires `AGE_DB_SUPERUSER_PASSWORD`, `AGE_DB_APP_PASSWORD` and `AGE_DB_OWNER_URL` — **owner
   credentials, which the architect does not hold**. Its C3 changes are covered by the repository
   guards and the derived env was verified on the box, but **a real provisioning run is an owner
   act** and this criterion stays open until they perform it.

⚠️ 🚫 Neither gate was substituted with an assumption, and 🚫 neither is reported as passed.
