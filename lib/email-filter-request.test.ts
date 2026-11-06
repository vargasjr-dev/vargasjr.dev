import { describe, expect, test } from "bun:test";
import {
  ALLOWED_FORWARDER,
  extractForwardedSender,
  fromAddress,
  htmlToText,
} from "./email-filter-request";

describe("fromAddress", () => {
  test("bare address", () => {
    expect(fromAddress("dvargasfuertes@gmail.com")).toBe(
      "dvargasfuertes@gmail.com",
    );
  });

  test("display name + angle address", () => {
    expect(fromAddress("David Vargas <dvargasfuertes@gmail.com>")).toBe(
      "dvargasfuertes@gmail.com",
    );
  });

  test("case-insensitive", () => {
    expect(fromAddress("DVargasFuertes@GMAIL.com")).toBe(
      "dvargasfuertes@gmail.com",
    );
  });
});

describe("extractForwardedSender", () => {
  test("gmail inline forward block", () => {
    const body = [
      "hey, adding a filter for this one",
      "",
      "---------- Forwarded message ---------",
      "De: Christian Faidit <christian@vellum.ai>",
      "Date: lun. 2 nov. 2026 à 09:15",
      "Subject: Your migration",
      "To: <dvargasfuertes@gmail.com>",
      "",
      "body text",
    ].join("\n");
    expect(extractForwardedSender(body)).toBe("christian@vellum.ai");
  });

  test("english From header", () => {
    expect(
      extractForwardedSender("From: Billing <billing@stripe.com>\nbody"),
    ).toBe("billing@stripe.com");
  });

  test("bare address on the From line", () => {
    expect(extractForwardedSender("From: billing@stripe.com\n")).toBe(
      "billing@stripe.com",
    );
  });

  test("quoted From line in a reply chain", () => {
    expect(extractForwardedSender("> From: a@b.com\n>> From: c@d.com")).toBe(
      "a@b.com",
    );
  });

  test("skips From: lines without an email", () => {
    expect(
      extractForwardedSender("From: the desk\nFrom: real@sender.com"),
    ).toBe("real@sender.com");
  });

  test("no From header → null", () => {
    expect(extractForwardedSender("just some text")).toBeNull();
  });
});

describe("htmlToText", () => {
  test("strips tags and decodes entities, keeping From: line", () => {
    const html =
      "<div>hi</div><br><span>From:&nbsp;A &lt;b@x.co&gt;</span><style>p{}</style>";
    const text = htmlToText(html);
    expect(extractForwardedSender(text)).toBe("b@x.co");
  });
});

describe("ALLOWED_FORWARDER", () => {
  test("is the work gmail", () => {
    expect(ALLOWED_FORWARDER).toBe("dvargasfuertes@gmail.com");
  });
});
