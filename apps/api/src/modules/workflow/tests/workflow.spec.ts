import { describe, expect, it } from 'vitest';
import { WorkflowService } from '../application/workflow.service';

describe('WorkflowModule', () => {
  it('service returns a placeholder status', () => {
    expect(new WorkflowService().status()).toContain('workflow');
  });
});
