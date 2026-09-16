import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — VargasJR",
  description: "How VargasJR collects, uses, and protects your information, including phone numbers used for SMS.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-10">
          Effective September 16, 2026 · vargasjr.dev
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              What we collect
            </h2>
            <p>
              This site is a personal project, so we keep data collection to a
              minimum. Depending on how you interact with us, we may process:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong>Phone number</strong> — if you text us or give us your
                number for SMS updates or verification.
              </li>
              <li>
                <strong>Message content</strong> — texts you send and receive
                through the messaging service, so the assistant can respond.
              </li>
              <li>
                <strong>Basic technical data</strong> — standard web server
                logs (IP address, user agent) kept for security and reliability.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              How we use it
            </h2>
            <p>
              Phone numbers and message content are used solely to deliver the
              conversations or verifications you asked for, and to honor opt-out
              requests. We do not sell, rent, or share your phone number with
              third parties for their own marketing. We do not use your
              information for advertising or build profiles for ad targeting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Processors we rely on
            </h2>
            <p>
              Text messages are delivered through Twilio as our
              communications carrier. Web hosting is provided by Vercel. These
              providers process data only as needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Retention &amp; your choices
            </h2>
            <p>
              We keep message data only as long as needed to operate the
              assistant, then delete it. Reply <strong>STOP</strong> to opt out
              of SMS at any time. To access, correct, or delete any other data
              we hold about you, email{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:hello@vargasjr.dev"
              >
                hello@vargasjr.dev
              </a>{" "}
              and we&apos;ll take care of it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Related policies
            </h2>
            <p>
              See the{" "}
              <Link className="text-primary hover:underline" href="/sms-consent">
                SMS Opt-In Policy
              </Link>{" "}
              for how we collect consent, and the{" "}
              <Link className="text-primary hover:underline" href="/terms">
                Terms &amp; Conditions
              </Link>{" "}
              for the terms of service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
