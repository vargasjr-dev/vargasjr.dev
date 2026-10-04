import Link from "next/link";
import { OptInForm } from "./opt-in-form";

export const metadata = {
  title: "SMS Opt-In — VargasJR",
  description:
    "Opt in to receive text messages from VargasJR, the AI assistant service operated by Vargas JR, LLC.",
};

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">SMS Opt-In</h1>
        <p className="text-gray-500 mb-10">
          Effective October 1, 2026 · vargasjr.dev
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Get text messages from VargasJR
            </h2>
            <p>
              VargasJR is an AI assistant service operated by Vargas JR, LLC.
              Enter your phone number below to receive task confirmations,
              calendar and deadline reminders, status alerts, and one-to-one
              conversational replies from <strong>+1 (833) 659-7364</strong>.
            </p>
            <p className="mt-2">
              Opting in is <strong>optional</strong> — SMS is a separate,
              standalone service and is never required to use anything else on
              this site.
            </p>
            <div className="mt-6">
              <OptInForm />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              What we send
            </h2>
            <p>
              Application-generated messages: task confirmations, calendar and
              deadline reminders, status alerts, and one-to-one conversational
              replies to requests you&apos;ve made. Message frequency varies.
              Message and data rates may apply, based on your mobile carrier
              and plan.
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
              How consent is recorded
            </h2>
            <p>
              When you submit the form above, we record your phone number, the
              exact consent language you agreed to, and the time of your
              consent. We never purchase, rent, or scrape phone number lists,
              and we never send marketing or bulk messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your number, protected
            </h2>
            <p>
              Phone numbers are used solely to deliver the messages you asked
              for. We do not sell or share them with third parties for their
              own marketing. See our{" "}
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
