import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { fetchMpMessages, mpSendMessage } from '@/utils/multiplayerDraftApi';
import type { MultiplayerDraftMessage } from '@/types/multiplayerDraft';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_BODY = 500;
const POLL_MS = 2500;

function parseMessageDate(iso: string): Date | null {
  if (!iso) return null;
  // Supabase may omit the timezone; treat naive ISO datetimes as UTC.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const normalized = !hasZone && iso.includes('T') ? `${iso}Z` : iso;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatChatTime(iso: string, nowMs: number): string {
  const d = parseMessageDate(iso);
  if (!d) return '';
  const diffSec = Math.round((nowMs - d.getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.round(diffSec / 60));
    return `${mins}m ago`;
  }
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatChatTimeAbsolute(iso: string): string {
  const d = parseMessageDate(iso);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function isMine(
  msg: MultiplayerDraftMessage,
  opts: { userId?: string | null; guestSessionId?: string | null; participantId?: string | null }
): boolean {
  if (opts.participantId && msg.participant_id === opts.participantId) return true;
  if (opts.userId && msg.user_id === opts.userId) return true;
  if (opts.guestSessionId && msg.guest_session_id === opts.guestSessionId) return true;
  return false;
}

function mergeMessages(
  prev: MultiplayerDraftMessage[],
  incoming: MultiplayerDraftMessage[]
): MultiplayerDraftMessage[] {
  if (incoming.length === 0) return prev;
  const byId = new Map<string, MultiplayerDraftMessage>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function MultiplayerDraftChat({
  draftId,
  guestSessionId,
  userId,
  participantId,
  canSend,
  variant = 'lobby',
  fillHeight = false,
  className,
}: {
  draftId: string;
  guestSessionId?: string | null;
  userId?: string | null;
  participantId?: string | null;
  canSend: boolean;
  variant?: 'lobby' | 'room' | 'results';
  /** Stretch the message list to fill the parent (mobile chat tab / lobby sidebar). */
  fillHeight?: boolean;
  className?: string;
}) {
  const instanceId = useId();
  const [messages, setMessages] = useState<MultiplayerDraftMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((force = false) => {
    const el = listRef.current;
    if (!el) return;
    if (!force && !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const applyMessages = useCallback(
    (incoming: MultiplayerDraftMessage[], replace = false) => {
      let changed = replace;
      setMessages((prev) => {
        const next = replace ? mergeMessages([], incoming) : mergeMessages(prev, incoming);
        if (
          !replace &&
          next.length === prev.length &&
          next.every((m, i) => m.id === prev[i]?.id)
        ) {
          return prev;
        }
        changed = true;
        return next;
      });
      if (changed) {
        requestAnimationFrame(() => scrollToBottom(replace));
      }
    },
    [scrollToBottom]
  );

  const loadMessages = useCallback(
    async (replace = false) => {
      const rows = await fetchMpMessages(draftId);
      applyMessages(rows, replace);
      return rows;
    },
    [draftId, applyMessages]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadMessages(true)
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(err.message || 'Could not load chat');
      });
    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  // Unique channel topic per mount so two chat trees never share/tear down one socket.
  useEffect(() => {
    const topic = `mp-chat-${draftId}-${instanceId}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'multiplayer_draft_messages',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          const row = payload.new as MultiplayerDraftMessage;
          if (!row?.id) return;
          applyMessages([row]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [draftId, instanceId, applyMessages]);

  // Backup poll — same idea as lobby participant sync if a realtime event is missed.
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadMessages(false).catch(() => {
        /* ignore transient poll errors */
      });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 48;
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const row = await mpSendMessage(draftId, body, guestSessionId);
      stickToBottomRef.current = true;
      applyMessages([row]);
      setDraft('');
      setNowMs(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const listHeight = fillHeight
    ? 'flex-1 min-h-0'
    : variant === 'lobby'
      ? 'h-64 lg:h-[min(28rem,calc(100vh-16rem))]'
      : variant === 'results'
        ? 'h-64'
        : 'h-36 sm:h-40';

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden',
        variant === 'room'
          ? 'rounded-lg border border-border/40 bg-secondary/25 p-3'
          : 'glass-card p-4',
        fillHeight && 'min-h-0 h-full',
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2 shrink-0 mb-2">
        <h2
          className={cn(
            'font-display tracking-wide',
            variant === 'room' ? 'text-base' : 'text-xl'
          )}
        >
          CHAT
        </h2>
        <p className="text-xs text-muted-foreground">
          {canSend ? 'Everyone in this draft' : 'Join to send messages'}
        </p>
      </div>

      <div
        ref={listRef}
        onScroll={onListScroll}
        className={cn(
          'min-h-0 overflow-y-auto overflow-x-hidden space-y-2 pr-1 scrollbar-thin rounded-md border border-border/40 bg-secondary/20 p-2',
          listHeight
        )}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading chat…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No messages yet. Say hello or talk picks.
          </p>
        )}
        {messages.map((msg) => {
          const mine = isMine(msg, { userId, guestSessionId, participantId });
          return (
            <div
              key={msg.id}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm max-w-[95%]',
                mine
                  ? 'ml-auto bg-accent/15 border border-accent/30'
                  : 'mr-auto bg-background/60 border border-border/40'
              )}
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className={cn(
                    'font-medium truncate',
                    mine ? 'text-accent' : 'text-foreground'
                  )}
                >
                  {mine ? 'You' : msg.display_name}
                </span>
                <span
                  className="text-[10px] text-muted-foreground shrink-0"
                  title={formatChatTimeAbsolute(msg.created_at)}
                >
                  {formatChatTime(msg.created_at, nowMs)}
                </span>
              </div>
              <p className="text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
                {msg.body}
              </p>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex gap-2 mt-2 shrink-0 items-center"
      >
        <label htmlFor={`mp-chat-${draftId}-${instanceId}`} className="sr-only">
          Message
        </label>
        <Input
          id={`mp-chat-${draftId}-${instanceId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
          placeholder={canSend ? 'Message the room…' : 'Join the draft to chat'}
          disabled={!canSend || sending}
          maxLength={MAX_BODY}
          className="bg-secondary/50 min-h-11"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend || sending || !draft.trim()}
          className="shrink-0 min-h-11 min-w-11"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
