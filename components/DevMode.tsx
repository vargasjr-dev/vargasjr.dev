"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

function useDevMode() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const sync = () =>
      setUnlocked(localStorage.getItem("vargasjr-dev-mode") === "1");
    sync();
    window.addEventListener("vargasjr-dev-mode", sync);
    return () => window.removeEventListener("vargasjr-dev-mode", sync);
  }, []);

  return unlocked;
}

export default function DevAvatar() {
  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlocked = useDevMode();

  const onTap = () => {
    if (unlocked) return;
    tapsRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tapsRef.current >= 7) {
      localStorage.setItem("vargasjr-dev-mode", "1");
      window.dispatchEvent(new Event("vargasjr-dev-mode"));
      tapsRef.current = 0;
      return;
    }
    timerRef.current = setTimeout(() => (tapsRef.current = 0), 1500);
  };

  return (
    <div onClick={onTap} className="cursor-default select-none inline-block">
      <Image
        src="/avatar.webp"
        alt="VargasJR — Padawan Developer"
        width={160}
        height={160}
        className="rounded-full mx-auto ring-4 ring-primary/30 shadow-lg shadow-primary/20"
        priority
      />
    </div>
  );
}

export function DevPhonePill() {
  const unlocked = useDevMode();
  if (!unlocked) return null;
  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-5 py-3">
      <span className="text-lg">📱</span>
      <a
        href="sms:+18336597438"
        className="text-sm font-medium text-white hover:text-primary transition-colors"
      >
        Text
      </a>
      <span className="text-xs text-gray-500">·</span>
      <a
        href="/api/vcard"
        className="text-xs text-gray-500 hover:text-primary transition-colors"
      >
        Save
      </a>
    </div>
  );
}
