/**
 * @vitest-environment node
 *
 * Contract-call parameters, against the real @stacks/transactions.
 *
 * handlers.test.ts mocks that module wholesale, and every contract-call
 * test in it passes `functionArgs: []`. So the one thing a contract call
 * lives or dies by, turning what a dApp puts on the wire into Clarity
 * values, was never exercised at all.
 */

import { describe, it, expect } from 'vitest';
import { Cl, cvToHex } from '@stacks/transactions';
import { toClarityArgs, toTxOptions, resolveRequestedNetwork } from './params';

describe('toClarityArgs', () => {
  it('deserializes the hex strings a dApp actually sends', () => {
    // @stacks/connect types functionArgs as `string[] | ClarityValue[]`,
    // and only strings survive JSON-RPC: a ClarityValue carrying a BigInt
    // cannot be serialized. The wallet used to cast the strings straight
    // to ClarityValue[] and hand them to the SDK.
    const args = [cvToHex(Cl.uint(42)), cvToHex(Cl.standardPrincipal('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'))];

    const parsed = toClarityArgs(args);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(Cl.uint(42));
    expect(parsed[1]).toEqual(
      Cl.standardPrincipal('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM')
    );
  });

  it('accepts hex without the 0x prefix', () => {
    const hex = cvToHex(Cl.bool(true)).replace(/^0x/, '');

    expect(toClarityArgs([hex])[0]).toEqual(Cl.bool(true));
  });

  it('passes through values that are already Clarity', () => {
    const value = Cl.stringAscii('hello');

    expect(toClarityArgs([value])[0]).toEqual(value);
  });

  it('has nothing to do when there are no arguments', () => {
    expect(toClarityArgs([])).toEqual([]);
    expect(toClarityArgs(undefined)).toEqual([]);
  });

  it('rejects a string that is not a Clarity value', () => {
    // Better here than as an unreadable failure from the node, or worse,
    // a transaction that means something other than what was asked.
    expect(() => toClarityArgs(['not-hex'])).toThrow(/argument/i);
  });
});

describe('resolveRequestedNetwork', () => {
  it('accepts the plain string a dApp actually sends', () => {
    // @stacks/connect types this as NetworkString, and Hiro's sandbox
    // sends "testnet". The schema demanded an object, so every contract
    // call and every STX transfer from a dApp failed Zod validation
    // before it reached a handler.
    expect(() => resolveRequestedNetwork('testnet', 'testnet')).not.toThrow();
  });

  it('accepts the object form too', () => {
    expect(() =>
      resolveRequestedNetwork({ chainId: 2147483648 }, 'testnet')
    ).not.toThrow();
  });

  it('accepts nothing at all', () => {
    expect(() => resolveRequestedNetwork(undefined, 'testnet')).not.toThrow();
  });

  it('refuses to sign on a chain the user is not on', () => {
    // Silently signing a mainnet transaction while the wallet says
    // testnet is the worst available outcome: the user approves what the
    // screen shows, and the screen shows their own network.
    expect(() => resolveRequestedNetwork('mainnet', 'testnet')).toThrow(
      /mainnet/i
    );
  });

  it('treats devnet and regtest as testnet, which is the chain they use', () => {
    expect(() => resolveRequestedNetwork('devnet', 'testnet')).not.toThrow();
    expect(() => resolveRequestedNetwork('regtest', 'testnet')).not.toThrow();
  });
});

describe('toTxOptions', () => {
  it('forwards the post conditions the dApp asked for', () => {
    // Dropping these was not a detail. They are the user's guarantee that
    // a contract cannot move more than it said it would, and the SDK
    // defaults to Deny, so a call that transfers anything aborts on chain
    // when its conditions go missing.
    const options = toTxOptions({
      postConditions: ['0x00021a', '0x00021b'],
      postConditionMode: 'allow',
    });

    expect(options.postConditions).toEqual(['0x00021a', '0x00021b']);
    expect(options.postConditionMode).toBe('allow');
  });

  it('omits what the dApp did not send, so the SDK keeps its defaults', () => {
    const options = toTxOptions({});

    expect(options).toEqual({});
    expect('fee' in options).toBe(false);
    expect('postConditionMode' in options).toBe(false);
  });

  it('forwards fee, nonce and sponsored when present', () => {
    const options = toTxOptions({ fee: 1000, nonce: 7, sponsored: true });

    expect(options.fee).toBe(1000);
    expect(options.nonce).toBe(7);
    expect(options.sponsored).toBe(true);
  });

  it('keeps a zero fee, which is a request and not an absence', () => {
    expect(toTxOptions({ fee: 0 }).fee).toBe(0);
  });
});
