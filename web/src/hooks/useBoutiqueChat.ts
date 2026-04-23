/**
 * Boutique shopping-assistant chat hook.
 * Sends messages to POST /api/boutique/chat via boutiqueApi, wires Turnstile,
 * keeps conversation state + tool-call summaries in memory.
 */

import { useCallback, useState, useRef } from 'react';
import { boutiqueApi, type BoutiqueChatTurn } from '@/lib/boutiqueApi';
import { useTurnstile } from './useTurnstile';
import { useAuth } from '@/contexts/AuthContext';

export type BoutiqueChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: BoutiqueChatTurn['toolCalls'];
  recommendedProductIds?: string[];
  createdAt: number;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useBoutiqueChat() {
  const [messages, setMessages] = useState<BoutiqueChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpConnected, setMcpConnected] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const turnstile = useTurnstile({ action: 'boutique-chat' });
  // Optional: send Bearer token when logged in so the backend attributes
  // the conversation to the user (and skips Turnstile if it wants to).
  const { token, user } = useAuth();

  const send = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || sending) return;
      setError(null);
      setSending(true);

      const userMessage: BoutiqueChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const turnstileToken = turnstile.configured ? await turnstile.execute() : null;
        const turn = await boutiqueApi.chat({
          message: trimmed,
          sessionId: sessionIdRef.current || undefined,
          turnstileToken,
          authToken: token || null,
        });
        if (turn.sessionId) sessionIdRef.current = turn.sessionId;
        setMcpConnected(turn.mcpConnected);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: turn.reply,
            toolCalls: turn.toolCalls,
            recommendedProductIds: turn.recommendedProductIds,
            createdAt: Date.now(),
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Chat failed';
        setError(message);
      } finally {
        setSending(false);
        turnstile.reset();
      }
    },
    [sending, turnstile, token]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionIdRef.current = null;
  }, []);

  return {
    messages,
    send,
    reset,
    sending,
    error,
    mcpConnected,
    turnstileContainerRef: turnstile.containerRef,
    turnstileConfigured: turnstile.configured,
    /** Convenience for the chat UI to render an "as <username>" badge. */
    authedUser: user || null,
  };
}
