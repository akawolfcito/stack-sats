/**
 * Formatting a STX balance without ever overstating it.
 *
 * The Home screen used toLocaleString with maximumFractionDigits: 2,
 * which rounds. After a contract deploy costing 0.004499 STX, a balance
 * of 499.995501 was shown as "500.00": a figure the account does not
 * hold, and a transaction that looked like it never happened.
 *
 * Truncation is the rule here. A wallet may show less than you have, in
 * the digits it does not have room for; it may never show more.
 *
 * The arithmetic runs on the integer microSTX the chain reports, so no
 * float rounding creeps in on the way.
 */

const MICRO_PER_STX = 1_000_000n;

/**
 * @param microStx integer microSTX, as the API reports it
 * @param decimals how many decimals to show for amounts of 0.01 and up
 */
export function formatStxFromMicro(
  microStx: string | number | bigint,
  decimals = 2
): string {
  let micro: bigint;
  try {
    micro = BigInt(typeof microStx === 'string' ? microStx.trim() || '0' : microStx);
  } catch {
    return (0).toFixed(decimals);
  }

  if (micro <= 0n) return (0).toFixed(decimals);

  const whole = micro / MICRO_PER_STX;
  const fraction = micro % MICRO_PER_STX;
  const fractionDigits = fraction.toString().padStart(6, '0');

  // Below the display precision, two decimals would read as 0.00 for an
  // account that is not empty. Show the real figure instead.
  const scale = BigInt(10 ** (6 - decimals));
  if (whole === 0n && fraction < scale) {
    return `0.${fractionDigits}`;
  }

  const shown = fractionDigits.slice(0, decimals);
  const grouped = whole.toLocaleString('en-US');

  return `${grouped}.${shown}`;
}
