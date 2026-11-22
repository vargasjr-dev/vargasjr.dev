import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { proxyCadetDev } from "./cadet-dev-proxy";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Cadet proxy forwards only gateway cookies and preserves separate HttpOnly session cookies", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://assistant.vargasjr.dev/v1/assistant?test=1",
    );
    const headers = new Headers(init?.headers);
    assert.equal(
      headers.get("cookie"),
      "cadet_web_access=access; cadet_web_refresh=refresh",
    );
    assert.equal(headers.get("authorization"), null);
    const response = new Response("event: test\n\n", {
      headers: { "content-type": "text/event-stream" },
    });
    response.headers.append(
      "set-cookie",
      "cadet_web_access=new; HttpOnly; Secure; SameSite=Strict; Path=/",
    );
    response.headers.append(
      "set-cookie",
      "cadet_web_refresh=new-refresh; HttpOnly; Secure; SameSite=Strict; Path=/",
    );
    response.headers.append("set-cookie", "admin_session=evil; Path=/");
    return response;
  };
  const response = await proxyCadetDev(
    new Request("https://vargasjr.dev/v1/assistant?test=1", {
      headers: {
        cookie:
          "admin_session=1; cadet_web_access=access; unrelated=secret; cadet_web_refresh=refresh",
        authorization: "Bearer website-secret",
      },
    }),
  );
  assert.equal(await response.text(), "event: test\n\n");
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("rejects cross-origin mutations and unsupported paths before contacting the gateway", async () => {
  globalThis.fetch = async () => {
    throw new Error("Should not fetch");
  };
  assert.equal(
    (
      await proxyCadetDev(
        new Request("https://vargasjr.dev/v1/assistant", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await proxyCadetDev(new Request("https://vargasjr.dev/api/admin"))).status,
    404,
  );
});

test("forwards pairing payloads and preserves unauthorized responses", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(
      new Headers(init?.headers).get("origin"),
      "https://assistant.vargasjr.dev",
    );
    assert.equal(
      Buffer.from(
        init?.body instanceof ArrayBuffer ? init.body : new ArrayBuffer(0),
      ).toString(),
      '{"deviceCode":"test"}',
    );
    return Response.json({ error: "expired" }, { status: 401 });
  };
  const response = await proxyCadetDev(
    new Request("https://vargasjr.dev/v1/assistant/remote-web/pairing-token", {
      method: "POST",
      headers: {
        origin: "https://vargasjr.dev",
        "content-type": "application/json",
      },
      body: '{"deviceCode":"test"}',
    }),
  );
  assert.equal(response.status, 401);
});
