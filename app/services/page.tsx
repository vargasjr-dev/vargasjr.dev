import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Services — VargasJR",
  description:
    "VargasJR is an AI assistant service operated by Vargas JR, LLC. Opt in by SMS and get task confirmations, reminders, status alerts, and 1:1 replies.",
};

const FEATURES = [
  {
    emoji: "✅",
    title: "Task confirmations",
    body: "When I finish something you asked for — a merge, a deployment, a scheduled job — you get a text confirming it's done.",
  },
  {
    emoji: "📅",
    title: "Calendar & deadline reminders",
    body: "I keep an eye on your calendar and deadlines, and I text you before things slip. Nothing lands on your desk as a surprise.",
  },
  {
    emoji: "🚨",
    title: "Status alerts",
    body: "Deploys go down, jobs fail, credentials expire. If something needs attention, you hear about it from me right away.",
  },
  {
    emoji: "💬",
    title: "1:1 conversational replies",
    body: "Text me a request in plain English and I'll handle it, then reply from the same number. It's a conversation, not a notification feed.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Opt in",
    body: (
      <>
        Fill out the one-minute form at{" "}
        <Link href="/sms-consent" className="text-primary underline">
          vargasjr.dev/sms-consent
        </Link>
        . It asks for your phone number and your explicit consent — SMS is
        optional and never required to use anything else on this site.
      </>
    ),
  },
  {
    step: "2",
    title: "Text me",
    body: (
      <>
        Send a message to <strong>+1 (833) 659-7364</strong>. Tell me what you
        need done or what you want me to watch.
      </>
    ),
  },
  {
    step: "3",
    title: "I keep you posted",
    body: (
      <>
        I text you confirmations, reminders, and alerts, and reply to your
        requests. Message frequency varies. Reply <strong>STOP</strong> to opt
        out or <strong>HELP</strong> for help at any time.
      </>
    ),
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <header className="px-6 pt-8 max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-primary transition-colors"
        >
          ← Back to Home
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 pt-10 pb-12 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            The VargasJR Assistant Service
          </span>
        </h1>
        <p className="text-lg text-gray-300 leading-relaxed max-w-xl mx-auto">
          VargasJR is an AI assistant service operated by{" "}
          <strong>Vargas JR, LLC</strong>. You opt in, I run your career and
          life operations from a text thread: confirming tasks, guarding your
          calendar, watching your systems, and answering when you text.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/sms-consent"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Opt in to SMS
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-gray-700 px-6 py-3 font-medium text-gray-200 hover:border-gray-500"
          >
            Who is VargasJR?
          </Link>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">What you get</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5"
            >
              <div className="text-2xl mb-2">{f.emoji}</div>
              <h3 className="font-bold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">How it works</h2>
        <div className="space-y-4">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="flex gap-4 bg-gray-800/40 border border-gray-700/50 rounded-xl p-5"
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary">
                {s.step}
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">{s.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Company info */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-3">The company</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            The VargasJR assistant service is built and operated by{" "}
            <strong>Vargas JR, LLC</strong>. We build personal AI assistant
            software: assistants that write code, run operations, and
            communicate with their people by SMS.
          </p>
          <p className="text-sm text-gray-400">
            Questions about the service? Email{" "}
            <a
              className="text-primary hover:underline"
              href="mailto:hello@vargasjr.dev"
            >
              hello@vargasjr.dev
            </a>{" "}
            — a human reads every message. See also our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
