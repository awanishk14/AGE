import { ValueObject } from '@age/shared';

interface ClientNameProps {
  value: string;
}

export class ClientName extends ValueObject<ClientNameProps> {
  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ClientName cannot be empty');
    }
    super({ value: value.trim() });
  }

  get value(): string {
    return this.props.value;
  }
}
