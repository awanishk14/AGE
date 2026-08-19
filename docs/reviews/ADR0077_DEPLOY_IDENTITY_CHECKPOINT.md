# ADR-0077 — the account that deploys AGE: the measured record

> ⚠️ **THIS DOCUMENT RECORDS WHAT WAS MEASURED ON THE REAL VPS, 🚫 NOT WHAT THE ADR INTENDED.**
> Every block below is output from a command run **as `age-deploy`** unless it says otherwise.
> 🚫 A green CI run is not evidence for anything in this file, and no line here was inferred.
>
> Slice 1 (the ADR) is `docs/adrs/0077-the-account-that-deploys-age.md`, `Accepted` by the Product
> Owner 2026-08-17. Slice 2 is PR #368. This is slice 2's acceptance.

---

## 1. The owner's acceptance, and the verification list it named

The owner accepted ADR-0077 and authorized slice 2 only. The ADR's §0.1b quotes the acceptance; the
enumerated verification list it elides is reproduced here, each item with the measured result.

| #   | The owner asked for                                      | Result                                                     |
| --- | -------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `age-deploy` can deploy AGE                              | ✅ §3 — the whole deploy ran as `age-deploy`, end to end   |
| 2   | cannot read `/opt/rankops/.env`                          | ✅ §4.1 — Permission denied                                |
| 3   | cannot read `/opt/snara/.env`                            | ✅ §4.1 — Permission denied                                |
| 4   | cannot read `/opt/dd-agency/.env`                        | ✅ §4.1 — Permission denied                                |
| 5   | cannot read `/opt/dd-scanner/.env`                       | ✅ §4.1 — Permission denied                                |
| 6   | cannot `docker exec` into peer containers                | ✅ §4.3 — refused by the wrapper AND by sudoers            |
| 7   | is not in the Docker group                               | ✅ §4.2 — sole group is `age-deploy`; the socket is denied |
| 8   | has no unrestricted sudo                                 | ✅ §4.4 — eight escalation shapes, all refused             |
| 9   | each sudo operation is limited to the reviewed wrapper   | ✅ §2 + §4.5                                               |
| 10  | wrappers are root-owned and unmodifiable by `age-deploy` | ✅ §4.6                                                    |
| 11  | Studio publicly reachable over HTTPS                     | ✅ §5                                                      |
| 12  | authentication still works                               | ✅ §6 — signed in, navigated, signed out, refused after    |
| 13  | AGE Postgres data unchanged                              | ✅ §7                                                      |
| 14  | nginx and TLS functional                                 | ✅ §5                                                      |

---

## 2. What `age-deploy` is, and what sudo grants it

```
uid=1002(age-deploy) gid=1002(age-deploy) groups=1002(age-deploy)

User age-deploy may run the following commands on vmi3191673:
    (root) NOPASSWD: /usr/local/sbin/age-deploy-compose-up ""
    (root) NOPASSWD: /usr/local/sbin/age-deploy-derive-env ""
    (root) NOPASSWD: /usr/local/sbin/age-deploy-nginx-apply ""
    (root) NOPASSWD: /usr/local/sbin/age-deploy-docker-probe
```

🛑 **THAT IS THE WHOLE GRANT.** No `ALL`, no shell, no `docker`, no `nginx`, no `systemctl`, and —
per D4 — **no `certbot`**. The trailing `""` on the first three permits **zero arguments** and
nothing else: `sudo -n age-deploy-compose-up extra` is refused by **sudoers itself**, before the
wrapper's own refusal is ever reached (§4.5).

The installed wrappers were compared to the repository by digest — **all four identical**, so the
guards in `deploy-wrapper-boundary.spec.ts` are guards over the code that is actually running:

```
age-deploy-compose-up    repo=3d0fb38145c70606  host=3d0fb38145c70606
age-deploy-derive-env    repo=fc5bd37dd39ded90  host=fc5bd37dd39ded90
age-deploy-docker-probe  repo=2a57a1051fea4c8b  host=2a57a1051fea4c8b
age-deploy-nginx-apply   repo=13ee759e709d1081  host=13ee759e709d1081
```

---

## 3. The deploy, run entirely as `age-deploy`

`AGE_VPS_USER=age-deploy AGE_VPS_PATH=/home/age-deploy/age bash scripts/deploy-studio.sh` — the
image built, the container was recreated, and the script's own proofs ran through the wrappers:

```
 Container age-studio Started
    composed as 1002:1002 — the owner of the record file
==> The console must actually be SERVING, 🚫 not merely started
    serving: /sign-in answers inside the container
==> D7: proving the boundary FROM INSIDE THE RUNNING CONTAINER
    ok   AGE postgres (age-internal) -> ALLOWED (expected ALLOWED)
    ok   SNARA postgres -> DENIED (expected DENIED)
    ok   RankOps postgres -> DENIED (expected DENIED)
    ok   Drishti postgres -> DENIED (expected DENIED)
    ok   Scanner mysql -> DENIED (expected DENIED)
    (ADR-0076 D7 satisfied from inside the container)
==> Confirming the console is published on LOOPBACK ONLY (D3)
    ok   127.0.0.1:3100 only
```

⚠️ **THE UID WAS DERIVED, 🚫 NOT CHOSEN.** `composed as 1002:1002` is `stat` on
`/var/lib/age-operator/clients.json`, which is now owned by `age-deploy` — so the container reads the
operator's record while it stays `0600`. 🚫 No `chmod o+r` was used anywhere in this migration; the
ownership moved and **the modes did not** (§7).

---

## 4. The negative cases — what `age-deploy` cannot do

### 4.1 Peer secrets

```
/opt/rankops/.env    -> rc=1 : cat: /opt/rankops/.env: Permission denied
/opt/snara/.env      -> rc=1 : cat: /opt/snara/.env: Permission denied
/opt/dd-agency/.env  -> rc=1 : cat: /opt/dd-agency/.env: Permission denied
/opt/dd-scanner/.env -> rc=1 : cat: /opt/dd-scanner/.env: Permission denied
sudo -n cat /opt/rankops/.env  -> sudo: a password is required
```

⚠️ **`age-deploy` HAS NO PASSWORD**, so "a password is required" is a hard denial, not a prompt.

### 4.2 Docker

```
id -nG              -> age-deploy
/var/run/docker.sock -> srw-rw---- root docker
docker ps            -> permission denied while trying to connect to the docker API
```

### 4.3 Peer containers

```
sudo -n age-deploy-docker-probe exec-probe rankops-app sign-in
  -> REFUSED: 'rankops-app' is not one of age-studio, age-postgres.
sudo -n docker exec rankops-app id
  -> sudo: a password is required
```

🛑 **BOTH DOORS, 🚫 NOT ONE.** The wrapper refuses the name, and the shape that would bypass the
wrapper is not in the sudoers file at all.

### 4.4 Unrestricted root

Every one of these returned `sudo: a password is required`:

```
bash -c id · sh -c id · su - · tee /etc/passwd · systemctl restart nginx
nginx -s reload · certbot --version · docker run -v /:/host alpine id
```

⚠️ The last two are the shapes the audit named specifically: `certbot --deploy-hook` and
`docker run -v /:/host` are each root by another name. Neither is reachable.

### 4.5 The wrapper argument allowlists

```
sudo -n age-deploy-compose-up extra              -> sudo: a password is required   (refused by SUDOERS)
… exec-probe age-postgres sign-in                -> REFUSED: exec-probe runs only in age-studio.
… rm age-studio                                  -> REFUSED: 'rm' is not one of inspect, logs, exec-probe, ps.
… inspect ../../rankops-app                      -> REFUSED: '../../rankops-app' is not one of age-studio, age-postgres.
… exec-probe age-studio "id"                     -> REFUSED: 'id' is not one of peer-reachability, sign-in.
```

### 4.6 The wrappers themselves

```
drwxr-xr-x 2 root root  /usr/local/sbin
-rwxr-xr-x 1 root root  /usr/local/sbin/age-deploy-{compose-up,derive-env,docker-probe,nginx-apply}

append    -> Permission denied
overwrite -> Permission denied
unlink    -> Permission denied          (the DIRECTORY is root-owned, so the file cannot be replaced)
chmod     -> Operation not permitted
```

🛑 **THE DIRECTORY MATTERS AS MUCH AS THE FILE.** A wrapper that is root-owned inside a directory the
deploy account may write is a wrapper the deploy account may **replace**; `/usr/local/sbin` is
`root:root 0755`, so it cannot.

---

## 5. The public boundary, after the migration

```
https://age.digitaldadi.agency/           -> 307  ->  /sign-in
https://age.digitaldadi.agency/businesses -> 307  ->  /sign-in
…/businesses?token=not-a-real-token       -> 307  ->  /sign-in
https://age.digitaldadi.agency/sign-in    -> 200
http://age.digitaldadi.agency/            -> 301   (plaintext redirects; HTTPS only)

certificate: issuer Let's Encrypt YE1, notAfter Sep 21 2026
nginx -t (as root): syntax is ok, test is successful
nginx: active · certbot.timer: active

ss -ltn: 127.0.0.1:3100 · 127.0.0.1:5442     (loopback only — nothing on 0.0.0.0)
docker inspect age-studio: running=true  user=1002:1002  privileged=false  network=age-internal
```

⚠️ **`nginx -t` RUN AS `age-deploy` FAILS**, and that is the correct result: it cannot read the
certificate. The test that matters is the one the **wrapper** runs as root, and it passes.

---

## 6. ✅ The browser gate — RUN, on the public URL

🛑 **ADR-0074's lesson stands: THE BROWSER IS A GATE THE REPO DOES NOT HAVE.** `curl` proving that
`/sign-in` answers `200` and that every protected route redirects is evidence about the **door**,
🚫 not about signing in. So item 12 was measured in a real browser against
`https://age.digitaldadi.agency`, after the migration, with the Studio running as `age-deploy`'s
deployment.

One operator session row was provisioned **as an act** for this walkthrough (§7) — 🚫 no
provisioning path was built, and 🚫 AGE minted nothing.

What was measured, in order:

| Step                                            | Measured                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/businesses` while unauthenticated             | redirected to `/sign-in`                                                             |
| a well-formed but unknown token (64 hex zeroes) | `/sign-in?refused=1`, **"That token was not accepted."** — naming nothing            |
| the provisioned token                           | admitted; landed on `/` with **Identity → "Session verified"**                       |
| `/businesses` while authenticated               | rendered — 1 business in the `org-fictional-nowhere` band, read from the record file |
| **Sign out**                                    | returned to `/sign-in`; the store row shows `revoked_at = 2026-08-17T04:56:39.316Z`  |
| the **same** token, re-presented after sign-out | `/sign-in?refused=1`, **"That token was not accepted."**                             |

⚠️ **A REFUSAL THAT WAS NOT WHAT IT LOOKED LIKE.** An earlier attempt refused a _valid_ token twice.
The container log named the cause: `The Server Reference ID did not match the expected format` — the
open tab was a **previous build's** page, so its Next.js server-action ids no longer resolved. A
cache-ignoring reload was not enough; a **new tab** was. 🛑 **A stale tab produces a refusal
indistinguishable, in the UI, from a rejected credential** — read the container log before believing
one. The second attempt also carried a genuinely expired row (8h expiry, elapsed), so neither
refusal was evidence about verification. Both were re-run cleanly and are the table above.

---

## 7. AGE Postgres — what changed, and what did not

`age-postgres` was **never recreated** by this deploy (`Up 15 hours` across it), so its volume was
never in the path. Row counts, read as the owner role:

```
snapshots = 0 · observations = 0 · operator_sessions = 10 (oldest issued 2026-08-15)
```

The **only** writes were `operator_sessions` rows for the browser walkthrough (§6) — two provisioned
as **ACTS**, the second because the first had expired, and each revoked afterwards. 🚫 **No
provisioning path was built.** Two facts fell out of performing it that are worth keeping:

- 🛑 **`age_app` CANNOT INSERT A SESSION.** Its grants are `SELECT` on the table and `UPDATE` on
  `revoked_at` alone. The insert had to be taken with the **owner role**, from a credential
  `age-deploy` cannot read. ⚠️ **AGE MINTS NOTHING** is enforced by the grant, not only by the code.
- ⚠️ **`age-deploy` CANNOT PROVISION A SESSION AT ALL**, by construction — it holds neither the owner
  credential nor a shell as root. Session provisioning is an **operator/owner act** and is now, also
  by privilege, **not a deployment act**.

⚠️ **RLS READS ZERO WITHOUT A SCOPE.** The first count returned `0` sessions because
`age.organization_id` was unset — 🚫 that is **coherence failing closed, NOT an empty database**, and
reading it as emptiness is exactly the mistake ADR-0046 D5 warns about.

Ownership moved, and 🚫 **NO MODE CHANGED**:

```
/var/lib/age-operator            age-deploy:age-deploy 0700   (recursive)
/var/lib/age-operator/clients.json                     0600
/etc/age-studio                  root:age-deploy       0750
/etc/age-studio/age-studio.container.env  age-deploy   0600
/etc/age-studio/age-studio.env            root:root    0600   ← 🚫 NOT readable by age-deploy
/etc/age-studio/age-postgres.env          root:root    0600   ← 🚫 NOT readable by age-deploy
```

⚠️ The derived container env **is** readable by `age-deploy`. That is deliberate and inside AGE's own
blast radius: it is AGE's own database credential, and the wrapper that derives it reads the root-only
source and never prints the value.

---

## 8. D5 — the residue is gone

```
/opt/age                       removed (1.1G)
/etc/systemd/system/age-studio.service        removed
/etc/systemd/system/age-studio.service.d/     removed
systemctl status age-studio  -> Unit age-studio.service could not be found.
```

⚠️ **`/home/drishti/age` WAS DELIBERATELY LEFT IN PLACE.** It is the rollback path of D7; deleting it
would have made the rollback the ADR promises unavailable while claiming to complete the migration.

Re-verified after the removal: both containers healthy, HTTPS `/sign-in` still `200`, and the
in-container sign-in route still answers.

---

## 9. 🚫 What this slice did NOT do

- 🚫 **ADR-0076 D8 IS STILL OPEN, AND UNCHANGED.** AGE's own store is still published on
  `127.0.0.1:5442` for the host-side capture CLI — re-measured open in §5. A compromised **peer** can
  still reach AGE's database. That is the mirror image of what D1 closed and it needs the owner.
- 🚫 **`drishti` STILL HAS ROOT-EQUIVALENT ACCESS TO EVERY OTHER PRODUCT.** ADR-0077 §2.1 said so
  before the work and it is still true after it. This slice reduced **AGE's** blast radius; it did
  not reduce anyone else's.
- 🚫 **NOTHING IN `/opt/rankops`, `/opt/snara`, `/opt/dd-agency`, `/opt/dd-scanner` WAS TOUCHED** —
  not their files, not their containers, not their databases, not their secrets.
- 🚫 No peer/ecosystem work, no other product slice.

---

## 10. ADR-0081 slice 2 — the fifth wrapper, authored but 🚫 NOT INSTALLED

**What landed (repository only):** `deploy/vps/wrappers/age-deploy-settings-apply`, the fifth
sudoers line with its trailing `""`, and the ADR-0081 D6 repository guards in
`packages/deployed-origin/src/tests/deploy-wrapper-boundary.spec.ts`.

🛑 **NOTHING WAS INSTALLED ON THE BOX.** The wrapper is not in `/usr/local/sbin`, the sudoers
drop-in on the host is unchanged, and 🚫 no setting has been written by it. That is **slice 3**,
together with the four D7 refusals demonstrated **as `age-deploy`** before the first successful
write.

### The existing guard failed first, exactly as D6.1 predicted

Adding a fifth file to the wrapper directory failed the shipped guard **before** any test was
edited — `expected [ 'age-deploy-compose-up', …(4) ] to deeply equal [ …(3) ]` and
`expected 5 to be 4`. 🚫 The guard was **not widened to tolerate an unknown wrapper**; the expected
set was extended to the wrapper this ADR names, and it still asserts the set exactly.

### The mutation pass — seven breaks, each naming the exact violation

| #   | Mutation                                              | What the failure said                                              |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `DATABASE_URL_APP` added to the allow-list            | _"expected 'ALLOWED=…' not to contain 'DATABASE_URL_APP'"_         |
| 2   | the lost-database-url refusal deleted                 | the D3 assertion named the missing `grep -q '^DATABASE_URL_APP='`  |
| 3   | the re-derive dropped                                 | _"to match /^\"\$DERIVE\"$/m"_ — D5's silence caught as absence    |
| 4   | a setting name taken from `$1` instead of stdin       | the shipped no-argv guard: _"not to match /\$\{?[1-9]\b/"_         |
| 5   | the report echoed the VALUE instead of `len=`         | the D4 assertion named the missing `printf '    %s len=%s\n'`      |
| 6   | the staged file created BEFORE the input is validated | _"expected 1173 to be less than 611"_ — the ordering, by offset    |
| 7   | the sudoers line removed                              | _"expected 4 to be 5"_, and the trailing-`""` check on `undefined` |

⚠️ An eighth check was demonstrated separately: appending `docker restart age-studio` to the wrapper
failed `/\bdocker\b/: expected true to be false`.

### Behaviour, measured — and where it was measured

The wrapper was run against a **temporary copy** with its two literal paths rewritten into a scratch
directory (🚫 the real ones are literals and are not overridable, which is the point). Observed:

- a two-setting write replaced the existing `AGE_STUDIO_ORGANIZATION_ID` line and appended the new
  ones, printing only `NAME len=N`;
- all six refusals of D3 fired with exit `2` — an argument, `DATABASE_URL_APP=…`, an unknown name, a
  line with no `=`, a duplicate name, and empty stdin — and 🚫 **the file was byte-unchanged after
  every one of them**.

🛑 **THIS IS A WORKSTATION FACT, 🚫 NOT A VPS FACT.** File modes were not asserted here (this
filesystem does not honour them), `chown root:root` was stubbed out, and `sudo` was not involved at
all. Root ownership, `0755`, `sudo -n -l` listing exactly five entries, and `age-deploy` still being
in no group but its own remain **host facts for slice 3**.

### Repository gates

`typecheck`, `lint` and `test --skip-nx-cache` each **64 projects**, exit 0; `@age/deployed-origin`
**198 tests** (191 → 198); `pnpm --filter @age/persistence typecheck:db` exit 0.

---

## 11. ADR-0081 slice 3 — the fifth wrapper INSTALLED, and the four refusals measured first

🛑 **EVERYTHING IN THIS SECTION IS A VPS FACT**, measured on `185.255.131.94` (`vmi3191673`) on
2026-08-19 from the repository at `main` `757889a`. §10 above remains true of what it describes —
it was a **workstation** fact, and it is 🚫 not rewritten here. Nothing in this section was inferred.

### 11.1 The state BEFORE, measured

`sudo -n -l` as `age-deploy` listed **four** entries — `compose-up`, `derive-env`, `nginx-apply`,
`docker-probe` — and `id` reported `uid=1002(age-deploy) gid=1002(age-deploy) groups=1002(age-deploy)`.
`/usr/local/sbin` held those four wrappers and 🚫 no fifth. `/etc/age-studio/age-studio.env` was
`root:root 0600`, 418 bytes, `sha256 58819da5f6cc914c5e28fe67a687fc01adbccba14c80d0681c5f3d50791e19f8`.
Its five names were `DATABASE_URL_APP`, `AGE_STUDIO_ORGANIZATION_ID`, `AGE_STUDIO_GOOGLE_CLIENT_ID`,
`AGE_STUDIO_GOOGLE_CLIENT_SECRET`, `AGE_STUDIO_GOOGLE_REDIRECT_URI`. 🚫 No value was printed at any
point in this slice.

### 11.2 The installation, and 🛑 who performed it

⚠️ **The install was performed by the root-equivalent peer deployment account**, because
`age-deploy` cannot write `/usr/local/sbin` or `/etc/sudoers.d` and 🚫 must never be able to —
a deployment identity that could install its own wrappers would be root with extra steps. This is
the **one** act ADR-0081 still needs that account for, and 🚫 it is not the recurring cost §0.1
describes: from here, a **setting change** no longer reaches for it.

Order, and 🛑 the validation came before the drop-in was live:

1. Both files were staged with `LF` endings (the checkout on this workstation is `CRLF`) and their
   digests compared on both machines before anything was installed —
   wrapper `8ad979143989c32a16b916595c5376bf88064910ee4846243525ffdc5e7077e3`,
   drop-in `d38f73849992b8efb484ad188b4e746355a073a6c7660430811f41728d13374a`.
2. `visudo -c -f` on the **staged** drop-in: `parsed OK`. A `diff` against the live one showed
   **exactly one added line** (`4a5`), the `age-deploy-settings-apply ""` entry, and 🚫 no other
   change. The live drop-in was copied to `/root/age-deploy.sudoers.bak.20260819` first —
   ⚠️ a malformed drop-in locks out every wrapper.
3. `install -o root -g root -m 0755` for the wrapper, `-m 0440` for the drop-in, then a full
   `visudo -c`: all five files under `/etc/sudoers.d` `parsed OK`. Installed digests matched the
   staged ones byte-for-byte.
4. Immediately after install, before any wrapper run:
   `age-studio.env` still `58819da5…`. **The installation itself wrote no setting.**

### 11.3 🛑 THE FOUR D7 REFUSALS, AS `age-deploy`, BEFORE THE FIRST SUCCESSFUL WRITE

| #   | attempt as `age-deploy`                       | exit | what refused it                                                    |
| --- | --------------------------------------------- | ---- | ------------------------------------------------------------------ |
| 1   | an argument (`--help`)                        | `1`  | 🛑 **`sudo` itself** — `sudo: a password is required`              |
| 2   | `DATABASE_URL_APP=postgres://attacker/x`      | `2`  | `REFUSED: 'DATABASE_URL_APP' is not an allow-listed setting name.` |
| 3   | an unknown name (`AGE_STUDIO_SOMETHING_ELSE`) | `2`  | `REFUSED: '…' is not an allow-listed setting name.`                |
| 4   | a line with no `=`                            | `2`  | `REFUSED: a line on stdin has no '='; nothing was written.`        |

Two further refusals were exercised in the same session: **empty stdin** (`REFUSED: stdin carried no
settings.`) and a **duplicate name** (`REFUSED: '…' appears twice in one input.`), both exit `2`.

⚠️ **Refusal 1 is worth reading carefully and 🚫 must not be reported as the wrapper's own check.**
The sudoers entry's trailing `""` permits the command with **no arguments at all**, so `sudo` denied
the invocation and the wrapper **never ran** — which is why the exit code is `1` and not the
wrapper's `2`. The wrapper's own `$# -ne 0` refusal is therefore **unreachable through `sudo`**, and
that is the intended two-layer shape ADR-0077 D3 describes: the drop-in refuses first, the wrapper
refuses if it is ever reached another way. 🚫 It is not redundant, and 🚫 not evidence of the
wrapper's own branch having executed here.

**After all six refusals, `/etc/age-studio/age-studio.env` was byte-identical:**
`58819da5f6cc914c5e28fe67a687fc01adbccba14c80d0681c5f3d50791e19f8` — the same digest as §11.1.
🚫 No `.staged` residue was left behind. 🚫 The file was never printed; only its digest was taken.

Measured separately, and it is the reason a digest is the only available comparison:
`cat /etc/age-studio/age-studio.env` as `age-deploy` → `Permission denied`. 🛑 **The account that
can write four named settings still cannot read the file it writes them into.**

### 11.4 The one successful write (D3, D4, D5)

Only after §11.3, `age-deploy` wrote **`AGE_STUDIO_GOOGLE_REDIRECT_URI`** on stdin. ⚠️ The value
chosen was the setting's **existing** value — the repo-documented public callback URL
`https://age.digitaldadi.agency/sign-in/callback` — confirmed equal to the deployed one **by
comparison on the box**, 🚫 not by reading it out. A real write was required; changing a live
setting was not, and 🛑 the pinned organization is an owner act that this slice does 🚫 not touch.

The wrapper printed, and 🚫 nothing else:

```
    AGE_STUDIO_GOOGLE_REDIRECT_URI len=47
    (derived, 600, deploy-user-owned — value never printed)
```

- **D4 honoured:** name and `len=` only. 🚫 No value, 🚫 no diff, 🚫 no digest of a value.
- **D3 honoured:** the file is 418 bytes with the same five names; the sorted-line digest is
  `fefa742eaf29626ad042e27fd7430841e70973421aee93685eba2b2d7cd1749c` **before and after** — the
  existing line was removed and re-appended, so content is identical and only line **order** moved.
  Modes survived the atomic replace: `age-studio.env` `root:root 0600`, `/etc/age-studio`
  `root:age-deploy 0750`.
- **D5 honoured, and this is the failure mode the wrapper exists to remove:**
  `age-studio.container.env` is `age-deploy:age-deploy 0600` and its sorted-line digest is the same
  `fefa742e…`. **The wrapper re-derived the container copy itself** — 🚫 no second command was run,
  and 🚫 the two files do not disagree.

### 11.5 The D6 host facts, measured as `age-deploy` — 🚫 which no repository test can assert

```
stat /usr/local/sbin/age-deploy-settings-apply  →  root:root 755
test -w …                                       →  not writable by age-deploy
id                                              →  uid=1002(age-deploy) gid=1002(age-deploy) groups=1002(age-deploy)
groups                                          →  age-deploy
sudo -n -l | grep -c 'NOPASSWD:'                →  5
```

The five entries, in full and with nothing else present: `age-deploy-compose-up ""`,
`age-deploy-derive-env ""`, `age-deploy-nginx-apply ""`, `age-deploy-docker-probe`,
`age-deploy-settings-apply ""`. 🛑 **`age-deploy` is still in no group but its own** — 🚫 not
`docker`, 🚫 not `sudo`.

### 11.6 🚫 What slice 3 did NOT do, and 🚫 must not be read as having done

- 🚫 **Nothing was deployed.** The console still runs the pre-ADR-0079-slice-4 image, and 🚫 neither
  2026-08-19 platform migration is applied. This slice changed **one setting's position in a file**
  and installed a wrapper; 🚫 it changed no application behaviour.
- 🚫 **No peer product, database, network, vhost, certificate or secret was touched.** 🚫 No change
  to `drishti`'s rights — ⚠️ it remains `(ALL) NOPASSWD: ALL` and in the `docker` group, i.e.
  **root-equivalent**, exactly as ADR-0081 §2.1 says it stays. 🚫 No new group for `age-deploy`.
- 🚫 **The allow-list was not touched.** It is still the four names of D2 and 🚫 `DATABASE_URL_APP`
  is still absent — 🛑 demonstrated by refusal, 🚫 not asserted.
- 🚫 **No value was printed, echoed or logged**, and 🚫 no credential entered `argv`. 🚫 No `sudo -E`.
- 🚫 **No browser was opened and nobody signed in.** That gate is still the owner's, and 🚫 this
  section proves nothing about it.
- ⚠️ **ADR-0081 §2.2 is now a live fact, not a forecast:** `age-deploy` **can** write four named
  settings into one root-owned file. That is a real widening, and 🚫 installing it does not make it
  narrow.

### 11.7 One repository change came with this slice: a guard that only passed on `LF`

⚠️ **Found by running the gates, 🚫 not by reading:** `deploy-wrapper-boundary.spec.ts`'s D6 guard 3
extracted the allow-list with `.replace(/^ALLOWED='/, '').replace(/'$/, '').trim()`. On a **`CRLF`**
checkout the line ends `…'\r`, so `/'$/` matched nothing, the trailing quote survived, and the guard
failed with `"AGE_STUDIO_ORGANIZATION_ID'"`. On CI — Linux, `LF` — it passed, which is why slice 2
merged green. 🛑 **A guard that is green on one line-ending convention and red on the other is not
asserting what it claims to**, and this repository's own working copy is `CRLF`.

The fix is a **reorder, 🚫 not a widening**: `.trim()` before stripping the quote, then `.trim()`
again. The assertion is unchanged — the same four names, exactly, in order.

Made to fail before it was trusted: `DATABASE_URL_APP` was appended to the wrapper's `ALLOWED`
literal, and the guard failed naming the violation —
`expected 'ALLOWED=\'AGE_STUDIO_GOOGLE_CLIENT_ID…' not to contain 'DATABASE_URL_APP'`. Restored by
copying the file back from a scratch backup, 🔴 never `git checkout <file>`.

**Gates, all `--skip-nx-cache`:** `typecheck` 64 projects, `lint` 64 projects, `test` 64 projects —
all exit 0; `@age/deployed-origin` **198 tests** passing; `pnpm --filter @age/persistence
typecheck:db` exit 0. ⚠️ The **installed** wrapper on the box is the unmutated file — its digest
`8ad979143989c32a16b916595c5376bf88064910ee4846243525ffdc5e7077e3` was re-confirmed after the
mutation was reverted, and 🚫 the mutation never left this workstation.
