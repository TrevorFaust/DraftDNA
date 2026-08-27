export const ROOMS = ['QB', 'RB', 'WR', 'TE', 'DST', 'BENCH'] as const;
export type Room = (typeof ROOMS)[number];

export const ROOM_LABELS: Record<Room, string> = {
  QB: 'QB room',
  RB: 'RB room',
  WR: 'WR room',
  TE: 'TE room',
  DST: 'DEF/ST room',
  BENCH: 'Bench',
};

export const ROOM_SHORT: Record<Room, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  DST: 'DEF/ST',
  BENCH: 'Bench',
};

export const TEAM_COUNT = 14;

export const DEFAULT_WEIGHTS: Record<Room, number> = {
  WR: 30,
  RB: 28,
  QB: 18,
  TE: 14,
  DST: 8,
  BENCH: 2,
};

export type RoomMode = 'ordinal' | 'custom';

export type Player = {
  id: string;
  name: string;
  room: Room;
  /** ESPN / NFL position label (QB, RB, WR, TE, K, D/ST). */
  position?: string;
  nflTeam?: string;
  unassigned?: boolean;
  /** Injured reserve slot. Counts in the Bench room, never as a starter. */
  ir?: boolean;
  /** Explicit lineup seat (`s:0`, `b:1`, `i:0`). Lets a manager start a bench player. */
  lineupSlot?: string;
};

export type Team = {
  id: string;
  name: string;
  players: Player[];
  gutBump: number;
};

export type League = {
  teams: Team[];
  weights: Record<Room, number>;
  roomMode: Record<Room, RoomMode>;
  ordinalRanks: Record<Room, string[]>;
  customScores: Record<Room, Record<string, number>>;
};

export type ScoredTeam = {
  team: Team;
  total: number;
  roomPoints: Record<Room, number>;
  roomPlace: Record<Room, number>;
  weighted: Record<Room, number>;
  rank: number;
  tied: boolean;
};

export function newId(): string {
  return crypto.randomUUID();
}
