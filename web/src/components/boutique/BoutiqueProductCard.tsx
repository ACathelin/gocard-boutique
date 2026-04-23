import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBoutiquePrice, type BoutiqueProduct } from '@/lib/boutiqueApi';

type BoutiqueProductCardProps = {
  product: BoutiqueProduct;
};

// Reliable self-hosted fallback. If a product's primary image is missing or
// the URL 404s at render time, we swap to our Van Gogh hero image so visitors
// never see a broken image glyph — and the placeholder stays on-brand for the
// GoCard pearl palette.
const FALLBACK_IMAGE = '/boutique/van-gogh-hero.jpg';

export default function BoutiqueProductCard({ product }: BoutiqueProductCardProps) {
  const [src, setSrc] = useState<string>(product.primary_image || FALLBACK_IMAGE);

  return (
    <Link to={`/boutique/p/${product.id}`} className="boutique-card" aria-label={product.name}>
      <div className="boutique-card__image">
        <img
          src={src}
          alt={product.name}
          loading="lazy"
          onError={() => {
            if (src !== FALLBACK_IMAGE) setSrc(FALLBACK_IMAGE);
          }}
        />
      </div>
      <div>
        <div className="boutique-card__name">{product.name}</div>
        <div className="boutique-card__price">
          {formatBoutiquePrice(product.price_cents, product.currency)}
        </div>
        {product.availability ? (
          <div className="boutique-card__meta">{product.availability}</div>
        ) : null}
      </div>
    </Link>
  );
}
