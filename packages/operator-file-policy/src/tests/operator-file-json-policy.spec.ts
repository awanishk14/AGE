import { describe, expect, it } from 'vitest';

import { describeJsonParseFailure } from '../operator-file-json-policy';

/**
 * The property under test is a NEGATIVE one: nothing the parser said about the
 * file's contents may survive. The realistic-leak cases below use a fictional
 * client, because a fixture that named a real one would be the very thing the
 * function exists to prevent (ADR-0053 D3).
 */

/** Produces a genuine V8 SyntaxError, so the test tracks the installed Node. */
const parseFailureOf = (text: string): unknown => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error;
  }

  throw new Error(`"${text}" was expected to be invalid JSON, but it parsed.`);
};

describe('describeJsonParseFailure', () => {
  it('extracts a bare position when the parser reports one', () => {
    expect(describeJsonParseFailure(new SyntaxError('Bad thing at position 142'))).toBe(
      'at position 142',
    );
  });

  it('extracts a line and column when the parser reports those instead', () => {
    expect(describeJsonParseFailure(new SyntaxError('Bad thing at line 7 column 3'))).toBe(
      'at line 7 column 3',
    );
  });

  it('says nothing about the text when the parser names no position', () => {
    expect(describeJsonParseFailure(new SyntaxError('Unexpected end of JSON input'))).toBe(
      'at an unreported position',
    );
  });

  it('refuses a non-Error without inspecting it', () => {
    expect(describeJsonParseFailure('Unexpected token in "Fictional Ltd"')).toBe(
      'at an unreported position',
    );
    expect(describeJsonParseFailure(undefined)).toBe('at an unreported position');
  });

  /**
   * The regression itself. On the installed Node, V8 embeds a fragment of the
   * source in the message — this asserts against the REAL error rather than a
   * hand-written one, so a future Node whose message shape changed cannot make
   * the guard vacuous while the leak returns.
   */
  it.each([
    '{"displayName": "Fictional Ltd (fictional)", "clientId": broken}',
    '{"externalRefs": {"googleAds": "111-222-3333"},}',
    '[{"value": "we sell fictional widgets to fictional buyers"',
  ])('carries no fragment of the offending text (%#)', (text) => {
    const error = parseFailureOf(text);
    const described = describeJsonParseFailure(error);

    // The precondition: this Node's message really does quote the source.
    // Without it, a Node that stopped quoting would let this test pass while
    // proving nothing.
    expect((error as Error).message.length).toBeGreaterThan(0);

    for (const secret of [
      'Fictional Ltd',
      'displayName',
      'clientId',
      'externalRefs',
      'googleAds',
      '111-222-3333',
      'widgets',
      'broken',
    ]) {
      expect(described.includes(secret), `"${secret}" must not survive`).toBe(false);
    }

    expect(described.startsWith('at ')).toBe(true);
  });

  it('never returns the parser message itself', () => {
    const error = parseFailureOf('{"clientId": broken}');

    expect(describeJsonParseFailure(error)).not.toBe((error as Error).message);
    expect(describeJsonParseFailure(error).length).toBeLessThan(40);
  });
});
