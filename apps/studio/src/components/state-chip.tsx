import { presentEpistemicState, type EpistemicState } from '@age/studio-shell';

interface StateChipProps {
  readonly state: EpistemicState;
}

/**
 * The one way an epistemic state is rendered.
 *
 * 🚫 Do not render a state any other way, and 🚫 do not drop the label in
 * favour of the colour — the four states must stay distinguishable in
 * greyscale (`17_DESIGN_SYSTEM.md` §4).
 */
export function StateChip({ state }: StateChipProps) {
  const presentation = presentEpistemicState(state);
  return (
    <span className={presentation.className} title={presentation.meaning}>
      {presentation.label}
    </span>
  );
}
