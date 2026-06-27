import { describe, expect, it } from 'vitest';
import { OrganizationService } from '../application/organization.service';

describe('OrganizationModule', () => {
  it('service returns a placeholder status', () => {
    expect(new OrganizationService().status()).toContain('organization');
  });
});
