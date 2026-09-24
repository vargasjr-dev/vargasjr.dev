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
        alt="VargasJR, Padawan Developer"
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
    <a
      href="sms:+18336597438"
      className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-5 py-3 hover:border-gray-500 transition-all"
    >
      <span className="w-5 h-5 flex items-center justify-center text-base leading-none">
        📱
      </span>
      <span className="text-sm font-medium text-white">Text</span>
    </a>
  );
}
