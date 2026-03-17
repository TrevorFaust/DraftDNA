# Chaos Archetypes — Review and Integration Notes

You added **29 chaos archetypes** in `Fantasy_Football_Archetype_Master.xlsx - Chaos Archetypes.csv`. Below is feedback on the file itself, data requirements, and how to integrate with the current archetype logic.

---

## 1. File structure and quality

- **Columns** (Archetype Name, Category, Trigger Condition, Frequency, Flavor Text, Notes) are clear and consistent.
- **Categories** map well to detection families: Positional Timing, Loyalty/Bias, Anti-Strategy, Positional Hoarding, Gambling/Variance, Troll/Comedic.
- **Flavor text** is strong and on-brand. A few rows use a literal `"x"` or `round "x"` — we’d substitute the actual round number (or count) at display time.
- **Notes** are useful as implementation hints (e.g. “team tracking”, “adp tracking”, “Based on player age”).

**Minor issues**

- **The One Trick Pony** flavor text starts with `"x"` — should be the count (e.g. “Seven players…”).
- **The Special Teams First Ballot** says `round "x+1"` — clarify whether that’s “before round 6” (i.e. rounds 1–5) or “before round 7” (rounds 1–6). Your trigger says “before Round 6”, so we’d show something like “before round 6” in the flavor text.
- **Retirement Watch** note: “retierment” → “retirement”.

---

## 2. How chaos differs from the 361 standard archetypes

- **Standard:** One 5-dimension strategy profile (RB/WR/QB/TE/Late) per draft → one archetype from the bucket (360 + Improviser).
- **Chaos:** Trigger-based. Each chaos archetype has a **condition** (e.g. “DST drafted Round 5 or earlier”, “8+ RBs”). No shared “strategy profile”; they’re independent flags.

So chaos should run **in addition to** standard detection: same draft can have a **standard** archetype (for badge/bucket) and optionally a **chaos** archetype when a chaos trigger fires.

---

## 3. Data we have vs. data we need

**Available on `Player` / draft context**

- `position`, `round_number` (from picks) → all position/round-based chaos.
- `adp`, `rank` → ADP-based chaos (reaches, anti-ADP, top-30, top-10 at position).
- `team` (NFL team) → Homer, One Trick Pony.
- `name` → Alphabetical (last-name order vs. pick order).
- `num_teams` → “single-QB” vs superflex; roster size for “one position until round 13+”.

**Not available (would need new data or heuristics)**

| Chaos archetype      | Needs                         | Notes |
|----------------------|--------------------------------|-------|
| The Hometown Hero    | Division or region per player  | Need team → division/region mapping; “prioritizes one region” is fuzzy. |
| The Time Traveler    | Age or “peak year” / stats     | “Peaked 3+ years ago” needs historical production or age + experience. |
| The Old Boys Club    | Player age                     | “5+ aged 30+” needs birth year or age. |
| The Rookie Truther   | Rookie flag                    | “5+ rookies” needs a rookie/experience flag. |
| The Injury Magnet    | Injury history                 | “4+ with significant injury history” needs games missed or injury tag. |
| The Lottery Ticket Booth | Injury risk per player    | “Every R1–6 pick has meaningful injury risk” needs same. |
| The Handcuff Army    | Handcuff ↔ starter links       | “4+ handcuffs without owning starters” needs handcuff relationships. |
| The Retirement Watch| Offseason retirement rumors    | External / editorial data. |
| The Fantasy Sommelier| “Aesthetically pleasing names”  | Subjective; not realistically automatable. |
| The Dynasty Dropout | Age/experience                 | “Young players, dynasty-style” needs age or experience. |

So:

- **Implementable with current data:** ~15–18 of 29 (all Positional Timing and Positional Hoarding, plus Homer, One Trick Pony, Alphabetical, and the ADP-based ones: Fantasy Hipster, Anti-ADP, Panic Button, YOLO).
- **Need new fields or external data:** the rest (age, injury, rookie, handcuff, retirement, division/region, Sommelier).

---

## 4. Integration design choices

**A. When to run chaos**

- Run **after** standard detection.
- For a completed draft: compute standard archetype (bucket + assignment) as today; then run chaos checks. If any chaos trigger fires, we have an optional **chaos override** or **second badge**.

**B. One chaos vs. multiple**

- Many drafts could hit 0 chaos triggers; some could hit 2+ (e.g. DST in R5 + 2 kickers).
- Options:
  - **Single chaos:** Define a **priority order** (e.g. by category or “rarity”) and assign at most one chaos archetype per draft.
  - **Multiple chaos:** Store an array of chaos archetype IDs and show several badges (more complex UI and storage).

Recommendation: start with **one chaos archetype per draft**, with a fixed priority order (e.g. Positional Timing first, then Hoarding, then Loyalty, etc., and within a category by row order or “Very Rare” before “Rare”).

**C. Override vs. companion**

- **Override:** If chaos fires, show only the chaos archetype (e.g. “The Special Teams Stan”) and hide the standard one. Simpler, but loses the “real” strategy story.
- **Companion:** Always show the standard archetype; if chaos fires, also show a chaos badge (e.g. “The Captain + The Special Teams Stan”). Makes it clear the draft was both strategic and chaotic.

Recommendation: **companion**. Keep standard archetype as primary; chaos as an extra badge/tag so “rare/funny” doesn’t replace “what they actually did.”

**D. Storage**

- Add optional fields to the draft (or a small “draft_chaos” table), e.g.:
  - `chaos_archetype_id` or `chaos_archetype_name`
  - Or `chaos_archetype_index` (index into a chaos list of 29).
- Badges UI: keep the existing 361 grid; add a **second section** “Chaos badges” (29 slots) and mark earned when `chaos_archetype_index` is set for a completed draft.

**E. Generator / source of truth**

- Add a script (or extend `generateArchetypeLogic.mjs`) to read **Chaos Archetypes.csv** and emit:
  - A **chaos list** (id/name, category, trigger key, flavor text, notes).
  - Trigger logic lives in code (or in a small “chaos trigger” module) that takes (picks, players, config) and returns which trigger keys fire; then map trigger key → chaos archetype.

---

## 5. Trigger logic — edge cases and ambiguities

- **The Zero Position:** “Completely neglects one **starting** position (not kicker or defense) until round 13+.” We need a roster config: which slots are “starting” (QB, RB, RB, WR, WR, TE, FLEX, etc.). Then for each such position, check whether the first pick at that position is round 13+. If league has 2 FLEX, “FLEX” might be two slots — need a clear rule (e.g. “at least one FLEX filled by round 13” or “both FLEX”).
- **Single-QB vs. superflex:** The Quarterback Factory is “3+ QBs in a **single-QB** league.” We have `num_teams` and can infer single-QB from league settings if that’s stored; otherwise we might assume single-QB unless we have an explicit superflex flag.
- **Opening Kickoff:** “DST or K in R1–5 **and** a second of the **same** position later.” So two DSTs with first in R1–5, or two Ks with first in R1–5. Clear.
- **Alphabetical:** “Draft order suspiciously follows alphabetical by last name.” Need a rule: e.g. “at least 80% of picks (by pick number) are in increasing order of last name” to allow one or two out-of-order picks. Also define how to derive “last name” (e.g. last token of `player.name`).
- **ADP “round”:** “Every pick at least 2 rounds later than consensus ADP” requires converting ADP to “expected round” (e.g. in 12-team, ADP 13 → round 2). Formula: `expectedRound = ceil(adp / num_teams)`. Then “2 rounds later” means `actualRound >= expectedRound + 2`. Same idea for Panic Button (reach = actualRound &lt; expectedRound − 3?) and YOLO (no player in top 10 at position by ADP).

---

## 6. Suggested implementation order

1. **Ingest the CSV**  
   Generator or one-off script: parse Chaos Archetypes.csv → chaos list (name, category, trigger key, flavor text). Replace `"x"` in flavor text with a placeholder like `{round}` or `{count}` for runtime substitution.

2. **Define trigger keys**  
   One string or enum per row (e.g. `special_teams_stan`, `kicker_truther`, …) and a single function `detectChaosArchetype(picksWithPlayers, config): string | null` that runs triggers in priority order and returns the first that fires (or the chosen one if you allow multiple later).

3. **Implement “free” triggers first**  
   No new data: Special Teams Stan, Kicker Truther, Double Dipper, DST Hoarder, Ostrich, Opening Kickoff, Special Teams First Ballot, RB Apocalypse, Air Show, Quarterback Factory, TE Convention, Zero Position, Homer, One Trick Pony, Alphabetical, Fantasy Hipster, Anti-ADP, Panic Button, YOLO. That’s most of the list; you can stub the rest as “not implemented” with a note in the UI.

4. **Wire into completion flow**  
   When a draft is completed, call `detectChaosArchetype(...)`. If non-null, save `chaos_archetype_index` (or name) on the draft. Do **not** change the standard archetype or bucket logic.

5. **UI**  
   - Draft completion / history: show standard archetype; if `chaos_archetype_index` is set, also show the chaos badge/tag and its flavor text.  
   - Badges page: add a “Chaos” section (29 slots), same earned/locked pattern as the main grid.

6. **Later**  
   Add age, injury, rookie, handcuff (and optionally division) so the remaining chaos archetypes can be implemented; keep Notes as the reference for which data each row needs.

---

## 7. Summary

- **File:** Structure and content are solid; fix the small flavor-text placeholders and typo.
- **Concept:** Chaos as a **second layer** (companion to standard archetype) keeps the model clear and avoids overloading the main bucket logic.
- **Data:** About half to two-thirds of triggers are doable with current data; the rest need new fields or external data (documented in §3 and Notes).
- **Integration:** Ingest CSV → chaos list + trigger keys; implement triggers in code with a clear priority; run after standard detection; store one chaos archetype per draft; add a Chaos badge section and display alongside the standard archetype.

If you want to go deeper next, we can (1) lock the exact trigger definitions and priority order, or (2) sketch the generator changes and the `detectChaosArchetype` API and storage fields.
