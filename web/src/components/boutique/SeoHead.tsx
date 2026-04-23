/**
 * SEO head tags for boutique pages. Uses React 19's native <title>/<meta>
 * hoisting so we don't pull in react-helmet. Also injects JSON-LD structured
 * data for Store / Product / BreadcrumbList as needed.
 */

import React from 'react';

type SeoHeadProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_TITLE = 'GoCard — Privileges, access, discretion | Worldline';
const DEFAULT_DESCRIPTION =
  'GoCard is a private lifestyle membership. Access to exclusive experiences, private dining, and travel, arranged by a personal concierge. Membership and reservations paid through Worldline GoPay Direct (Visa Intelligent Commerce, Mastercard Agent Pay).';

// Resolve the site origin at runtime — avoids baking a deployment-specific
// domain into the build. Override at build time with VITE_SITE_URL if desired.
const SITE_URL: string =
  (typeof window !== 'undefined' && window.location?.origin) ||
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  '';

const DEFAULT_IMAGE = `${SITE_URL}/boutique/van-gogh-hero.jpg`;

export default function SeoHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url = `${SITE_URL}/boutique`,
  type = 'website',
  jsonLd,
}: SeoHeadProps) {
  const ldBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldBlocks.map((block, idx) => (
        <script
          key={`jsonld-${idx}`}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
