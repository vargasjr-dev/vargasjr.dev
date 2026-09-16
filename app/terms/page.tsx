import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — VargasJR",
  description: "Terms governing the use of vargasjr.dev and VargasJR's SMS messages.",
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
            <h2 className="text-xl font-semibold text-white mb-3">1. The service</h2>
            <p>
              vargasjr.dev is the home of VargasJR, a personal AI assistant
              operated by David Vargas (&quot;we&quot;, &quot;us&quot;). The site provides
              information about projects, a downloadable contact card, and an
              opt-in text messaging service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. SMS terms</h2>
            <p>
              If you opt in to receive text messages from +1 (833) 659-7364,
              the following additional terms apply:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Messages are 1:1 and conversational; frequency varies and is kept to a minimum.</li>
              <li>Message and data rates may apply, depending on your carrier and plan.</li>
              <li>
                Reply <strong>STOP</strong> at any time to opt out; reply{" "}
                <strong>HELP</strong> for help.
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
              Consent to receive messages is not a condition of using anything
              else on this site. See the{" "}
              <Link className="text-primary hover:underline" href="/sms-consent">
                SMS Opt-In Policy
              </Link>{" "}
              for how consent is collected.
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
            <h2 className="text-xl font-semibold text-white mb-3">5. Contact</h2>
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
