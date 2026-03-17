# Chaos Archetypes — Implementation Spec

Based on your clarifications. Use this as the source of truth when implementing.

---

## 1. Special Teams First Ballot (flavor text)

- **Trigger:** Both a Kicker AND a DST drafted **before round 6** (i.e. by end of round 5). Latest completion = round 5.
- **Flavor text:** Substitute the round when the **later** of the two was drafted. Call that round `R`. Display: “kicker and defense were off the board before round **R+1**”.
  - If both done by end of round 3 → “before round 4”.
  - If both done by end of round 5 → “before round 6”.
- So: `R = max(roundOfFirstKicker, roundOfFirstDST)`; flavor uses “before round R+1”.

---

## 2. Chaos as own badges + instant vs gated

- **Chaos badges are their own badges** (separate from standard), but you **also** show the **main (standard) badge**; chaos appears **on the side** as a bonus (companion).
- **Two types:**
  - **Instant:** Trigger fires → award chaos badge immediately (e.g. Kicker Truther, DST in R5, Double Dipper — not a “normal” strategy).
  - **Gated:** Award **only if** the user has already earned **all** standard archetypes in the **same bucket** (same strategy profile) as this draft. Otherwise do **not** award the chaos badge this time (they get the standard badge from the bucket as today).
- **You will curate** which chaos archetypes are instant vs gated. Once you provide that list, we wire it (e.g. `CHAOS_INSTANT_IDS` vs gated).

---

## 3. One Trick Pony vs Homer

- **7+ players from same NFL team** → **One Trick Pony only** (supersedes Homer).
- **5 or 6 players from same team** → **Homer**.
- Detection order: check One Trick Pony first; if 7+, return One Trick Pony. Else if 5–6, return Homer.

---

## 4. ADP / round and league size

- **Expected round** from ADP: `expectedRound = ceil(adp / num_teams)`.
- All ADP-based chaos (Anti-ADP, Panic Button, Fantasy Hipster, etc.) use this. Smaller leagues (e.g. 4-team) will have larger “round stretch” for the same ADP gap; that’s acceptable.

---

## 5. YOLO and “top 10 at position”

- Use **community ranking** (rank), not ADP. **Top 10 at position** = the 10 highest-ranked players at that position (in the pool we have).
- Trigger: no drafted player is in the top 10 at their position (by rank). **Badge is permanent** once earned (no re-evaluation if rankings change later). Same for all badges.

---

## 6. Alphabetical

- **80%** of picks (by pick order) must follow **last-name** alphabetical order.
- Last name = derived from `player.name` (e.g. last token).

---

## 7. Data and triggers

- **Remove Fantasy Sommelier** from the list → **28 chaos archetypes**.
- **Division:** You’ll provide divisional layout → Hometown Hero = heavy same-division drafting.
- **Age** (from player cards): Old Boys Club = 5+ players aged **30+** (flavor "thirty"). Time Traveler = use **31+** as the age threshold (only ~30–40 draftable in that range; having 7–10 on a 15–20 roster is a stretch). E.g. 45% or higher of roster aged 31+; flavor "A good portion of this roster…"
- **Rookie:** You’ll flag rookies; Rookie Truther = 5+ rookies. Evaluate **after** other categories (only spring when no other chaos applies).
- **Injury:** “Injury risk” = e.g. **10+ games missed in last 2 seasons** (you may add injury data later). Injury Magnet = 4+ such players.
- **Handcuff:** Handcuff designation deferred until after NFL free agency / when player team data is updated. Until then we cannot give an accurate list (RB2-by-ADP-per-team is unstable). Handcuff Army = 4+ handcuff RBs without owning the corresponding starters—implement once rosters are finalized.
- **Retirement Watch:** **3+ players aged 34+**. Only a handful of draftable guys in this range.

---

## 8. Integration

1. **Multiple chaos triggers:** If more than one fires, choose **one** chaos badge: prefer one the user **hasn’t earned** yet; if multiple unearned, use **trigger order** (order in chaos list). So: filter to chaos badges that fired and user doesn’t have → take first in list order.
2. **Companion:** User always gets **main badge**; if a chaos trigger awards a chaos badge, show it **in addition** (main + chaos on the side).
3. **Badge order in UI:** Group **standard** badges by **RB strategy** (all Hero RB together, Zero RB, Hybrid, etc.), then **chaos badges last** as bonus. Implementation: keep `FULL_ARCHETYPE_LIST` and stored indices unchanged; add a **display order** (e.g. `BADGE_DISPLAY_ORDER`: array of indices) so the grid renders in RB-grouped order with chaos at the end. Stored `user_detected_archetype_index` still refers to the canonical list.
4. **Zero Position:** “First player drafted for a position = starter.” Check positions **QB, RB, WR, TE** only (exclude DST and K). If the **first** player drafted for any of those positions is in **round 13+**, that’s Zero Position.
5. **Quarterback Factory:** **Single-QB:** 3+ QBs. **Superflex:** 3+5 = **8+ QBs**.

---

## 9. Generator

- Read Chaos Archetypes CSV (minus Sommelier).
- Output chaos list (id, name, category, trigger key, flavor text). Special Teams First Ballot flavor uses “before round R+1” as above.

---

## 10. Open points (confirm before coding)

1. **Old Boys Club:** Trigger = 5+ players aged **30+** (flavor text says “thirty-two”). Use 30+ for trigger; keep or change flavor to “thirty”?
2. **Retirement Watch:** Use age **33+** or **34+** for “rumored retirement” proxy? (We’ll use one consistently and you can tune after seeing counts.)
3. **Instant vs gated list:** Once you send the curated list of which chaos archetypes are instant vs gated, we’ll wire it (e.g. `CHAOS_INSTANT_IDS`).
4. **Time Traveler “majority”:** Count over all drafted skill players (QB/RB/WR/TE), or exclude K/DST only? Proposed: majority of drafted players with a defined peak age (QB/RB/WR/TE/K).

See sections 11–13 for resolved decisions.

---

## 11. Divisions (for Hometown Hero)

- **AFC East:** Buffalo Bills, Miami Dolphins, New England Patriots, New York Jets  
- **AFC North:** Baltimore Ravens, Cincinnati Bengals, Cleveland Browns, Pittsburgh Steelers  
- **AFC South:** Houston Texans, Indianapolis Colts, Jacksonville Jaguars, Tennessee Titans  
- **AFC West:** Denver Broncos, Kansas City Chiefs, Las Vegas Raiders, Los Angeles Chargers  
- **NFC East:** Dallas Cowboys, New York Giants, Philadelphia Eagles, Washington Commanders  
- **NFC North:** Chicago Bears, Detroit Lions, Green Bay Packers, Minnesota Vikings  
- **NFC South:** Atlanta Falcons, Carolina Panthers, New Orleans Saints, Tampa Bay Buccaneers  
- **NFC West:** Arizona Cardinals, Los Angeles Rams, San Francisco 49ers, Seattle Seahawks  

Mapping: `src/constants/nflDivisions.ts`. Hometown Hero = heavy same-division drafting.

---

## 12. Instant replace vs companion

- **Replace (show only this badge):** Special Teams Stan, The Opening Kickoff, Special Teams First Ballot, The Alphabetical. When one fires, user gets **only** that chaos badge.
- **Companion:** All other chaos badges are shown **in addition** to the main (standard) badge (2 badges).

---

## 13. Finalized details

- **Old Boys Club:** 5+ players aged **30+**; flavor "thirty".
- **Retirement Watch:** **3+ players aged 34+** (only a handful of draftable guys in this range).
- **Time Traveler:** **31+** as the age threshold; e.g. 45% or higher of roster aged 31+. Only ~30–40 draftable in that range, so 7–10 on a 15–20 roster is a stretch; flavor "A good portion of this roster…"
- **Quarterback Factory:** Single-QB **3+ QBs**. Superflex **9+ QBs** (3+6).
- **Injury:** Use 1 vs 2 years based on available games-missed data.
- **Age source:** From `birth_date` in `nfl_players_historical`, `players_info`, or `players_clean` (join to `players` via `espn_id`); see `PlayerDetailDialog` and `src/utils/playerAge.ts`.
