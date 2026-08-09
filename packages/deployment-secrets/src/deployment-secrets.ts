/**
 * ADR-0061 **A6 item 2** — the secrets a deployed AGE needs, and 🛑 **the rule
 * that an absent one is a REFUSAL, never a default.**
 *
 * ⚠️ **THE FAILURE THIS EXISTS TO PREVENT IS A QUIET SUCCESS.** Every widely
 * exploited "misconfiguration" of this shape has the same story: a secret was
 * missing, something helpful substituted a development value, and the process
 * started. Nobody saw an error, because there wasn't one. A deployment that
 * cannot find its secrets must **fail to start**, loudly, at the moment it is
 * deployed — which is the one moment somebody is watching.
 *
 * 🚫 **THERE IS NO DEFAULT, NO FALLBACK AND NO GENERATED VALUE**, and a guard
 * fails the build if one appears. 🚫 There is no `?? 'dev-secret'`, no
 * `randomBytes` stand-in, and no "generate one if missing" convenience: a
 * generated secret is a secret nobody can rotate, because nobody knows it.
 *
 * ⚠️ **A REFUSAL NAMES THE VARIABLE, 🚫 NEVER ITS VALUE.** The whole point of
 * this module is that it handles secrets; a refusal that quotes one has written
 * a credential into a log, a terminal scrollback and a CI transcript. It also
 * 🚫 never says how long a value was or what it started with — a partial secret
 * is still a secret, and a length is a lead.
 *
 * ⚠️ **EVERY MISSING VARIABLE IS NAMED AT ONCE.** Refusing on the first one
 * teaches the operator to fix, redeploy, fail, fix, redeploy — and each of those
 * cycles is a chance to reach for the shortcut this module exists to refuse.
 *
 * Pure: the environment arrives as a parameter. 🚫 It reads no `process.env`,
 * opens no file and performs no effect; a composition root does that.
 */

/** 🚫 Never carries a value — only the names of the variables that were absent. */
export class DeploymentSecretsRefusedError extends Error {
  /** The variables the deployment could not start without, in declared order. */
  readonly missing: readonly string[];

  constructor(message: string, missing: readonly string[]) {
    super(message);
    this.name = 'DeploymentSecretsRefusedError';
    this.missing = Object.freeze([...missing]);
  }
}

/**
 * The environment, as a value.
 *
 * ⚠️ Modelled as `string | undefined` on purpose: that is exactly what
 * `process.env` gives, and pretending otherwise would move the absent case out
 * of the type where nobody handles it.
 */
export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;

/**
 * The variables a deployed AGE cannot start without.
 *
 * ⚠️ **`DATABASE_URL` — THE OWNER ROLE — IS DELIBERATELY NOT HERE.** Running
 * migrations is a separate act by a separate role, and an application process
 * that holds owner credentials all day is an application process that can drop a
 * table by accident. The app reads `DATABASE_URL_APP` (the non-owner `age_app`
 * role) and nothing else.
 */
export const REQUIRED_DEPLOYMENT_SECRETS = Object.freeze([
  'DATABASE_URL_APP',
] as const satisfies readonly string[]);

export type RequiredDeploymentSecret = (typeof REQUIRED_DEPLOYMENT_SECRETS)[number];

/** The resolved secrets, each present and non-blank because it was checked. */
export type DeploymentSecrets = Readonly<Record<RequiredDeploymentSecret, string>>;

/**
 * ⚠️ A variable that is present but blank is **absent**. `FOO=` in a unit file
 * or a compose file is the most common way a secret goes missing, and it is
 * indistinguishable from a mistake — so it is treated as one.
 */
function isAbsent(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

/**
 * The deployment's secrets, or a refusal to start.
 *
 * @throws {DeploymentSecretsRefusedError} naming every absent variable — 🚫 and
 *         no value, no length and no prefix of one.
 */
export function requireDeploymentSecrets(environment: EnvironmentRecord): DeploymentSecrets {
  const missing = REQUIRED_DEPLOYMENT_SECRETS.filter((name) => isAbsent(environment[name]));

  if (missing.length > 0) {
    throw new DeploymentSecretsRefusedError(
      `This deployment cannot start: ${missing.length} required secret(s) are absent or blank — ` +
        `${missing.join(', ')}. There is no default and no generated substitute: a deployment ` +
        'that starts without its secrets is a deployment nobody knows is misconfigured. Set the ' +
        'variable(s) named above from the environment or a secret file and start it again.',
      missing,
    );
  }

  const resolved = Object.fromEntries(
    REQUIRED_DEPLOYMENT_SECRETS.map((name) => [name, (environment[name] as string).trim()]),
  ) as Record<RequiredDeploymentSecret, string>;

  return Object.freeze(resolved);
}

/**
 * Which required secrets are absent, without throwing.
 *
 * ⚠️ For a **status surface**, so a screen can say "two secrets are absent" by
 * asking rather than by catching. 🚫 It is not a way to start anyway: it returns
 * names, never values, and 🚫 nothing here makes an absent secret survivable.
 */
export function absentDeploymentSecrets(environment: EnvironmentRecord): readonly string[] {
  return Object.freeze(REQUIRED_DEPLOYMENT_SECRETS.filter((name) => isAbsent(environment[name])));
}
