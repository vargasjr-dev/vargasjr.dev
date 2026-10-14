import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  assistantReturnPath,
  gatewayAssistantUrl,
  parentToSpa,
  spaToParent,
} from "./assistant-navigation";
import { GET } from "../app/assistant/[[...slug]]/route";

import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const originalFetch = globalThis.fetch;
const originalGateway = process.env.CADET_GATEWAY_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGateway === undefined) delete process.env.CADET_GATEWAY_URL;
  else process.env.CADET_GATEWAY_URL = originalGateway;
});

test("admin and SPA routes preserve a pairing fragment and query without adding to the code", () => {
  const source =
    "/admin/assistant/pair?returnTo=%2Fassistant%2F#device_code=CODE-123";
  assert.equal(
    parentToSpa(source),
    "/assistant/pair/?returnTo=%2Fassistant%2F#device_code=CODE-123",
  );
  assert.equal(
    spaToParent(parentToSpa(source)),
    "/admin/assistant/pair/?returnTo=%2Fassistant%2F#device_code=CODE-123",
  );
});

test("gateway paths retain the configured host prefix and the pairing route", () => {
  assert.equal(
    gatewayAssistantUrl(
      "https://gateway.example/instance-1/",
      "/assistant/pair/#device_code=CODE-123",
    ),
    "https://gateway.example/instance-1/assistant/pair/#device_code=CODE-123",
  );
  assert.equal(
    gatewayAssistantUrl(
      "https://gateway.example/instance-1/assistant/",
      "/assistant/pair/",
    ),
    "https://gateway.example/instance-1/assistant/pair/",
  );
});

test("gateway HTML runs on the site origin and reports navigation including pairing fragments", async () => {
  process.env.CADET_GATEWAY_URL = "https://gateway.example/instance-1";
  const fetched: string[] = [];
  globalThis.fetch = async (input) => {
    fetched.push(String(input));
    return new Response(
      "<html><head></head><body><main>Cadet</main></body></html>",
      { headers: { "Content-Type": "text/html" } },
    );
  };
  const response = await GET(
    new Request("https://site.example/assistant/pair/"),
    { params: Promise.resolve({ slug: ["pair"] }) },
  );
  const messages: Array<{ path: string; nav: string }> = [];
  const sockets: string[] = [];
  const dom = new JSDOM(await response.text(), {
    url: "https://site.example/assistant/pair/#device_code=CODE-123",
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window, "WebSocket", {
        value: class {
          constructor(url: string) {
            sockets.push(String(url));
          }
        },
        writable: true,
      });
      Object.defineProperty(window, "parent", {
        value: {
          postMessage(message: { path: string; nav: string }, origin: string) {
            assert.equal(origin, "https://site.example");
            messages.push(message);
          },
        },
      });
    },
  });
  try {
    assert.deepEqual(fetched, [
      "https://gateway.example/instance-1/assistant/pair/",
    ]);
    assert.equal(dom.window.document.querySelector("iframe"), null);
    assert.equal(messages[0].path, "/assistant/pair/#device_code=CODE-123");
    dom.window.history.pushState(
      { idx: 1 },
      "",
      "/assistant/conversations/123/?view=chat#message-1",
    );
    assert.equal(
      messages.at(-1)?.path,
      "/assistant/conversations/123/?view=chat#message-1",
    );
    assert.equal(messages.at(-1)?.nav, "push");
    dom.window.history.replaceState(
      { idx: 1 },
      "",
      "/assistant/conversations/456/",
    );
    assert.equal(messages.at(-1)?.nav, "replace");
    assert.equal(dom.window.history.state.idx, 1);
    new dom.window.WebSocket("wss://site.example/v1/live-voice?token=fixture");
    assert.equal(
      sockets[0],
      "wss://gateway.example/instance-1/v1/live-voice?token=fixture",
    );
    new dom.window.WebSocket("wss://external.example/events");
    assert.equal(sockets[1], "wss://external.example/events");
  } finally {
    dom.window.close();
  }
});

test("Cadet refresh and assets bypass legacy mocks without cross-origin redirects", () => {
  process.env.CADET_GATEWAY_URL = "https://gateway.example/instance-1";
  for (const path of [
    "/v1/guardian/refresh",
    "/v1/assistants/",
    "/assistant/assets/app.js",
  ]) {
    const response = proxy(new NextRequest("https://site.example" + path));
    assert.equal(
      response.headers.get("x-middleware-rewrite"),
      "https://gateway.example/instance-1" + path,
    );
    assert.equal(response.headers.get("location"), null);
  }
  const legacy = proxy(
    new NextRequest("https://site.example/v1/assistants/", {
      headers: { cookie: "webClientBundle=vellum" },
    }),
  );
  assert.equal(
    legacy.headers.get("x-middleware-rewrite"),
    "https://site.example/api/v1/assistants",
  );
});

test("login resumes only a local assistant path", () => {
  assert.equal(
    assistantReturnPath("/admin/assistant/pair/#device_code=CODE-123"),
    "/admin/assistant/pair/#device_code=CODE-123",
  );
  assert.equal(
    assistantReturnPath("//evil.example/admin/assistant/pair/"),
    null,
  );
  assert.equal(
    assistantReturnPath("https://evil.example/admin/assistant/pair/"),
    null,
  );
});
