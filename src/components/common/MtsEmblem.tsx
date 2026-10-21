import { useState } from 'react';

interface MtsEmblemProps {
  className?: string;
  size?: number;
}

export default function MtsEmblem({ className = "w-9 h-9 sm:w-10 sm:h-10", size = 40 }: MtsEmblemProps) {
  const [imageError, setImageError] = useState(false);

  if (!imageError) {
    return (
      <img
        src="/images/mts-lab-logo.png"
        alt="MTS LAB Official Logo"
        width={size}
        height={size}
        onError={() => setImageError(true)}
        className={`${className} object-contain select-none shrink-0 drop-shadow-md`}
        loading="eager"
      />
    );
  }

  // High-fidelity vector SVG fallback: Mechanical gear, dark-blue smartphone, repair wrench, and orbiting ring
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 select-none drop-shadow-md`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mts-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0066cc" />
          <stop offset="100%" stopColor="#002266" />
        </linearGradient>
        <linearGradient id="mts-wrench-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="mts-orbit-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0044aa" />
        </linearGradient>
      </defs>

      {/* 1. Mechanical Gear (top-left) */}
      <g fill="#64748b" opacity="0.9">
        <path d="M 38 12 L 44 14 L 43 20 A 28 28 0 0 1 50 24 L 56 21 L 60 27 L 55 31 A 28 28 0 0 1 57 39 L 63 42 L 61 48 L 55 49 A 28 28 0 0 1 51 56 L 54 62 L 48 66 L 43 61 A 28 28 0 0 1 35 63 L 32 69 L 26 67 L 27 61 A 28 28 0 0 1 20 57 L 14 60 L 10 54 L 15 50 A 28 28 0 0 1 13 42 L 7 39 L 9 33 L 15 32 A 28 28 0 0 1 19 25 L 16 19 L 22 15 L 27 20 A 28 28 0 0 1 35 18 Z" />
        <circle cx="35" cy="40" r="12" fill="#0f172a" />
      </g>

      {/* 2. Dark-Blue Smartphone Outline & Body */}
      <rect
        x="32"
        y="18"
        width="44"
        height="70"
        rx="10"
        fill="url(#mts-blue-grad)"
        stroke="#38bdf8"
        strokeWidth="1.5"
      />
      {/* Screen reflection/bevel */}
      <rect
        x="36"
        y="23"
        width="36"
        height="56"
        rx="6"
        fill="#ffffff"
        opacity="0.9"
      />
      {/* Screen Inner Shadow/Glare */}
      <path
        d="M 36 23 L 72 23 L 52 79 L 36 79 Z"
        fill="#0f172a"
        opacity="0.8"
      />
      {/* Speaker grill */}
      <rect x="47" y="20" width="14" height="2" rx="1" fill="#94a3b8" />
      {/* Home button circle */}
      <circle cx="54" cy="83" r="3" fill="#ffffff" />

      {/* 3. Repair Wrench */}
      <g transform="translate(42, 28) rotate(-15)">
        <path
          d="M 12 0 C 7 0 2 3 0 8 C 3 9 6 11 6 15 C 6 19 3 21 0 22 C 3 27 8 30 13 30 L 16 42 C 17 45 20 46 22 44 L 25 41 C 27 39 26 36 24 35 L 21 24 C 24 21 26 17 25 12 C 22 11 20 9 20 5 C 20 1 22 0 25 0 C 21 -1 16 -1 12 0 Z"
          fill="url(#mts-wrench-grad)"
          stroke="#e0f2fe"
          strokeWidth="0.8"
        />
      </g>

      {/* 4. Subtle Orbiting Ring */}
      <path
        d="M 14 55 C 14 74 88 88 90 70 C 92 56 30 48 14 55 Z"
        fill="url(#mts-orbit-grad)"
        opacity="0.95"
      />
      <path
        d="M 18 56 C 24 72 82 82 86 70"
        stroke="#ffffff"
        strokeWidth="1.2"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}
