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

test("the shell hands the browser-only fragment to the gateway iframe", async () => {
  process.env.CADET_GATEWAY_URL = "https://gateway.example/instance-1";
  const response = await GET(
    new Request("https://site.example/assistant/pair/"),
    { params: Promise.resolve({ slug: ["pair"] }) },
  );
  const dom = new JSDOM(await response.text(), {
    url: "https://site.example/assistant/pair/#device_code=CODE-123",
    runScripts: "dangerously",
  });
  try {
    const iframe = dom.window.document.getElementById("cadet-gateway");
    assert.equal(
      iframe?.getAttribute("src"),
      "https://gateway.example/instance-1/assistant/pair/#device_code=CODE-123",
    );
    dom.window.history.replaceState(
      null,
      "",
      "/assistant/conversations/123/?view=chat#message-1",
    );
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    assert.equal(
      iframe?.getAttribute("src"),
      "https://gateway.example/instance-1/assistant/conversations/123/?view=chat#message-1",
    );
  } finally {
    dom.window.close();
  }
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
