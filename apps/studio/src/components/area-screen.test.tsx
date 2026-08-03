import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AreaScreen } from './area-screen';

/**
 * ⚠️ `AreaScreen` now serves the console-level areas only. Subject areas moved
 * to `/b/:clientId/...` and are rendered by `SubjectAreaScreen`, which resolves
 * the business FIRST. 🚫 Do not point this component at a subject route again —
 * it has no scope to resolve and would render a subject screen for no business.
 */
describe('AreaScreen', () => {
  it('names the area and the question it will answer', () => {
    render(<AreaScreen route="/" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByText(/What changed, what is waiting/)).toBeDefined();
  });

  /**
   * ⚠️ The point of the whole screen. An unwired area says it is unwired, in
   * words, and says why. 🚫 It must not look like a business about which AGE
   * knows nothing.
   */
  it('says it is not wired, and why', () => {
    render(<AreaScreen route="/" />);
    expect(screen.getByText('This screen is not wired yet')).toBeDefined();
    expect(screen.getByText(/nothing truthful to compose/)).toBeDefined();
    expect(screen.getByText(/Not assessed/)).toBeDefined();
  });

  it('distinguishes not-having-looked from having-looked-and-found-nothing', () => {
    render(<AreaScreen route="/" />);
    expect(screen.getByText(/not because AGE looked and found nothing/)).toBeDefined();
  });

  /**
   * 🚫 No invented value, anywhere. A digit on this screen would be a number
   * AGE does not have.
   */
  it('renders no number that could be mistaken for a result', () => {
    const { container } = render(<AreaScreen route="/" />);
    const text = container.textContent ?? '';
    expect(text.length).toBeGreaterThan(50);
    // The only digits permitted are those inside cited document identifiers.
    const digits = text.replace(/ADR-\d{4}\s*D\d|18_AGE_STUDIO\.md|§[\d.]+|S\d+/g, '');
    expect(digits).not.toMatch(/\d/);
  });

  it('does not invent a fallback for an unknown route', () => {
    render(<AreaScreen route="/organizations" />);
    expect(screen.getByRole('heading', { name: 'Unknown screen' })).toBeDefined();
  });

  it('does not render a subject route, which has no scope here', () => {
    // ⚠️ `/discovery` no longer exists as a route. It must resolve to nothing
    // rather than quietly rendering the Discovery area with no business.
    render(<AreaScreen route="/discovery" />);
    expect(screen.getByRole('heading', { name: 'Unknown screen' })).toBeDefined();
  });
});
