import { describe, expect, it } from 'vitest';
import { ReportingService } from '../application/reporting.service';

describe('ReportingModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ReportingService().status()).toContain('reporting');
  });
});
