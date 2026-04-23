/**
 * Client-side boutique cart state. Lives in localStorage so a visitor can
 * switch tabs without losing their selection. When the WL MCP is wired in,
 * the MCP will own the cart and this hook becomes a thin read wrapper.
 */

import { useCallback, useEffect, useState } from 'react';
import type { BoutiqueProduct } from '@/lib/boutiqueApi';

const STORAGE_KEY = 'boutique:cart:v1';

export type BoutiqueCartItem = {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
};

type Persisted = { items: BoutiqueCartItem[] };

function isValidItem(i: unknown): i is BoutiqueCartItem {
  if (!i || typeof i !== 'object') return false;
  const item = i as BoutiqueCartItem;
  return (
    typeof item.productId === 'string' &&
    !!item.productId &&
    typeof item.priceCents === 'number' &&
    Number.isFinite(item.priceCents) &&
    item.priceCents >= 0 &&
    typeof item.quantity === 'number' &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
}

function readStorage(): Persisted {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      // Drop items with NaN prices — these can land in localStorage from
      // earlier app versions that misread the API shape (price vs price_cents).
      return { items: parsed.items.filter(isValidItem) };
    }
  } catch {
    /* corrupt localStorage — ignore */
  }
  return { items: [] };
}

function writeStorage(data: Persisted) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded etc — non-fatal */
  }
}

export function useBoutiqueCart() {
  const [items, setItems] = useState<BoutiqueCartItem[]>(() => readStorage().items);

  useEffect(() => {
    writeStorage({ items });
  }, [items]);

  const add = useCallback((product: BoutiqueProduct, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: Math.min(10, i.quantity + quantity) } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          priceCents: product.price_cents,
          currency: product.currency || 'EUR',
          imageUrl: product.primary_image,
          quantity,
        },
      ];
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, Math.min(10, quantity)) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const currency = items[0]?.currency || 'EUR';
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, add, remove, setQuantity, clear, totalCents, currency, count };
}
