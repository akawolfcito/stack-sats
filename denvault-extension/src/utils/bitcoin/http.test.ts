/**
 * Tests for the timed Bitcoin HTTP helper.
 *
 * The regression these guard: a Bitcoin API host that accepts the connection
 * and then never answers used to hang the wallet forever, because no request
 * carried a deadline.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  fetchWithTimeout,
  BtcRequestTimeoutError,
  BTC_REQUEST_TIMEOUT_MS,
} from './http';

const URL = 'https://example.invalid/api/address/abc';

/** A fetch that never settles until the request signal aborts. */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects with BtcRequestTimeoutError when the host never answers', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const promise = fetchWithTimeout(URL, {}, 5_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(BtcRequestTimeoutError);

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it('reports the url and the deadline it exceeded', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const promise = fetchWithTimeout(URL, {}, 5_000).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const error = await promise;

    expect(error).toBeInstanceOf(BtcRequestTimeoutError);
    expect(error.url).toBe(URL);
    expect(error.timeoutMs).toBe(5_000);
  });

  it('aborts the underlying request rather than leaking it', async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithTimeout(URL, {}, 5_000).catch(() => null);
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(true);
  });

  it('resolves normally when the host answers in time', async () => {
    const response = new Response('{"ok":true}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(fetchWithTimeout(URL)).resolves.toBe(response);
  });

  it('does not fire the deadline once the request settles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));

    await fetchWithTimeout(URL, {}, 5_000);

    // Nothing is pending: an uncleared timer would still be queued here.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates a transport failure untouched', async () => {
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));

    await expect(fetchWithTimeout(URL)).rejects.toBe(failure);
  });

  it('lets a caller-supplied signal abort the request', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const caller = new AbortController();

    const promise = fetchWithTimeout(URL, { signal: caller.signal }, 5_000).catch(
      (e) => e
    );
    caller.abort();
    const error = await promise;

    // The caller aborted, not the deadline, so this is not a timeout.
    expect(error).not.toBeInstanceOf(BtcRequestTimeoutError);
  });

  it('defaults to the shared Bitcoin deadline', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const promise = fetchWithTimeout(URL).catch((e) => e);
    await vi.advanceTimersByTimeAsync(BTC_REQUEST_TIMEOUT_MS);
    const error = await promise;

    expect(error).toBeInstanceOf(BtcRequestTimeoutError);
    expect(error.timeoutMs).toBe(BTC_REQUEST_TIMEOUT_MS);
  });
});
