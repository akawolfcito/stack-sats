/**
 * RPC surface contract.
 *
 * `public/injection.js` publishes SUPPORTED_METHODS to every page as
 * `window.StacksWallet.methods`. That list is a promise: a dApp that sees
 * a method there expects the wallet to be able to complete it.
 *
 * It used to advertise four methods that fell through to `// TODO:
 * implement` in Confirmation.handleConfirm. The user got a polished
 * approval screen, entered their PIN, approved — and received
 * `-32603 Internal Error`. A dead end that asks for the PIN first.
 *
 * These tests pin the surface so the wallet can never again claim more
 * than it can do.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INJECTION_SOURCE = readFileSync(
  resolve(__dirname, "../../public/injection.js"),
  "utf-8"
);
const CONFIRMATION_SOURCE = readFileSync(
  resolve(__dirname, "../components/Confirmation.vue"),
  "utf-8"
);
const BACKGROUND_SOURCE = readFileSync(
  resolve(__dirname, "../../public/background.js"),
  "utf-8"
);

/**
 * Methods Confirmation.handleConfirm can actually carry to a signed
 * result. Every entry maps to a handler in utils/stxmethods.
 */
const IMPLEMENTED_METHODS = [
  "getAddresses",
  "stx_signMessage",
  "stx_transferStx",
  "stx_signStructuredMessage",
  "stx_getAddresses",
  "stx_deployContract",
  "stx_callContract",
];

/**
 * Removed because nothing implements them. Re-advertising any of these
 * requires writing the handler first.
 */
const UNIMPLEMENTED_METHODS = [
  "stx_transferSip10Ft",
  "stx_signTransaction",
  "signPsbt",
  "sendTransfer",
];

/**
 * Handled by Confirmation.handleConfirm. stx_getAccounts is implemented
 * but deliberately not advertised, so it is accepted without being
 * published to pages.
 */
const ACCEPTED_ONLY = ["stx_getAccounts"];

function parseList(source: string, name: string, file: string): string[] {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) throw new Error(`${name} not found in ${file}`);
  return Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map((m) => m[1]);
}

describe("advertised RPC surface", () => {
  const advertised = parseList(INJECTION_SOURCE, "SUPPORTED_METHODS", "injection.js");

  it("advertises exactly the methods that are implemented", () => {
    expect([...advertised].sort()).toEqual([...IMPLEMENTED_METHODS].sort());
  });

  it.each(UNIMPLEMENTED_METHODS)(
    "does not advertise %s, which has no handler",
    (method) => {
      expect(advertised).not.toContain(method);
    }
  );

  it("leaves no unimplemented branch in the approval switch", () => {
    // Catches the reverse regression: a method re-added to the switch as
    // a stub while still being advertised.
    expect(CONFIRMATION_SOURCE).not.toMatch(/\/\/\s*TODO:\s*implement/i);
  });

  it("can describe every method it advertises", () => {
    // A method with no entry in methodDescription renders its raw id to
    // the user on the approval screen.
    for (const method of advertised) {
      expect(CONFIRMATION_SOURCE).toContain(method);
    }
  });
});

/**
 * The advertised list in injection.js is advisory: content.js relays any
 * well-formed event, so a page can reach the background without going
 * through window.StacksWallet. background.js is where the surface is
 * actually enforced.
 */
describe("enforced RPC surface", () => {
  const advertised = parseList(INJECTION_SOURCE, "SUPPORTED_METHODS", "injection.js");
  const accepted = parseList(BACKGROUND_SOURCE, "ACCEPTED_METHODS", "background.js");

  it("accepts exactly what is implemented", () => {
    expect([...accepted].sort()).toEqual(
      [...IMPLEMENTED_METHODS, ...ACCEPTED_ONLY].sort()
    );
  });

  it("accepts everything it advertises", () => {
    for (const method of advertised) {
      expect(accepted).toContain(method);
    }
  });

  it.each(UNIMPLEMENTED_METHODS)("refuses to accept %s", (method) => {
    expect(accepted).not.toContain(method);
  });

  it("rejects unsupported methods before queueing anything", () => {
    // The guard must run ahead of enqueue, otherwise the popup opens and
    // asks for the PIN before the request can fail.
    const guardIndex = BACKGROUND_SOURCE.indexOf("!ACCEPTED_METHODS.includes(method)");
    const autoApproveIndex = BACKGROUND_SOURCE.indexOf(
      "AUTO_APPROVE_METHODS.includes(method)"
    );

    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(autoApproveIndex);
    expect(BACKGROUND_SOURCE).toContain("-32601");
  });
});
