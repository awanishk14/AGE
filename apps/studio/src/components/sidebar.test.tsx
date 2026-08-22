import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sidebar } from './sidebar';

/**
 * ⚠️ **THE SIGN-OUT AFFORDANCE IS PART OF THE BOUNDARY, NOT DECORATION** —
 * ADR-0074 §7 slice 2. The Product Owner's definition of done ends *"logout/
 * expiry works"*, and a revocation route nobody can reach is a route nobody
 * uses. 🛑 These assert the SHAPE of the control; that revoking really refuses
 * the same token afterwards is proven against the running deployment, 🚫 not
 * here.
 */

describe('Sidebar', () => {
  it('offers signing out as a POST, never a link', () => {
    const { container } = render(<Sidebar signedIn />);

    const button = screen.getByRole('button', { name: 'Sign out' });
    const form = button.closest('form');

    expect(form).not.toBeNull();
    // 🚫 A GET that revoked could be fired by a prefetch, an image, or another
    // site. The method is the protection, so the method is what is asserted.
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post');
    expect(form?.getAttribute('action')).toBe('/sign-out');
    expect(container.querySelector('a[href="/sign-out"]')).toBeNull();
  });

  it('says signing out revokes the session, not merely the browser', () => {
    render(<Sidebar signedIn />);

    // ⚠️ If this sentence ever becomes "you have been signed out", the console
    // is describing a cleared cookie as though it were a revoked session.
    expect(screen.getByText(/revokes this session in the store/)).toBeDefined();
  });

  it('🚫 shows no sign-out control — and no second door — when nobody is signed in', () => {
    const { container } = render(<Sidebar signedIn={false} />);

    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    // 🚫 No hand-written "Sign in" link either: the redirect already takes an
    // unadmitted caller to the one door, and a second one is a second truth.
    expect(container.querySelector('a[href="/sign-in"]')).toBeNull();
  });

  it('still links only areas that exist, in both states', () => {
    for (const signedIn of [true, false]) {
      const { container, unmount } = render(<Sidebar signedIn={signedIn} />);

      const routes = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));

      expect(routes.length).toBeGreaterThan(0);
      // 🚫 The sidebar has no business in hand, so it may not link one.
      expect(routes.filter((route) => (route ?? '').startsWith('/b/'))).toEqual([]);
      unmount();
    }
  });

  /**
   * ⚠️ `.invalid` is reserved and can never resolve — 🚫 no real operator
   * address appears in this repository, in a fixture or in prose.
   */
  it('names who is signed in, immediately above the control that signs them out', () => {
    render(<Sidebar signedIn signedInEmail="operator@fictional.invalid" />);

    const label = screen.getByText('operator@fictional.invalid');
    const button = screen.getByRole('button', { name: 'Sign out' });

    // 🛑 ORDER IS THE POINT, NOT MERE PRESENCE. The question "which address am
    // I about to sign out?" is only answered if the answer precedes the button.
    const labelPrecedesButton = Boolean(
      label.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    );

    expect({ labelPrecedesButton }).toEqual({ labelPrecedesButton: true });
  });

  it('still offers signing out when the address is unknown', () => {
    render(<Sidebar signedIn />);

    // 🛑 THE WAY OUT IS NEVER GATED ON THE LABEL. A directory read may fail;
    // an operator who can act must always be able to stop acting.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('names nobody when nobody is signed in', () => {
    render(<Sidebar signedIn={false} signedInEmail="operator@fictional.invalid" />);

    // 🚫 An address rendered without a session would be a claim the boundary
    // never made. The `signedIn` gate governs both, so they cannot drift apart.
    expect(screen.queryByText('operator@fictional.invalid')).toBeNull();
  });

  it('prints no scope, tier or role beside the address', () => {
    const { container } = render(<Sidebar signedIn signedInEmail="operator@fictional.invalid" />);

    // 🛑 A TIER IS RE-READ PER REQUEST (ADR-0079 §2, ADR-0089); printed here it
    // would be a cached authorization that keeps asserting itself after the
    // membership behind it is revoked.
    expect(container.textContent).not.toMatch(/platform|agency operator|client-viewer|role/i);
  });
});
