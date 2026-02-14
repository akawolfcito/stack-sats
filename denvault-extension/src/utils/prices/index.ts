/**
 * Fiat price service using CoinGecko free API
 * 5-minute cache to respect rate limits (10-30 calls/min on free tier)
 */

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 5000; // 5 second timeout

interface PriceCache {
  stxUsd: number | null;
  btcUsd: number | null;
  fetchedAt: number;
}

let cache: PriceCache = {
  stxUsd: null,
  btcUsd: null,
  fetchedAt: 0,
};

function isCacheValid(): boolean {
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

/**
 * Fetch STX and BTC prices in USD from CoinGecko
 * Returns cached values if within TTL
 */
export async function fetchPrices(): Promise<{
  stxUsd: number | null;
  btcUsd: number | null;
}> {
  if (isCacheValid()) {
    return { stxUsd: cache.stxUsd, btcUsd: cache.btcUsd };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    cache = {
      stxUsd: data?.blockstack?.usd ?? null,
      btcUsd: data?.bitcoin?.usd ?? null,
      fetchedAt: Date.now(),
    };

    return { stxUsd: cache.stxUsd, btcUsd: cache.btcUsd };
  } catch {
    // Return stale cache on error, or null if no cache exists
    return { stxUsd: cache.stxUsd, btcUsd: cache.btcUsd };
  }
}

/**
 * Format a fiat amount for display
 */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Convert microSTX to fiat display string
 * Returns null if price is unavailable
 */
export function microStxToUsd(
  microStx: bigint,
  stxUsd: number | null,
): string | null {
  if (stxUsd === null) return null;
  const stx = Number(microStx) / 1_000_000;
  return formatUsd(stx * stxUsd);
}

/**
 * Clear the price cache (for testing)
 */
export function _clearPriceCache(): void {
  cache = { stxUsd: null, btcUsd: null, fetchedAt: 0 };
}
