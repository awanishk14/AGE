import { describe, expect, it } from 'vitest';
import { PeopleService } from '../application/people.service';

describe('PeopleModule', () => {
  it('service returns a placeholder status', () => {
    expect(new PeopleService().status()).toContain('people');
  });
});
