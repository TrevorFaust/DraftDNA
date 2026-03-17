/**
 * Chaos archetypes (28). Excludes Fantasy Sommelier.
 * Replace-type: when one of these fires, user sees only this badge (no standard).
 * Companion: user sees main badge + this chaos badge.
 */

export interface ChaosArchetype {
  name: string;
  /** When true, this chaos replaces the main archetype for display. */
  replace: boolean;
  flavorText: string;
}

/** Order determines trigger priority when multiple chaos fire (first in list wins). */
export const CHAOS_ARCHETYPES: ChaosArchetype[] = [
  // Replace-type (instant) — show only this badge
  {
    name: 'The Special Teams Stan',
    replace: true,
    flavorText:
      'A defense was on the board in round "x" and you took it, treating it with the same conviction most managers reserve for elite running backs. The Special Teams Stan believes defensive points are just as real as offensive ones and drafted accordingly, loudly and without apology.',
  },
  {
    name: 'The Opening Kickoff',
    replace: true,
    flavorText:
      'A special teams asset was drafted in the first five rounds, and then another one was added later, because the first one clearly wasn\'t enough commitment to the bit. The Opening Kickoff leads with special teams and dares the rest of the roster to justify that decision.',
  },
  {
    name: 'The Special Teams First Ballot',
    replace: true,
    flavorText:
      'A kicker and a defense were both off the board before the end of round 6, consuming premium draft capital on the two positions that every consensus expert says to draft last. The Special Teams First Ballot has a Hall of Fame case for most unconventional positional philosophy in league history.',
  },
  {
    name: 'The Alphabetical',
    replace: true,
    flavorText:
      'The picks on this roster follow the alphabet with a consistency that is either an extraordinary coincidence or a fully committed structural decision. The Alphabetical has found a draft system that is completely immune to positional bias, recency bias, and conventional wisdom.',
  },
  // Companion chaos
  {
    name: 'The Kicker Truther',
    replace: false,
    flavorText:
      'A kicker came off the board in round "x", selected with full conviction and zero irony. The Kicker Truther has done the research, watched the range sessions, and decided that the rest of the league is leaving points on the field by waiting.',
  },
  {
    name: 'The Double Dipper',
    replace: false,
    flavorText:
      'Two kickers were drafted, because one kicker is a starting asset and two kickers is a strategy. The Double Dipper has hedged the most chaotic position in fantasy by simply acquiring both outcomes and letting the better leg decide.',
  },
  {
    name: 'The DST Hoarder',
    replace: false,
    flavorText:
      'Four or more defenses were drafted, which means streaming is no longer a game-time decision but a personal philosophy. The DST Hoarder has cornered the defensive market and will rotate with a confidence that borders on unsettling.',
  },
  {
    name: 'The Ostrich',
    replace: false,
    flavorText:
      'The quarterback position was ignored for the entire draft until the final round made ignoring it technically impossible. The Ostrich buried its head in the positional sand and drafted every other position group with great care before surfacing, just barely, to select a signal-caller.',
  },
  {
    name: 'The Homer',
    replace: false,
    flavorText:
      'Five or more players share the same NFL team affiliation on this fantasy roster, which means the fandom and the fantasy strategy have merged completely. The Homer drafts with the heart as much as the head.',
  },
  {
    name: 'The One Trick Pony',
    replace: false,
    flavorText:
      'Seven or more players from the same NFL team are on this roster, which is not a fantasy draft so much as a very intense show of support for one franchise. The One Trick Pony has gone all in on a single offense.',
  },
  {
    name: 'The Fantasy Hipster',
    replace: false,
    flavorText:
      'Not a single player in the consensus top thirty by ADP appears on this roster, because if everyone wants them, the Fantasy Hipster simply does not. The Fantasy Hipster was contrarian before contrarian was a draft strategy.',
  },
  {
    name: 'The Anti-ADP',
    replace: false,
    flavorText:
      'Every single pick was taken at least two rounds after the consensus expected draft position, meaning this entire roster was assembled at a theoretical discount. The Anti-ADP treats consensus rankings as a starting point for negotiation.',
  },
  {
    name: 'The RB Apocalypse',
    replace: false,
    flavorText:
      'Eight or more running backs were drafted, which means this roster has more running backs than most teams have offensive linemen and is prepared for a ground game scenario that has never occurred in NFL history.',
  },
  {
    name: 'The Air Show',
    replace: false,
    flavorText:
      'Eight or more wide receivers were drafted, which means this team has decided that running backs are essentially optional and the forward pass is the only play that matters.',
  },
  {
    name: 'The Quarterback Factory',
    replace: false,
    flavorText:
      'Three or more quarterbacks are on this roster in a single-QB league—or six or more in superflex—which means the factory is running. The production line only needs one unit.',
  },
  {
    name: 'The TE Convention',
    replace: false,
    flavorText:
      'Three tight ends are on this roster, which suggests that the tight end position was either wildly misunderstood or deeply, personally beloved. The TE Convention has gathered every reliable pass-catcher at the position.',
  },
  {
    name: 'The Zero Position',
    replace: false,
    flavorText:
      'One starting position was entirely ignored until the thirteenth round or later, meaning a lineup slot was effectively left unaddressed for the first three quarters of the draft. The Zero Position is either a masterclass in positional punting or a clerical error that became a philosophy.',
  },
  {
    name: 'The Panic Button',
    replace: false,
    flavorText:
      'Five or more picks came off the board at least 2.5 rounds ahead of consensus expectations, which means the draft room exerted significant emotional pressure on this roster at multiple points. The Panic Button was pressed early and pressed often.',
  },
  {
    name: 'The Hometown Hero',
    replace: false,
    flavorText:
      'Seventy-five percent or more of this roster is made up of players from the four teams in a single NFL division. The Hometown Hero drafted with a clear geographic loyalty, one division, one dream, and the rest of the league is just visiting.',
  },
  { name: 'The Time Traveler', replace: false, flavorText: 'A good portion of this roster is made up of players whose statistical peaks were three or more years ago. The Time Traveler believes that the old guard still has something left in the tank.' },
  { name: 'The Injury Magnet', replace: false, flavorText: 'Four or more players on this roster arrived with documented, significant injury histories. When healthy, this roster is terrifying. The word "when" is doing a lot of work.' },
  { name: 'The Rookie Truther', replace: false, flavorText: 'Five or more rookies were drafted. The Rookie Truther believes in the pipeline, the tape, and the upside that experience cannot yet confirm.' },
  { name: 'The Old Boys Club', replace: false, flavorText: 'Five or more players on this roster are thirty or older. The Old Boys Club drafts players who have seen everything the league can throw at them and handled it.' },
  { name: 'The YOLO', replace: false, flavorText: 'Not a single player on this roster projects to finish inside the top ten at their position. This team is one hundred percent lottery tickets from the first pick to the last.' },
  { name: 'The Handcuff Army', replace: false, flavorText: 'Four or more handcuff running backs were drafted without owning any of the corresponding featured backs. The Handcuff Army is prepared for other people\'s disasters.' },
  { name: 'The Lottery Ticket Booth', replace: false, flavorText: 'Every pick in the first six rounds carried meaningful injury risk. Maximum variance was baked into this roster before the middle rounds even began.' },
  { name: 'The Retirement Watch', replace: false, flavorText: 'Three or more players on this roster were rumored to be considering retirement before the season began. The Retirement Watch believes in the comeback story.' },
  { name: 'The Dynasty Dropout', replace: false, flavorText: 'This redraft roster is stacked with young players who will be excellent in two or three years. The Dynasty Dropout forgot which format this was or decided it did not matter.' },
];

// Fantasy Sommelier removed per spec. Above: 4 replace + 23 companion = 27 chaos (18 implementable now; rest for badge grid).

/** Names that replace the main archetype when they fire. */
export const CHAOS_REPLACE_NAMES = new Set(
  CHAOS_ARCHETYPES.filter((a) => a.replace).map((a) => a.name)
);

export function getChaosArchetypeByName(name: string): ChaosArchetype | undefined {
  return CHAOS_ARCHETYPES.find((a) => a.name === name);
}

export function isChaosReplace(name: string): boolean {
  return CHAOS_REPLACE_NAMES.has(name);
}
