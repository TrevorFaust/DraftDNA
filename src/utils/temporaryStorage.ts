import type { MockDraft, DraftPick, RankedPlayer } from '@/types/database';

const TEMP_DRAFT_PREFIX = 'temp_draft_';
const TEMP_DRAFT_LIST_KEY = 'temp_drafts_list';
const TEMP_RANKINGS_KEY = 'temp_rankings';
const TEMP_SETTINGS_KEY = 'temp_settings';
const GUEST_SESSION_ID_KEY = 'guest_session_id';
/** Persist All Leagues bucket (scoring/leagueType/superflex/rookiesOnly) so refresh keeps dynasty/SF/standard etc. */
export const ALL_LEAGUES_BUCKET_KEY = 'rankingsAllLeaguesBucket';

/** Generate a UUID v4 for guest session (used to submit rankings so they count toward community). */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Get or create a persistent guest session ID so guest rankings can be submitted and count toward community. */
export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return generateUuid();
  let id = localStorage.getItem(GUEST_SESSION_ID_KEY);
  if (!id) {
    id = generateUuid();
    localStorage.setItem(GUEST_SESSION_ID_KEY, id);
  }
  return id;
}

// Temporary Draft Storage
export const tempDraftStorage = {
  // Save a temporary draft
  saveDraft: (draft: MockDraft, picks: DraftPick[]): void => {
    const key = `${TEMP_DRAFT_PREFIX}${draft.id}`;
    localStorage.setItem(key, JSON.stringify({ draft, picks }));
    
    // Update the list of temporary drafts
    const draftList = tempDraftStorage.getDraftList();
    if (!draftList.includes(draft.id)) {
      draftList.push(draft.id);
      localStorage.setItem(TEMP_DRAFT_LIST_KEY, JSON.stringify(draftList));
    }
  },

  // Get a temporary draft
  getDraft: (draftId: string): { draft: MockDraft; picks: DraftPick[] } | null => {
    const key = `${TEMP_DRAFT_PREFIX}${draftId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  // Get list of temporary draft IDs
  getDraftList: (): string[] => {
    const data = localStorage.getItem(TEMP_DRAFT_LIST_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  // Delete a temporary draft
  deleteDraft: (draftId: string): void => {
    const key = `${TEMP_DRAFT_PREFIX}${draftId}`;
    localStorage.removeItem(key);
    
    const draftList = tempDraftStorage.getDraftList();
    const updatedList = draftList.filter(id => id !== draftId);
    localStorage.setItem(TEMP_DRAFT_LIST_KEY, JSON.stringify(updatedList));
  },

  // Clear all temporary drafts
  clearAll: (): void => {
    const draftList = tempDraftStorage.getDraftList();
    draftList.forEach(id => {
      localStorage.removeItem(`${TEMP_DRAFT_PREFIX}${id}`);
    });
    localStorage.removeItem(TEMP_DRAFT_LIST_KEY);
  },
};

// Temporary Rankings Storage (per bucket so guest rankings are scoped to scoring/league type/superflex/rookiesOnly)
const tempRankingsKeyForBucket = (bucketKey: string) => `${TEMP_RANKINGS_KEY}_${bucketKey}`;

export const tempRankingsStorage = {
  /** Save guest rankings for the current bucket. Only show vs community when they finalize for this bucket. */
  save: (rankings: RankedPlayer[], bucketKey: string): void => {
    localStorage.setItem(tempRankingsKeyForBucket(bucketKey), JSON.stringify(rankings));
  },

  /** Get guest rankings for the given bucket, or null if none / different bucket. */
  get: (bucketKey: string): RankedPlayer[] | null => {
    const data = localStorage.getItem(tempRankingsKeyForBucket(bucketKey));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  clear: (bucketKey?: string): void => {
    if (bucketKey) {
      localStorage.removeItem(tempRankingsKeyForBucket(bucketKey));
    } else {
      // Clear all bucket-scoped ranking keys (keys that start with TEMP_RANKINGS_KEY)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(TEMP_RANKINGS_KEY)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  },
};

// Temporary Settings Storage
export const tempSettingsStorage = {
  save: (settings: {
    numTeams?: number;
    userPickPosition?: number;
    pickTimer?: number;
    cpuSpeed?: 'slow' | 'normal' | 'fast' | 'rapid';
    playerPool?: string;
    positionLimits?: {
      QB?: number;
      RB?: number;
      WR?: number;
      TE?: number;
      K?: number;
      DEF?: number;
      BENCH?: number;
    };
    isSuperflex?: boolean;
    rookiesOnly?: boolean;
    draftOrder?: string;
    scoringFormat?: string;
    leagueType?: string;
  }): void => {
    localStorage.setItem(TEMP_SETTINGS_KEY, JSON.stringify(settings));
  },

  get: (): any => {
    const data = localStorage.getItem(TEMP_SETTINGS_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  clear: (): void => {
    localStorage.removeItem(TEMP_SETTINGS_KEY);
  },
};

// Generate a temporary draft ID
export const generateTempDraftId = (): string => {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// All Leagues bucket (for logged-in users: persist so refresh keeps dynasty/SF/standard etc.)
export type AllLeaguesBucket = {
  scoringFormat: 'standard' | 'ppr' | 'half_ppr';
  leagueType: 'season' | 'dynasty';
  isSuperflex: boolean;
  rookiesOnly: boolean;
};

export const allLeaguesBucketStorage = {
  get(): AllLeaguesBucket | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(ALL_LEAGUES_BUCKET_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.scoringFormat === 'string' && typeof parsed.leagueType === 'string') {
        return {
          scoringFormat: parsed.scoringFormat as AllLeaguesBucket['scoringFormat'],
          leagueType: parsed.leagueType as AllLeaguesBucket['leagueType'],
          isSuperflex: Boolean(parsed.isSuperflex),
          rookiesOnly: Boolean(parsed.rookiesOnly),
        };
      }
    } catch {}
    return null;
  },
  save(bucket: AllLeaguesBucket): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ALL_LEAGUES_BUCKET_KEY, JSON.stringify(bucket));
  },
};
