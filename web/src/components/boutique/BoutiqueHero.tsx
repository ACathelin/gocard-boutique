import React, { useState } from 'react';
import { Link } from 'react-router-dom';

type BoutiqueHeroProps = {
  onOpenChat: () => void;
};

// Rembrandt, "Aristotle with a Bust of Homer" (1653) — self-hosted from
// /public/boutique/. Public domain, sourced from the Metropolitan Museum
// of Art's Open Access collection (accession 61.198). Dutch masters in
// lamplight — right atmosphere for the private-night-in-the-museum hero.
const HERO_IMAGE = '/boutique/rijksmuseum-overnight.jpg';

// UUID of the Rijksmuseum Overnight flagship seeded by migration 0138.
const RIJKSMUSEUM_OVERNIGHT_ID = 'a0000000-0000-4000-8000-0000000000be';

// Near-white ink used on top of the painting. Can't use the theme's
// `--boutique-text-inverse` here — that's deliberately dark for "light blocks",
// which doesn't apply when the underlay is a dark chiaroscuro oil.
const INK = 'hsl(40 25% 97%)';
const INK_MUTED = 'hsl(40 20% 92% / 0.9)';

export default function BoutiqueHero({ onOpenChat }: BoutiqueHeroProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: 'min(92vh, 1100px)',
        minHeight: 640,
        overflow: 'hidden',
        backgroundColor: 'hsl(var(--boutique-bg))',
      }}
    >
      <img
        src={HERO_IMAGE}
        alt=""
        loading="eager"
        onLoad={() => setImgLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 30%',
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Soft gradient anchored at the bottom where the copy lives. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(8,10,22,0.25) 0%, rgba(8,10,22,0.10) 30%, rgba(8,10,22,0.70) 75%, rgba(8,10,22,0.94) 100%)',
        }}
      />

      <div
        className="boutique-gutter"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 'clamp(2rem, 6vw, 5rem)',
          color: INK,
        }}
      >
        <span className="eyebrow reveal-up" style={{ color: INK_MUTED }}>
          The Flagship · Spring 2026 · Amsterdam
        </span>
        <h1
          className="reveal-up delay-1"
          style={{
            marginTop: '1rem',
            color: INK,
            maxWidth: '20ch',
            fontSize: 'clamp(2.5rem, 7vw, 6rem)',
            lineHeight: 1,
            textShadow: '0 2px 24px rgba(8,10,22,0.55)',
          }}
        >
          A night alone<br />
          in the Rijksmuseum.
        </h1>
        <p
          className="reveal-up delay-2"
          style={{
            marginTop: '1.5rem',
            maxWidth: '52ch',
            color: INK_MUTED,
            fontSize: '1.05rem',
            lineHeight: 1.6,
            textShadow: '0 1px 12px rgba(8,10,22,0.6)',
          }}
        >
          After the last visitor leaves, the galleries are yours — a curator-led
          walk through the Dutch masters, a private dinner laid between the
          paintings, and a suite installed for the night under the Great Hall.
          One evening per month, April through October. Two guests.
        </p>
        <div
          className="reveal-up delay-3"
          style={{
            marginTop: '2rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Link
            to={`/boutique/p/${RIJKSMUSEUM_OVERNIGHT_ID}`}
            className="boutique-btn"
            style={{
              backgroundColor: 'hsl(var(--boutique-accent))',
              color: 'hsl(var(--boutique-accent-ink))',
              borderColor: 'hsl(var(--boutique-accent))',
            }}
          >
            Reserve the night · €15,000
          </Link>
          <a
            href="#capsule"
            className="boutique-btn"
            style={{
              backgroundColor: 'transparent',
              color: INK,
              borderColor: INK,
            }}
          >
            Browse the collection
          </a>
          <button
            type="button"
            className="boutique-btn ghost"
            onClick={onOpenChat}
            style={{ color: INK }}
          >
            Ask the concierge →
          </button>
        </div>
      </div>
    </section>
  );
}
