/**
 * A site's standing approval must not outlive what it was approved for.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clearOriginApprovals,
  revokeOriginApproval,
  listApprovedOrigins,
} from "./approvals";

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {
    "approved_https://explorer.hiro.so": { addresses: ["ST2NJ5K"] },
    "approved_https://app.example": { addresses: ["ST1ECQ1"] },
    "request_abc-123": { payload: {} },
    unrelated: true,
  };

  // @ts-expect-error - narrow stub for the two calls this module makes
  globalThis.chrome = {
    storage: {
      session: {
        get: vi.fn(async (keys?: unknown) => (keys === undefined ? { ...store } : {})),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
        }),
      },
    },
  };
});

describe("origin approvals", () => {
  it("drops every approval and leaves other session state alone", async () => {
    await clearOriginApprovals();

    expect(Object.keys(store)).toEqual(["request_abc-123", "unrelated"]);
  });

  it("drops one site without touching the others", async () => {
    await revokeOriginApproval("https://app.example");

    expect(Object.keys(store)).toContain("approved_https://explorer.hiro.so");
    expect(Object.keys(store)).not.toContain("approved_https://app.example");
  });

  it("lists the origins holding an approval", async () => {
    expect((await listApprovedOrigins()).sort()).toEqual([
      "https://app.example",
      "https://explorer.hiro.so",
    ]);
  });

  it("says nothing rather than throwing when storage is missing", async () => {
    // @ts-expect-error - the extension APIs are absent outside the extension
    globalThis.chrome = undefined;

    await expect(clearOriginApprovals()).resolves.toBeUndefined();
    await expect(revokeOriginApproval("https://app.example")).resolves.toBeUndefined();
    await expect(listApprovedOrigins()).resolves.toEqual([]);
  });

  it("survives storage failing, because a switch must not die with it", async () => {
    // @ts-expect-error - narrow stub
    globalThis.chrome = {
      storage: {
        session: {
          get: vi.fn(async () => {
            throw new Error("storage unavailable");
          }),
          remove: vi.fn(),
        },
      },
    };

    await expect(clearOriginApprovals()).resolves.toBeUndefined();
    await expect(listApprovedOrigins()).resolves.toEqual([]);
  });
});
