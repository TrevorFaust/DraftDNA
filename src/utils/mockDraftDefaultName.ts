import { supabase } from '@/integrations/supabase/client';
import { tempDraftStorage } from '@/utils/temporaryStorage';

const AUTO_NAME_RE = /^Mock Draft #(\d+)$/i;

export function isAutoMockDraftName(name: string | null | undefined): boolean {
  return AUTO_NAME_RE.test((name || '').trim());
}

/** Next unused Mock Draft #N given existing names and how many drafts already exist. */
export function nextMockDraftNumber(existingNames: string[], existingCount: number): number {
  const used = new Set<number>();
  for (const name of existingNames) {
    const match = AUTO_NAME_RE.exec((name || '').trim());
    if (match) used.add(parseInt(match[1], 10));
  }
  let next = Math.max(1, existingCount + 1);
  while (used.has(next)) next += 1;
  return next;
}

type DraftNameRow = {
  id: string;
  name: string;
  created_at: string;
  league_key: string;
};

async function fetchSoloNameRows(userId: string, leagueId: string | null): Promise<DraftNameRow[]> {
  let query = supabase
    .from('mock_drafts')
    .select('id, name, created_at, league_id')
    .eq('user_id', userId);
  if (leagueId) query = query.eq('league_id', leagueId);
  else query = query.is('league_id', null);

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load solo drafts for default name:', error);
    return [];
  }
  return (data || []).map((d) => ({
    id: d.id,
    name: d.name || '',
    created_at: d.created_at,
    league_key: (d.league_id as string | null) || '__none__',
  }));
}

async function fetchMpNameRows(userId: string, leagueId: string | null): Promise<DraftNameRow[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('draft:multiplayer_drafts!inner(id, name, created_at, source_league_id, status)')
    .eq('user_id', userId);
  if (error) {
    console.error('Failed to load multiplayer drafts for default name:', error);
    return [];
  }

  return ((data || []) as Array<{
    draft: {
      id: string;
      name: string;
      created_at: string;
      source_league_id: string | null;
      status: string;
    } | null;
  }>)
    .map((row) => row.draft)
    .filter((d): d is NonNullable<typeof d> => !!d && d.status !== 'cancelled')
    .filter((d) =>
      leagueId ? d.source_league_id === leagueId : true
    )
    // When scoping to "no league", only uncategorized MP drafts.
    .filter((d) => (leagueId ? true : d.source_league_id == null))
    .map((d) => ({
      id: d.id,
      name: d.name || '',
      created_at: d.created_at,
      league_key: d.source_league_id || '__none__',
    }));
}

/**
 * Default name for a new mock: Mock Draft #N where N is the next draft ordinal
 * in this league (solo + multiplayer), skipping numbers already used as auto-names.
 */
export async function resolveNextMockDraftName(opts: {
  userId: string | null;
  leagueId: string | null;
}): Promise<string> {
  const { userId, leagueId } = opts;

  if (!userId) {
    const priorCount = tempDraftStorage.getDraftList().length;
    const names = tempDraftStorage
      .getDraftList()
      .map((id) => tempDraftStorage.getDraft(id)?.draft.name || '');
    return `Mock Draft #${nextMockDraftNumber(names, priorCount)}`;
  }

  const [solo, mp] = await Promise.all([
    fetchSoloNameRows(userId, leagueId),
    fetchMpNameRows(userId, leagueId),
  ]);
  const rows = [...solo, ...mp];
  return `Mock Draft #${nextMockDraftNumber(
    rows.map((r) => r.name),
    rows.length
  )}`;
}

async function renameMultiplayerDraft(draftId: string, name: string): Promise<boolean> {
  const { error } = await supabase.rpc('mp_rename_draft' as any, {
    p_draft_id: draftId,
    p_name: name,
  });
  if (error) {
    console.error('Failed to repair multiplayer draft name:', draftId, error);
    return false;
  }
  return true;
}

/**
 * Rewrite auto-named drafts (Mock Draft #N) so N matches chronological order
 * among all drafts in that league (named drafts still occupy their slot).
 * Returns how many rows were updated.
 */
export async function repairAutoMockDraftNames(userId: string): Promise<number> {
  const { data: soloData, error: soloError } = await supabase
    .from('mock_drafts')
    .select('id, name, created_at, league_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (soloError) {
    console.error('Failed to load drafts for name repair:', soloError);
    return 0;
  }

  const { data: mpPartData, error: mpError } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('draft:multiplayer_drafts!inner(id, name, created_at, source_league_id, status)')
    .eq('user_id', userId);
  if (mpError) {
    console.warn('Failed to load multiplayer drafts for name repair:', mpError);
  }

  type Row = {
    id: string;
    name: string;
    created_at: string;
    league_key: string;
    kind: 'solo' | 'mp';
  };

  const rows: Row[] = [];
  for (const d of soloData || []) {
    rows.push({
      id: d.id,
      name: d.name || '',
      created_at: d.created_at,
      league_key: (d.league_id as string | null) || '__none__',
      kind: 'solo',
    });
  }
  for (const row of (mpPartData || []) as Array<{
    draft: {
      id: string;
      name: string;
      created_at: string;
      source_league_id: string | null;
      status: string;
    } | null;
  }>) {
    const d = row.draft;
    if (!d || d.status === 'cancelled') continue;
    rows.push({
      id: d.id,
      name: d.name || '',
      created_at: d.created_at,
      league_key: d.source_league_id || '__none__',
      kind: 'mp',
    });
  }

  const byLeague = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byLeague.get(row.league_key) || [];
    list.push(row);
    byLeague.set(row.league_key, list);
  }

  let updated = 0;
  for (const list of byLeague.values()) {
    list.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (!isAutoMockDraftName(row.name)) continue;
      const desired = `Mock Draft #${i + 1}`;
      if (row.name.trim() === desired) continue;

      if (row.kind === 'solo') {
        const { error } = await supabase
          .from('mock_drafts')
          .update({ name: desired })
          .eq('id', row.id)
          .eq('user_id', userId);
        if (error) {
          console.error('Failed to repair draft name:', row.id, error);
          continue;
        }
      } else {
        const ok = await renameMultiplayerDraft(row.id, desired);
        if (!ok) continue;
      }
      updated += 1;
    }
  }

  return updated;
}
