import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  assistantReturnPath,
  assistantFrameUrl,
  assistantNavigationMessage,
  gatewayAssistantUrl,
  parentToSpa,
  spaToParent,
} from "./assistant-navigation";
import { GET } from "../app/assistant/[[...slug]]/route";

const originalGateway = process.env.CADET_GATEWAY_URL;
afterEach(() => {
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

test("the admin frame loads the fixed same-site Cadet domain with the pairing fragment", () => {
  assert.equal(
    assistantFrameUrl(
      "/admin/assistant/pair/?returnTo=%2Fassistant%2F#device_code=CODE-123",
    ),
    "https://assistant.vargasjr.dev/assistant/pair/?returnTo=%2Fassistant%2F#device_code=CODE-123",
  );
  assert.equal(
    assistantFrameUrl(
      "/admin/assistant/conversations/123/?view=chat#message-1",
    ),
    "https://assistant.vargasjr.dev/assistant/conversations/123/?view=chat#message-1",
  );
  assert.equal(
    assistantFrameUrl("/admin/assistant/conversations/123/", "vellum"),
    "/assistant/conversations/123/",
  );
});

test("Cadet shell URLs redirect to its domain without fetching or proxying", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("The website must not fetch Cadet HTML");
  };
  try {
    const response = await GET(
      new Request(
        "https://site.example/assistant/conversations/123/?view=chat",
      ),
      { params: Promise.resolve({ slug: ["conversations", "123"] }) },
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://assistant.vargasjr.dev/assistant/conversations/123/?view=chat",
    );
  } finally {
    globalThis.fetch = fetch;
  }
});

test("navigation messages validate the protocol and assistant path", () => {
  assert.deepEqual(
    assistantNavigationMessage({
      source: "mycadet-web-nav",
      nav: "push",
      path: "/assistant/conversations/123/",
    }),
    { nav: "push", path: "/assistant/conversations/123/" },
  );
  assert.equal(
    assistantNavigationMessage({
      source: "mycadet-web-nav",
      nav: "push",
      path: "/assistant/../../admin/",
    }),
    null,
  );
  assert.equal(
    assistantNavigationMessage({
      source: "mycadet-web-nav",
      nav: "push",
      path: "https://evil.example/assistant/",
    }),
    null,
  );
  assert.equal(
    assistantNavigationMessage({
      source: "other",
      nav: "push",
      path: "/assistant/",
    }),
    null,
  );

  // The copied-cadet bundle's protocol is retired: the remote-gateway SPA
  // speaks "mycadet-web-nav" and nothing emits "cadet-spa-nav" anymore.
  assert.equal(
    assistantNavigationMessage({
      source: "cadet-spa-nav",
      nav: "push",
      path: "/assistant/",
    }),
    null,
  );
  assert.equal(
    assistantNavigationMessage({
      source: "mycadet-web-nav",
      nav: "other",
      path: "/assistant/",
    }),
    null,
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
