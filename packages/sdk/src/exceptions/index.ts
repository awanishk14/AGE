/** SdkException — base exception for the AGE SDK. Placeholder. */
export class SdkException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SdkException';
  }
}
