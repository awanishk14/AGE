# AGE Demo Run Guide

The fastest way to run the AGE capability demo locally, end-to-end. There are
three ways to view the **same** in-memory demo — pick whichever suits you.

## Prerequisites

- Node.js **22 LTS**
- pnpm **9+** (`corepack enable`)
- Install dependencies once from the repo root:

  ```bash
  pnpm install
  ```

No database, Redis, or external services are required for the demo.

---

## A. CLI demo

The quickest check — prints the decision reports straight to your terminal.

```bash
pnpm demo
```

What it shows:

- all **six capabilities** (Intelligence, Market Discovery, Growth, Authority,
  Operations, Revenue)
- **accepted / rejected / duplicate** accounting per capability, with the
  invariant `accepted + rejected + duplicate === derived === input items`
- a **pending human approval** checklist — every accepted item awaits sign-off

See [`apps/demo/README.md`](../apps/demo/README.md) and
[`apps/demo/sample-output.txt`](../apps/demo/sample-output.txt) for a full
example run.

---

## B. API demo

Start the API (NestJS) using the repo's existing dev command:

```bash
pnpm --filter @age/api dev
```

The API listens on **`http://localhost:4000`** by default (configurable via the
`API_PORT` env var).

Then call the read-only endpoint:

```bash
curl http://localhost:4000/demo/capabilities
```

- Route: **`GET /demo/capabilities`**
- Returns the six capability reports plus a summary (capabilities run, total
  pending approvals, accounting invariant) as JSON.
- Read-only — nothing is persisted or executed.

---

## C. Web demo

Start the web app (Next.js) using the repo's existing dev command:

```bash
pnpm --filter @age/web dev
```

Then open:

- **`http://localhost:3000/demo`**

The page fetches `GET /demo/capabilities` and renders the six reports with a
summary and the Human-Approved Execution notice.

### API URL configuration

The web app reads the API base URL from the environment variable:

- **`NEXT_PUBLIC_API_URL`**
- Default when unset: **`http://localhost:4000`** (the API's local default)

To point the web demo at a different API, set it before starting the web app,
e.g.:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm --filter @age/web dev
```

> Start the API (mode B) **before** loading `/demo`, otherwise the page shows a
> connection error.

---

## What is completed / pending

### Completed

- Six **pure capabilities** (deterministic, in-memory decision logic)
- **CLI demo** (`pnpm demo`)
- **API demo endpoint** (`GET /demo/capabilities`)
- **Web demo screen** (`/demo`)
- **ADR-0020** governance (branch flow) accepted
- **Human-Approved Execution** flow — decision objects only, awaiting approval

### Pending (not yet built)

- Real product workflows
- Auth / tenant-aware demo access (not wired yet)
- Persistence-backed inputs and outputs
- A real approval workflow (approvals are display-only today)
- External integrations
- Phase 5 execution engines
- Production deployment hardening

---

## Safety boundary

The demo is intentionally inert. Across all three modes:

- The demo is **read-only**.
- There are **no execution engines**.
- **No side effects** are performed.
- **No external APIs** are called.
- **No database writes** occur.
- **Every accepted item requires human approval before execution** — the demo
  only produces recommendations.
- **Phase 5 is not started.**

---

## Troubleshooting

- **API not running** — the web `/demo` page shows a connection error. Start the
  API first: `pnpm --filter @age/api dev`, then reload the page.
- **Wrong `NEXT_PUBLIC_API_URL`** — if the web app points at the wrong host/port,
  requests fail. Confirm the API is on `http://localhost:4000` (or set
  `NEXT_PUBLIC_API_URL` to match your API).
- **Web page shows a connection error** — verify the API responds directly:
  `curl http://localhost:4000/demo/capabilities`. If that fails, the issue is on
  the API side, not the web side.
- **Not sure the capability runtime works** — run the CLI demo first:
  `pnpm demo`. If it prints six reports, the pure runtime is healthy and the
  problem is in the API/web wiring.
- **Verify the API layer** — run the API tests:
  `pnpm --filter @age/api test`.
- **Verify the compiled API actually boots** — run the runtime smoke check
  (build first): `pnpm --filter @age/api build && pnpm --filter @age/api smoke:demo`.
  It boots `dist/main.js` on a test port, checks `GET /demo/capabilities`, and
  shuts the process down. This also runs in CI after the build step.
