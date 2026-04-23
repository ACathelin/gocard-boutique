/**
 * Thin wrapper around Cloudflare Turnstile's explicit-render API.
 * Loads the script once, exposes {token, ready, execute, reset}.
 *
 * When VITE_TURNSTILE_SITE_KEY is not set, the hook returns `ready: false`
 * and `execute()` resolves to null — the UI should still render, the
 * backend middleware handles the missing-secret case too.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
          execution?: 'render' | 'execute';
          appearance?: 'always' | 'execute' | 'interaction-only';
        }
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    // Cloudflare calls this once ready
    window.onloadTurnstileCallback = () => resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_URL}"]`);
    if (existing) {
      // Script tag is there — wait for the callback
      const check = () => {
        if (window.turnstile) resolve();
        else setTimeout(check, 50);
      };
      check();
      return;
    }

    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?onload=onloadTurnstileCallback&render=explicit`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function useTurnstile(options?: { action?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenResolverRef = useRef<((token: string | null) => void) | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: options?.action || 'boutique',
        size: 'invisible',
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (t: string) => {
          setToken(t);
          setReady(true);
          if (tokenResolverRef.current) {
            tokenResolverRef.current(t);
            tokenResolverRef.current = null;
          }
        },
        'expired-callback': () => {
          setToken(null);
        },
        'error-callback': () => {
          if (tokenResolverRef.current) {
            tokenResolverRef.current(null);
            tokenResolverRef.current = null;
          }
        },
      });
      widgetIdRef.current = id;
      setReady(true);
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* no-op */
        }
      }
    };
  }, [siteKey, options?.action]);

  const execute = useCallback((): Promise<string | null> => {
    if (!siteKey) return Promise.resolve(null);
    if (token) return Promise.resolve(token);
    if (!window.turnstile || !widgetIdRef.current) return Promise.resolve(null);

    return new Promise<string | null>((resolve) => {
      tokenResolverRef.current = resolve;
      try {
        window.turnstile!.execute(widgetIdRef.current!);
      } catch {
        resolve(null);
      }
      // Guard against the widget never firing back
      setTimeout(() => {
        if (tokenResolverRef.current === resolve) {
          tokenResolverRef.current = null;
          resolve(null);
        }
      }, 10_000);
    });
  }, [siteKey, token]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* no-op */
      }
    }
  }, []);

  return { containerRef, token, ready, execute, reset, configured: !!siteKey };
}
