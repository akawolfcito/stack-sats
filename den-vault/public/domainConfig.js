/**
 * Domain whitelist configuration
 * Only these origins can communicate with the wallet
 */

const ALLOWED_ORIGINS = [
  "http://localhost",
  "http://127.0.0.1",
  "https://localhost",
];

/**
 * Check if an origin is in the whitelist
 * Supports port wildcards (e.g., http://localhost:* matches http://localhost:3000)
 */
function isOriginAllowed(origin) {
  if (!origin) return false;

  return ALLOWED_ORIGINS.some((allowed) => {
    // Check if origin starts with allowed pattern
    return origin.startsWith(allowed);
  });
}

/**
 * Rate limiting configuration
 */
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 30,
  requests: new Map(), // origin -> { count, timestamp }

  check(origin) {
    const now = Date.now();
    const tracking = this.requests.get(origin) || { count: 0, timestamp: now };

    // Reset if more than a minute has passed
    if (now - tracking.timestamp > 60000) {
      tracking.count = 0;
      tracking.timestamp = now;
    }

    tracking.count++;
    this.requests.set(origin, tracking);

    return tracking.count <= this.MAX_REQUESTS_PER_MINUTE;
  },

  reset(origin) {
    this.requests.delete(origin);
  },
};
