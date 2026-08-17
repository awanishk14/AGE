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
