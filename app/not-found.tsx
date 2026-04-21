import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
      <div className="text-center px-6">
        <p className="text-6xl mb-4">🚀</p>
        <h1 className="text-4xl font-bold mb-3">404 — Lost in Space</h1>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          This page doesn&apos;t exist. The Force is not strong with this URL.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
