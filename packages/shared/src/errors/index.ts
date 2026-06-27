/**
 * AgeError — base application error every domain error should extend. Placeholder.
 */
export class AgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgeError';
  }
}
