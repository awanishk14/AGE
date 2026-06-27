# AGE — Module Dependencies

> Status: Foundation scaffold (Task 002).

At this foundation stage, **no domain module imports another domain module**. The only outward
dependency is the `@age/shared` **domain kernel** (`Entity`, `AggregateRoot`, `ValueObject`,
`Repository`, …), which every domain layer builds on. This keeps boundaries crisp while the
domain model is established.

## Current state

```
organization   → (none)
people         → (none)
brand          → (none)
product        → (none)
service        → (none)
market         → (none)
icp            → (none)
competitor     → (none)
strategy       → (none)
research       → (none)
evidence       → (none)
knowledge      → (none)
campaign       → (none)
content        → (none)
project        → (none)
decision       → (none)
integration    → (none)
reporting      → (none)
workflow       → (none)
```

Every module's domain layer depends only on the kernel:

```
<module>/domain → @age/shared (kernel)
```

Only the composition root depends on the modules:

```
AppModule → DOMAIN_MODULES → [ all 19 domain modules ]
```

## Intended future direction (non-binding)

These are anticipated dependencies once implementation begins. They are documented for
planning only and are **not** wired yet:

- `organization` is expected to be a foundational context other modules reference for tenancy.
- `strategy` is expected to consume `icp`, `market`, `competitor`, `research`, `evidence`.
- `campaign` is expected to consume `strategy`, `content`, `icp`.
- `decision` is expected to consume `evidence` and `knowledge`.
- `reporting` and `workflow` are expected to consume many contexts read-only.

## Dependency rules (to enforce later)

- No cyclic dependencies between modules.
- Cross-context access goes through published interfaces (ports), never internal entities.
- Shared concerns live in `@age/shared`, not duplicated across modules.
