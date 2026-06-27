import { describe, expect, it } from 'vitest';
import { ContentService } from '../application/content.service';

describe('ContentModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ContentService().status()).toContain('content');
  });
});
