import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import BoutiqueLayout from './BoutiqueLayout';
import BoutiqueHeader from '@/components/boutique/BoutiqueHeader';
import BoutiqueFooter from '@/components/boutique/BoutiqueFooter';
import BoutiqueHero from '@/components/boutique/BoutiqueHero';
import BoutiqueProductGrid from '@/components/boutique/BoutiqueProductGrid';
import BoutiqueChatPanel from '@/components/boutique/BoutiqueChatPanel';
import BoutiqueCartDrawer from '@/components/boutique/BoutiqueCartDrawer';
import BoutiqueBottomNav from '@/components/boutique/BoutiqueBottomNav';
import SeoHead from '@/components/boutique/SeoHead';
import { usePublicFeatureFlag } from '@/hooks/usePublicFeatureFlag';
import { useBoutiqueCart } from '@/hooks/useBoutiqueCart';
import { boutiqueApi, type BoutiqueCapabilities, type BoutiqueProduct } from '@/lib/boutiqueApi';

export default function Boutique() {
  const [chatOpen, setChatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useBoutiqueCart();

  const boutiquePublic = usePublicFeatureFlag('boutique_public_enabled', { defaultValue: true });

  const productsQuery = useQuery({
    queryKey: ['boutique', 'products'],
    queryFn: () => boutiqueApi.products(),
    staleTime: 2 * 60 * 1000,
    enabled: boutiquePublic.enabled,
  });

  const capsQuery = useQuery({
    queryKey: ['boutique', 'capabilities'],
    queryFn: () => boutiqueApi.capabilities(),
    staleTime: 2 * 60 * 1000,
    enabled: boutiquePublic.enabled,
  });

  const products: BoutiqueProduct[] = productsQuery.data?.products || [];
  const capabilities: BoutiqueCapabilities | undefined = capsQuery.data?.capabilities;

  if (!boutiquePublic.loading && !boutiquePublic.enabled) {
    return (
      <BoutiqueLayout>
        <SeoHead />
        <div className="boutique-gutter boutique-section" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Boutique</span>
          <h1 style={{ marginTop: '1rem' }}>The boutique is temporarily closed.</h1>
          <p style={{ color: 'hsl(var(--boutique-text-muted))', marginTop: '1rem' }}>
            Please check back soon.
          </p>
        </div>
      </BoutiqueLayout>
    );
  }

  const siteOrigin =
    (typeof window !== 'undefined' && window.location?.origin) || '';
  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'GoCard',
    description:
      'GoCard is a private lifestyle membership. Access to exclusive experiences, private dining, and travel, with a personal concierge on call. Payments routed through Worldline GoPay Direct (Visa Intelligent Commerce, Mastercard Agent Pay).',
    url: `${siteOrigin}/boutique`,
    image: `${siteOrigin}/boutique/van-gogh-hero.jpg`,
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Credit Card, Visa Intelligent Commerce, Mastercard Agent Pay',
    priceRange: '€€€',
  };

  return (
    <BoutiqueLayout>
      <SeoHead jsonLd={storeJsonLd} />
      <BoutiqueHeader
        cartCount={cart.count}
        onOpenCart={() => setCartOpen(true)}
        onOpenMenu={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
      <main className="boutique-bottom-pad">
        <BoutiqueHero onOpenChat={() => setChatOpen(true)} />

        <section id="capsule" className="boutique-gutter boutique-section">
          <header style={{ marginBottom: 'clamp(2rem, 4vw, 4rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow">This season</span>
              <h2 style={{ marginTop: '0.5rem' }}>Twelve privileges.</h2>
            </div>
            <p style={{ maxWidth: '34ch', color: 'hsl(var(--boutique-text-muted))', fontSize: '0.95rem' }}>
              An annual membership, a handful of races, two dinners, two journeys, one evening.
              Seats are finite; the concierge keeps the diary.
            </p>
          </header>

          {/* Group products by category so the hero's right-rail nav has
              somewhere to land (#cat-membership, #cat-experiences, …). */}
          {(() => {
            const groups: Array<{ key: string; label: string; cats: string[] }> = [
              { key: 'membership',  label: 'Membership',  cats: ['Membership'] },
              { key: 'experiences', label: 'Experiences', cats: ['Experiences'] },
              { key: 'dining',      label: 'Dining',      cats: ['Dining'] },
              { key: 'travel',      label: 'Travel',      cats: ['Travel'] },
              { key: 'events',      label: 'Events',      cats: ['Events'] },
            ];
            const matched = new Set<string>();
            const sections = groups.map((g) => {
              const items = products.filter((p) =>
                g.cats.includes(String(p.category_name || ''))
              );
              items.forEach((p) => matched.add(p.id));
              return { ...g, items };
            });
            const orphans = products.filter((p) => !matched.has(p.id));

            if (productsQuery.isLoading || productsQuery.isError || products.length === 0) {
              return (
                <BoutiqueProductGrid
                  products={products}
                  loading={productsQuery.isLoading}
                  error={productsQuery.isError ? 'Unable to load products.' : null}
                />
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3rem, 6vw, 5rem)' }}>
                {sections
                  .filter((s) => s.items.length > 0)
                  .map((s) => (
                    <div id={`cat-${s.key}`} key={s.key} style={{ scrollMarginTop: '2rem' }}>
                      <header className="boutique-section-head">
                        <h3 className="boutique-section-head__title">{s.label}</h3>
                        <span className="eyebrow">
                          {s.items.length} {s.items.length === 1 ? 'privilege' : 'privileges'}
                        </span>
                      </header>
                      <BoutiqueProductGrid products={s.items} />
                    </div>
                  ))}

                {orphans.length > 0 ? (
                  <div>
                    <header className="boutique-section-head">
                      <h3 className="boutique-section-head__title">Other</h3>
                      <span className="eyebrow">
                        {orphans.length} {orphans.length === 1 ? 'privilege' : 'privileges'}
                      </span>
                    </header>
                    <BoutiqueProductGrid products={orphans} />
                  </div>
                ) : null}
              </div>
            );
          })()}
        </section>

        <section id="concierge" className="boutique-gutter boutique-section" style={{ borderTop: '1px solid hsl(var(--boutique-border))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem' }}>
            <div>
              <span className="eyebrow">Concierge</span>
              <h2 style={{ marginTop: '0.5rem' }}>A lifestyle manager, one message away.</h2>
              <p style={{ color: 'hsl(var(--boutique-text-muted))', marginTop: '1.5rem', maxWidth: '44ch', fontSize: '1rem', lineHeight: 1.7 }}>
                Say what you're after — a weekend in Italy, a dinner for four, two paddock seats
                for Monaco. She'll suggest something from the collection, talk about the people
                you'll meet, and add the seat to your order.
              </p>
              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {capabilities?.networks.visa_intelligent_commerce ? (
                  <span className="boutique-badge">Visa · Intelligent Commerce</span>
                ) : null}
                {capabilities?.networks.mastercard_agentpay ? (
                  <span className="boutique-badge">Mastercard · Agent Pay</span>
                ) : null}
                {capabilities?.networks.visa_trusted_agent ? (
                  <span className="boutique-badge">Visa · Trusted Agent</span>
                ) : null}
                {capabilities?.networks.mc_trusted_agent ? (
                  <span className="boutique-badge">Mastercard · Trusted Agent</span>
                ) : null}
              </div>
              <button
                type="button"
                className="boutique-btn primary"
                onClick={() => setChatOpen(true)}
                style={{ marginTop: '2rem' }}
              >
                Open concierge
              </button>
            </div>
            <aside style={{ borderLeft: '1px solid hsl(var(--boutique-border))', paddingLeft: '3rem' }}>
              <span className="eyebrow">Transport</span>
              <p style={{ marginTop: '1rem', color: 'hsl(var(--boutique-text-muted))', fontSize: '0.95rem', lineHeight: 1.7 }}>
                The concierge connects to a Worldline GoPay Direct MCP — a small, stable protocol
                AI concierges can speak. Collection browsing, reservation holds, and payment
                authorisation all pass through a single tool surface, ready for the Visa and
                Mastercard Trusted Agent standards as they roll out.
              </p>
              <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid hsl(var(--boutique-border))' }}>
                <div className="boutique-chat__tool">wl-gopay-direct · search_products</div>
                <div className="boutique-chat__tool">wl-gopay-direct · add_to_cart</div>
                <div className="boutique-chat__tool">wl-gopay-direct · initiate_payment</div>
                <div className="boutique-chat__tool">wl-gopay-direct · authorize_vic</div>
                <div className="boutique-chat__tool">wl-gopay-direct · authorize_agentpay</div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <BoutiqueFooter />

      <BoutiqueChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        chatEnabled={capabilities?.chatEnabled ?? false}
        products={products}
      />
      <BoutiqueCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        totalCents={cart.totalCents}
        currency={cart.currency}
        onRemove={cart.remove}
        onSetQuantity={cart.setQuantity}
        capabilities={capabilities}
      />

      <BoutiqueBottomNav onOpenChat={() => setChatOpen(true)} activeTab="collection" />
    </BoutiqueLayout>
  );
}
