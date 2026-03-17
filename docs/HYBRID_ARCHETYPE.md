# Hybrid Archetype — Detection and Philosophy

## What Hybrid is

Hybrid is an **intentional skill-position-first** drafting philosophy. The drafter enters the draft with a plan to alternate or mix RBs and WRs in the early rounds rather than committing heavily to one side. It is not random — it is a deliberate choice to build balanced skill position depth before addressing anything else.

## How it differs from other RB strategies

| Strategy    | Early-round behavior |
|------------|-----------------------|
| **Robust RB** | 3+ RBs by round 4 regardless of WRs. |
| **Hero RB**   | One elite RB in round 1, then pivot away. |
| **Zero RB**   | No RBs until round 7+. |
| **BPA**       | Follows the board with no positional agenda. |
| **Hybrid**    | Actively manages **both** RB and WR counts in the early rounds: neither neglected, neither dominant. |

Hybrid is the only strategy where the drafter is simultaneously balancing RB and WR in the opening window.

## Round 1–6 fingerprint (detection trigger)

- **Window:** First 6 picks (scaled by league size: `ceil(6 * leagueSize / 12)`).
- **Rules:**
  - At least **2 RBs** and at least **2 WRs** in that window.
  - Neither position accounts for **more than 4** of the 6 selections.

Examples:

- `RB-WR-RB-WR-RB-WR` → Hybrid (purest form).
- `RB-RB-WR-WR-RB-WR` → Hybrid.
- `RB-RB-RB-WR-RB-WR` → Not Hybrid (Robust RB territory).

## QB and TE in Hybrid

In a **pure** Hybrid execution, QB and TE are deferred; rounds 1–6 are for skill positions. However, if a QB or TE **falls significantly past consensus ADP** in those rounds, the Hybrid drafter takes him — value overrides the plan when the price is right. That is part of the philosophy, not a deviation.

- **Guardrail:** The player must have fallen **meaningfully** past where the room expected him (e.g. ADP 20 taken at pick 30), not “at value” (ADP 20 at pick 18).
- Detection today does not use ADP; early QB/TE in a Hybrid build is not yet distinguished from “planned” early QB/TE. A future enhancement can add an ADP condition for rounds 1–4.

## Roster shape

- Near **positional roster maximum** at both RB and WR.
- Typically **exactly 1 QB and 1 TE**, often with streaming in mind.
- K and DST in the final two rounds; punted QB usually 1–3 rounds before K/DST.

## WR Mid vs WR Late within Hybrid

- **WR Mid:** Slightly heavier on RBs in the first four rounds, then 2–3 WRs in a cluster in rounds 6–10.
- **WR Late:** WR compensation later (round 6+), with earlier rounds more RB-dominant within the mix.

Both are valid Hybrid variants; the WR strategy dimension captures the tilt.

## Hybrid vs BPA (ambiguity)

The hardest distinction is **Hybrid** vs **BPA** when the board happens to alternate RB/WR.

- **In practice:** If the **same user** shows RB+WR dominance in rounds 1–6 **repeatedly** across drafts, treat as Hybrid (intentional philosophy). If the distribution **varies draft-to-draft** with no consistent pattern, treat as BPA (board-driven).
- **Single-draft detection:** We use the round 1–6 fingerprint only. When it fits (2+ RB, 2+ WR, neither > 4), we classify as Hybrid; otherwise we fall through to BPA. Cross-draft consistency would require analysis of the user’s draft history and is not implemented in single-draft detection.
