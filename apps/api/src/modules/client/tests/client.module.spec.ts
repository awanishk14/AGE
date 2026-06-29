import { describe, expect, it } from 'vitest';
import { ClientService } from '../application/client.service';

describe('ClientModule', () => {
  it('ClientService returns a status string containing "client"', () => {
    expect(new ClientService().status()).toContain('client');
  });
});
