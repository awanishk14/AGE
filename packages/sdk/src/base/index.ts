/**
 * BaseClient — shared abstraction for all generated SDK clients. Placeholder.
 */
export abstract class BaseClient {
  protected constructor(protected readonly baseUrl: string) {}

  /** Returns the configured base URL. Placeholder accessor. */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
