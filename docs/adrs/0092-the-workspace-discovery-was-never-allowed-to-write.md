# ADR-0092 — The workspace discovery was never allowed to write

Status: **Accepted** (2026-08-22)

🛑 **ACCEPTED BY THE ARCHITECT, 2026-08-22, AND 🚫 NOT BY THE OWNER.** Under constitution §5 this is
internal, reversible in code, and reachable from the accepted ADRs: it changes what one container
may write under one host directory **it already reads**, at a path that is already configuration. It
🚫 does not provision or name a real person, account, membership, client or organization; it 🚫 does
not change what the outside world can reach; it is 🚫 not a product judgement about the business.
Security **posture** is mine — security **exposure** is the owner's, and 🛑 **no exposure changes
here**: no port, no network, no published address, no route, no credential.

Amends: **ADR-0076 D5** — the mode of the **second** of its two paths. Completes: **ADR-0091 D2**,
which named this defect and deliberately left it standing. Depends on: ADR-0054 (an operator path is
never defaulted) · ADR-0076 (the container boundary) · ADR-0091 (the same defect, the other path).
Supersedes: nothing.

---

## 1. Why this exists, and why it is a SECOND ADR and not a wider first one

ADR-0091 fixed the client record file and 🛑 **refused to fix this one in the same slice**, because
at that moment the workspace failure was _"a reading of the code and the compose file, 🚫 NOT a
measurement — I have not opened that form."_ D2 said it would get its own slice and its own browser
gate. ⚠️ **This is that slice.** The refusal was not caution for its own sake: the record-file fix
was closed by a browser and this one has its own, different, browser gate.

### 1a — What is now MEASURED, and what is still only read

✅ **MEASURED, in a browser, by the owner, on the deployed console:** `/businesses/new` succeeded
after ADR-0091 and a real client record was appended. 🛑 **That is the proof ADR-0091 needed and it
is 🚫 not proof about this path.** The console's next screen offers **Start Discovery**, and that is
the first action that writes into the workspace.

⚠️ **STILL A READING OF THE CODE, 🚫 NOT A MEASUREMENT:** `packages/operator-workspace/src/operator-workspace.ts`
writes twice into the workspace directory — the draft (`saveDraft`) and the answer file
(`submit`) — each `ensureDirectory` then `writeFileText`. Under a `:ro` mount both throw, and both
are converted into a refusal that names the workspace without the system error. 🚫 **I have not
opened that form and I do not claim it is broken; I claim the mount cannot permit the write.**

## 2. The decision

**D1 — The discovery workspace is bind-mounted READ-WRITE.** It is the directory the operator's
drafts and answer files are written into, and writing them is an entitled console action.

**D2 — 🚫 STILL NOTHING ELSE FROM THE HOST IS MOUNTED.** Exactly the same two paths, at the same
addresses, as ADR-0076 D5 and ADR-0091 D4. This ADR changes **a mode**, 🚫 not the list.

**D3 — 🛑 THE PARENT DIRECTORY IS STILL NOT MOUNTED.** `/var/lib/age-operator` holds both operator
paths and the operator's other files. ADR-0091 §3 refused to mount it as **wider than the defect**,
and 🚫 that refusal is not quietly undone here by mounting one level up for convenience.

**D4 — The guard is NARROWED TO FOLLOW THE CHANGE, 🚫 NOT WIDENED TO PERMIT IT** (constitution
§3.8). The per-path assertion introduced by ADR-0091 D3 changes `ro` → `rw` **for the workspace
only**; 🚫 it is not relaxed to "has a mode", and 🚫 the exactly-one-writable-mount count is not
deleted — it is **corrected to two, asserted by naming both**, so a third writable mount still
fails.

⚠️ **D4 IS THE PART THAT CAN GO WRONG SILENTLY.** ADR-0091's third guard exists so that a writable
mount cannot arrive unnoticed. 🛑 Turning it into "at least one is writable" would destroy it while
looking like an update. It stays an **exact list**.

## 3. What this costs, and what it notably does NOT cost

🛑 **THE ATOMICITY COST OF ADR-0091 §3 DOES NOT APPLY HERE, AND THE DIFFERENCE IS WORTH SAYING
PLAINLY.** That cost came from mounting a **single file**, which cannot be replaced by `rename()`.
This is a **directory** mount, so a temp-file-then-rename is available inside it.

⚠️ **AVAILABLE IS 🚫 NOT DONE.** `writeFileText` is still `writeFileSync`, still in place, and this
ADR 🚫 does not change how a file is written — that would be a second decision smuggled into a mount
change. 🛑 **The durability question stays OPEN, exactly as ADR-0091 §3 left it**, and it is now open
with the observation that this path could close it cheaply and the record file's path could not.

The real cost is plain: **the console can now create and overwrite files under the operator's
workspace directory.** That is the entitled action working, and 🚫 it is not widened by this ADR to
anything outside that directory.

## 4. The guards

1. 🛑 **The mount list is asserted EXACTLY** — two entries, in order, full text. A third fails.
2. 🛑 **Each path's mode is asserted BY PATH** — workspace `:rw`, record file `:rw`, each named, so
   a swap or a silent revert fails and 🛑 **fails naming which path is wrong**.
3. 🛑 **The writable mounts are asserted as an EXACT LIST, 🚫 not a count-at-least.** Both paths are
   named. A third writable mount fails. ⚠️ A mount with **no mode at all** is writable in Docker, so
   an absent mode counts as writable — 🚫 not treating it so would be a scan narrower than its rule.
4. 🛑 **The environment values still name a PATH and 🚫 never a mode** — the guard earned inside the
   ADR-0091 slice, when a stray `:rw` landed on the value the console **opens**. It is 🚫 not
   removed now that a second path is writable; it is the guard most likely to earn itself again.

⚠️ Every one of these is proven by **deliberate mutation** before it is believed (constitution §5).
🚫 A guard that has only ever passed is not evidence.

## 5. 🛑 WHAT THIS DOES NOT PROVE

🚫 **A COMPOSE FILE IS NOT A RUNNING CONTAINER, AND A REPOSITORY TEST IS NOT A VPS FACT.** This ADR
is closed by exactly one thing: **the owner opening Discovery on the deployed console and a draft
being saved.** 🚫 CI is not that gate, 🚫 `curl` is not that gate, 🚫 the merge is not that gate,
🚫 a successful deploy is not that gate, and 🛑 **ADR-0091's browser gate does not transfer to this
path** — that is the entire reason this is a separate ADR.

⚠️ **Answering the questionnaire about a real business is an OWNER ACT** (constitution §5, §7). I
🚫 do not author a business's answers, and 🚫 no real answer file is committed.

## 6. What this deliberately does NOT do

- 🚫 **It does not touch host permissions.** The workspace stays `0700`, owned by the deploy
  account. 🛑 `chmod o+w` on a shared host would hand a real business's discovery data to another
  account.
- 🚫 **It does not mount the parent directory** (D3).
- 🚫 **It does not change how any file is written** (§3).
- 🚫 **It does not create an outbound write surface.** The constitution's refusal is about AGE
  writing to **the outside world**; this is the operator's own workspace, on the operator's own box,
  at a path the operator configured.
- 🚫 **It does not make AGE mint anything that grants access.** Untouched.
