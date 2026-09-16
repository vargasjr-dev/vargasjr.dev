import Link from "next/link";

export const metadata = {
  title: "SMS Opt-In Policy — VargasJR",
  description:
    "How VargasJR collects consent to send you text messages, what you can expect, and how to opt out.",
};

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">SMS Opt-In Policy</h1>
        <p className="text-gray-500 mb-10">
          Effective September 16, 2026 · vargasjr.dev
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              How you opt in
            </h2>
            <p>
              VargasJR sends text messages only to people who have explicitly
              given us their phone number for that purpose. Consent is collected
              in one of the following ways:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong>Inbound message:</strong> you text our number (+1 (833)
                659-7364) first. By messaging us, you consent to a reply from
                the same number.
              </li>
              <li>
                <strong>Direct request:</strong> you ask VargasJR (in person or
                in writing) to send you updates by text, and you provide your
                number for that purpose.
              </li>
              <li>
                <strong>Verified account holder:</strong> the number is used for
                security verification (for example, two-factor authentication)
                at the account owner&apos;s own request.
              </li>
            </ul>
            <p className="mt-3">
              We never purchase, rent, or scrape phone number lists, and we
              never send marketing or bulk messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              What we send
            </h2>
            <p>
              Messages are 1:1, conversational, and initiated by or on behalf of
              the account owner. Expected frequency is low — at most a handful
              of messages per day. Message and data rates may apply, based on
              your mobile carrier and plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Opting out
            </h2>
            <p>
              Reply <strong>STOP</strong> to any message and we will stop
              texting you immediately. Reply <strong>HELP</strong> for support,
              or contact us at{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:hello@vargasjr.dev"
              >
                hello@vargasjr.dev
              </a>
              . Opting out never affects any other service you use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your number, protected
            </h2>
            <p>
              Phone numbers are used solely to deliver the messages you asked
              for. We do not sell or share them with third parties for their own
              marketing. See our{" "}
              <Link className="text-primary hover:underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              for full details, and our{" "}
              <Link className="text-primary hover:underline" href="/terms">
                Terms &amp; Conditions
              </Link>{" "}
              for the rest of the fine print.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
