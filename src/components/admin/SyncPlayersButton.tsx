import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw } from 'lucide-react';
import { isSyncAdminUser } from '@/constants/adminSync';

/** Response shape from supabase/functions/sync-player-teams */
export type SyncPlayerTeamsResult = {
  success: boolean;
  season?: number | 'all';
  checked?: number;
  pendingChanges?: number;
  updated?: number;
  failed?: number;
  sample?: { id: string; team: string | null; jersey_number: number | null }[];
  sampleTruncated?: boolean;
  error?: string;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

const DEFAULT_SEASON = 2025;

type Props = { userId: string };

export function SyncPlayersButton({ userId }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<SyncPlayerTeamsResult | null>(null);

  async function handleSync() {
    if (!isSyncAdminUser(userId)) {
      setResult({ success: false, error: 'Not allowed' });
      setStatus('error');
      return;
    }

    setStatus('loading');
    setResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not signed in');
      }

      const { data, error } = await supabase.functions.invoke<SyncPlayerTeamsResult>(
        'sync-player-teams',
        {
          body: { season: DEFAULT_SEASON },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        let msg = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const errBody = (await ctx.json()) as { error?: string };
            if (typeof errBody?.error === 'string') {
              msg = errBody.error;
            }
          } catch {
            /* keep message */
          }
        }
        throw new Error(msg);
      }

      if (data && data.success === false && data.error) {
        throw new Error(data.error);
      }

      setResult(data ?? null);
      setStatus('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ success: false, error: message });
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={handleSync}
        disabled={status === 'loading'}
        className="gap-2 w-fit"
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {status === 'loading' ? 'Syncing…' : 'Sync player teams (Sleeper)'}
      </Button>

      {status === 'done' && result?.success && (
        <div className="text-sm rounded-md border border-green-500/30 bg-green-500/10 text-foreground p-3 space-y-1">
          <p>
            Checked <strong>{result.checked ?? 0}</strong> players with a Sleeper id
            {result.season != null && (
              <>
                {' '}
                (season <strong>{String(result.season)}</strong>)
              </>
            )}
            .
          </p>
          <p>
            Updated <strong>{result.updated ?? 0}</strong>
            {typeof result.failed === 'number' && result.failed > 0 && (
              <> — <span className="text-destructive">{result.failed} failed</span></>
            )}
            .
          </p>
          {result.pendingChanges != null && result.pendingChanges > 0 && (
            <ul className="mt-2 space-y-1 text-muted-foreground max-h-40 overflow-y-auto">
              {(result.sample ?? []).slice(0, 15).map((row) => (
                <li key={row.id}>
                  Team / jersey → <span className="text-foreground">{row.team ?? 'FA'}</span>
                  {row.jersey_number != null && ` #${row.jersey_number}`}
                </li>
              ))}
              {result.sampleTruncated && (
                <li className="italic">…and more (see Edge function logs for full list)</li>
              )}
            </ul>
          )}
          {result.pendingChanges === 0 && (
            <p className="text-muted-foreground">No differences vs Sleeper for this season.</p>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="text-sm rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {result?.error ?? 'Something went wrong'}
        </div>
      )}
    </div>
  );
}
