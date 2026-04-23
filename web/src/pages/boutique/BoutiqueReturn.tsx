import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import BoutiqueLayout from './BoutiqueLayout';
import BoutiqueHeader from '@/components/boutique/BoutiqueHeader';
import BoutiqueFooter from '@/components/boutique/BoutiqueFooter';
import BoutiqueBottomNav from '@/components/boutique/BoutiqueBottomNav';
import SeoHead from '@/components/boutique/SeoHead';
import { boutiqueApi } from '@/lib/boutiqueApi';
import { useBoutiqueCart } from '@/hooks/useBoutiqueCart';

type Status = 'checking' | 'success' | 'pending' | 'failed' | 'unknown';

const SUCCESSFUL_STATUSES = new Set(['CAPTURED', 'CAPTURE_REQUESTED', 'PAID', 'AUTHORIZED', 'PENDING_APPROVAL']);
const FAILED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'REJECTED_CAPTURE']);

export default function BoutiqueReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cart = useBoutiqueCart();
  const [status, setStatus] = useState<Status>('checking');
  const [detail, setDetail] = useState<string | null>(null);

  const hostedCheckoutId = params.get('hostedCheckoutId') || params.get('REF');

  useEffect(() => {
    if (!hostedCheckoutId) {
      setStatus('unknown');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { status: rawStatus } = await boutiqueApi.paymentStatus(hostedCheckoutId);
        if (cancelled) return;
        const normalized = (rawStatus || '').toUpperCase();
        setDetail(normalized || null);
        if (SUCCESSFUL_STATUSES.has(normalized)) {
          setStatus('success');
          cart.clear();
        } else if (FAILED_STATUSES.has(normalized)) {
          setStatus('failed');
        } else if (normalized) {
          setStatus('pending');
        } else {
          setStatus('unknown');
        }
      } catch {
        if (!cancelled) setStatus('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostedCheckoutId]);

  let title = 'Payment return — GoCard';
  let heading = 'Checking payment…';
  let body = 'One moment while we confirm with Worldline.';
  if (status === 'success') {
    title = 'Thank you — GoCard';
    heading = 'Welcome to GoCard.';
    body = 'Your reservation is confirmed. The concierge will be in touch by email with next steps.';
  } else if (status === 'failed') {
    heading = 'Payment not completed.';
    body = 'The card was declined or the checkout was cancelled. You can try again from your order.';
  } else if (status === 'pending') {
    heading = 'Payment pending.';
    body = 'Worldline is finalising the transaction. You will receive confirmation shortly.';
  } else if (status === 'unknown') {
    heading = "We couldn't verify the payment.";
    body = 'If you were charged, the concierge will reconcile automatically. Please refresh in a moment or reach out.';
  }

  return (
    <BoutiqueLayout>
      <SeoHead title={title} />
      <BoutiqueHeader
        cartCount={cart.count}
        onOpenCart={() => navigate('/boutique')}
        onOpenMenu={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
      <main
        className="boutique-gutter boutique-section boutique-bottom-pad"
        style={{ maxWidth: 640, marginInline: 'auto', textAlign: 'center' }}
      >
        <span className="eyebrow">
          {status === 'success' ? 'Confirmed' : status === 'failed' ? 'Declined' : status === 'pending' ? 'Pending' : 'Return'}
        </span>
        <h1 style={{ marginTop: '1rem' }}>{heading}</h1>
        <p style={{ marginTop: '1.5rem', color: 'hsl(var(--boutique-text-muted))', fontSize: '1rem', lineHeight: 1.7 }}>
          {body}
        </p>
        {detail ? (
          <div className="boutique-chat__tool" style={{ marginTop: '1.5rem' }}>
            worldline · status · {detail.toLowerCase()}
          </div>
        ) : null}
        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/boutique" className="boutique-btn primary">Back to the collection</Link>
          <Link to="/boutique#concierge" className="boutique-btn">Speak to the concierge</Link>
        </div>
      </main>
      <BoutiqueFooter />

      <BoutiqueBottomNav onOpenChat={() => navigate('/boutique#concierge')} activeTab="collection" />
    </BoutiqueLayout>
  );
}
