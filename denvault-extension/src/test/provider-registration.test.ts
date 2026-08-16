/**
 * WBIP004 provider registration contract.
 *
 * `id` is not a display name. @stacks/connect-ui resolves it as a dotted
 * path into `window`:
 *
 *   getProviderFromId = (id) =>
 *     id?.split('.').reduce((acc, part) => acc?.[part], window);
 *
 * So the id has to point at the object that carries `request()`. It said
 * "DenVault" while the object lived at `window.StacksWallet`, so
 * `window["DenVault"]` was `undefined`, and the library's capability probe
 * (`"signMultipleTransactions" in provider`) threw
 * `TypeError: Cannot use 'in' operator ... in undefined` the moment anyone
 * pressed Connect. DenVault listed itself in every dApp picker and crashed
 * on selection.
 *
 * `name` is the display string. `id` is the lookup path. These tests pin
 * that distinction.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INJECTION_SOURCE = readFileSync(
  resolve(__dirname, "../../public/injection.js"),
  "utf-8"
);

/** The `id` value inside the wbip_providers registration. */
function registeredId(): string {
  const match = INJECTION_SOURCE.match(
    /window\.wbip_providers\.push\(\{[\s\S]*?\bid:\s*"([^"]+)"/
  );
  if (!match) throw new Error("no wbip_providers registration found");
  return match[1];
}

/** Reads a string field from the registration block. */
function registeredField(field: string): string {
  const match = INJECTION_SOURCE.match(
    new RegExp(`window\\.wbip_providers\\.push\\(\\{[\\s\\S]*?\\b${field}:\\s*"([^"]+)"`)
  );
  if (!match) throw new Error(`no ${field} in registration`);
  return match[1];
}

/**
 * Mirrors @stacks/connect-ui's getProviderFromId against a fake window,
 * so the resolution rule is exercised rather than assumed.
 */
function resolveFromId(id: string, win: Record<string, unknown>): unknown {
  return id
    .split(".")
    .reduce<unknown>(
      (acc, part) => (acc as Record<string, unknown> | undefined)?.[part],
      win
    );
}

describe("WBIP004 provider registration", () => {
  it("assigns the provider onto window under some global path", () => {
    expect(INJECTION_SOURCE).toMatch(/window\.\w+\s*=\s*StacksWallet\s*;/);
  });

  it("registers an id that resolves to the injected provider object", () => {
    const assignment = INJECTION_SOURCE.match(
      /window\.(\w+)\s*=\s*StacksWallet\s*;/
    );
    expect(assignment).not.toBeNull();

    const globalName = assignment![1];
    const provider = { request: () => {} };
    const fakeWindow: Record<string, unknown> = { [globalName]: provider };

    // The real failure mode: this returned undefined, and the library did
    // `"signMultipleTransactions" in undefined`.
    expect(resolveFromId(registeredId(), fakeWindow)).toBe(provider);
  });

  it("does not resolve to undefined, which is what crashed Connect", () => {
    const fakeWindow: Record<string, unknown> = {
      StacksWallet: { request: () => {} },
    };
    const resolved = resolveFromId(registeredId(), fakeWindow);

    expect(resolved).toBeDefined();
    // Reproduces the library's probe. It throws on undefined.
    expect(() => "signMultipleTransactions" in (resolved as object)).not.toThrow();
  });

  it("keeps DenVault as the display name", () => {
    expect(registeredField("name")).toBe("DenVault");
  });

  it("points webUrl at a host the project actually owns", () => {
    const webUrl = registeredField("webUrl");

    // github.com/denvault/denvault was registered here and returns 404.
    expect(webUrl).not.toContain("github.com/denvault");
    expect(webUrl).toMatch(/^https:\/\/akawolfcito\.github\.io\//);
  });

  it("ships a real icon rather than the placeholder mark", () => {
    const icon = registeredField("icon");

    expect(icon).toMatch(/^data:image\/(png|svg\+xml);base64,/);
    // The placeholder was a 48px rounded rect filled with Stacks purple.
    expect(icon).not.toContain("IzU1NDZGRg");
  });
});
