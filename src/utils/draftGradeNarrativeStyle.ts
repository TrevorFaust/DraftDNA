/**

 * Draft grade report — voice and pillars for every finished mock.

 *

 * ## Four pillars (balance in every report)

 *

 * 1. **Who you took vs who was available** — premium-slot reaches, steals only at real value, name who was left on the board.

 * 2. **Team synergy** — one RB handcuff is fine; elite WR2 with the alpha on the same team is risky but OK at price; late-round secondary WRs (e.g. WR2 types) are more problematic.
 *    Late QB is fine at value; three early WR1s are not a problem by themselves. Zero-RB (no RB through round 6)
 *    is fine when WRs are strong and TE/QB anchor the build — penalize late QB only for bad WR quality, reaches, or stacks.

 * 3. **Roster build & prior-year production** — archetype lead, positional ranks (WR5), roster shape.

 * 4. **Balanced grade** — "While [good]…, [what hurt] add up to a B- draft" when the draft is mixed.

 *

 * ## Tone

 * Direct "you" voice; one paragraph; not a checklist.

 */



const COUNT_WORDS = [

  'zero',

  'one',

  'two',

  'three',

  'four',

  'five',

  'six',

  'seven',

  'eight',

  'nine',

  'ten',

  'eleven',

  'twelve',

] as const;



/** Spell small counts in prose; digits for larger values. */

export function narrativeCount(n: number): string {

  if (Number.isInteger(n) && n >= 0 && n < COUNT_WORDS.length) {

    return COUNT_WORDS[n];

  }

  return String(n);

}



/** Avoid "2 2025" — e.g. seasonCountPhrase(2, 2025, 'top-ten finishers') → "two 2025 top-ten finishers". */

export function seasonCountPhrase(count: number, season: number, label: string): string {

  return `${narrativeCount(count)} ${season} ${label}`;

}


