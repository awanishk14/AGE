# ADR-0080 — Reaching a platform membership: how the super-admin signs in

Status: **Accepted** (2026-08-19) — **OPTION A.** Accepted by the Product Owner, whose words are
recorded verbatim in §6 below. 🚫 This was not self-accepted: the proposal was PR #385 and this
line was flipped by a separate PR carrying the owner's answer.

Depends on: ADR-0079 (three scopes, and the sign-in it authorized) · ADR-0046 **D5** (RLS is
coherence, 🚫 not authorization) · ADR-0076 (container isolation).

---

## 1. The problem, stated as a fact about shipped code

ADR-0079 §1 records the owner's direction: _"there has to be a superadmin who has access to all
agency account"_. **That super-admin cannot sign in.**

This is not an oversight and 🚫 not a defect — it is a consequence that slice 2 chose deliberately
and slice 3 refuses **by name** rather than silently:

- `account_memberships` stores a platform membership with `organization_id IS NULL`
  (`20260818000000_…/migration.sql`, the shape `CHECK`).
- Both `SELECT` policies compare `organization_id` for **equality** with the scope, and 🛑 **NULL is
  never equal to anything**, so no tenant-scoped transaction can return a platform row — or learn
  that platform operators exist at all.
- `decideSignIn` therefore refuses `platform-scope-not-yet-readable` when it sees one, and the
  console renders _"the kind of access it holds is not served by this console yet"_.

⚠️ **THE INVISIBILITY IS A FEATURE AND IT IS WHY THIS IS AN ADR AND NOT A PATCH.** The obvious fix —
widen the policy so `organization_id IS NULL` also matches — would make every platform operator's
address readable **inside every tenant-scoped transaction in the product**. 🚫 That is the widened
guard §3.8 of the operating constitution forbids, in database form.

---

## 2. What is NOT in question

- 🚫 AGE still mints nothing. Every option below reads rows a human provisioned; 🚫 none creates an
  account, a membership or a role, and 🚫 none asks for a new `GRANT` beyond `SELECT`.
- 🚫 No option changes what a platform operator may SEE once admitted. That is ADR-0079 §4's two
  renderings and is out of scope here; this ADR is only about **being let in**.
- 🚫 No option touches the peer→AGE direction (ADR-0076 D8), which remains the owner's and open.

---

## 3. The options

### Option A — a second, unscoped read path, at one named module

A separate composed reader that runs **without** a tenant scope, used by the sign-in callback only
and only after Google has verified an address. The tenant-scoped reader is unchanged, so the
existing invisibility is unchanged for every other caller.

- ✅ The scoped policies stay exactly as they are; nothing already shipped gets wider.
- ✅ Reachable from exactly one door, which the existing "exactly one caller" guards can pin.
- ⚠️ It is a second path to the same table, and this repository's whole record is that the second
  path is the one that rots. It would need its own guard asserting its **only** caller is the
  callback, and asserting it cannot read anything but memberships.
- 🚫 A defect there reads platform memberships without a scope — the blast radius is "who the
  platform operators are", 🚫 never client data.

### Option B — give the platform scope an organization of its own

Provision platform memberships against a reserved organization instead of `NULL`, so the ordinary
scoped read finds them and nothing new is built.

- ✅ Zero new code paths; the shape `CHECK` and one policy comment change.
- 🛑 **AND IT DESTROYS THE PROPERTY §1 DESCRIBES.** A reserved id is a value any transaction can
  scope itself to. The invisibility was structural; this makes it a convention.
- 🚫 Recorded so it is not mistaken for absent. **Not recommended.**

### Option C — leave it refused, and provision the super-admin an agency membership too

The person holds an agency membership like anyone else and signs in through it; the platform scope
waits for the rendering that needs it (ADR-0079 §4).

- ✅ Ships nothing at all. The refusal already names itself honestly.
- ✅ 🛑 Nothing is built ahead of its slice — ADR-0079 §6's own rule.
- ⚠️ The owner's _"access to all agency account"_ is then **not** served yet, and the person holds
  two memberships, which `decideSignIn` refuses as `ambiguous-membership` if both are agency-scoped
  and live. That interaction must be settled before this option is taken.

### Recommendation

**Option C now, Option A when the platform rendering exists.** ⚠️ The recommendation is the
architect's and is 🚫 **not** independent corroboration of itself: it is one lens, and the owner's
choice is the decision.

---

## 4. The question for the Product Owner, in plain English

**Today, the super-admin account cannot log in. Which do you want?**

1. **Leave it that way for now** — the super-admin logs in as an agency user instead, and the
   super-admin view is built later, all at once. (Nothing gets built now.)
2. **Build the super-admin login path now** — a separate, carefully fenced way to look that account
   up, used only during sign-in.
3. **The quick way** — give super-admins a pretend organization so the normal lookup finds them.
   ⚠️ **This is the one to say no to**: it takes away the protection that currently stops every
   client's session from being able to see who your super-admins are.

---

## 5. What is decided here if this is accepted

- **D1** — which option above is taken.
- **D2** — if Option C: whether one person may hold an agency membership **and** a platform
  membership, and what `decideSignIn` must answer when they do. 🚫 The current answer would be
  `ambiguous-membership`, which is a refusal, 🚫 not a preference.
- **D3** — if Option A: whether the unscoped reader may read `accounts` as well as
  `account_memberships`, or only the membership and then re-read the account in scope.

🛑 **Until a separate PR records the owner's answer verbatim, the honest state of the product is the
one shipped: a platform membership is refused by name, and the screen says so.**

---

## 6. The Product Owner's decision (2026-08-19)

Asked §4's question — _"Today, the super-admin account cannot log in. Which do you want?"_ — the
owner answered, **verbatim and in full**:

> super admin should be able to sign in, make awanishkumar0009@gmail.com a superadmin and can use
> google aoth only yo login in

⚠️ Reproduced exactly as written, typos included. 🚫 It is not tidied, and 🚫 nothing is read into
it that it does not say.

### What that settles

- **D1 = Option A.** _"super admin should be able to sign in"_ is §4's choice **2**, "build the
  super-admin login path now". 🛑 It is 🚫 **NOT** option 3: the owner did not take the "pretend
  organization" shortcut, and §3 Option B stays refused — it would make every platform operator's
  address readable inside every tenant-scoped transaction in the product.
- **D2 does not arise.** It was conditional on Option C, which was not taken.
- **Google only.** _"can use google aoth only yo login in"_ — 🛑 there is to be **no password path
  for the super-admin**, and there is none in the product today. 🚫 This ADR does 🚫 not authorize one,
  and 🚫 no later slice may add one by citing this ADR.

### D3, decided by the architect under the standing autonomy grant

⚠️ **The owner did 🚫 NOT answer D3, and this is the architect's decision, 🚫 not theirs.** It is
recorded separately so it can be overturned without disturbing the words above.

**The fenced reader reads `accounts` as well as `account_memberships`,** and 🚫 nothing else.

The alternative in D3 — read the membership unscoped, then re-read the account **in scope** — is
**not available for a platform membership**: that membership's `organization_id` **IS NULL**, so
there is no scope to re-read it in. ⚠️ Choosing it anyway would mean inventing a scope to perform
the re-read, which is Option B wearing a different hat.

🛑 **The fence, which is the whole of what makes this Option A and 🚫 not a widened policy:**

- It is reachable from **exactly one caller**, the sign-in callback, pinned by a guard by full path.
- It runs **only after Google has verified an address**, and takes that address as its only input.
- It reads **two tables and no others** — 🚫 no snapshots, 🚫 no clients, 🚫 no organizations.
- It **writes nothing, to nothing, ever.** 🛑 AGE mints nothing; this reads rows a human
  provisioned.
- 🚫 The tenant-scoped reader is **unchanged**. Nothing already shipped gets wider, and the
  structural invisibility §1 describes still holds for every other caller in the product.

⚠️ **The blast radius of a defect here is "who the platform operators are", 🚫 never client
data** — stated in §3 before the decision, and unchanged by it.

### 🛠️ What this ADR still does 🚫 NOT authorize

- 🚫 **No rendering.** ADR-0079 §4's two renderings are untouched; this is only about being let in.
  A platform operator who signs in sees what the console already shows, 🚫 nothing more.
- 🚫 **No provisioning path.** 🛑 Making `awanishkumar0009@gmail.com` a super-admin is a **human
  act** against the deployed store — 🚫 not a feature, 🚫 not a script that ships, and 🚫 not
  something AGE does for itself.
- 🚫 **No peer→AGE direction** (ADR-0076 D8), which remains open and the owner's.
