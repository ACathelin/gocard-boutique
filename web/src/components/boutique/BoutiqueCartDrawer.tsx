import React, { useEffect, useState } from 'react';
import { boutiqueApi, formatBoutiquePrice } from '@/lib/boutiqueApi';
import { useTurnstile } from '@/hooks/useTurnstile';
import { useAuth } from '@/contexts/AuthContext';
import type { BoutiqueCartItem } from '@/hooks/useBoutiqueCart';
import type { BoutiqueCapabilities } from '@/lib/boutiqueApi';

type BoutiqueCartDrawerProps = {
  open: boolean;
  onClose: () => void;
  items: BoutiqueCartItem[];
  totalCents: number;
  currency: string;
  onRemove: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  capabilities?: BoutiqueCapabilities;
};

type PaymentNetworkChoice =
  | { network: 'visa'; agentProtocol: 'vic' }
  | { network: 'mastercard'; agentProtocol: 'mc_agentpay' }
  | { network: null; agentProtocol: null };

export default function BoutiqueCartDrawer({
  open,
  onClose,
  items,
  totalCents,
  currency,
  onRemove,
  onSetQuantity,
  capabilities,
}: BoutiqueCartDrawerProps) {
  const { user, token, isAuthenticated } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [networkChoice, setNetworkChoice] = useState<PaymentNetworkChoice>({ network: null, agentProtocol: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstile = useTurnstile({ action: 'boutique-checkout' });

  // Keep email in sync if the user logs in / out while the drawer is open.
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const vicEnabled = capabilities?.networks.visa_intelligent_commerce ?? true;
  const mcEnabled = capabilities?.networks.mastercard_agentpay ?? true;
  const paymentsEnabled = capabilities?.paymentsEnabled ?? true;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const turnstileToken = turnstile.configured ? await turnstile.execute() : null;
      const response = await boutiqueApi.checkout({
        amount: totalCents,
        currency,
        email: email || undefined,
        network: networkChoice.network,
        agentProtocol: networkChoice.agentProtocol,
        cart: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        turnstileToken,
        authToken: token || null,
      });
      if (response.hostedCheckoutUrl) {
        window.location.href = response.hostedCheckoutUrl;
        return;
      }
      setError('Checkout returned no redirect. Please try again.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
    } finally {
      setSubmitting(false);
      turnstile.reset();
    }
  };

  return (
    <>
      {open ? (
        <div
          onClick={onClose}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background: 'hsl(var(--boutique-text) / 0.25)',
            zIndex: 60,
          }}
        />
      ) : null}

      <aside
        aria-hidden={!open}
        aria-label="Shopping cart"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(460px, 100vw)',
          backgroundColor: 'hsl(var(--boutique-bg-raised))',
          color: 'hsl(var(--boutique-text))',
          zIndex: 70,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--boutique-medium) var(--boutique-ease)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px -20px hsl(var(--boutique-text) / 0.25)',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid hsl(var(--boutique-divider))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div className="serif" style={{ fontSize: '1.25rem' }}>Your cart</div>
          <button type="button" className="boutique-btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem' }}>
          {items.length === 0 ? (
            <p style={{ color: 'hsl(var(--boutique-text-muted))', marginTop: '2rem' }}>
              Your order is quiet. Add a privilege from the collection and it will appear here.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item) => (
                <li
                  key={item.productId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 1fr auto',
                    gap: '1rem',
                    padding: '1.25rem 0',
                    borderBottom: '1px solid hsl(var(--boutique-divider))',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '3 / 4',
                      background: 'hsl(var(--boutique-bg-subtle))',
                      overflow: 'hidden',
                    }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="serif" style={{ fontSize: '1.05rem' }}>{item.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--boutique-text-muted))', marginTop: '0.2rem' }}>
                      {formatBoutiquePrice(item.priceCents, item.currency)} · qty {item.quantity}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="boutique-btn ghost"
                        style={{ fontSize: '0.7rem', letterSpacing: '0.14em' }}
                        onClick={() => onSetQuantity(item.productId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="boutique-btn ghost"
                        style={{ fontSize: '0.7rem', letterSpacing: '0.14em' }}
                        onClick={() => onSetQuantity(item.productId, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="boutique-btn ghost"
                        style={{ fontSize: '0.7rem', letterSpacing: '0.14em', color: 'hsl(var(--boutique-accent))' }}
                        onClick={() => onRemove(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <form
            onSubmit={submit}
            style={{
              borderTop: '1px solid hsl(var(--boutique-divider))',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="eyebrow">Total</span>
              <span className="serif" style={{ fontSize: '1.5rem' }}>
                {formatBoutiquePrice(totalCents, currency)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: isAuthenticated
                  ? 'hsl(var(--boutique-accent))'
                  : 'hsl(var(--boutique-text-faint))',
              }}
            >
              {isAuthenticated
                ? `Signed in as ${user?.email || user?.username}`
                : 'Guest checkout'}
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span className="eyebrow">
                {isAuthenticated ? 'Email (from your account)' : 'Email (optional)'}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="boutique-input"
                autoComplete="email"
              />
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`boutique-badge ${networkChoice.network === null ? 'active' : ''}`}
                onClick={() => setNetworkChoice({ network: null, agentProtocol: null })}
                style={{
                  cursor: 'pointer',
                  borderColor:
                    networkChoice.network === null
                      ? 'hsl(var(--boutique-border-strong))'
                      : 'hsl(var(--boutique-border))',
                }}
              >
                Any card
              </button>
              {vicEnabled ? (
                <button
                  type="button"
                  className="boutique-badge"
                  onClick={() => setNetworkChoice({ network: 'visa', agentProtocol: 'vic' })}
                  style={{
                    cursor: 'pointer',
                    borderColor:
                      networkChoice.network === 'visa'
                        ? 'hsl(var(--boutique-border-strong))'
                        : 'hsl(var(--boutique-border))',
                  }}
                >
                  Visa · VIC
                </button>
              ) : null}
              {mcEnabled ? (
                <button
                  type="button"
                  className="boutique-badge"
                  onClick={() => setNetworkChoice({ network: 'mastercard', agentProtocol: 'mc_agentpay' })}
                  style={{
                    cursor: 'pointer',
                    borderColor:
                      networkChoice.network === 'mastercard'
                        ? 'hsl(var(--boutique-border-strong))'
                        : 'hsl(var(--boutique-border))',
                  }}
                >
                  MC · Agent Pay
                </button>
              ) : null}
            </div>

            {error ? (
              <div role="alert" style={{ color: 'hsl(var(--boutique-accent))', fontSize: '0.85rem' }}>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="boutique-btn primary"
              disabled={!paymentsEnabled || submitting || items.length === 0}
            >
              {submitting
                ? 'Opening Worldline…'
                : isAuthenticated
                  ? 'Checkout with Worldline'
                  : 'Checkout as guest'}
            </button>
            {!paymentsEnabled ? (
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--boutique-text-muted))' }}>
                Payments are currently paused.
              </div>
            ) : null}

            <div ref={turnstile.containerRef} aria-hidden />
          </form>
        ) : null}
      </aside>
    </>
  );
}
