import { describe, expect, it } from 'vitest';
import { KnowledgeService } from '../application/knowledge.service';

describe('KnowledgeModule', () => {
  it('service returns a placeholder status', () => {
    expect(new KnowledgeService().status()).toContain('knowledge');
  });
});
