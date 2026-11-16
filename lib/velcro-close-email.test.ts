import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseClosedEmail,
  customerEmailFrom,
  isClosingTransition,
} from "./velcro-close-email";

test("isClosingTransition fires only on open -> closed", () => {
  assert.equal(isClosingTransition("open", "closed"), true);
  assert.equal(isClosingTransition(null, "closed"), true);
  // Re-closing an already-closed case must not re-notify.
  assert.equal(isClosingTransition("closed", "closed"), false);
  assert.equal(isClosingTransition("closed", "open"), false);
  assert.equal(isClosingTransition("open", "open"), false);
  assert.equal(isClosingTransition(undefined, undefined), false);
});

test("customerEmailFrom prefers the email-channel account handle", () => {
  assert.equal(
    customerEmailFrom(
      [
        { channel: "sms", handle: "+15551230000" },
        { channel: "email", handle: "joe@paladin.farm" },
      ],
      "John@paladin.farm",
    ),
    "joe@paladin.farm",
  );
});

test("customerEmailFrom falls back to a name that is an email", () => {
  assert.equal(customerEmailFrom([], "John@paladin.farm"), "John@paladin.farm");
  assert.equal(
    customerEmailFrom([{ channel: "sms", handle: "+1555" }], "John"),
    null,
  );
  assert.equal(customerEmailFrom([], null), null);
  // Malformed email-channel handles are not trusted over the name.
  assert.equal(
    customerEmailFrom([{ channel: "email", handle: "not-an-email" }], "a@b.co"),
    "a@b.co",
  );
});

test("buildCaseClosedEmail names the case and the next-release note", () => {
  const { subject, text, html } = buildCaseClosedEmail(
    9,
    "Main-agent cache breakpoints <hardcode> 5m ttl",
  );
  assert.ok(subject.includes("#9"));
  assert.ok(subject.includes("5m ttl"));
  assert.ok(text.includes("closed case #9"));
  assert.ok(text.includes("live on the next release"));
  // The title is user-controlled — the HTML body must not pass it through raw.
  assert.ok(!html.includes("<hardcode>"));
  assert.ok(html.includes("&lt;hardcode&gt;"));
});
