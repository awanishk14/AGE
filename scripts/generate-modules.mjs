#!/usr/bin/env node
/**
 * AGE domain-module generator.
 *
 * Generates the Clean-Architecture layered scaffold for every domain module
 * under `apps/api/src/modules/<module>` and the `DOMAIN_MODULES` registry.
 *
 * Source of truth: the MODULES list below.
 *
 * Usage:
 *   node scripts/generate-modules.mjs              # (re)generate ALL modules + registry
 *   node scripts/generate-modules.mjs <name>       # (re)generate a single existing module
 *
 * To add a NEW module: add it to MODULES, then run with no args.
 *
 * Layers produced per module:
 *   presentation/   controllers (transport boundary)
 *   application/    services (use-cases), dto/, validators/
 *   domain/         aggregates/ (canonical root), repositories/ (ports), types/, interfaces/
 *   infrastructure/ placeholder (implements ports later)
 *   tests/          module spec
 *
 * Note: domain entities are NOT generated — the Aggregate is the canonical root.
 * Identifiers are re-exported from `@age/shared` (single UniqueId-based identity).
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const pascal = (s) =>
  s.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
const camel = (s) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

// ── Source of truth: [name, purpose]
export const MODULES = [
  ['organization', 'Tenant boundary and top-level account that owns all other domain data.'],
  ['people', 'Individuals and teams associated with an organization.'],
  ['brand', 'Brand identity, voice, positioning and assets.'],
  ['product', 'Products, features and value propositions.'],
  ['service', 'Services, scope and delivery model.'],
  ['market', 'Markets, segments and geographies.'],
  ['icp', 'Ideal Customer Profiles — who to target.'],
  ['competitor', 'Competitors and their positioning.'],
  ['strategy', 'Growth strategies, objectives and plans.'],
  ['research', 'Research questions and findings.'],
  ['evidence', 'Verifiable evidence and sources.'],
  ['knowledge', 'Structured business knowledge.'],
  ['campaign', 'Campaigns, channels and timelines.'],
  ['content', 'Content assets.'],
  ['project', 'Units of execution toward outcomes.'],
  ['decision', 'Recorded decisions and rationale.'],
  ['integration', 'Connections to external systems.'],
  ['reporting', 'Reports, dashboards and metrics.'],
  ['workflow', 'Orchestrated multi-step processes.'],
  ['problem', 'Problems the organization solves, tied to products and markets.'],
];

function w(rel, content) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content.endsWith('\n') ? content : content + '\n', 'utf8');
}

function moduleFiles(name, purpose) {
  const P = pascal(name);
  const c = camel(name);
  const base = `apps/api/src/modules/${name}`;

  // presentation
  w(`${base}/presentation/${name}.controller.ts`,
`import { Controller } from '@nestjs/common';
import { ${P}Service } from '../application/${name}.service';

/**
 * ${P}Controller — presentation boundary for the ${name} domain.
 * Placeholder; no routes defined yet.
 */
@Controller('${name}')
export class ${P}Controller {
  constructor(private readonly ${c}Service: ${P}Service) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.${c}Service.status();
  }
}
`);
  w(`${base}/presentation/index.ts`, `export * from './${name}.controller';\n`);

  // application
  w(`${base}/application/${name}.service.ts`,
`import { Injectable } from '@nestjs/common';

/**
 * ${P}Service — application service (use-cases) for the ${name} domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ${P}Service {
  /** Placeholder status indicator for the scaffolded ${name} module. */
  status(): string {
    return '${name} module: scaffold only';
  }
}
`);
  w(`${base}/application/dto/create-${name}.dto.ts`,
`/** Create${P}Dto — placeholder input contract. Fields added later. */
export class Create${P}Dto {}
`);
  w(`${base}/application/dto/update-${name}.dto.ts`,
`/** Update${P}Dto — placeholder input contract. Fields added later. */
export class Update${P}Dto {}
`);
  w(`${base}/application/dto/index.ts`,
`export * from './create-${name}.dto';
export * from './update-${name}.dto';
`);
  w(`${base}/application/validators/${name}.validator.ts`,
`import { z } from 'zod';

/** Placeholder Zod schema for the ${name} domain. Fields added later. */
export const ${c}Schema = z.object({});

export type ${P}Schema = z.infer<typeof ${c}Schema>;
`);
  w(`${base}/application/validators/index.ts`, `export * from './${name}.validator';\n`);
  w(`${base}/application/index.ts`,
`export * from './${name}.service';
export * from './dto';
export * from './validators';
`);

  // domain (Aggregate = canonical root; no standalone entity)
  w(`${base}/domain/aggregates/${name}.aggregate.ts`,
`import { AggregateRoot } from '@age/shared';

/**
 * ${P}Aggregate — aggregate root (consistency boundary) for the ${name} context.
 * Canonical domain root. Placeholder; invariants and child entities added later.
 */
export class ${P}Aggregate extends AggregateRoot {}
`);
  w(`${base}/domain/aggregates/index.ts`, `export * from './${name}.aggregate';\n`);

  w(`${base}/domain/repositories/${name}.repository.ts`,
`import type { Repository } from '@age/shared';
import type { ${P}Aggregate } from '../aggregates/${name}.aggregate';

/**
 * ${P}Repository — persistence port for the ${P}Aggregate.
 * Interface only; implemented in the infrastructure layer later. No Prisma/SQL.
 */
export type ${P}Repository = Repository<${P}Aggregate>;
`);
  w(`${base}/domain/repositories/index.ts`, `export * from './${name}.repository';\n`);

  w(`${base}/domain/types/${name}.types.ts`,
`/** Identifier for the ${name} domain — re-exported from the shared kernel. */
export type { ${P}Id } from '@age/shared';
`);
  w(`${base}/domain/types/index.ts`, `export * from './${name}.types';\n`);

  w(`${base}/domain/interfaces/${name}.interface.ts`,
`/**
 * ${P}ServiceContract — public contract for the ${name} service. Placeholder.
 */
export interface ${P}ServiceContract {
  status(): string;
}
`);
  w(`${base}/domain/interfaces/index.ts`, `export * from './${name}.interface';\n`);

  w(`${base}/domain/index.ts`,
`export * from './aggregates';
export * from './repositories';
export * from './types';
export * from './interfaces';
`);

  // infrastructure
  w(`${base}/infrastructure/index.ts`,
`/**
 * Infrastructure layer for the ${name} domain.
 *
 * Placeholder. Repository implementations, persistence mappings and external
 * adapters live here once the data layer is introduced. No implementation yet.
 */
export {};
`);

  // tests
  w(`${base}/tests/${name}.spec.ts`,
`import { describe, expect, it } from 'vitest';
import { ${P}Service } from '../application/${name}.service';

describe('${P}Module', () => {
  it('service returns a placeholder status', () => {
    expect(new ${P}Service().status()).toContain('${name}');
  });
});
`);

  // module + barrel + README
  w(`${base}/${name}.module.ts`,
`import { Module } from '@nestjs/common';
import { ${P}Controller } from './presentation/${name}.controller';
import { ${P}Service } from './application/${name}.service';

/**
 * ${P}Module — domain module for the ${name} bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [${P}Controller],
  providers: [${P}Service],
  exports: [${P}Service],
})
export class ${P}Module {}
`);
  w(`${base}/index.ts`,
`export * from './${name}.module';
export * from './presentation';
export * from './application';
export * from './domain';
`);
  w(`${base}/README.md`,
`# ${P} Module

## Purpose

${purpose}

## Layered structure (Clean Architecture)

\`\`\`
presentation/    → controllers (transport boundary)
application/     → services (use-cases), DTOs, validators
domain/          → aggregates (canonical root), repositories (ports), types, interfaces
infrastructure/  → persistence & external adapters (placeholder)
tests/           → module specs
\`\`\`

Dependencies point inward: presentation → application → domain. Infrastructure
implements the domain's repository ports. Domain depends only on the
\`@age/shared\` kernel (Entity, AggregateRoot, ValueObject, Repository).

## Aggregate root

- \`${P}Aggregate\` — the canonical domain root.

## Repository port

- \`${P}Repository\` (interface only).

## Identifier

- \`${P}Id\` — re-exported from \`@age/shared\` (single UniqueId-based identity).

## Dependencies

\`@age/shared\` (domain kernel only). No cross-domain dependencies.
`);
}

function writeRegistry() {
  const importLines = MODULES.map(([n]) => `import { ${pascal(n)}Module } from './${n}/${n}.module';`).join('\n');
  const reexport = MODULES.map(([n]) => `export * from './${n}';`).join('\n');
  const registry = MODULES.map(([n]) => `  ${pascal(n)}Module,`).join('\n');
  w('apps/api/src/modules/index.ts',
`${importLines}

${reexport}

/**
 * DOMAIN_MODULES — every AGE domain module, registered in the modular monolith.
 * Extracting a module into a microservice later only requires moving the folder.
 */
export const DOMAIN_MODULES = [
${registry}
];
`);
}

const arg = process.argv[2];
if (arg) {
  const found = MODULES.find(([n]) => n === arg);
  if (!found) {
    console.error(`Unknown module "${arg}". Add it to MODULES in scripts/generate-modules.mjs first.`);
    process.exit(1);
  }
  moduleFiles(found[0], found[1]);
  console.log(`Regenerated module: ${arg}`);
} else {
  rmSync(join(ROOT, 'apps/api/src/modules'), { recursive: true, force: true });
  MODULES.forEach(([name, purpose]) => moduleFiles(name, purpose));
  writeRegistry();
  console.log(`Generated ${MODULES.length} modules + DOMAIN_MODULES registry.`);
}
