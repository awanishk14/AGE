import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { presentDashboard, presentSystemStatus } from '@age/studio-shell';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardScreen } from './dashboard-screen';

const facets = presentSystemStatus({
  bindHost: '127.0.0.1',
  bindPort: 3100,
  recordFile: 'not-configured',
  identity: 'not-established',
  captureStore: 'not-read',
});

function renderWithNoRecordFile() {
  return render(
    <DashboardScreen
      view={presentDashboard({ kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' })}
      facets={facets}
    />,
  );
}

describe('DashboardScreen', () => {
  it('names the screen and the question it answers', () => {
    renderWithNoRecordFile();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined();
    expect(screen.getByText(/What changed, what is waiting/)).toBeDefined();
  });

  /**
   * ⚠️ The whole reason this screen was allowed to exist: it composes only from
   * sources that were really read, and says so about everything else.
   */
  it('states why each unmeasured panel is unmeasured', () => {
    renderWithNoRecordFile();

    expect(screen.getByText(/nothing has read the capture store/)).toBeDefined();
    expect(screen.getByText(/no capability has been given a real client/)).toBeDefined();
    expect(screen.getByText(/An empty result from an empty input is not a finding/)).toBeDefined();
  });

  /**
   * 🚫 THE SENTENCE THIS SCREEN MUST NEVER PRINT. "No contradictions", "all
   * clear" or "0 pending" would turn "AGE has never looked" into "AGE checked
   * this business and it is fine".
   */
  it('never reports an unmeasured aggregate as clear, empty or zero', () => {
    const { container } = renderWithNoRecordFile();
    const text = (container.textContent ?? '').toLowerCase();

    expect(text.length).toBeGreaterThan(200);
    for (const forbidden of [
      'no contradictions',
      'all clear',
      'nothing pending',
      '0 pending',
      'no issues',
      'up to date',
    ]) {
      expect(text, `the dashboard printed "${forbidden}"`).not.toContain(forbidden);
    }
  });

  /** 🚫 No count of businesses when no record file was configured. */
  it('shows no business count when nothing was read', () => {
    renderWithNoRecordFile();

    expect(screen.getByText('AGE_CLIENT_RECORD_FILE', { exact: false })).toBeDefined();
    expect(screen.queryByText(/\d+ businesses? in/)).toBeNull();
  });

  it('shows a count only once records were actually read', () => {
    render(
      <DashboardScreen
        view={presentDashboard({
          kind: 'listed',
          bands: [
            {
              organizationId: 'org_fictional_alpha',
              clients: [
                {
                  clientId: 'cl_fictional_one',
                  displayName: 'Entirely Fictional Bakery',
                  organizationId: 'org_fictional_alpha',
                  externalRefs: {},
                },
              ],
            },
          ],
        })}
        facets={facets}
      />,
    );

    expect(screen.getByText(/1 business in 1 organization band/)).toBeDefined();
  });

  /**
   * ⚠️ The coverage list is the console describing ITSELF, and every unwired
   * row must carry its reason — an unexplained row is an empty screen with a
   * label on it.
   */
  it('lists every area it cannot answer, with the reason', () => {
    renderWithNoRecordFile();

    expect(screen.getByText(/areas read a real source/)).toBeDefined();
    // ⚠️ `getAllBy` on purpose — more than one area is blocked on the same
    // undischarged decision, and a single-match assertion would break the day a
    // second one is listed honestly.
    expect(screen.getAllByText(/Blocked on ADR-0055 D7/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(1);
  });

  /** 🚫 No progress bar and no completion percentage over the area counts. */
  it('turns the area counts into no completion figure', () => {
    const { container } = renderWithNoRecordFile();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/\d\s?%|complete\b|[↑↓▲▼]/i);
    expect(container.querySelector('progress')).toBeNull();
  });

  /**
   * 🚫 THE REFUSAL MOST LIKELY TO BE UNDONE BY A LATER EDIT. The front page must
   * not produce a BIF, assemble evidence or submit anything when it is opened.
   * A recompute-on-open is class 3 under ADR-0057 D4 even though its effect is
   * entirely internal — which is exactly why the BIF and Evidence screens are
   * button-pressed.
   *
   * ⚠️ The route source is read directly rather than mocked: a mock proves the
   * component this test rendered did not call a producer, not that the page
   * cannot.
   */
  it('reaches no producer from the dashboard route', () => {
    // ⚠️ Resolved from `process.cwd()`, not `import.meta.url`: these tests run
    // in jsdom, where the module URL is not a `file:` URL — the same reason
    // `effect-isolation.test.ts` resolves its paths this way.
    const source = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );

    // ⚠️ Assert the file was really read FIRST, so a moved route can never make
    // the refusal below pass over an empty string.
    expect(source).toContain('export default function Page');

    const banned = [
      'generateBifFromAnswerFile',
      'assembleEvidence',
      'submitDiscoveryAnswers',
      'writeDiscoveryDraft',
      'createClientRecord',
    ];

    for (const token of banned) {
      expect(source, `the dashboard route must not call ${token}`).not.toContain(token);
    }

    expect(banned).toHaveLength(5);
  });
});
