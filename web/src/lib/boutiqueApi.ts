/**
 * Typed fetch helpers for the public /api/boutique/* endpoints.
 * Sends credentials so the anonymous boutique_sid cookie persists.
 */

import { API_BASE_URL } from './api';

export type BoutiqueProduct = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  /** Always in cents internally. The API returns it as `price` in euros; we
   *  multiply on the way in (see `normalizeProduct`) so all UI helpers can
   *  use cents consistently. */
  price_cents: number;
  currency: string;
  brand_id: string;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  primary_image: string | null;
  style: string | null;
  status: string | null;
  stock_quantity: number;
  low_stock: boolean;
  /** Human-readable availability window, e.g. "11 – 14 June 2026". */
  availability?: string | null;
  /** Short booking note shown alongside the CTA, e.g. "Book 45 days ahead". */
  booking_note?: string | null;
};

/** Backend's `searchProducts` divides price_cents by 100 before responding,
 *  so the wire shape uses `price` (a euro float). Reverse that here so every
 *  downstream component can rely on `price_cents`. */
function normalizeProduct(raw: Record<string, unknown>): BoutiqueProduct {
  const priceEuros = typeof raw.price === 'number' ? raw.price : Number(raw.price);
  const priceCentsFromApi =
    typeof raw.price_cents === 'number' ? raw.price_cents : Number(raw.price_cents);
  const price_cents = Number.isFinite(priceCentsFromApi)
    ? priceCentsFromApi
    : Number.isFinite(priceEuros)
      ? Math.round(priceEuros * 100)
      : 0;
  return {
    ...(raw as unknown as BoutiqueProduct),
    price_cents,
  };
}

export type BoutiqueCapabilities = {
  chatEnabled: boolean;
  paymentsEnabled: boolean;
  turnstileRequired: boolean;
  networks: {
    visa_intelligent_commerce: boolean;
    mastercard_agentpay: boolean;
    visa_trusted_agent: boolean;
    mc_trusted_agent: boolean;
  };
};

export type BoutiqueChatTurn = {
  reply: string;
  sessionId: string;
  toolCalls: Array<{
    name: string;
    durationMs?: number | null;
    status?: 'ok' | 'error';
  }>;
  cartDelta?: unknown;
  paymentRedirectUrl?: string | null;
  /** Product IDs the concierge recommended — rendered inline as chips. */
  recommendedProductIds?: string[];
  mcpConnected: boolean;
};

export type BoutiqueCheckoutResponse = {
  success: boolean;
  hostedCheckoutId: string;
  hostedCheckoutUrl: string;
  partialRedirectUrl?: string;
  returnMac?: string;
  sessionId: string;
};

async function request<T>(
  path: string,
  init?: RequestInit & { turnstileToken?: string | null; authToken?: string | null }
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (init?.turnstileToken) {
    headers.set('cf-turnstile-response', init.turnstileToken);
  }
  if (init?.authToken) {
    // Optional Bearer: backend treats /chat and /checkout with optionalAuth,
    // so a valid token attributes the action to the user; missing/invalid is
    // gracefully treated as guest.
    headers.set('Authorization', `Bearer ${init.authToken}`);
  }
  const res = await fetch(`${API_BASE_URL}/boutique${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // fall through — json stays null
  }
  if (!res.ok) {
    const message =
      (json && typeof json === 'object' && 'error' in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).error)
        : null) || `Boutique API request failed (${res.status})`;
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    const code =
      json && typeof json === 'object' && 'code' in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).code)
        : undefined;
    if (code) err.code = code;
    throw err;
  }
  return json as T;
}

export const boutiqueApi = {
  async capabilities(): Promise<{ capabilities: BoutiqueCapabilities }> {
    return request('/capabilities');
  },

  async products(params?: { category?: string; search?: string }): Promise<{ products: BoutiqueProduct[] }> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    const query = q.toString();
    const raw = await request<{ products: Array<Record<string, unknown>> }>(
      `/products${query ? `?${query}` : ''}`
    );
    return { products: (raw.products || []).map(normalizeProduct) };
  },

  async product(id: string): Promise<{ product: BoutiqueProduct }> {
    const raw = await request<{ product: Record<string, unknown> }>(
      `/products/${encodeURIComponent(id)}`
    );
    return { product: normalizeProduct(raw.product) };
  },

  async chat(opts: {
    message: string;
    sessionId?: string;
    turnstileToken?: string | null;
    authToken?: string | null;
  }): Promise<BoutiqueChatTurn> {
    const body = JSON.stringify({
      message: opts.message,
      sessionId: opts.sessionId,
    });
    const json = await request<{ success: boolean } & BoutiqueChatTurn>('/chat', {
      method: 'POST',
      body,
      turnstileToken: opts.turnstileToken,
      authToken: opts.authToken,
    });
    return json;
  },

  async checkout(opts: {
    amount: number;
    currency?: string;
    email?: string;
    sessionId?: string;
    network?: 'visa' | 'mastercard' | 'trusted_agent' | null;
    agentProtocol?:
      | 'vic'
      | 'mc_agentpay'
      | 'visa_trusted_agent'
      | 'mc_trusted_agent'
      | null;
    cart?: Array<{ productId: string; quantity: number }>;
    turnstileToken?: string | null;
    authToken?: string | null;
  }): Promise<BoutiqueCheckoutResponse> {
    return request('/checkout', {
      method: 'POST',
      body: JSON.stringify({
        amount: opts.amount,
        currency: opts.currency || 'EUR',
        email: opts.email,
        sessionId: opts.sessionId,
        network: opts.network ?? undefined,
        agentProtocol: opts.agentProtocol ?? undefined,
        cart: opts.cart ?? [],
      }),
      turnstileToken: opts.turnstileToken,
      authToken: opts.authToken,
    });
  },

  async paymentStatus(hostedCheckoutId: string): Promise<{ status: string; payload: unknown }> {
    return request(`/payment-status/${encodeURIComponent(hostedCheckoutId)}`);
  },
};

export function formatBoutiquePrice(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(0)}`;
  }
}
