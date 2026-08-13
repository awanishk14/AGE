/**
 * What the Sources area does NOT cover, said out loud (ADR-0069 D3/D5).
 *
 * 🛑 **THE NAME "SOURCES" PROMISES MORE THAN THE SCREEN SHOWS.** It reads a
 * document the operator named, and nothing else. Since ADR-0069 a second kind
 * of input exists — an observation a source SYSTEM produced, carried in by the
 * operator's own relay — and it surfaces on Peer Products, not here. An
 * operator who opened Sources, saw one document and concluded "that is
 * everything AGE has been given" would be wrong, and the screen would have
 * caused it by staying silent.
 *
 * 🚫 **THIS IS A POINTER, 🚫 NOT A SECOND COPY OF THE ANSWER.** The relayed
 * observations are read on one path and rendered by one panel; showing them
 * here as well would make two screens answer "what did a source report", and
 * the copy that drifts still looks authoritative. Sources names the omission
 * and says where the answer lives.
 *
 * 🚫 **IT ASSERTS NOTHING ABOUT WHETHER ANY OBSERVATION EXISTS.** This sentence
 * is fixed text: it cannot say "no source systems have reported", because from
 * here AGE has not looked, and "AGE never looked" must never be rendered as
 * "AGE looked and found nothing" (D5).
 *
 * Pure: no clock, no I/O, no randomness.
 */

/** The sentence the Sources screen shows about its own boundary. */
export function describeSourcesCoverage(): string {
  return (
    'This area covers documents only. What a source system observed reaches AGE by a separate ' +
    'act — the operator relays it — and is shown under Peer Products. Nothing here has looked ' +
    'at that store, so this screen being quiet about it says nothing at all about whether any ' +
    'source system has reported.'
  );
}
