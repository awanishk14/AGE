/**
 * Result — base abstraction for explicit success/failure outcomes.
 *
 * Base abstraction only; used to model outcomes without throwing.
 */
export class Result<T> {
  readonly isSuccess: boolean;
  readonly value?: T;
  readonly error?: string;

  private constructor(isSuccess: boolean, value?: T, error?: string) {
    this.isSuccess = isSuccess;
    this.value = value;
    this.error = error;
  }

  static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, value);
  }

  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, undefined, error);
  }
}
