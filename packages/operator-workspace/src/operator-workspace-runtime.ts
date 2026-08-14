/**
 * Every effect the operator workspace needs, named once (ADR-0060 D2).
 *
 * ⚠️ THE POINT OF THIS INTERFACE IS THAT THE SURFACE SUPPLIES IT. `apps/studio`
 * binds it to `node:fs` and `process`; `apps/mcp` will bind its own; a test
 * binds an in-memory one. 🚫 No member of it may be defaulted here — a default
 * would let a surface acquire a filesystem it never asked for, and the effect
 * would then live in two places instead of one.
 *
 * 🚫 NOTHING IS ADDED HERE "FOR LATER". Every member exists because one of the
 * nine operations already needed it, so the interface stays an honest inventory
 * of what the console actually does to the operator's machine.
 */
export interface OperatorWorkspaceRuntime {
  /**
   * The environment the surface was started with.
   *
   * ⚠️ Read, never written. The console's whole configuration story is "you
   * told me where to look", and `@age/studio-shell` decides what a missing
   * variable means — 🚫 not this package, and 🚫 never a default path.
   */
  readonly env: Readonly<Record<string, string | undefined>>;

  /**
   * The repository working tree operator files must live OUTSIDE of.
   *
   * ⚠️ Used ONLY to locate the tree to exclude — never to find a file. That
   * distinction is ADR-0054 D2: searching the working directory for an
   * operator's file is the refused behaviour; knowing which tree to exclude is
   * the guard that enforces it.
   */
  repositoryRoot(): string;

  /** The clock. ⚠️ Injected so a caller can prove what it produced was determined by its input. */
  now(): Date;

  /**
   * Whether a path exists.
   *
   * ⚠️ A different question from "can it be read". A file that exists and
   * cannot be parsed must never be treated as absent — absence means nobody
   * has started, and that is not the same fact.
   */
  fileExists(path: string): boolean;

  /** Read a file as UTF-8 text, or throw. ⚠️ Callers swallow the system error: it embeds the path. */
  readFileText(path: string): string;

  /**
   * Read a file as raw bytes, or throw (ADR-0070).
   *
   * ⚠️ **A SEPARATE MEMBER FROM `readFileText`, ON PURPOSE.** A PDF read as
   * UTF-8 is mojibake, and mojibake is what a decoder must never be handed —
   * nor an operator shown. This exists because the console now reads documents
   * whose bytes are not characters, and 🚫 for no other reason.
   *
   * 🚫 **THE DECODER ITSELF IS NOT A RUNTIME MEMBER.** Which library decodes a
   * real client's documents is ADR-0070 D2, a Product Owner decision — 🚫 not a
   * capability any surface may quietly bind. It is passed to the one operation
   * that needs it, by the one surface authorized to have it.
   */
  readFileBytes(path: string): Uint8Array;

  /** Write UTF-8 text, or throw. */
  writeFileText(path: string, contents: string): void;

  /** Create a directory and its parents if they are missing, or throw. */
  ensureDirectory(path: string): void;
}
