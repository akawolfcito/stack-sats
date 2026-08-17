/**
 * Timed HTTP for the Bitcoin API calls.
 *
 * Every Bitcoin fetch used to call the platform `fetch` with no deadline. When
 * the upstream host stopped answering (mempool.space did, for both mainnet and
 * testnet), the promise never settled: the balance spinner ran forever, no
 * error surfaced and no retry was possible. A wallet that hangs on a dead host
 * is worse than one that says it could not reach the network, so every request
 * carries a deadline now.
 *
 * The deadline lives here rather than at each call site so a new endpoint
 * cannot forget it.
 */

/** Deadline for a single Bitcoin API request. */
export const BTC_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Raised when a request passes {@link BTC_REQUEST_TIMEOUT_MS} without a
 * response. Distinguishable from a transport failure so callers can tell "the
 * host is not answering" apart from "the host refused us".
 */
export class BtcRequestTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Bitcoin API request timed out after ${timeoutMs}ms`);
    this.name = 'BtcRequestTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * `fetch` with a deadline.
 *
 * Aborts the request once `timeoutMs` elapses and rejects with a
 * {@link BtcRequestTimeoutError}. Any `signal` the caller supplies still works:
 * aborting it aborts the request, and that rejects with the platform's own
 * abort error rather than the timeout one.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = BTC_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Honour a caller-supplied signal without losing our own deadline.
  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new BtcRequestTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
