import { describe, expect, it } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('reports a healthy status', () => {
    const service = new AppService();
    expect(service.health()).toEqual({ status: 'ok', service: 'age-api' });
  });
});
