/**
 * Smoke test against the real loaded extension.
 *
 * Covers the surfaces nothing else does — the service worker, the
 * content-script bridge and the packaged popup — focused on what the
 * 1.1.3 changes touched.
 */

import { test, expect, openDapp } from "./fixtures";

test("the service worker boots and reports the packaged version", async ({
  serviceWorker,
}) => {
  const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest());

  expect(manifest.version).toBe("1.1.3");
  expect(manifest.permissions).toEqual(["storage", "sidePanel"]);
  expect(manifest.host_permissions).toEqual([
    "https://api.hiro.so/*",
    "https://api.testnet.hiro.so/*",
  ]);
});

test("the popup loads from the packaged build", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);

  // Onboarding is the first screen with no wallet in storage.
  await expect(page.locator("body")).toContainText(/wallet/i, { timeout: 15000 });

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test("the page API advertises exactly the implemented methods", async ({ context }) => {
  const page = await openDapp(context);

  // The advertised list reaches dApps through the WBIP004 provider
  // registration, not as a property of window.StacksWallet.
  //
  // Looked up by name, because id is the dotted window path the connect
  // library walks to reach request(), not a label.
  const provider = await page.evaluate(
    () =>
      (
        window as unknown as {
          wbip_providers?: Array<{ id: string; name: string; methods: string[] }>;
        }
      ).wbip_providers?.find((p) => p.name === "DenVault")
  );

  expect(provider).toBeTruthy();
  // Selecting the wallet resolves this id against window; when it missed,
  // @stacks/connect crashed with "Cannot use 'in' operator ... in undefined".
  expect(provider!.id).toBe("StacksWallet");
  expect(provider!.methods).toEqual([
    "getAddresses",
    "stx_signMessage",
    "stx_transferStx",
    "stx_signStructuredMessage",
    "stx_getAddresses",
    "stx_deployContract",
    "stx_callContract",
  ]);
});

test("a withdrawn method is refused by the page API without reaching the wallet", async ({
  context,
}) => {
  const page = await openDapp(context);

  // request() rejects with the JSON-RPC envelope rather than resolving.
  const result = await page.evaluate(async () => {
    const wallet = (
      window as unknown as {
        StacksWallet: { request: (m: string, p: unknown) => Promise<unknown> };
      }
    ).StacksWallet;
    try {
      return { resolved: await wallet.request("signPsbt", {}) };
    } catch (rejection) {
      return rejection as { error?: { code: number } };
    }
  });

  expect(result).toMatchObject({ error: { code: -32601 } });
  // No approval window was opened: only the dApp tab exists.
  expect(context.pages().filter((p) => p.url().startsWith("chrome-extension://"))).toHaveLength(0);
});

test("the background refuses a withdrawn method dispatched straight at the bridge", async ({
  context,
}) => {
  const page = await openDapp(context);

  // Bypasses injection.js entirely: content.js relays any well-formed
  // event, which is why the real guard has to live in the background.
  const response = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window.addEventListener("message", (event) => {
        const data = event.data as { jsonrpc?: string; error?: { code: number } };
        if (data?.jsonrpc === "2.0" && data.error) resolve(data);
      });
      document.dispatchEvent(
        new CustomEvent("stackswallet_request", {
          detail: { jsonrpc: "2.0", id: "raw-1", method: "signPsbt", params: {} },
        })
      );
      setTimeout(() => resolve({ timedOut: true }), 8000);
    });
  });

  expect(response).toMatchObject({ error: { code: -32601 } });
  expect(context.pages().filter((p) => p.url().startsWith("chrome-extension://"))).toHaveLength(0);
});
