import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Users, MessageCircle } from 'lucide-react';

type BoutiqueBottomNavProps = {
  onOpenChat: () => void;
  /** Which tab is currently "active" — defaults to 'collection' on the main page. */
  activeTab?: 'collection' | 'concierge' | 'membership';
};

type TabId = 'collection' | 'concierge' | 'membership';

/**
 * Floating pill nav anchored to the bottom of the viewport, with a separate
 * circular "ASK" button on the right that opens the concierge chat.
 *
 * - Collection  → scrolls to #capsule on /boutique
 * - Concierge   → scrolls to #concierge on /boutique (or opens chat on sub-pages)
 * - Membership  → scrolls to #about on /boutique
 * - ASK         → opens the chat drawer
 */
export default function BoutiqueBottomNav({ onOpenChat, activeTab = 'collection' }: BoutiqueBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const onBoutiqueHome = location.pathname === '/boutique';

  const go = (anchor: string) => () => {
    if (onBoutiqueHome) {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate(`/boutique#${anchor}`);
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; onClick: () => void }> = [
    { id: 'collection',  label: 'Collection',  icon: <Home size={18} strokeWidth={1.5} />,  onClick: go('capsule') },
    { id: 'concierge',   label: 'Concierge',   icon: <User size={18} strokeWidth={1.5} />,  onClick: go('concierge') },
    { id: 'membership',  label: 'Membership',  icon: <Users size={18} strokeWidth={1.5} />, onClick: go('about') },
  ];

  return (
    <div className="boutique-bottom-nav" role="navigation" aria-label="Boutique sections">
      <div className="boutique-bottom-nav__pill">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={t.onClick}
            className={`boutique-bottom-nav__tab ${activeTab === t.id ? 'is-active' : ''}`}
            aria-current={activeTab === t.id ? 'page' : undefined}
          >
            <span className="boutique-bottom-nav__icon" aria-hidden>
              {t.icon}
            </span>
            <span className="boutique-bottom-nav__label">{t.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenChat}
        className="boutique-bottom-nav__ask"
        aria-label="Ask the concierge"
      >
        <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
        <span>Ask</span>
      </button>
    </div>
  );
}
