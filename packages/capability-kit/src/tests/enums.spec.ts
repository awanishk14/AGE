import { describe, expect, it } from 'vitest';
import { Capability, ExecutionDomain } from '../enums';

describe('Capability enum', () => {
  it('has exactly 7 members', () => {
    const values = Object.values(Capability);
    expect(values).toHaveLength(7);
  });

  it('includes Intelligence', () => {
    expect(Capability.Intelligence).toBe('Intelligence');
  });

  it('includes MarketDiscovery', () => {
    expect(Capability.MarketDiscovery).toBe('MarketDiscovery');
  });
});

describe('ExecutionDomain enum', () => {
  it('includes SEO', () => {
    expect(ExecutionDomain.SEO).toBe('SEO');
  });

  it('includes GoogleAds', () => {
    expect(ExecutionDomain.GoogleAds).toBe('GoogleAds');
  });
});
