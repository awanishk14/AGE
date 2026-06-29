import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientService {
  status(): string {
    return 'client module: scaffold only';
  }
}
