# scripts

Developer and CI automation scripts for AGE.

- `setup.sh` — one-shot local bootstrap (install deps, env file, start services).
- `generate-modules.mjs` — canonical domain-module generator.

## Generating domain modules

The layered structure of every domain module under `apps/api/src/modules/<module>` is generated
from a single source of truth: the `MODULES` list in `scripts/generate-modules.mjs`.

```bash
# (Re)generate ALL modules + the DOMAIN_MODULES registry
node scripts/generate-modules.mjs

# (Re)generate a single existing module (e.g. after editing the template)
node scripts/generate-modules.mjs strategy
```

Each module is produced with the Clean-Architecture layout:

```
presentation/    controllers (transport boundary)
application/     services (use-cases), dto/, validators/
domain/          aggregates/ (canonical root), repositories/ (ports), types/, interfaces/
infrastructure/  placeholder (implements ports later)
tests/           module spec
```

Notes:

- The **aggregate is the canonical domain root** — standalone entity placeholders are not generated.
- Identifiers (`<Module>Id`) are re-exported from `@age/shared` (single `UniqueId`-based identity).

### Adding a new module

1. Add `['<name>', '<one-line purpose>']` to `MODULES` in `scripts/generate-modules.mjs`.
2. Run `node scripts/generate-modules.mjs`.
3. Add a matching `<Name>Id` to `packages/shared/src/domain/ids/index.ts`.
4. Run `pnpm typecheck && pnpm lint && pnpm test`.
