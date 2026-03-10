/**
 * Generated from archetype_logic/archetype_mapping(2).csv and detection.scaling_mapping.csv.
 * Do not edit by hand. Run: node scripts/generateArchetypeLogic.mjs
 */

import type { ArchetypeStrategies, RbStrategyId, WrStrategyId, QbStrategyId, TeStrategyId, LateStrategyId } from './archetypeStrategies';

export interface NamedArchetype {
  name: string;
  strategies: ArchetypeStrategies;
}

export const ARCHETYPE_LIST: NamedArchetype[] = [
  {
    "name": "The Blue Chip",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Fortress",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Blueprint",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Captain",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Empire",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Commander in Chief",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Lock In",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Power Formation",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Sure Thing",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Premium Build",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Long Shot",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Rock",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Disciplined",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Pillar",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Stronghold",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Immovable Object",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Locked In",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Quiet Storm",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Sure Thing",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Safe Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Conservative",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Cornerstone",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Foundation",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Hand",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The TE Hoarder",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Fortress Wall",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Portfolio",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Safe Inversion",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Stabilizer",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Cautious Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Monk",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Bedrock",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Reliable",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Safe Harbor",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Behemoth",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Iron Curtain",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Safe Chaos",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Maverick",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The TE Anchor",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    }
  },
  {
    "name": "The Coalition",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Grand Slam",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Calculated Risk",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Commander",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Ironclad Plan",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Blueprint",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Even Hand",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Methodical Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Power Broker",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Unorthodox",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Reliable Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Route Runner",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Stabilizer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Veteran",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Deep Value",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Hard Hat",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Pragmatist",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Reliable Duo",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Patient",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Balanced Attack",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Pairing",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Bulwark",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Even Keel",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Safe Bet",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Contrarian's Cousin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Old School",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Patient Investor",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Trench Worker",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Patient Drafter",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Pragmatic Renegade",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Quiet Storm",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Minimalist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Minimalist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Stoic",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Controlled Burn",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steel Curtain",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Survivalist",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Workhorse",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Grinder's Path",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    }
  },
  {
    "name": "The Ironclad",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Power Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The General",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Scout Team",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Signal Corps",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Deliberate",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Field General",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Formation",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Signal First",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Signal",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Pragmatist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Reliable Duo",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Grinder",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Scout",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Hand",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Disciplined Pro",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Hard Hat",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Workhorse Classic",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Patient Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Coalition",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Veteran Move",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Conservative",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Indexer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Steady Receiver",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Deep Sleeper",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Powerhouse",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Traditionalist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Workhorse's Cousin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Deliberate Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Iron Will",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Stoic",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Blue Collar",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Monk",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Spartan",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Bruiser",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Bruiser",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Minimalist Extreme",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Minimalist Pro",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Minimalist Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    }
  },
  {
    "name": "The Big Four",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Two Towers",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Franchise",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Franchise Builder",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Opportunist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Field General",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Luxury Tax",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Triple Crown",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Two Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Kelce-Allen Special",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Dark Horse",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The High Roller",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Maverick",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Premium Collector",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Pure Play",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Cornerstone",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Last Resort Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Maverick's Twin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Trenches",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Premium TE Play",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Loaded Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Troika",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Double Down",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Hero",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Market Timer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Full House",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Inverted Draft",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Pivot",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Thunder",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The TE Believer",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The All-In",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Iconoclast",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Chaos Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Swing Trader",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Wildcatter",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Brute Force",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Chaos Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Maverick",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Tank",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The TE Truther",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    }
  },
  {
    "name": "The Big Three",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Star Collector",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Free Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gambler",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Power Broker",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Early Adopter",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Opportunist's Mirror",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Signal Caller",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Triple Threat",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Upside Down",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Boom or Bust",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Late Surge",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Sleeper",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Upside Seeker",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Wide Open",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Free Thinker",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Late Bloomer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Longshot",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Lottery Ticket",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gambler's Process",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Dual Threat",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Dynamic Duo",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Complete Package",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Sleeper Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Streaker",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Backfield Boss",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gridiron",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Late Bloomer Special",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Underdog",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Slow Burn",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Chaos Theory",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Renegade",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Anarchist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gambit",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Pure Opportunist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Bulldozer",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Dumpster Fire Chic",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Ground Game",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Wildcard",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Hail Mary",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    }
  },
  {
    "name": "The Big Play",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Triple Header",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Air Raid",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Bold Franchise",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Opportunist's Gambit",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Bold Departure",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Franchise QB",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gambler's Gambit",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Open Field",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Air Strike",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Daredevil",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Late Bloomer",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Bold",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Boom Factory",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Value Hunter",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Bet Hedger",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Hail Mary Classic",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Hammer Drop",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Stoic",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Late Skill Surge",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Contrarian",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Showstopper",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Air Raid Classic",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Air Raid Classic",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Pivot",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Dark Horse",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Ground & Pound",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Hammer",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Waiver King",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Delayed Attack",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Maverick's Mirror",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Moonshot",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Iconoclast",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Lone Wolf",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Pure Chaos",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Free Spirit",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Gunslinger's Nemesis",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Lone Ranger",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Total Chaos",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Chaos Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    }
  },
  {
    "name": "The Asset Manager",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Dual Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Architect",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Dynasty",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value GM",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Balance Sheet",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Premium Purist",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Strategist",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The War Room General",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Non-Conformist",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Purist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Underdog Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Accountant",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Librarian",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Robot",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Late Value",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Logician",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Return on Rushes",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Engineer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The TE Premium Value",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Complete Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Professor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Accountant",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Optimizer",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Stack Master",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Long Game",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Machine",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Return on Investment",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Inversion",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Balanced Premium",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Actuarial",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Cold Eye",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Actuarial",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Quant",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Systematic",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Data Driven",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Juggernaut",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Sledgehammer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Chaos",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The TE Value Hunter",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    }
  },
  {
    "name": "The GM",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Synergist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Computer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Executive Suite",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Tactician",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Draft Board",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Strategist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Structured Gamble",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Systems Thinker",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Contrarian Formula",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Long Game",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Hunter",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Analyst",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Formula",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Seeker",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Cold Eye",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Market Timer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Value Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Waiver Wire Maestro",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Efficiency Expert",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Diversified",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Formula",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Efficient Market",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Fundamentalist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Neutral",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Arbitrage",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Classicist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Efficiency Play",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Meat and Potatoes",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Contrarian BPA",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Contrarian",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spartan",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Algorithm",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Algorithm",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Methodist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The No-QB Club",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Quant",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Run First",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spartan Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Uncommon Value",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Brass Tacks",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Executive",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Evaluator",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Field Marshal",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The War Room",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Commander in Chief",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Draft Engine",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Draft Room",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The QB Truther",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Quarterback First",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Logician",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Smart Money",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Analyst",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Methodical",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Realist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Mileage",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Mileage Counter",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Process Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Pure BPA",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Optimizer's Path",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Calculated Risk",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Diversified Portfolio",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Scout",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spreadsheet",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spreadsheet Classic",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Arbitrageur",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Smart Money",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Strongman",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Wire to Wire",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Process",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Logician's Ghost",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Stoic's Formula",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Robot",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spartan Analyst",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Spartan General",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Old Faithful",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Pure Contrarian",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Pure Value",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Run Committee",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  },
  {
    "name": "The Robot Builder",
    "strategies": {
      "rb": "skill_pos_late",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    }
  }
];

const ARCHETYPE_BY_NAME = new Map(ARCHETYPE_LIST.map(a => [a.name.toLowerCase(), a]));

export function getArchetypeByName(name: string): NamedArchetype | undefined {
  return ARCHETYPE_BY_NAME.get(name.trim().toLowerCase());
}

export function getArchetypeNameByStrategies(strategies: ArchetypeStrategies): string | undefined {
  const s = strategies;
  return ARCHETYPE_LIST.find(a => a.strategies.rb === s.rb && a.strategies.wr === s.wr && a.strategies.qb === s.qb && a.strategies.te === s.te && a.strategies.late === s.late)?.name;
}

// Round windows by total draft rounds (from detection.scaling_mapping.csv)
export const ROUND_WINDOWS_BY_STRATEGY: Record<string, Record<number, string>> = {
  "zero_rb": {
    "9": "R1–3",
    "10": "R1–3",
    "11": "R1–3",
    "12": "R1–4",
    "13": "R1–4",
    "14": "R1–4",
    "15": "R1–4",
    "16": "R1–5",
    "17": "R1–5",
    "18": "R1–5",
    "19": "R1–6",
    "20": "R1–6",
    "22": "R1–6",
    "25": "R1–7",
    "28": "R1–8",
    "30": "R1–8"
  },
  "hero_rb": {
    "9": "R1",
    "10": "R1",
    "11": "R1",
    "12": "R1",
    "13": "R1",
    "14": "R1",
    "15": "R1",
    "16": "R1",
    "17": "R1",
    "18": "R1",
    "19": "R1",
    "20": "R1",
    "22": "R1",
    "25": "R1",
    "28": "R1",
    "30": "R1"
  },
  "robust_rb": {
    "9": "R1–2",
    "10": "R1–2",
    "11": "R1–3",
    "12": "R1–3",
    "13": "R1–3",
    "14": "R1–3",
    "15": "R1–3",
    "16": "R1–4",
    "17": "R1–4",
    "18": "R1–4",
    "19": "R1–4",
    "20": "R1–4",
    "22": "R1–5",
    "25": "R1–5",
    "28": "R1–6",
    "30": "R1–6"
  },
  "skill_pos_late": {
    "9": "P1–2",
    "10": "P1–2",
    "11": "P1–2",
    "12": "P1–2",
    "13": "P1–2",
    "14": "P1–2",
    "15": "P1–2",
    "16": "P1–2",
    "17": "P1–2",
    "18": "P1–2",
    "19": "P1–2",
    "20": "P1–2",
    "22": "P1–2",
    "25": "P1–2",
    "28": "P1–2",
    "30": "P1–2"
  },
  "bpa": {
    "9": "All",
    "10": "All",
    "11": "All",
    "12": "All",
    "13": "All",
    "14": "All",
    "15": "All",
    "16": "All",
    "17": "All",
    "18": "All",
    "19": "All",
    "20": "All",
    "22": "All",
    "25": "All",
    "28": "All",
    "30": "All"
  },
  "hero_wr": {
    "9": "R1",
    "10": "R1",
    "11": "R1",
    "12": "R1",
    "13": "R1",
    "14": "R1",
    "15": "R1",
    "16": "R1",
    "17": "R1",
    "18": "R1",
    "19": "R1",
    "20": "R1",
    "22": "R1",
    "25": "R1",
    "28": "R1",
    "30": "R1"
  },
  "robust_wr": {
    "9": "R1–3",
    "10": "R1–4",
    "11": "R1–4",
    "12": "R1–4",
    "13": "R1–5",
    "14": "R1–5",
    "15": "R1–5",
    "16": "R2–6",
    "17": "R2–6",
    "18": "R2–6",
    "19": "R2–7",
    "20": "R2–7",
    "22": "R2–8",
    "25": "R2–9",
    "28": "R2–10",
    "30": "R2–10"
  },
  "wr_mid": {
    "9": "R2–5",
    "10": "R2–5",
    "11": "R2–6",
    "12": "R2–6",
    "13": "R2–7",
    "14": "R2–7",
    "15": "R2–7",
    "16": "R3–8",
    "17": "R3–8",
    "18": "R3–9",
    "19": "R3–9",
    "20": "R3–10",
    "22": "R3–11",
    "25": "R4–12",
    "28": "R4–14",
    "30": "R4–14"
  },
  "wr_late": {
    "9": "R1–3",
    "10": "R1–3",
    "11": "R1–3",
    "12": "R1–4",
    "13": "R1–4",
    "14": "R1–4",
    "15": "R1–4",
    "16": "R1–5",
    "17": "R1–5",
    "18": "R1–5",
    "19": "R1–6",
    "20": "R1–6",
    "22": "R1–6",
    "25": "R1–7",
    "28": "R1–8",
    "30": "R1–8"
  },
  "early_qb": {
    "9": "R1–2",
    "10": "R1–2",
    "11": "R1–3",
    "12": "R1–3",
    "13": "R1–3",
    "14": "R1–3",
    "15": "R1–3",
    "16": "R1–4",
    "17": "R1–4",
    "18": "R1–4",
    "19": "R1–4",
    "20": "R1–4",
    "22": "R1–5",
    "25": "R1–5",
    "28": "R1–6",
    "30": "R1–6"
  },
  "mid_qb": {
    "9": "R2–5",
    "10": "R2–6",
    "11": "R3–6",
    "12": "R3–7",
    "13": "R3–7",
    "14": "R3–8",
    "15": "R3–8",
    "16": "R4–9",
    "17": "R4–10",
    "18": "R4–10",
    "19": "R4–11",
    "20": "R4–11",
    "22": "R5–12",
    "25": "R5–14",
    "28": "R6–15",
    "30": "R6–16"
  },
  "late_qb": {
    "9": "R5–8",
    "10": "R6–8",
    "11": "R6–9",
    "12": "R7–10",
    "13": "R7–11",
    "14": "R8–12",
    "15": "R8–12",
    "16": "R9–13",
    "17": "R10–14",
    "18": "R10–15",
    "19": "R11–16",
    "20": "R11–16",
    "22": "R12–18",
    "25": "R14–20",
    "28": "R15–23",
    "30": "R16–24"
  },
  "punt_qb": {
    "9": "R8+",
    "10": "R8+",
    "11": "R9+",
    "12": "R10+",
    "13": "R11+",
    "14": "R12+",
    "15": "R12+",
    "16": "R13+",
    "17": "R14+",
    "18": "R15+",
    "19": "R16+",
    "20": "R16+",
    "22": "R18+",
    "25": "R20+",
    "28": "R23+",
    "30": "R24+"
  },
  "early_te": {
    "9": "R1–2",
    "10": "R1–2",
    "11": "R1–3",
    "12": "R1–3",
    "13": "R1–3",
    "14": "R1–3",
    "15": "R1–3",
    "16": "R1–4",
    "17": "R1–4",
    "18": "R1–4",
    "19": "R1–4",
    "20": "R1–4",
    "22": "R1–5",
    "25": "R1–5",
    "28": "R1–6",
    "30": "R1–6"
  },
  "mid_te": {
    "9": "R2–5",
    "10": "R2–6",
    "11": "R3–6",
    "12": "R3–7",
    "13": "R3–7",
    "14": "R3–8",
    "15": "R3–8",
    "16": "R4–9",
    "17": "R4–10",
    "18": "R4–10",
    "19": "R4–11",
    "20": "R4–11",
    "22": "R5–12",
    "25": "R5–14",
    "28": "R6–15",
    "30": "R6–16"
  },
  "stream_te": {
    "9": "R5+",
    "10": "R6+",
    "11": "R6+",
    "12": "R7+",
    "13": "R7+",
    "14": "R8+",
    "15": "R8+",
    "16": "R9+",
    "17": "R10+",
    "18": "R10+",
    "19": "R11+",
    "20": "R11+",
    "22": "R12+",
    "25": "R14+",
    "28": "R15+",
    "30": "R16+"
  },
  "upside": {
    "9": "R6+",
    "10": "R6+",
    "11": "R7+",
    "12": "R8+",
    "13": "R8+",
    "14": "R9+",
    "15": "R9+",
    "16": "R10+",
    "17": "R11+",
    "18": "R11+",
    "19": "R12+",
    "20": "R12+",
    "22": "R14+",
    "25": "R15+",
    "28": "R17+",
    "30": "R18+"
  },
  "floor": {
    "9": "R6+",
    "10": "R6+",
    "11": "R7+",
    "12": "R8+",
    "13": "R8+",
    "14": "R9+",
    "15": "R9+",
    "16": "R10+",
    "17": "R11+",
    "18": "R11+",
    "19": "R12+",
    "20": "R12+",
    "22": "R14+",
    "25": "R15+",
    "28": "R17+",
    "30": "R18+"
  },
  "vbd": {
    "9": "R3–8",
    "10": "R4–8",
    "11": "R4–9",
    "12": "R4–10",
    "13": "R5–11",
    "14": "R5–12",
    "15": "R5–12",
    "16": "R6–13",
    "17": "R6–14",
    "18": "R6–15",
    "19": "R7–16",
    "20": "R7–16",
    "22": "R8–18",
    "25": "R9–20",
    "28": "R10–23",
    "30": "R10–24"
  },
  "handcuff": {
    "9": "R5+",
    "10": "R5+",
    "11": "R6+",
    "12": "R6+",
    "13": "R7+",
    "14": "R7+",
    "15": "R8+",
    "16": "R8+",
    "17": "R8+",
    "18": "R9+",
    "19": "R9+",
    "20": "R10+",
    "22": "R11+",
    "25": "R12+",
    "28": "R14+",
    "30": "R15+"
  }
};

export const DETECTION_STRATEGY_KEYS: Record<string, string> = {"zero_rb":"zero_rb","hero_rb":"hero_rb","robust_rb":"robust_rb","skill_pos_late":"skill_pos_late","bpa":"bpa","hero_wr":"hero_wr","robust_wr":"robust_wr","wr_mid":"wr_mid","wr_late":"wr_late","early_qb":"early_qb","mid_qb":"mid_qb","late_qb":"late_qb","punt_qb":"punt_qb","early_te":"early_te","mid_te":"mid_te","stream_te":"stream_te","upside":"upside","floor":"floor","vbd":"vbd","handcuff":"handcuff"};

/** Get round window string for a strategy and total rounds (e.g. "R1-4", "R8+"). Uses closest column if exact totalRounds not in sheet. */
export function getRoundWindowForStrategy(strategyId: string, totalRounds: number): string | undefined {
  const key = DETECTION_STRATEGY_KEYS[strategyId];
  if (!key) return undefined;
  const windows = ROUND_WINDOWS_BY_STRATEGY[key];
  if (!windows) return undefined;
  const rounds = [9,10,11,12,13,14,15,16,17,18,19,20,22,25,28,30];
  let best = rounds[0];
  for (const r of rounds) { if (r <= totalRounds) best = r; }
  return windows[best];
}
