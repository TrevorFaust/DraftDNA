# Archetype Master File — Spec for Migration

Use this as a checklist so the codebase can be updated to use your new archetype master file and flavor text.

---

## 1. What we need from you

### 1.1 File format and location

- **Where will the master file live?**  
  Suggested: `archetype_logic/archetype_master.xlsx` (or a single CSV if you prefer).

- **Format:**
  - **Option A — Excel (recommended if you have multiple tabs):** One `.xlsx` with sheets, e.g.:
    - `Archetypes` (or “Archetype Mapping”): one row per named archetype + strategy columns + flavor text.
    - Optional: `Detection` (round windows), `Strategies` (definitions), etc.
  - **Option B — CSV:** One or more CSVs in `archetype_logic/`:
    - e.g. `archetype_master.csv` with columns: Archetype Name, RB Strategy, WR Strategy, QB Strategy, TE Strategy, Late Philosophy, **Flavor Text**.
    - If detection windows live in a separate tab/sheet, we need that as a second CSV (or we keep using the existing detection file).

Please confirm:
- [ ] File path you’ll use: `archetype_logic/_________________.xlsx` or `.csv`
- [ ] Exact **sheet names** (if Excel) or **file names** (if CSV).
- [ ] Exact **column headers** for the main archetype table (so we can map “Flavor Text” and the five strategy columns).

### 1.2 Archetype table columns (required)

The generator expects one row per **named archetype** with at least:

| Column purpose   | Example value   | Notes |
|------------------|-----------------|--------|
| Archetype name   | The Captain     | Must be unique. |
| RB strategy      | BPA / Robust RB / Hero RB / Zero RB / Skill Pos Late | Exact spelling or we map via a table. |
| WR strategy      | Robust WR / WR Late / Hero WR / WR Mid | |
| QB strategy      | Early QB / Mid QB / Late QB / Punt QB | |
| TE strategy      | Early TE / Mid TE / Stream TE | |
| Late philosophy  | Floor / Upside / VBD / Handcuff | |
| **Flavor text**  | 1–3 sentences describing this archetype. | New; will be shown in badge tooltips. |

If your column names differ (e.g. “Late Round”, “Philosophy”), list them and we’ll map them.

### 1.3 Strategy / philosophy name changes

If any **strategy or philosophy names** changed (e.g. “Stream TE” → “Late TE” in the sheet, or new options):

- List **old name → new name** (or “new strategy: X”).
- We’ll update:
  - `archetypeStrategies.ts` (IDs and `STRATEGY_DISPLAY_TO_ID`) if needed.
  - The generator’s mapping from spreadsheet text → internal IDs (e.g. `zero_rb`, `stream_te`).
  - Detection in `archetypeDetection.ts` only if the **detection rules** for a strategy changed (same ID = no change).

### 1.4 Detection / round windows (optional)

- If your master file includes a **Detection** (or “Round Windows”) tab with the same idea as the current `detection.scaling_mapping.csv` (strategy → round windows by total rounds), we can switch the generator to read that tab instead of a separate CSV.
- If you’re not changing detection at all, we can keep reading `detection.scaling_mapping.csv` (you’d need to export it from your master or leave the current one in place).

---

## 2. What we’ll change in the codebase

Once the above is clear, we will:

1. **Generator (`scripts/generateArchetypeLogic.mjs`)**
   - Read from your **master file** (Excel or CSV).
   - Parse the main archetype table and the **Flavor text** column.
   - If detection is in the same file (e.g. a “Detection” sheet), read it from there; otherwise keep using the existing detection CSV.
   - Output `archetypeMappings.generated.ts` with:
     - `NamedArchetype`: `name`, `strategies`, and **`flavorText?: string`**.
     - Same list and lookup APIs as today.

2. **Types and list**
   - `NamedArchetype` in generated (and `archetypeListWithImproviser.ts` if we add “The Improviser” there) will include optional `flavorText`.
   - `FULL_ARCHETYPE_LIST` will carry flavor text through for the UI.

3. **UI (ArchetypeBadge / tooltips)**
   - When an archetype has `flavorText`, show it in the badge tooltip (e.g. as the main description line).
   - Keep “why you earned it” (from strategies) as a second line; optionally use flavor text as the first line and strategy summary as fallback when flavor text is missing.

4. **Strategy/philosophy changes**
   - If you added or renamed strategies: update `archetypeStrategies.ts` and the generator’s display-name → ID map so the generator and detection stay in sync.
   - If only the **archetype list** and **flavor text** changed, no detection or weight changes are required.

---

## 3. Quick answers that unblock implementation

You can reply with something like:

1. **“Master file is `archetype_logic/archetype_master.xlsx` with sheets: `Archetypes`, `Detection`.”**
2. **“Archetypes sheet columns: `Name`, `RB`, `WR`, `QB`, `TE`, `Late`, `Flavor Text`.”**
3. **“Strategy names are unchanged”** or **“Changed: [list].”**
4. **“Flavor text is 1–2 sentences; use it as the main tooltip description.”**

With that, we can wire the generator to your master file and use flavor text everywhere it’s needed.

---

## 4. Current implementation notes (post-migration)

- **Master source:** `Fantasy_Football_Archetype_Master.xlsx - Master Archetypes.csv` (360 archetypes with flavor text). RB strategy **Hybrid** is supported (mix of RB+WR in first 6 rounds; detection uses round-scaling by league size).
- **The Improviser:** Optional 361st archetype (BPA + Robust WR + Mid QB + Stream TE + Floor), defined in code only. Used as a fallback when detection doesn’t match a named archetype. To have exactly 360 archetypes from the file, remove `THE_IMPROVISER` from `archetypeListWithImproviser.ts` and use `ARCHETYPE_LIST` instead of `FULL_ARCHETYPE_LIST` where appropriate.
- **Detection:** Strategy Logic (round-based with `adjusted_round = base_round × (12 / league_size)`) is used where applicable (e.g. Hybrid first-6-rounds window). Percentage-based rules remain for other strategies and as fallback when league size is outside 10–12.
- **Closest match for old drafts / CPU:** When displaying a completed draft (History, Badges, completion screen), archetype is always re-computed from picks and resolved to the closest match in the current list. Stored `user_detected_archetype` / `user_detected_archetype_index` are only used when picks are not available. CPU archetypes shown in History are also derived from that CPU’s picks, so they align with the current 360 list.
