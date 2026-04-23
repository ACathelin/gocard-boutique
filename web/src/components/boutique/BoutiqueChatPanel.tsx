import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoutiqueChat } from '@/hooks/useBoutiqueChat';
import { formatBoutiquePrice, type BoutiqueProduct } from '@/lib/boutiqueApi';

type BoutiqueChatPanelProps = {
  open: boolean;
  onClose: () => void;
  chatEnabled: boolean;
  /** Current catalog so recommendation chips can render name + price. */
  products?: BoutiqueProduct[];
};

export default function BoutiqueChatPanel({ open, onClose, chatEnabled, products }: BoutiqueChatPanelProps) {
  const { messages, send, sending, error, mcpConnected, turnstileContainerRef, turnstileConfigured } =
    useBoutiqueChat();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  // Look up a product by id for recommendation chips.
  const productsById = useMemo(() => {
    const map = new Map<string, BoutiqueProduct>();
    (products || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
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
        aria-label="Boutique concierge"
        className="boutique-chat"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(460px, 100vw)',
          zIndex: 70,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--boutique-medium) var(--boutique-ease)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px -20px hsl(var(--boutique-text) / 0.25)',
        }}
      >
        <div className="boutique-chat__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div>Concierge</div>
            <div
              className="eyebrow"
              style={{ marginTop: '0.4rem', color: mcpConnected ? 'hsl(var(--boutique-accent))' : 'hsl(var(--boutique-text-faint))' }}
            >
              {mcpConnected ? 'WL MCP · live' : 'Claude · live · WL MCP pending'}
            </div>
          </div>
          <button type="button" className="boutique-btn ghost" onClick={onClose} aria-label="Close concierge">
            Close
          </button>
        </div>

        <div
          ref={logRef}
          style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1rem' }}
          aria-live="polite"
        >
          {!chatEnabled ? (
            <div className="boutique-chat__msg assistant">
              <div className="boutique-chat__role">Concierge</div>
              <p>
                The concierge is offline right now. Have a look at the collection —
                she'll be back shortly.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="boutique-chat__msg assistant">
              <div className="boutique-chat__role">Concierge</div>
              <p>
                Good day — I'm your GoCard concierge. Tell me how you'd like to spend
                time this season. Try: <em>"a weekend in Italy with a race badge"</em> or
                <em> "a quiet dinner for four"</em>.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const recs =
                m.recommendedProductIds
                  ?.map((id) => productsById.get(id))
                  .filter((p): p is BoutiqueProduct => !!p) || [];
              return (
                <div key={m.id} className={`boutique-chat__msg ${m.role}`}>
                  <div className="boutique-chat__role">{m.role === 'user' ? 'You' : 'Concierge'}</div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  {recs.length > 0 ? (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {recs.map((p) => (
                        <Link
                          key={`${m.id}-rec-${p.id}`}
                          to={`/boutique/p/${p.id}`}
                          onClick={onClose}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.6rem 0.75rem',
                            border: '1px solid hsl(var(--boutique-border))',
                            background: 'hsl(var(--boutique-bg-subtle))',
                            textDecoration: 'none',
                            color: 'hsl(var(--boutique-text))',
                          }}
                        >
                          {p.primary_image ? (
                            <img
                              src={p.primary_image}
                              alt=""
                              style={{ width: 44, height: 56, objectFit: 'cover', flex: '0 0 auto' }}
                            />
                          ) : null}
                          <span style={{ flex: 1, fontSize: '0.9rem' }}>{p.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--boutique-text-muted))' }}>
                            {formatBoutiquePrice(p.price_cents, p.currency)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {m.toolCalls && m.toolCalls.length > 0 ? (
                    <div style={{ marginTop: '0.6rem' }}>
                      {m.toolCalls.map((call, idx) => (
                        <div key={`${m.id}-tc-${idx}`} className="boutique-chat__tool">
                          {call.name}
                          {typeof call.durationMs === 'number' ? ` · ${call.durationMs}ms` : ''}
                          {call.status ? ` · ${call.status}` : ''}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {sending ? (
            <div className="boutique-chat__msg assistant">
              <div className="boutique-chat__role">Concierge</div>
              <p style={{ margin: 0, color: 'hsl(var(--boutique-text-faint))' }}>Thinking…</p>
            </div>
          ) : null}
          {error ? (
            <div className="boutique-chat__msg assistant" role="alert">
              <div className="boutique-chat__role">Concierge</div>
              <p style={{ margin: 0, color: 'hsl(var(--boutique-accent))' }}>{error}</p>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={submit}
          style={{
            borderTop: '1px solid hsl(var(--boutique-divider))',
            padding: '1rem 1.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={chatEnabled ? 'Ask the concierge…' : 'Concierge is offline'}
            disabled={!chatEnabled || sending}
            rows={2}
            className="boutique-input"
            style={{ resize: 'none', fontSize: '0.95rem', minHeight: 64 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e as unknown as React.FormEvent);
              }
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'hsl(var(--boutique-text-faint))',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              {turnstileConfigured ? '🔒 Turnstile active' : 'Turnstile not configured'}
            </span>
            <button
              type="submit"
              className="boutique-btn primary"
              disabled={!chatEnabled || sending || !draft.trim()}
            >
              Send
            </button>
          </div>
          <div ref={turnstileContainerRef} aria-hidden />
        </form>
      </aside>
    </>
  );
}
