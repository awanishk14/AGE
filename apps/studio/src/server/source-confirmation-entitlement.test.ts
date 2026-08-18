import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **THE TWO ENTITLEMENT GATES THAT LIVE IN THE EFFECT MODULE** — AGE-INV-SEL-1,
 * ADR-0074 §7 slice 3, applied to the ADR-0073 source-confirmation pair.
 *
 * 🛑 **THIS CLOSES A MEASURED GAP, 🚫 NOT A HYPOTHETICAL ONE.** Every other
 * business-scoped operation is gated inside `@age/operator-workspace`, where the
 * package's own suite covers it. These two are gated HERE instead — deliberately,
 * because gating them in the draft module would make `operator-workspace.ts`
 * import the module that imports it. Nothing tested that. Deleting BOTH gates
 * outright left all 272 tests in this app passing, and `tsc --noEmit` clean —
 * measured, by making exactly that edit and running exactly those commands.
 *
 * 🛑 **WHAT THAT DEFECT WOULD HAVE BEEN.** `recordSourceConfirmationAction` is a
 * browser-reachable POST whose `clientId` is entirely under the caller's control.
 * With the write gate gone, an admitted operator could append a confirmation to
 * the workspace file of a business in ANOTHER organization — and per §3.4 the
 * client a fact is filed under IS PROVENANCE, so that is a provenance violation
 * and 🚫 not merely an access-control one. With the read gate gone they could
 * read one back.
 *
 * ⚠️ **IT ASSERTS THE GATE'S ARGUMENTS, THE ORDER, AND THE SILENCE OF THE
 * WRITER.** A gate handed the wrong organization is not a gate; a gate consulted
 * after the write has already written; and a refusal that still wrote is not a
 * refusal.
 */

const refusalUnlessEntitled = vi.fn();
const readSourceConfirmationsIn = vi.fn();
const recordSourceConfirmationIn = vi.fn();

vi.mock('@age/operator-workspace', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    refusalUnlessEntitled: (...args: readonly unknown[]) => refusalUnlessEntitled(...args),
    readSourceConfirmations: (...args: readonly unknown[]) => readSourceConfirmationsIn(...args),
    recordSourceConfirmation: (...args: readonly unknown[]) => recordSourceConfirmationIn(...args),
  };
});

const { readSourceConfirmations, recordSourceConfirmation } =
  await import('./operator-environment');

const SESSION_ORGANIZATION = 'org-alpha';
const FOREIGN_CLIENT = 'fictional-kite-repairs';

const REFUSAL = { kind: 'refused', reason: 'That business is not in the client record file.' };

const OPTIONS = {
  questionId: 'q1',
  passage: { text: 'a passage', locator: { kind: 'page', page: 1 } },
  source: { documentId: 'doc-1', title: 'A document' },
  confirmedBy: 'operator@example.test',
} as never;

describe('the source-confirmation entitlement gates', () => {
  beforeEach(() => {
    refusalUnlessEntitled.mockReset();
    readSourceConfirmationsIn.mockReset();
    recordSourceConfirmationIn.mockReset();
  });

  describe('recording a confirmation — the write door', () => {
    it('🛑 refuses an unentitled business, and writes NOTHING', () => {
      refusalUnlessEntitled.mockReturnValue(REFUSAL);

      const outcome = recordSourceConfirmation(SESSION_ORGANIZATION, FOREIGN_CLIENT, OPTIONS);

      expect(outcome).toEqual(REFUSAL);
      expect(recordSourceConfirmationIn).not.toHaveBeenCalled();
    });

    it('🛑 consults the gate with the SESSION’s organization and the caller’s clientId', () => {
      refusalUnlessEntitled.mockReturnValue(REFUSAL);

      recordSourceConfirmation(SESSION_ORGANIZATION, FOREIGN_CLIENT, OPTIONS);

      expect(refusalUnlessEntitled).toHaveBeenCalledTimes(1);
      expect(refusalUnlessEntitled.mock.calls[0]?.slice(1)).toEqual([
        SESSION_ORGANIZATION,
        FOREIGN_CLIENT,
      ]);
    });

    it('🛑 gates BEFORE it writes, on the entitled path as well', () => {
      const order: string[] = [];
      refusalUnlessEntitled.mockImplementation(() => {
        order.push('gate');
        return undefined;
      });
      recordSourceConfirmationIn.mockImplementation(() => {
        order.push('write');
        return { kind: 'recorded' };
      });

      const outcome = recordSourceConfirmation(SESSION_ORGANIZATION, FOREIGN_CLIENT, OPTIONS);

      expect(order).toEqual(['gate', 'write']);
      expect(outcome).toEqual({ kind: 'recorded' });
    });
  });

  describe('reading confirmations back', () => {
    it('🛑 refuses an unentitled business, and reads NOTHING', () => {
      refusalUnlessEntitled.mockReturnValue(REFUSAL);

      const outcome = readSourceConfirmations(SESSION_ORGANIZATION, FOREIGN_CLIENT);

      expect(outcome).toEqual(REFUSAL);
      expect(readSourceConfirmationsIn).not.toHaveBeenCalled();
    });

    it('🛑 consults the gate with the SESSION’s organization and the caller’s clientId', () => {
      refusalUnlessEntitled.mockReturnValue(REFUSAL);

      readSourceConfirmations(SESSION_ORGANIZATION, FOREIGN_CLIENT);

      expect(refusalUnlessEntitled).toHaveBeenCalledTimes(1);
      expect(refusalUnlessEntitled.mock.calls[0]?.slice(1)).toEqual([
        SESSION_ORGANIZATION,
        FOREIGN_CLIENT,
      ]);
    });

    it('🛑 gates BEFORE it reads, on the entitled path as well', () => {
      const order: string[] = [];
      refusalUnlessEntitled.mockImplementation(() => {
        order.push('gate');
        return undefined;
      });
      readSourceConfirmationsIn.mockImplementation(() => {
        order.push('read');
        return { kind: 'loaded' };
      });

      const outcome = readSourceConfirmations(SESSION_ORGANIZATION, FOREIGN_CLIENT);

      expect(order).toEqual(['gate', 'read']);
      expect(outcome).toEqual({ kind: 'loaded' });
    });
  });
});
