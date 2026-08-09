/**
 * `@age/deployment-secrets` — ADR-0061 **A6 item 2**.
 *
 * 🛑 **AN ABSENT SECRET IS A REFUSAL TO START, NEVER A DEFAULT.** 🚫 No
 * fallback, no generated value, no development substitute.
 *
 * 🚫 **IT HOLDS NO SECRET AND READS NO ENVIRONMENT.** The environment arrives as
 * a parameter; a composition root supplies it. This package decides, and
 * 🚫 performs nothing.
 *
 * ⚠️ **A REFUSAL NAMES THE VARIABLE, NEVER ITS VALUE** — not the value, not its
 * length, not a prefix of it.
 */

export {
  absentDeploymentSecrets,
  DeploymentSecretsRefusedError,
  REQUIRED_DEPLOYMENT_SECRETS,
  requireDeploymentSecrets,
  type DeploymentSecrets,
  type EnvironmentRecord,
  type RequiredDeploymentSecret,
} from './deployment-secrets';
