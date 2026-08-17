import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { describeBtcTx, fetchBtcActivity } from './activity';
import { resetEsploraHostCache } from './endpoints';

const MINE_LEGACY = 'mw7qXcn8GSjKHLXQZJ5YVzzGvyij3rLiVX';
const MINE_TAPROOT = 'tb1p0lh827cjuagvym9ke72c3v99jt6e7z2sj8cnheutqn2scsphuz6qs7q4fz';
const THEIRS = 'tb1qerzrlxcfu24davlur5sqmgzzgsal6wusda40er';

const owned = new Set([MINE_LEGACY, MINE_TAPROOT]);

/**
 * The real send from the 2026-08-16 testnet run: 10000 sats out, 4010 in
 * fees, 167308 back as change.
 */
const OUTGOING = {
  // Short ids on purpose: a 64 character hex literal is the shape of a
  // leaked key, and the pre-commit scanner is right to refuse to tell a
  // txid apart from one. Nothing here parses the format.
  txid: 'tx-outgoing',
  fee: 4010,
  vin: [{ prevout: { scriptpubkey_address: MINE_LEGACY, value: 181318 } }],
  vout: [
    { scriptpubkey_address: THEIRS, value: 10000 },
    { scriptpubkey_address: MINE_LEGACY, value: 167308 },
  ],
  status: { confirmed: false },
};

/** The faucet payment that funded the address. */
const INCOMING = {
  txid: 'tx-incoming',
  fee: 139,
  vin: [{ prevout: { scriptpubkey_address: THEIRS, value: 1863914843 } }],
  vout: [
    { scriptpubkey_address: 'mfYKxJG2WGKMQXxMg3zVqSCSgxGfrb8MZ1', value: 1863733386 },
    { scriptpubkey_address: MINE_LEGACY, value: 181318 },
  ],
  status: { confirmed: true, block_time: 1786918722 },
};

describe('describeBtcTx', () => {
  it('reports what left the wallet, not the change', () => {
    const item = describeBtcTx(OUTGOING, owned);

    expect(item.isOutgoing).toBe(true);
    // 10000, not 177318 and not the 14010 that includes the fee: it has
    // to match the number the user typed.
    expect(item.amountSats).toBe(10000);
    expect(item.feeSats).toBe(4010);
    expect(item.counterparty).toBe(THEIRS);
    expect(item.confirmed).toBe(false);
  });

  it('reports only what this wallet received', () => {
    const item = describeBtcTx(INCOMING, owned);

    expect(item.isOutgoing).toBe(false);
    // The faucet's own change output is not ours and must not be counted.
    expect(item.amountSats).toBe(181318);
    expect(item.feeSats).toBe(0);
    expect(item.counterparty).toBe(THEIRS);
    expect(item.blockTime).toBe(1786918722);
  });

  it('counts a payment to our second address as incoming', () => {
    const item = describeBtcTx(
      {
        txid: 'aa',
        fee: 100,
        vin: [{ prevout: { scriptpubkey_address: THEIRS, value: 50000 } }],
        vout: [{ scriptpubkey_address: MINE_TAPROOT, value: 40000 }],
        status: { confirmed: true, block_time: 10 },
      },
      owned
    );

    expect(item.isOutgoing).toBe(false);
    expect(item.amountSats).toBe(40000);
  });

  it('treats a move between our own addresses as outgoing with nothing sent', () => {
    const item = describeBtcTx(
      {
        txid: 'bb',
        fee: 200,
        vin: [{ prevout: { scriptpubkey_address: MINE_LEGACY, value: 30000 } }],
        vout: [{ scriptpubkey_address: MINE_TAPROOT, value: 29800 }],
        status: { confirmed: true, block_time: 20 },
      },
      owned
    );

    expect(item.isOutgoing).toBe(true);
    expect(item.amountSats).toBe(0);
    expect(item.feeSats).toBe(200);
  });
});

describe('fetchBtcActivity', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetEsploraHostCache();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respond(txs: unknown[]) {
    return new Response(JSON.stringify(txs), { status: 200 });
  }

  it('puts the unconfirmed transaction first', async () => {
    fetchMock
      .mockResolvedValueOnce(respond([INCOMING, OUTGOING]))
      .mockResolvedValueOnce(respond([]));

    const items = await fetchBtcActivity([MINE_LEGACY, MINE_TAPROOT], 'testnet');

    expect(items).toHaveLength(2);
    expect(items[0].txid).toBe(OUTGOING.txid);
    expect(items[0].confirmed).toBe(false);
  });

  it('does not list the same transaction twice when it touches both addresses', async () => {
    const shared = {
      ...OUTGOING,
      vout: [
        { scriptpubkey_address: THEIRS, value: 10000 },
        { scriptpubkey_address: MINE_TAPROOT, value: 167308 },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(respond([shared]))
      .mockResolvedValueOnce(respond([shared]));

    const items = await fetchBtcActivity([MINE_LEGACY, MINE_TAPROOT], 'testnet');

    expect(items).toHaveLength(1);
  });

  it('returns nothing rather than throwing when the indexer is down', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    // A gap in the history is a gap in the view. The balance beside it is
    // the thing that must never guess, and it says "Unavailable" itself.
    await expect(
      fetchBtcActivity([MINE_LEGACY], 'testnet')
    ).resolves.toEqual([]);
  });

  it('asks for nothing when the account has no Bitcoin addresses', async () => {
    expect(await fetchBtcActivity([], 'testnet')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
