import { ValueObject, DomainError } from '@age/shared';

class ClientNameValidationError extends DomainError {
  readonly code = 'CLIENT_NAME_INVALID';
  constructor(message: string) {
    super(message);
  }
}

interface ClientNameProps {
  value: string;
}

export class ClientName extends ValueObject<ClientNameProps> {
  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new ClientNameValidationError('ClientName cannot be empty');
    }
    super({ value: value.trim() });
  }

  get value(): string {
    return this.props.value;
  }
}
