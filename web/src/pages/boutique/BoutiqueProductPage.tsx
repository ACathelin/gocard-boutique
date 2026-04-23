import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import BoutiqueLayout from './BoutiqueLayout';
import BoutiqueHeader from '@/components/boutique/BoutiqueHeader';
import BoutiqueFooter from '@/components/boutique/BoutiqueFooter';
import BoutiqueChatPanel from '@/components/boutique/BoutiqueChatPanel';
import BoutiqueCartDrawer from '@/components/boutique/BoutiqueCartDrawer';
import BoutiqueBottomNav from '@/components/boutique/BoutiqueBottomNav';
import SeoHead from '@/components/boutique/SeoHead';
import { boutiqueApi, formatBoutiquePrice } from '@/lib/boutiqueApi';
import { useBoutiqueCart } from '@/hooks/useBoutiqueCart';

const FALLBACK_IMAGE = '/boutique/van-gogh-hero.jpg';

export default function BoutiqueProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const cart = useBoutiqueCart();

  // Reset the image-fallback state whenever the URL product ID changes, so
  // navigating from one product to another retries the new primary_image.
  useEffect(() => { setImgSrc(null); }, [id]);

  const productQuery = useQuery({
    queryKey: ['boutique', 'product', id],
    queryFn: () => boutiqueApi.product(id!),
    enabled: !!id,
  });

  const capsQuery = useQuery({
    queryKey: ['boutique', 'capabilities'],
    queryFn: () => boutiqueApi.capabilities(),
    staleTime: 2 * 60 * 1000,
  });

  if (productQuery.isLoading) {
    return (
      <BoutiqueLayout>
        <SeoHead title="Loading — GoCard" />
        <BoutiqueHeader cartCount={cart.count} onOpenCart={() => setCartOpen(true)} onOpenMenu={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        <div className="boutique-gutter boutique-section">
          <p style={{ color: 'hsl(var(--boutique-text-muted))' }}>Loading…</p>
        </div>
        <BoutiqueFooter />
      </BoutiqueLayout>
    );
  }

  if (productQuery.isError || !productQuery.data?.product) {
    return (
      <BoutiqueLayout>
        <SeoHead title="Not found — GoCard" />
        <BoutiqueHeader cartCount={cart.count} onOpenCart={() => setCartOpen(true)} onOpenMenu={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        <div className="boutique-gutter boutique-section" style={{ textAlign: 'center' }}>
          <span className="eyebrow">404</span>
          <h1 style={{ marginTop: '1rem' }}>This privilege is no longer available.</h1>
          <Link to="/boutique" className="boutique-btn" style={{ marginTop: '2rem' }}>
            Back to the collection
          </Link>
        </div>
        <BoutiqueFooter />
      </BoutiqueLayout>
    );
  }

  const product = productQuery.data.product;
  const effectiveImage = imgSrc ?? product.primary_image ?? FALLBACK_IMAGE;
  const siteOrigin =
    (typeof window !== 'undefined' && window.location?.origin) || '';
  const productUrl = `${siteOrigin}/boutique/p/${product.id}`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.primary_image,
    brand: { '@type': 'Brand', name: product.brand_name || 'GoCard' },
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: (product.price_cents / 100).toFixed(2),
      availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: productUrl,
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Boutique', item: `${siteOrigin}/boutique` },
      { '@type': 'ListItem', position: 2, name: product.name, item: productUrl },
    ],
  };

  return (
    <BoutiqueLayout>
      <SeoHead
        title={`${product.name} — GoCard`}
        description={product.description || 'An exclusive privilege from the GoCard collection.'}
        image={product.primary_image || undefined}
        type="product"
        url={productUrl}
        jsonLd={[productJsonLd, breadcrumbJsonLd]}
      />
      <BoutiqueHeader
        cartCount={cart.count}
        onOpenCart={() => setCartOpen(true)}
        onOpenMenu={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <main
        className="boutique-gutter boutique-section boutique-bottom-pad"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '4rem', alignItems: 'start' }}
      >
        <div
          style={{
            aspectRatio: '3 / 4',
            background: 'hsl(var(--boutique-bg-subtle))',
            overflow: 'hidden',
          }}
        >
          <img
            src={effectiveImage}
            alt={product.name}
            onError={() => {
              if (effectiveImage !== FALLBACK_IMAGE) setImgSrc(FALLBACK_IMAGE);
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div>
          <Link to="/boutique" className="eyebrow boutique-link" style={{ border: 0 }}>
            ← Collection
          </Link>
          <h1 style={{ marginTop: '0.75rem' }}>{product.name}</h1>
          <div style={{ marginTop: '1rem', fontSize: '1.1rem', color: 'hsl(var(--boutique-text-muted))' }}>
            {formatBoutiquePrice(product.price_cents, product.currency)}
          </div>

          <p
            style={{
              marginTop: '2rem',
              maxWidth: '46ch',
              color: 'hsl(var(--boutique-text-muted))',
              fontSize: '1rem',
              lineHeight: 1.8,
            }}
          >
            {product.description}
          </p>

          {product.availability || product.booking_note ? (
            <div
              style={{
                marginTop: '2rem',
                padding: '1.25rem 1.5rem',
                border: '1px solid hsl(var(--boutique-border))',
                background: 'hsl(var(--boutique-bg-raised))',
              }}
            >
              {product.availability ? (
                <div>
                  <div className="eyebrow" style={{ color: 'hsl(var(--boutique-accent))' }}>
                    Available
                  </div>
                  <div
                    className="serif"
                    style={{
                      marginTop: '0.3rem',
                      fontSize: '1.1rem',
                      color: 'hsl(var(--boutique-text))',
                    }}
                  >
                    {product.availability}
                  </div>
                </div>
              ) : null}
              {product.booking_note ? (
                <div style={{ marginTop: product.availability ? '1rem' : 0 }}>
                  <div className="eyebrow">Booking</div>
                  <div
                    style={{
                      marginTop: '0.3rem',
                      fontSize: '0.95rem',
                      color: 'hsl(var(--boutique-text-muted))',
                      lineHeight: 1.55,
                    }}
                  >
                    {product.booking_note}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              rowGap: '0.6rem',
              columnGap: '1.5rem',
              marginTop: '2rem',
              fontSize: '0.85rem',
              color: 'hsl(var(--boutique-text-muted))',
            }}
          >
            {product.style ? (<><dt className="eyebrow">Style</dt><dd>{product.style}</dd></>) : null}
            {product.sku ? (<><dt className="eyebrow">SKU</dt><dd>{product.sku}</dd></>) : null}
            <dt className="eyebrow">Stock</dt>
            <dd>{product.stock_quantity > 0 ? `${product.stock_quantity} seats remaining` : 'Fully booked'}</dd>
          </dl>

          <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="boutique-btn primary"
              onClick={() => {
                cart.add(product, 1);
                setCartOpen(true);
              }}
              disabled={product.stock_quantity <= 0}
            >
              {product.stock_quantity > 0 ? 'Book this experience' : 'Fully booked'}
            </button>
            <button
              type="button"
              className="boutique-btn"
              onClick={() => {
                cart.add(product, 1);
                navigate('/boutique#capsule');
                setCartOpen(true);
              }}
              disabled={product.stock_quantity <= 0}
            >
              Add & continue
            </button>
            <button type="button" className="boutique-btn ghost" onClick={() => setChatOpen(true)}>
              Ask the concierge
            </button>
          </div>
        </div>
      </main>
      <BoutiqueFooter />

      <BoutiqueChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        chatEnabled={capsQuery.data?.capabilities.chatEnabled ?? false}
        products={product ? [product] : []}
      />
      <BoutiqueCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        totalCents={cart.totalCents}
        currency={cart.currency}
        onRemove={cart.remove}
        onSetQuantity={cart.setQuantity}
        capabilities={capsQuery.data?.capabilities}
      />

      <BoutiqueBottomNav onOpenChat={() => setChatOpen(true)} activeTab="collection" />
    </BoutiqueLayout>
  );
}
