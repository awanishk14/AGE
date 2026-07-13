# AGE — Adaptive Growth Engine

> An **Adaptive Growth Intelligence Platform (AGIP)** — initially used internally by Digital Dadi, later commercialized as a SaaS product.

This repository is an **enterprise-grade monorepo scaffold**. It contains no business logic yet — only the structure, tooling, and configuration required to build AGE reliably at scale.

---

## Tech Stack

| Layer    | Technology                                                |
| -------- | --------------------------------------------------------- |
| Monorepo | [Nx](https://nx.dev) + [pnpm](https://pnpm.io) workspaces |
| Runtime  | Node.js 22 LTS                                            |
| Language | TypeScript                                                |
| Web      | Next.js (App Router), Tailwind CSS, shadcn/ui             |
| API      | NestJS, tRPC, Zod                                         |
| Data     | PostgreSQL, Prisma ORM, Redis                             |
| AI       | OpenAI SDK (model-agnostic), LangGraph                    |
| Testing  | Vitest (unit), Playwright (e2e)                           |
| Quality  | ESLint, Prettier, Husky, lint-staged                      |
| Infra    | Docker & Docker Compose                                   |
| CI       | GitHub Actions                                            |

## Repository Layout

```
apps/
  web/            Next.js front-end
  api/            NestJS back-end API
packages/
  ui/             Shared React components (shadcn/ui based)
  config/         Shared tooling config (tsconfig, eslint presets)
  types/          Shared TypeScript types & Zod schemas
  sdk/            Typed client SDK for the AGE API
  integrations/   Third-party integration adapters
  knowledge/      Knowledge base / agent context primitives
docs/             White-papers, blueprints, PRDs, ADRs, research, architecture, templates
infrastructure/   IaC, Docker, deployment assets
scripts/          Developer & CI automation scripts
tests/            Cross-cutting / integration test suites
```

## Prerequisites

- Node.js **22 LTS** (`nvm use`)
- pnpm **9+** (`corepack enable`)
- Docker & Docker Compose

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.example .env

# 3. Start backing services (Postgres + Redis)
docker compose up -d

# 4. Run the dev servers
pnpm dev
```

## Common Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Run all apps in dev mode             |
| `pnpm build`     | Build all projects                   |
| `pnpm lint`      | Lint all projects                    |
| `pnpm typecheck` | Type-check all projects              |
| `pnpm test`      | Run unit tests (Vitest)              |
| `pnpm test:e2e`  | Run e2e tests (Playwright)           |
| `pnpm affected`  | Run lint/test/build on affected only |
| `pnpm graph`     | Open the Nx project graph            |
| `pnpm format`    | Format the codebase with Prettier    |

## Run the AGE demo

See the six completed capabilities produce human-reviewable decision objects,
fully in-memory with no side effects. Three ways to view the same demo:

```bash
# 1. CLI — prints the decision reports to your terminal
pnpm demo

# 2. API — read-only endpoint: GET /demo/capabilities
pnpm --filter @age/api dev            # serves http://localhost:4000

# 3. Web — a simple read-only page at /demo
pnpm --filter @age/web dev            # serves http://localhost:3000/demo
```

The web page reads the API via `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:4000`). See [`apps/demo/README.md`](./apps/demo/README.md) for
details and a sample run, or the
[Demo Run Guide](./docs/DEMO_RUN_GUIDE.md) for a full local walkthrough of all
three modes.

## License

[MIT](./LICENSE) © Digital Dadi
