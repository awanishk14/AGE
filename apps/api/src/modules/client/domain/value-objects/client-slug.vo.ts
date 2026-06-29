import { ValueObject } from '@age/shared';

interface ClientSlugProps {
  value: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ClientSlug extends ValueObject<ClientSlugProps> {
  constructor(value: string) {
    if (!SLUG_PATTERN.test(value)) {
      throw new Error(`ClientSlug must be kebab-case lowercase alphanumeric, got: "${value}"`);
    }
    super({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
