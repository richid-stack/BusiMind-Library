import React from 'react';

/**
 * BusiMindLogo
 * An iconic, elegant visual mark combining an opened book (the foundation of curated knowledge)
 * seamlessly flowing into the left and right hemispheres of a cerebral brain / intellect cortex.
 * Scalable vector graphics with high-contrast warm gold and deep obsidian accents.
 */
export const BusiMindLogo: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-8 h-8',
}) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="BusiMind Library Logo"
  >
    <defs>
      {/* Primary Gold/Amber Gradient */}
      <linearGradient id="bmGoldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f3a847" />
        <stop offset="45%" stopColor="#ffb84d" />
        <stop offset="100%" stopColor="#d58215" />
      </linearGradient>

      {/* Secondary Soft Gold for Interior Pages */}
      <linearGradient id="bmPageGrad" x1="12" y1="20" x2="36" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffd88a" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#f3a847" stopOpacity="0.4" />
      </linearGradient>

      {/* Dark Accent for Background or Highlights */}
      <linearGradient id="bmSpineGrad" x1="24" y1="8" x2="24" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#ffd88a" />
      </linearGradient>
    </defs>

    {/* Subtle Glow Backdrop Disk */}
    <circle cx="24" cy="24" r="22" fill="#131921" fillOpacity="0.15" />

    {/* ============================================================== */}
    {/* 1. THE OPEN BOOK (FOUNDATION AT THE BASE)                     */}
    {/* Left and right curved page wings fanning out to form the base  */}
    {/* ============================================================== */}

    {/* Left Page Wing (Outer Cover & Spreads) */}
    <path
      d="M24 38.5 C19 36.5 13 36 6 38.5 C6 31 6.5 25 7 24 C13 22 18.5 22.5 24 25.5 Z"
      fill="url(#bmGoldGrad)"
      fillOpacity="0.25"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />

    {/* Right Page Wing (Outer Cover & Spreads) */}
    <path
      d="M24 38.5 C29 36.5 35 36 42 38.5 C42 31 41.5 25 41 24 C35 22 29.5 22.5 24 25.5 Z"
      fill="url(#bmGoldGrad)"
      fillOpacity="0.25"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />

    {/* Inner Leaf Accent Lines (Pages Turning) */}
    <path
      d="M24 35.5 C19.5 34 14.5 33.5 9 35.2"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M24 35.5 C28.5 34 33.5 33.5 39 35.2"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Central Book Spine Notch & Bookmark Ribbon */}
    <path
      d="M24 25.5 V41"
      stroke="url(#bmSpineGrad)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polygon
      points="24,41 22,43 24,42 26,43"
      fill="url(#bmGoldGrad)"
    />

    {/* ============================================================== */}
    {/* 2. THE BRAIN (CEREBRAL CORTEX RISING FROM THE PAGES)           */}
    {/* Left & Right Hemispheres with Symmetrical Neural Gyri & Sulci  */}
    {/* ============================================================== */}

    {/* Left Brain Hemisphere Silhouette */}
    <path
      d="M24 23.5
         C19.5 23 15 22 12.5 19
         C9.5 15.5 10 11 13 8
         C15.5 5.5 19.5 5 23 7.5
         C23.7 8 24 8.5 24 9.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />

    {/* Left Hemisphere Inner Cortex Lobes (Neural Convolutions) */}
    <path
      d="M13.5 13 C16.5 11 19.5 13.5 22.5 11.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 17.5 C15.5 16 18 18 21 16.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M17 7.5 C18.5 9 18.5 11 20 12"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />

    {/* Right Brain Hemisphere Silhouette */}
    <path
      d="M24 23.5
         C28.5 23 33 22 35.5 19
         C38.5 15.5 38 11 35 8
         C32.5 5.5 28.5 5 25 7.5
         C24.3 8 24 8.5 24 9.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />

    {/* Right Hemisphere Inner Cortex Lobes (Neural Convolutions) */}
    <path
      d="M34.5 13 C31.5 11 28.5 13.5 25.5 11.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M35.5 17.5 C32.5 16 30 18 27 16.5"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M31 7.5 C29.5 9 29.5 11 28 12"
      stroke="url(#bmGoldGrad)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />

    {/* ============================================================== */}
    {/* 3. INTELLECT SYNAPSE / ESSENCE OF "BUSIMIND"                   */}
    {/* Glowing crown nodes where the thoughts connect to knowledge     */}
    {/* ============================================================== */}
    <circle cx="24" cy="6.5" r="1.75" fill="url(#bmGoldGrad)" />
    <circle cx="17.5" cy="11.5" r="1.2" fill="#ffd88a" />
    <circle cx="30.5" cy="11.5" r="1.2" fill="#ffd88a" />
  </svg>
);
