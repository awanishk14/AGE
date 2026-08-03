/**
 * `@age/studio-shell` — the testable logic behind the AGE Studio shell.
 *
 * ⚠️ This package holds decisions; `apps/studio` renders them. That split is the
 * ADR-0048 D4 precedent: logic that has rules lives below the rendering layer so
 * it can be tested without a browser. 🚫 Do not move any of this into a
 * component, and 🚫 do not let a component grow a second copy of a rule.
 *
 * 🚫 Nothing here reads a database, a file or the network. The shell is honest
 * about knowing nothing yet, rather than looking complete and being empty.
 */

export {
  assertLoopbackBindHost,
  DEFAULT_STUDIO_BIND_HOST,
  loopbackHosts,
  StudioBindRefusedError,
} from './loopback-policy';

export {
  allEpistemicStatePresentations,
  EPISTEMIC_STATES,
  presentEpistemicState,
  type EpistemicState,
  type EpistemicStatePresentation,
} from './epistemic-state';

export {
  areaByRoute,
  areasForLevel,
  everyAreaIsUnwired,
  REFUSED_AREAS,
  STUDIO_AREAS,
  type AreaLevel,
  type AreaWiring,
  type StudioArea,
} from './navigation';
