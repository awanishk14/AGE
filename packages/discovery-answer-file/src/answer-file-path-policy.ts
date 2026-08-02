/**
 * ADR-0054 D2 — the answer file lives OUTSIDE the repository and is never
 * committed.
 *
 * ⚠️ `.gitignore` is NOT the control: it protects only paths someone remembered
 * to list. The control is that the file lives outside the repo entirely and a
 * path inside it is REFUSED — not warned about, not ignored.
 *
 * ⚠️ Path handling here is deliberately hand-rolled string arithmetic rather
 * than `node:path`. `path.resolve` consults `process.cwd()` when given a
 * relative path, which is both an impurity and precisely the "search of the
 * working directory" D2 forbids. Relative paths are refused outright instead.
 *
 * Comparison is case-insensitive on every platform. That refuses MORE paths
 * than a case-sensitive filesystem strictly requires, which is the fail-closed
 * direction: the cost is an operator renaming a directory, the cost of the
 * opposite error is a real client's answers sitting inside a public repo.
 */

/** Refusal raised when a candidate answer-file path is not acceptable. */
export class AnswerFilePathRefusedError extends Error {
  readonly candidatePath: string;

  constructor(message: string, candidatePath: string) {
    super(message);
    this.name = 'AnswerFilePathRefusedError';
    this.candidatePath = candidatePath;
  }
}

const WINDOWS_DRIVE = /^[A-Za-z]:\//;

function isAbsolute(path: string): boolean {
  // Separators are unified first: `E:\age-private\answers.json` is absolute on
  // Windows and must not be mistaken for a relative path and refused.
  const slashed = path.replace(/\\/g, '/');
  return slashed.startsWith('/') || WINDOWS_DRIVE.test(slashed);
}

/**
 * Normalizes separators and collapses `.` / `..` segments without touching the
 * filesystem or the working directory.
 */
function normalize(path: string): string {
  const slashed = path.replace(/\\/g, '/');

  const driveMatch = WINDOWS_DRIVE.exec(slashed);
  const prefix = driveMatch ? slashed.slice(0, 3) : slashed.startsWith('/') ? '/' : '';
  const body = slashed.slice(prefix.length);

  const segments: string[] = [];
  for (const segment of body.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const joined = `${prefix}${segments.join('/')}`;
  // Strip a trailing slash so `/repo/` and `/repo` compare equal.
  return joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
}

function comparable(path: string): string {
  return normalize(path).toLowerCase();
}

/**
 * Refuses any answer-file path that is blank, relative, or inside the
 * repository working tree. Returns nothing on success — it is a guard, not a
 * resolver, and deliberately hands back no "corrected" path.
 *
 * 🚫 There is no default and no fallback location: both arguments are required
 * and must be absolute.
 */
export function assertAnswerFilePathOutsideRepository(
  candidatePath: string,
  repositoryRoot: string,
): void {
  const candidate = candidatePath.trim();

  if (candidate === '') {
    throw new AnswerFilePathRefusedError(
      'The answer file path is required and must not be blank. There is no default path.',
      candidatePath,
    );
  }

  if (!isAbsolute(candidate)) {
    throw new AnswerFilePathRefusedError(
      `The answer file path must be absolute, but got "${candidatePath}". ` +
        'Relative paths are refused rather than resolved, so that no file is ever ' +
        'located by searching the working directory.',
      candidatePath,
    );
  }

  const root = repositoryRoot.trim();
  if (root === '' || !isAbsolute(root)) {
    throw new AnswerFilePathRefusedError(
      `The repository root must be an absolute path, but got "${repositoryRoot}".`,
      candidatePath,
    );
  }

  const normalizedCandidate = comparable(candidate);
  const normalizedRoot = comparable(root);

  const isInside =
    normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);

  if (isInside) {
    throw new AnswerFilePathRefusedError(
      `Refused: "${candidatePath}" is inside the repository working tree ` +
        `("${repositoryRoot}"). A real client's answers must live outside the ` +
        'repository entirely. Move the file somewhere the repository does not ' +
        'contain, then pass that path.',
      candidatePath,
    );
  }
}
