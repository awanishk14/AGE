/**
 * ADR-0054 D2 (and D3, which imposes "the same rules") — an operator-authored
 * file carrying a real client's data lives OUTSIDE the repository and is never
 * committed.
 *
 * ⚠️ This rule is shared rather than copied ON PURPOSE. D3 says the client
 * record loader obeys "the same constraints as D2". Two implementations of one
 * fail-closed rule can drift, and the drift would be silent: the copy that was
 * relaxed still passes its own tests. There is one rule and one place.
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
 * opposite error is a real client's data sitting inside a public repo.
 */

/** Refusal raised when a candidate operator-file path is not acceptable. */
export class OperatorFilePathRefusedError extends Error {
  readonly candidatePath: string;

  /** What kind of file was being located, e.g. `'answer file'`. */
  readonly subject: string;

  constructor(message: string, candidatePath: string, subject: string) {
    super(message);
    this.name = 'OperatorFilePathRefusedError';
    this.candidatePath = candidatePath;
    this.subject = subject;
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
 * Refuses any operator-file path that is blank, relative, or inside the
 * repository working tree. Returns nothing on success — it is a guard, not a
 * resolver, and deliberately hands back no "corrected" path.
 *
 * 🚫 There is no default and no fallback location: all three arguments are
 * required, and both paths must be absolute.
 *
 * @param subject What the file is, named in every refusal so the operator knows
 *                which of several paths was rejected. Required — a default
 *                would make one caller's refusal describe another's file.
 */
export function assertOperatorFilePathOutsideRepository(
  candidatePath: string,
  repositoryRoot: string,
  subject: string,
): void {
  const candidate = candidatePath.trim();
  const named = subject.trim();

  if (named === '') {
    throw new OperatorFilePathRefusedError(
      'The subject of an operator-file path check is required: a refusal that does not say ' +
        'which file was refused cannot be acted on.',
      candidatePath,
      subject,
    );
  }

  if (candidate === '') {
    throw new OperatorFilePathRefusedError(
      `The ${named} path is required and must not be blank. There is no default path.`,
      candidatePath,
      subject,
    );
  }

  if (!isAbsolute(candidate)) {
    throw new OperatorFilePathRefusedError(
      `The ${named} path must be absolute, but got "${candidatePath}". ` +
        'Relative paths are refused rather than resolved, so that no file is ever ' +
        'located by searching the working directory.',
      candidatePath,
      subject,
    );
  }

  const root = repositoryRoot.trim();
  if (root === '' || !isAbsolute(root)) {
    throw new OperatorFilePathRefusedError(
      `The repository root must be an absolute path, but got "${repositoryRoot}".`,
      candidatePath,
      subject,
    );
  }

  const normalizedCandidate = comparable(candidate);
  const normalizedRoot = comparable(root);

  const isInside =
    normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);

  if (isInside) {
    throw new OperatorFilePathRefusedError(
      `Refused: "${candidatePath}" is inside the repository working tree ` +
        `("${repositoryRoot}"). A real client's ${named} must live outside the ` +
        'repository entirely. Move the file somewhere the repository does not ' +
        'contain, then pass that path.',
      candidatePath,
      subject,
    );
  }
}
