/**
 * Where the Bitcoin calls go.
 *
 * Both hosts serve the same Esplora API, so the wallet can move between
 * them without changing a single call site. It has to: on 2026-08-16
 * mempool.space answered nothing for either network, mainnet or testnet,
 * while blockstream.info replied in 0.4s. With the 15s deadline in place
 * that outage no longer hangs the UI, but the balance still resolved to
 * zero, which reads exactly like an empty address.
 *
 * Unreachable from here is not proof of unreachable everywhere, so the old
 * host stays in the chain instead of being dropped. Whichever answers
 * first is remembered for the rest of the session, so the failover is paid
 * once rather than on every request.
 */

import type { NetworkName } from '../network';
import { secureLog } from '../security/logger';
import { fetchWithTimeout } from './http';

/** Esplora-compatible hosts, in the order they are tried. */
const ESPLORA_HOSTS: Record<NetworkName, string[]> = {
  mainnet: ['https://blockstream.info/api', 'https://mempool.space/api'],
  testnet: [
    'https://blockstream.info/testnet/api',
    'https://mempool.space/testnet/api',
  ],
  // Devnet has no Bitcoin chain of its own; it borrows testnet.
  devnet: [
    'https://blockstream.info/testnet/api',
    'https://mempool.space/testnet/api',
  ],
};

/** Human-facing explorers, matching the primary host above. */
const EXPLORER_BASES: Record<NetworkName, string> = {
  mainnet: 'https://blockstream.info',
  testnet: 'https://blockstream.info/testnet',
  devnet: 'https://blockstream.info/testnet',
};

/** The host that last answered, per network. */
const lastGoodHost = new Map<NetworkName, string>();

export interface EsploraRequestOptions {
  network: NetworkName;
  init?: RequestInit;
  timeoutMs?: number;
}

/** The hosts for a network, best first. */
export function esploraHostsFor(network: NetworkName): string[] {
  const hosts = ESPLORA_HOSTS[network];
  const preferred = lastGoodHost.get(network);
  if (!preferred || !hosts.includes(preferred)) {
    return [...hosts];
  }
  return [preferred, ...hosts.filter((host) => host !== preferred)];
}

/** Drop the remembered host. Tests use this; nothing else needs it. */
export function resetEsploraHostCache(): void {
  lastGoodHost.clear();
}

/** Base URL of the explorer a user can open for this network. */
export function getBtcExplorerBase(network: NetworkName): string {
  return EXPLORER_BASES[network];
}

/**
 * Call an Esplora path, failing over between hosts.
 *
 * Moves to the next host when one throws (timeout or transport) or answers
 * 5xx. Anything else is an answer and is handed back as-is: a 404 for an
 * address with no history is a legitimate reply, and retrying it would
 * double every lookup for nothing.
 *
 * @throws when no host answered, naming them so the failure is legible.
 */
export async function esploraFetch(
  path: string,
  { network, init, timeoutMs }: EsploraRequestOptions
): Promise<Response> {
  const hosts = esploraHostsFor(network);
  let lastError: unknown;

  for (const host of hosts) {
    const url = `${host}${path}`;
    try {
      const response = await fetchWithTimeout(url, init ?? {}, timeoutMs);

      if (response.status >= 500) {
        lastError = new Error(`${host} answered ${response.status}`);
        secureLog('Bitcoin host returned a server error', {
          host,
          status: response.status,
        });
        continue;
      }

      lastGoodHost.set(network, host);
      return response;
    } catch (error) {
      lastError = error;
      secureLog('Bitcoin host did not answer', { host });
    }
  }

  // `cause` is assigned rather than passed: the two-argument Error
  // constructor needs a newer lib than this project compiles against.
  const failure = new Error(
    `No Bitcoin API could be reached for ${network} (tried ${hosts.join(', ')}): ${String(lastError)}`
  );
  (failure as Error & { cause?: unknown }).cause = lastError;
  throw failure;
}
