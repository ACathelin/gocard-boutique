import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Menu } from 'lucide-react';

type BoutiqueHeaderProps = {
  cartCount: number;
  onOpenCart: () => void;
  onOpenMenu?: () => void;
};

export default function BoutiqueHeader({ cartCount, onOpenCart, onOpenMenu }: BoutiqueHeaderProps) {
  return (
    <header
      className="boutique-gutter"
      style={{
        paddingBlock: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'hsl(var(--boutique-bg) / 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Link
        to="/boutique"
        className="serif"
        style={{
          fontSize: '1.35rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'hsl(var(--boutique-text))',
          textDecoration: 'none',
        }}
      >
        GoCard
      </Link>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Open cart (${cartCount} items)`}
          className="boutique-icon-btn"
        >
          <ShoppingBag size={20} strokeWidth={1.5} aria-hidden />
          {cartCount > 0 ? (
            <span className="boutique-icon-btn__count" aria-hidden>
              {cartCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="boutique-icon-btn"
        >
          <Menu size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </header>
  );
}
