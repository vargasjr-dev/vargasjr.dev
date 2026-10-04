import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — VargasJR",
  description:
    "Terms governing the use of vargasjr.dev and VargasJR's SMS messages.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Terms &amp; Conditions</h1>
        <p className="text-gray-500 mb-10">
          Effective September 16, 2026 · vargasjr.dev
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. The service
            </h2>
            <p>
              vargasjr.dev is the home of VargasJR, a personal AI assistant
              operated by David Vargas (&quot;we&quot;, &quot;us&quot;). The
              site provides information about projects, a downloadable contact
              card, and an opt-in text messaging service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. SMS terms
            </h2>
            <p>
              By providing your mobile phone number and enrolling in the
              VargasJR SMS program at{" "}
              <Link
                className="text-primary hover:underline"
                href="/sms-consent"
              >
                vargasjr.dev/sms-consent
              </Link>
              , you agree to receive text messages from{" "}
              <strong>VargasJR</strong>, the AI assistant service operated by{" "}
              <strong>Vargas JR, LLC</strong>, from +1 (833) 659-7364.
              Specifically:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong>Message types:</strong> task confirmations, calendar and
                deadline reminders, status alerts, and one-to-one conversational
                replies to requests you&apos;ve made.
              </li>
              <li>
                <strong>Frequency:</strong> message frequency varies.
              </li>
              <li>
                <strong>Cost:</strong> message and data rates may apply,
                depending on your carrier and plan.
              </li>
              <li>
                <strong>Opt-out:</strong> reply <strong>STOP</strong> to opt out
                at any time; reply <strong>HELP</strong> for help.
              </li>
              <li>
                Carriers are not liable for delayed or undelivered messages.
              </li>
              <li>
                We may suspend messaging that is abusive, unlawful, or that
                interferes with operation of the service.
              </li>
            </ul>
            <p className="mt-3">
              Participation in the SMS program is subject to our{" "}
              <Link className="text-primary hover:underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              and these{" "}
              <Link className="text-primary hover:underline" href="/terms">
                Terms &amp; Conditions
              </Link>
              . Consent to receive messages is optional and is not a condition
              of using anything else on this site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. Acceptable use
            </h2>
            <p>
              Don&apos;t misuse the site or the messaging line: no spam, no
              attempts to disrupt or overload the service, no unlawful activity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. No warranty; limitation of liability
            </h2>
            <p>
              The site and messages are provided &quot;as is&quot; without
              warranties of any kind. To the maximum extent permitted by law, we
              are not liable for indirect or consequential damages arising from
              your use of the site or the messaging service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Contact
            </h2>
            <p>
              Questions about these terms? Email{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:hello@vargasjr.dev"
              >
                hello@vargasjr.dev
              </a>
              . These terms may be updated occasionally; changes are reflected
              in the effective date above.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
