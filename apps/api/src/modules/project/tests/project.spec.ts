import { describe, expect, it } from 'vitest';
import { ProjectService } from '../application/project.service';

describe('ProjectModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ProjectService().status()).toContain('project');
  });
});
