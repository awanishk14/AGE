import { Controller } from '@nestjs/common';
import { ClientService } from '../application/client.service';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  status(): string {
    return this.clientService.status();
  }
}
