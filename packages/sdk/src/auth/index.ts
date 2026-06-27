/** AuthStrategy — pluggable auth contract for the AGE SDK. Placeholder. */
export interface AuthStrategy {
  getAuthHeader(): Record<string, string>;
}
