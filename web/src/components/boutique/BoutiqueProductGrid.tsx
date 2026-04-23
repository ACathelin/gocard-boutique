import React from 'react';
import BoutiqueProductCard from './BoutiqueProductCard';
import type { BoutiqueProduct } from '@/lib/boutiqueApi';

type BoutiqueProductGridProps = {
  products: BoutiqueProduct[];
  loading?: boolean;
  error?: string | null;
};

export default function BoutiqueProductGrid({ products, loading, error }: BoutiqueProductGridProps) {
  if (error) {
    return (
      <div style={{ padding: '3rem 0', color: 'hsl(var(--boutique-text-muted))' }}>
        We could not load the collection. Please try again shortly.
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'clamp(1rem, 2vw, 2rem)',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="boutique-card">
            <div
              className="boutique-card__image"
              style={{ background: 'hsl(var(--boutique-bg-subtle))', animation: 'boutique-reveal 1200ms both' }}
            />
            <div style={{ height: 24, background: 'hsl(var(--boutique-bg-subtle))', width: '65%' }} />
            <div style={{ height: 14, background: 'hsl(var(--boutique-bg-subtle))', width: '30%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 'clamp(1.5rem, 2.5vw, 2.5rem)',
      }}
    >
      {products.map((product) => (
        <BoutiqueProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
