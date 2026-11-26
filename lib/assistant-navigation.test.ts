import { test } from "node:test";
import assert from "node:assert/strict";

import {
  gatewayAssistantUrl,
  assistantReturnPath,
  ASSISTANT_RETURN_KEY,
} from "./assistant-navigation";
import { GET } from "../app/assistant/[[...slug]]/route";

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

test("login-return paths stay inside the admin assistant url space", () => {
  assert.equal(
    assistantReturnPath("/admin/assistant/conversations/123/?view=chat"),
    "/admin/assistant/conversations/123/?view=chat",
  );
  // Anything outside the admin prefix never hijacks the login resume: the
  // gateway's own /web/assistant space and bare /admin are not assistant urls.
  assert.equal(assistantReturnPath("/admin/dev/assistant/"), null);
  assert.equal(assistantReturnPath("/admin/"), null);
  assert.equal(
    assistantReturnPath("https://evil.example/admin/assistant/"),
    null,
  );
  assert.equal(assistantReturnPath(null), null);
  assert.equal(ASSISTANT_RETURN_KEY, "adminAssistantReturnTo");
});
