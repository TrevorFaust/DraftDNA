/**
 * Generated from Master Archetypes CSV (or archetype_mapping) and optional detection.scaling_mapping.csv.
 * Do not edit by hand. Run: node scripts/generateArchetypeLogic.mjs
 */

import type { ArchetypeStrategies, RbStrategyId, WrStrategyId, QbStrategyId, TeStrategyId, LateStrategyId } from './archetypeStrategies';

export interface NamedArchetype {
  name: string;
  strategies: ArchetypeStrategies;
  /** 1–2 sentence description for tooltips and draft completion. */
  flavorText?: string;
}

export const ARCHETYPE_LIST: NamedArchetype[] = [
  {
    "name": "The Captain",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Pure best-player-available drafting, and the board just happened to deliver an early QB, a premium TE, and a wall of WRs. The Captain leads by example and the draft board set a very good example all night long. No agenda, no bias, just discipline from pick one to the final round."
  },
  {
    "name": "The Opportunist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Best player available every pick, which naturally produced an early QB, a premium TE, stacked WRs, and boom-or-bust upside late. The Opportunist follows the board wherever it leads and seizes every opening the room creates. The board led somewhere excellent. The Opportunist was ready."
  },
  {
    "name": "The Value GM",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available from start to finish, anchored by an early QB, a premium TE, and stacked WRs, with value-based drafting driving every late pick. The Value GM runs the most disciplined front office in the league: no ego, no agenda, just the ranked board. Every pick was optimal. The roster is the proof."
  },
  {
    "name": "The Calculated Risk",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "best player available drafting led naturally to an early QB, stacked WRs, a reliable mid-round TE, and a floor-first backend. The Calculated Risk knew the odds before every pick and only accepted risk when the value justified it. Every gamble was calculated. Every calculation was correct."
  },
  {
    "name": "The Cold Calculation",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, mid-round QB, streamed TE, and value-based drafting calculating the risk-adjusted return on every backend pick. The Cold Calculation ran the math: Zero RB at the right ADP, Hero WR at the right price, mid-round QB at value, and value-based drafting confirming every subsequent pick. The risk was calculated. The calculation was correct."
  },
  {
    "name": "The Free Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "No positional agenda, the board gave you an early QB, solid WRs, a mid-round TE, and upside all the way down. The Free Agent goes wherever the value is, with no loyalty to any single strategy or position group. The freedom to follow the board is the whole strategy."
  },
  {
    "name": "The Computer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Pure best player available every round: early QB, solid WRs, value TE, and value-based drafting driving the entire backend. The Computer processed the board and output the optimal roster without hesitation or second-guessing. There were no emotional picks. The Computer doesn't have emotions."
  },
  {
    "name": "The Scout Team",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Best player available at every turn, with the board delivering an early QB, strong WR depth, and a reliable bench. The Scout Team did the film work, studied every player, and executed the plan without a single deviation. Preparation plus discipline equals this roster."
  },
  {
    "name": "The Opportunist's Gambit",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available led to an early QB and stacked WRs, then you went after boom-or-bust picks every round after. The Opportunist's Gambit seized every value opening and then swung hard for the fences. Value in the foundation, ceiling in the roof, the complete package."
  },
  {
    "name": "The Evaluator",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available produced an early QB, stacked WRs, a streamed TE, and value-based drafting guiding every late pick without exception. The Evaluator rates every player the same way, objectively, without bias, without sentiment. The evaluation was correct. It always is."
  },
  {
    "name": "The Disciplined",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available produced a premium TE, strong WR depth, a late QB at tremendous value, and a reliable conservative bench. The Disciplined never reaches, never panics, and never pays more than a pick is worth. Fifteen rounds of discipline compounds into something very difficult to beat."
  },
  {
    "name": "The Pure Play",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available delivered a premium TE, stacked WRs, a late QB at incredible value, and upside picks late. The Pure Play is best player available in its most honest form, no strategy overlaid, no positional agenda imposed. The board ran the draft. The board did well."
  },
  {
    "name": "The Robot",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Best player available, premium TE, stacked WRs, late QB, and value-based drafting closing out the backend with zero emotional picks from start to finish. The Robot will be optimizing lineups in October while everyone else is still second-guessing August. There were no human decisions made in this draft. Only optimal ones."
  },
  {
    "name": "The Automaton",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with heavy Robust WR investment, QB fully punted, streamed TE, and value-based drafting running the backend with automated precision. The Automaton processed every available data point, confirmed the Zero RB directive, executed the QB punt on schedule, and output the optimal value-based drafting roster without a single deviation. No human decisions were made in this draft. Only optimal ones."
  },
  {
    "name": "The Stabilizer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "best player available gave you stacked WRs, a solid mid-round TE, a late QB at great value, and a reliable conservative bench. The Stabilizer keeps everything running smoothly through every storm the season can throw at it. It cannot be destabilized. That's the whole point."
  },
  {
    "name": "The Ballast",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available gave you a premium TE, a reliable mid-round QB, late WRs, and a dependable floor-first bench. The Ballast keeps the roster balanced and the floor elevated through every injury, bye week, and cold stretch. It cannot be shaken. It will not be moved."
  },
  {
    "name": "The Sleeper",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available produced stacked WRs and a patient QB strategy, then you chased upside picks all the way to the final round. The Sleeper is the team nobody remembers drafting until week 7, when everyone suddenly remembers it. It was hiding in plain sight the entire time."
  },
  {
    "name": "The Formula",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, stacked WRs, late QB at value, mid-round TE, and value-based drafting all the way to the final pick, a proven equation. The Formula has been backtested extensively and the results are consistently excellent. Trust the formula. The formula works."
  },
  {
    "name": "The Proof",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB anchored by a Hero WR, mid-round QB, mid-round TE, and value-based drafting driving every pick from round five onward. The Proof is the same equation as always, avoid the position with the highest injury rate and let the passing game do the heavy lifting. The math has not changed. It still works."
  },
  {
    "name": "The Scout",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Pure best player available, stacked WRs, late QB at tremendous value, stream TE, and a steady floor-first backend. The Scout did the homework long before the draft started and trusted it all the way through. The preparation is visible in every single pick."
  },
  {
    "name": "The Talent Evaluator",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB anchored by a workhorse back, Robust WR depth alongside it, mid-round QB, streamed TE, and value-based drafting precision late. The Talent Evaluator did the film work before the draft started and trusted it through every round. Every pick is defensible. The tape doesn't lie."
  },
  {
    "name": "The Value Hunter",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available, stacked WRs, late QB at maximum value, stream TE, and boom-or-bust picks filling the bench. The Value Hunter finds diamonds even in the final five rounds, every round is an opportunity. Every opportunity was seized."
  },
  {
    "name": "The Prospector",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB paired with a Hero WR, late QB taken at tremendous value, mid-round TE, and value-based drafting guiding the backend without exception. The Prospector finds the mispriced asset at every position and takes it before anyone else identifies the opportunity. The value was there. It always is."
  },
  {
    "name": "The Analyst",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available, stacked WRs, late QB at value, stream TE, and value-based drafting driving every single late pick. The Analyst turned the entire draft into a research project, and produced a research-grade roster. The findings were published in every selection."
  },
  {
    "name": "The Examiner",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, a late QB at maximum value, mid-round TE, and value-based drafting pulling the backend into shape. The Examiner ran the numbers on every position, every round, and produced a roster where every pick makes sense on paper. The analysis was thorough. The roster is the report."
  },
  {
    "name": "The Steady Hand",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Pure value drafting gave you a premium TE, solid WRs, a reliable mid-round QB, and steady dependable depth. The Steady Hand never flinched, never panicked, and never once deviated from the ranked list. This is what composure looks like across fifteen rounds."
  },
  {
    "name": "The Ironhand",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB paired with deep WR investment, a late QB taken at a discount, streamed TE, and floor-first depth throughout. The Ironhand built this team to survive the season without drama, no boom weeks required, no busts tolerated. Fifteen rounds of composure. The composure shows."
  },
  {
    "name": "The Market Timer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available produced a premium TE, stacked WRs, a QB grabbed at the perfect moment, and upside picks late. The Market Timer knew exactly when to pull the trigger at every position, the timing was impeccable. Patience plus preparation equals perfect execution."
  },
  {
    "name": "The Window Spotter",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB leading the way, WRs taken late and at value, late QB at a discount, mid-round TE, and value-based drafting as the closing philosophy. The Window Spotter knows when every position peaks in value and drafts accordingly, patience is the edge, timing is the weapon. Every trigger was pulled at the right moment."
  },
  {
    "name": "The Accountant",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available all the way, with a premium TE, stacked WRs, mid-round QB, and value-based drafting tracking every late pick. The Accountant ran the draft like a balance sheet, every pick measured against its replacement cost. The books are balanced. The roster is excellent."
  },
  {
    "name": "The Ledger",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside deep Robust WR investment, late QB at tremendous value, premium early TE, and value-based drafting tracking the backend. The Ledger tracked the cost basis on every pick. Zero RB as the value position, stacked WRs as the appreciating asset, late QB as the undervalued holding, and value-based drafting balancing the books. The books are clean."
  },
  {
    "name": "The Even Keel",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Pure value drafting created a balanced, reliable roster with no obvious weakness anywhere on the board. The Even Keel never panics, never overreacts, and never makes a pick it has to defend later. Because there is nothing to panic about."
  },
  {
    "name": "The Sleeper Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available produced stacked WRs and a reliable mid-round QB and TE, then you chased upside all the way down. The Sleeper Agent blends into the background completely, unnoticed and underestimated. Until October. Then everyone notices."
  },
  {
    "name": "The Neutral",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available from start to finish, mid-round QB and TE, stacked WRs, and value-based drafting driving every late pick. The Neutral has no agenda, no positional bias, and no emotional attachment to any strategy. Just the ranked list and the discipline to follow it."
  },
  {
    "name": "The Indexer",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "best player available produced stacked WRs, a reliable mid-round QB, a streamed TE, and a dependable conservative bench. The Indexer tracks the market and buys everything at fair value, no premiums, no discounts, no deviations. Fair value. Every single round."
  },
  {
    "name": "The Pivot",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available naturally built a WR-heavy team with a reliable mid-round QB, and then pivoted hard to upside late. The Pivot adapts to the board, always, and always finds a new angle worth exploiting. Flexibility is the strategy. The strategy is excellent."
  },
  {
    "name": "The Redirect",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available produced a premium TE and a mid-round QB, with WRs deferred, then you pivoted hard to upside late. The Redirect adapts to the board in real time and always finds a new angle that the room missed. The ability to change direction is the whole advantage."
  },
  {
    "name": "The Spreadsheet Classic",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Pure best player available, stacked WRs, mid-round QB, stream TE, and value-based drafting all the way to the final round. The Spreadsheet Classic is what happens when you trust the model completely and never deviate once. The model was right. The model is always right."
  },
  {
    "name": "The Safe Harbor",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available, premium TE, stacked WRs, punted QB, and a reliable dependable bench to anchor everything. The Safe Harbor is your port in a storm, stable, anchored, and impossible to rattle by midseason. When the season gets turbulent, this team holds course."
  },
  {
    "name": "The Chaos Agent",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available led to stacked WRs, a premium TE, a punted QB, and boom-or-bust picks filling the backend. The Chaos Agent followed the board wherever it went, and it went somewhere genuinely interesting. The chaos wasn't planned. It was discovered. And it's magnificent."
  },
  {
    "name": "The Actuarial",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available, premium TE, stacked WRs, punted QB, and value-based drafting all the way to the final pick. The Actuarial calculated the expected value of punting QB versus drafting one early, and the math supported the decision. It was a data-driven conclusion. The data was correct."
  },
  {
    "name": "The Underwriter",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with a Hero WR riding alongside it, full QB punt, premium early TE, and value-based drafting extracting every available drop of value late. The Underwriter ran the probability tables on every possible build and determined this combination produces the best expected outcomes. The actuary's table doesn't care about feelings. Just frequency."
  },
  {
    "name": "The Minimalist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "best player available, stacked WRs, mid-round TE, punted QB, and a lean reliable backend with no wasted spots. The Minimalist cut everything that isn't essential and built a clean, functional, no-nonsense roster. Less is more, especially at quarterback."
  },
  {
    "name": "The Spartan Draft",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with heavy Robust WR depth, QB punt, mid-round TE, and a floor-first backend stripped to the essentials. The Spartan Draft removes every non-essential from the draft strategy. Zero RB is the essential starting point, stacked WRs are the essential asset, and the floor-first backend is the essential safety margin. Minimal. Essential. Correct."
  },
  {
    "name": "The Pure Opportunist",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available produced stacked WRs and a mid-round TE, then you punted QB and took shots on upside everywhere. The Pure Opportunist seizes every opening the board presents without hesitation or second-guessing. Every round had an opportunity. Every opportunity was captured."
  },
  {
    "name": "The Algorithm",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, stacked WRs, mid-round TE, punted QB, and value-based drafting driving every remaining pick, zero human error. The Algorithm doesn't need intuition, hunches, or gut feelings. It has a ranked list. The ranked list was followed to the letter."
  },
  {
    "name": "The Cipher",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with deep Robust WR investment, QB fully punted, mid-round TE, and value-based drafting running the backend with algorithmic precision. The Cipher processed every pick through the Zero RB model, confirmed the value-based outputs at every position, and executed without emotional interference from start to finish. The algorithm ran correctly. The roster is the output."
  },
  {
    "name": "The Monk",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "best player available, stacked WRs, punted QB, stream TE, and a steady conservative bench built with complete calm. The Monk is devoted to the process and the process alone, no deviations, no compromises, no noise. The process was followed. The results will follow."
  },
  {
    "name": "The Ascetic",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB paired with a Hero WR, full QB punt accepted, premium early TE investment, and a floor-first conservative backend. The Ascetic drafts without ego, without noise, and without the temptation to overcomplicate what already works. Silence and discipline. The roster reflects both."
  },
  {
    "name": "The Iconoclast",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available led to stacked WRs, punted QB, stream TE, and boom-or-bust picks, all by pure board logic. The Iconoclast breaks convention without even trying, the board just took it somewhere unconventional. The result is unorthodox. The process was pure."
  },
  {
    "name": "The Heretic",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR running alongside it, QB punted entirely, premium early TE, and boom-or-bust upside picks filling the backend. The Heretic rejects every convention that doesn't make mathematical sense and builds the team the field is too timid to draft. Convention is overrated. The ceiling is not."
  },
  {
    "name": "The Spartan Analyst",
    "strategies": {
      "rb": "bpa",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available, stacked WRs, punted QB, stream TE, and value-based drafting all the way to the final pick without a single detour. The Spartan Analyst is lean, efficient, completely unemotional, and mathematically correct at every turn. The ranked list was the only voice in the draft room."
  },
  {
    "name": "The Commander in Chief",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available naturally delivered an early QB and a premium TE before WRs entered the picture, then a reliable floor-first bench. The Commander in Chief runs the most organized operation in the league, with premium picks at the two positions that matter most. This is the draft of someone who walked in with a hierarchy and executed it perfectly."
  },
  {
    "name": "The Dispatch",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with late WRs, early QB priority, streamed TE, and value-based drafting providing direction through every backend round. The Dispatch runs the draft room with authority, every pick serves the roster strategy, no exceptions made, no deviations tolerated. The command was total. The roster reflects it."
  },
  {
    "name": "The Field General",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available gave you an early QB, a premium TE, late WRs, and boom-or-bust upside picks filling the bench. The Field General commands from the most important positions on the field and dares everything else to keep up. Premium at QB and TE, ceiling everywhere else."
  },
  {
    "name": "The Commanding Officer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with WRs taken late, early QB locked in, streamed TE, and a floor-first backend built for durability. The Commanding Officer commands the roster from the front, sets the tone with the RB anchor, and keeps every position group disciplined. The general leads from the top. The roster follows."
  },
  {
    "name": "The Strategist",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available, early QB, premium TE, late WRs, and value-based drafting driving every pick from round 5 onward. The Strategist sees three moves ahead and executes each one before the rest of the room catches on. This draft was pre-planned, the plan was excellent, and it was followed exactly."
  },
  {
    "name": "The Planner",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with late WRs, early QB secured, mid-round TE, and value-based drafting closing out the backend. The Planner mapped the draft before the first pick and executed a plan that balanced every position group without compromise. The board was a chessboard. Every move was calculated."
  },
  {
    "name": "The Even Hand",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Pure best player available gave you an early QB, a reliable mid-round TE, late WRs, and a floor-first steady bench. The Even Hand never shows favoritism, not to positions, not to players, not to trends. The board was the only deciding voice."
  },
  {
    "name": "The Opportunist's Mirror",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available produced an early QB and a mid-round TE. WRs were deferred late, then upside picks all the way down. The Opportunist's Mirror reflects the board back at you with no filter and no preconceptions. The board said this was the right draft. The board was right."
  },
  {
    "name": "The Systems Thinker",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, early QB, value TE, late WRs, and value-based drafting late, every pick part of a larger interconnected system. The Systems Thinker sees how each selection affects every other selection on the roster. The system works. It always works."
  },
  {
    "name": "The Deliberate",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Pure best player available, early QB, stream TE, late WRs, and a reliable floor-first bench, not a single rushed pick. The Deliberate took its time at every selection and never made a hasty or reactionary decision. Every pick was considered. Every pick was correct."
  },
  {
    "name": "The Open Field",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available led to an early QB, stream TE, late WRs, and boom-or-bust picks attacking from every angle. The Open Field found space the rest of the room missed, every single round, without fail. There is always an open receiver if you know where to look."
  },
  {
    "name": "The Draft Engine",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available, early QB, stream TE, late WRs, and value-based drafting driving every pick, a perpetual motion machine of value. The Draft Engine never stalls, never misfires, and never wastes a selection. It ran all fifteen rounds without a single hiccup."
  },
  {
    "name": "The Quiet Storm",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available produced a premium TE, late QB at great value, late WRs, and a dependable floor-first bench. The Quiet Storm doesn't announce itself in August, it just keeps winning quietly until October when everyone notices. It was coming the whole time."
  },
  {
    "name": "The Grinding Stone",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with a Hero WR anchor, QB fully punted, mid-round TE, and a floor-first backend built to grind through the entire schedule. The Grinding Stone doesn't need a splash moment, it accumulates quietly and is difficult to beat by week twelve. Nobody sees it coming until it's too late."
  },
  {
    "name": "The Maverick's Twin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available gave you a premium TE, a late QB at tremendous value, late WRs, and boom-or-bust picks late. The Maverick's Twin plays by entirely different rules and still arrives at the same destination, a strong roster. Same destination, completely different route."
  },
  {
    "name": "The Logician",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available, premium TE, late QB at maximum value, late WRs, and value-based drafting all the way to the final pick. The Logician can defend every single selection with cold, hard data and does not apologize for a single one. The logic is airtight. The roster reflects that."
  },
  {
    "name": "The Rationalist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at tremendous value, streamed TE, and value-based drafting conducting a precise logical analysis at every backend pick. The Rationalist identifies the Zero RB thesis as the most defensible strategic position in fantasy and applies formal logic to every subsequent selection, the late QB is the next logical step, and value-based drafting is the proof of concept. The logic was sound."
  },
  {
    "name": "The Pragmatist",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "best player available gave you a value TE, a late QB, late WRs, and a reliable floor-first bench that never lets you down. The Pragmatist does what works, not what's exciting, and what works is building a dependable roster. Every pick served a purpose."
  },
  {
    "name": "The Measured",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at a discount, streamed TE, and a floor-first backend built on pragmatic selection principles. The Measured makes the most defensible picks without requiring them to be exciting. Zero RB is the pragmatic stance on RB scarcity, late QB is the pragmatic value find, and the floor-first backend is the pragmatic finish. Practical. Correct."
  },
  {
    "name": "The Free Thinker",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available, mid-round TE, late QB at value, late WRs, and boom-or-bust picks filling the entire bench. The Free Thinker doesn't follow a strategy, it builds one from scratch every single draft. The result is always original and usually excellent."
  },
  {
    "name": "The Cold Eye",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, mid-round TE, late QB at maximum value, late WRs, and value-based drafting driving every remaining pick. The Cold Eye sees the board with total clarity, no emotion, no sentiment, no clouded judgment. This is what objectivity looks like across fifteen rounds."
  },
  {
    "name": "The Dispassionate",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside a Hero WR, QB punt accepted, premium early TE, and value-based drafting building a cold, analytical backend. The Dispassionate views the draft without sentiment. Zero RB is the logical stance, QB punt is the value maximization, premium TE is the positional edge, and value-based drafting confirms every pick was correct. No emotion. Only analysis."
  },
  {
    "name": "The Disciplined Pro",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "best player available, stream TE, late QB at tremendous value, late WRs, and a dependable floor-first bench. The Disciplined Pro has been burned by flashy rosters before and builds exclusively for reliability. Experience turned into discipline. Discipline turned into this roster."
  },
  {
    "name": "The Stoic",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available, stream TE, late QB, late WRs, and boom-or-bust picks, drafted without a single flinch or second guess. The Stoic approached the entire draft with complete emotional detachment and zero outcome anxiety. The picks are made. The process was sound. Whatever happens next was always going to happen."
  },
  {
    "name": "The Unflinching",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt committed, streamed TE, and a floor-first backend. The Unflinching accepts every uncomfortable trade-off. Zero RB, punted QB, no TE premium, without flinching and builds a floor-first backend that holds together regardless of the circumstances. Stoic in approach. Steady in production."
  },
  {
    "name": "The Pure BPA",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Best player available every single pick, late QB, stream TE, late WRs, value-based drafting late, the platonic ideal of the strategy. The Pure best player available is the most honest possible approach to fantasy drafting: trust the ranked list, always. There was no other voice in the room."
  },
  {
    "name": "The Long Game",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available, premium TE, mid-round QB at value, late WRs, and value-based drafting all the way to the final pick. The Long Game isn't worried about week 1, it's worried about week 14, when the field is thinned and this roster peaks. Patience is the entire strategy. The patience was real."
  },
  {
    "name": "The Marathon",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at value, mid-round TE, and value-based drafting playing the long game through the entire backend. The Marathon is not designed for week three, the late QB is a value investment that compounds, the Hero WR is the steady asset, and value-based drafting makes every backend pick a long-term holding. The game is long. This team finishes it."
  },
  {
    "name": "The Contrarian's Cousin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Pure best player available, mid-round QB and TE, late WRs, and a conservative floor-first bench with no unnecessary risk. The Contrarian's Cousin goes against the grain quietly, no announcements, no explanations needed. The board led here and the board is not wrong."
  },
  {
    "name": "The Underdog",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available produced a reliable mid-round QB and TE. WRs deferred, then boom-or-bust picks everywhere late. The Underdog was counted out in the draft room. They will remember that feeling around week 8. It was assembled quietly and it is going to cause problems."
  },
  {
    "name": "The Arbitrage",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, mid-round QB and TE at value, late WRs, and value-based drafting finding price discrepancies all the way down. The Arbitrage finds the spread between price and value and profits from every single one. The inefficiencies were real. They were all exploited."
  },
  {
    "name": "The Workhorse's Cousin",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "best player available gave you a mid-round QB, stream TE, late WRs, and a reliable dependable bench. The Workhorse's Cousin works just as hard as the Workhorse, with a slightly more flexible origin story. It shows up every week. That's the whole job."
  },
  {
    "name": "The Dark Horse",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available, mid-round QB, stream TE, late WRs, and high-ceiling boom-or-bust picks filling the backend. The Dark Horse isn't on anyone's preseason radar, which is precisely how this drafter planned it. Being underestimated is a competitive advantage."
  },
  {
    "name": "The Longshot Contender",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, late QB at value, premium early TE investment, and upside picks swinging for the fences late. The Longshot Contender is the team nobody picked in the preseason preview but is somehow leading the league by October. The shadow was deliberate. So was the roster."
  },
  {
    "name": "The Smart Money",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available, mid-round QB on value, stream TE, late WRs, and value-based drafting all the way to the final pick. The Smart Money knows something the rest of the room doesn't, and bet accordingly at every turn. The market was mispriced. This drafter noticed first."
  },
  {
    "name": "The Informed Edge",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB paired with a Hero WR, late QB taken at great value, streamed TE, and value-based drafting tracking every late-round pick. The Informed Edge identifies inefficiencies in the draft room and exploits them systematically from start to finish. The edge isn't luck. It's process."
  },
  {
    "name": "The Steady Maverick",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "best player available gave you a premium TE, punted QB, late WRs, and a steady reliable bench with a high floor. The Steady Maverick is unconventional at the top of the draft, and completely responsible everywhere else. Bold where it counts, reliable where it must be."
  },
  {
    "name": "The Maverick",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "best player available led to a premium TE, punted QB entirely, late WRs, and boom-or-bust picks all the way down. The Maverick follows the board wherever it goes, even when it goes somewhere nobody else would follow. The board led here. The Maverick had no hesitation."
  },
  {
    "name": "The Outlier",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with full WR investment, late QB at real value, premium early TE, and boom-or-bust upside swinging through the backend. The Outlier takes the path nobody else is walking and trusts the conviction all the way to the final round. Unconventional was the point. Upside was the reward."
  },
  {
    "name": "The Data Driven",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "best player available, premium TE, punted QB, late WRs, and value-based drafting all the way to the final pick, the data made every call. The Data Driven let the numbers make every single decision and never once overrode the signal. The data was consulted. The data was correct."
  },
  {
    "name": "The Controlled Burn",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "best player available, mid-round TE, punted QB, late WRs, and a reliable floor-first bench with no unnecessary risk. The Controlled Burn eliminates the deadwood without burning down the whole forest. Careful, deliberate, and surprisingly effective."
  },
  {
    "name": "The Wildcard",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "best player available led to a punted QB, mid-round TE, late WRs, and boom-or-bust picks that nobody in the room predicted. The Wildcard is impossible to game-plan against because nobody knows what card is coming next. Including, possibly, this drafter."
  },
  {
    "name": "The Quant",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "best player available, mid-round TE, punted QB, late WRs, and value-based drafting all the way down, the quantitative approach in its purest form. The Quant ran the regression, found punt QB to be the correct output, and acted on it without hesitation. The math was done. The math was right."
  },
  {
    "name": "The Modeler",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside deep Robust WR investment, QB fully punted, premium early TE, and value-based drafting quantifying every unit of value from the backend. The Modeler ran the models before the draft, confirmed the Zero RB and premium TE thesis with the data, punted QB as the model suggested, and used value-based drafting to validate every pick from round five on. The model was correct."
  },
  {
    "name": "The Minimalist Pro",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "best player available, punted QB, stream TE, late WRs, and a lean reliable backend, everything unnecessary was cut. The Minimalist Pro is efficient by nature, not by effort, the simplest approach that still works. Less is more. This roster is proof."
  },
  {
    "name": "The Free Spirit",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "best player available, punted QB, stream TE, late WRs, and boom-or-bust picks everywhere late, no rules, no agenda. The Free Spirit goes wherever the vibes take them, and the vibes apparently led somewhere with real upside. No plan. Great result. That's the spirit."
  },
  {
    "name": "The Pure Value",
    "strategies": {
      "rb": "bpa",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "best player available, punted QB, stream TE, late WRs, and value-based drafting driving every remaining pick without exception. The Pure Value doesn't draft, it harvests, round after round, extracting maximum value from minimum investment. The harvest was excellent."
  },
  {
    "name": "The Empire",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Elite RB anchor, WRs stacked, early QB, premium TE, and a conservative dependable bench. The Empire is built to dominate sustainably, methodically, without unnecessary risk, and without apology. It's not exciting. It's relentless. Those things are not the same."
  },
  {
    "name": "The Franchise",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "A top-tier RB, a wall of WRs, an early QB, and a premium TE, four pillars secured in four rounds. The Franchise built a roster that looks like a dynasty waiting to happen and swings for the fences late. Premium assets at every position. This is what a franchise looks like."
  },
  {
    "name": "The Dynasty",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "You locked up premium picks at every position and let pure value guide every remaining pick all the way down. The Dynasty is the draft that future leagues will measure themselves against, the benchmark everyone chases. It is exactly that good."
  },
  {
    "name": "The Ironclad Plan",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB anchored early, stacked WR depth alongside it, early QB secured, mid-round TE, and a floor-first backend to close. The Ironclad Plan was written before the draft started and executed without a single line crossed out. There are no question marks on this roster. That was the whole plan."
  },
  {
    "name": "The Power Broker",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB leading the way, heavy WR investment built around it, early QB locked in, mid-round TE, and boom-or-bust upside late. The Power Broker makes big commitments early and dares the rest of the league to match them. Bold picks. Bigger expectations."
  },
  {
    "name": "The Freight Train",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth with WRs added late, early QB locked in, mid-round TE, and a floor-first backend. The Freight Train with a Robust RB approach locks up the ground game and the signal-caller simultaneously, the broker made two big deals before anyone else at the table was ready. The deals were made. The roster reflects them."
  },
  {
    "name": "The Executive Suite",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, early QB, mid-round TE, and value-based drafting running the entire backend operation with precision. The Executive Suite runs the most efficient front office in the league, every pick was a trade up in value, every round an opportunity captured. The suite doesn't make bad deals."
  },
  {
    "name": "The General",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB paired with deep WR investment, early QB priority, streamed TE, and a floor-first backend that refuses to crack. The General doesn't leave the backfield position to chance, anchor it early, stack the receiving corps, and manage the rest. The plan was simple. It worked."
  },
  {
    "name": "The Bold Franchise",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with stacked WRs, early QB on board, streamed TE, and boom-or-bust upside picks occupying every backend slot. The Bold Franchise commits fully to the high-variance path and believes the ceiling is worth every risk taken to get there. The franchise bet on upside. The franchise usually wins."
  },
  {
    "name": "The War Room",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB alongside deep WR stacking, early QB secured, streamed TE, and value-based drafting extracting value through every remaining round. The War Room analyzed every available option before each pick and chose the most defensible one every single time. The analysis was thorough. The room produced results."
  },
  {
    "name": "The Stronghold",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB anchored at the top, heavy WR depth behind it, late QB at excellent value, premium early TE investment, and a floor-first close. The Stronghold was built to withstand pressure from every direction, every position group has depth, every weakness has a contingency. Fortifications complete."
  },
  {
    "name": "The Librarian",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, late QB taken at value, early TE premium, and value-based drafting methodically tracking every late pick. The Librarian has read every research paper on draft theory and applied the findings to every single selection. Every pick is catalogued. Every outcome is expected."
  },
  {
    "name": "The Veteran",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with deep WR investment, late QB at value, mid-round TE, and a floor-first backend built for a long season. The Veteran has been here before, knows which spots to target, which positions to avoid reaching for, and how to build depth without flinching. Experience drafted this team."
  },
  {
    "name": "The Upside Seeker",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside heavy WR investment, late QB at excellent value, mid-round TE, and upside picks swinging for the fences late. The Upside Seeker found the RB anchor first, stacked the WRs, grabbed the QB late at a discount, and spent the rest of the draft on lottery tickets. The ceiling is real. So is the risk."
  },
  {
    "name": "The Bold",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with stacked WRs, late QB at tremendous value, streamed TE, and boom-or-bust picks filling the entire backend. The Bold commits to the big-swing philosophy and accepts that the outcome will be memorable either way. There is no floor here. Only ceiling."
  },
  {
    "name": "The Methodical",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with deep WR depth, late QB grabbed at real value, streamed TE, and value-based drafting driving every remaining selection. The Methodical builds slowly, deliberately, and without a wasted pick from the first round to the last. The method is boring. The results are not."
  },
  {
    "name": "The TE Hoarder",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with full WR investment, mid-round QB, premium early TE, and a floor-first backend designed for reliability above all else. The TE Hoarder saw the early TE as non-negotiable and built the rest of the team around that anchor. Two premium positions locked in. The floor is very high."
  },
  {
    "name": "The Hero",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside heavy WRs, mid-round QB, premium early TE, and boom-or-bust upside picks in every backend slot. The Hero has a clear identity, the RB carries the team, the TE holds the corner, and the WRs light up the scoreboard on the big weeks. It's a starring role. The hero is ready."
  },
  {
    "name": "The Stack Master",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, mid-round QB, early TE premium, and value-based drafting closing out the backend without deviation. The Stack Master builds layers, the RB is the foundation, the WRs are the walls, and value-based drafting is the roof that holds the whole structure together. Masterfully stacked."
  },
  {
    "name": "The Bulwark",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB paired with deep WR investment, mid-round QB, mid-round TE, and a floor-first backend with no weak links. The Bulwark is immovable, there is no lineup slot that can't produce, no roster spot that was wasted, no week where this team is a pushover. Built to not break."
  },
  {
    "name": "The Complete Package",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with full WR depth, mid-round QB, mid-round TE, and boom-or-bust upside picks closing out the backend. The Complete Package has everything the lineup needs, the ground game, the air game, and enough upside in the backend to make a deep run. This team does it all."
  },
  {
    "name": "The Fundamentalist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, mid-round QB, mid-round TE, and value-based drafting as the operating principle from round six to the end. The Fundamentalist believes in the fundamentals of draft theory and refuses to deviate regardless of what the room is doing. The fundamentals held. They always do."
  },
  {
    "name": "The Conservative",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB alongside heavy WR investment, mid-round QB, streamed TE, and a floor-first backend that plays it safe every week. The Conservative knows that the safest roster is the one still in contention in week fourteen. No fireworks. Just wins."
  },
  {
    "name": "The Cautious",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB strategy with a Hero WR, mid-round QB, early premium TE, and a floor-first backend. The Cautious chose the Zero RB path with all three major positions managed carefully, mid-round QB at value, premium TE, and a floor-first backend that holds position every week. Conservative. Correct."
  },
  {
    "name": "The Air Raid Classic",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with deep WR stacking, mid-round QB, streamed TE, and boom-or-bust upside picks throughout the entire backend. The Air Raid Classic runs it through the air at every position except the backfield, the Hero RB is the anchor, everything else is a target. The ball is in the air. Catch it."
  },
  {
    "name": "The Air Raid Zero",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, mid-round QB, streamed TE, and boom-or-bust upside picks running the air raid through the backend. The Air Raid Zero runs the same play every year, stack WRs, grab the QB in the middle rounds, skip the RBs entirely, and swing for the ceiling late. Classic play. Classic result."
  },
  {
    "name": "The Reliable",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with heavy WR investment, QB punted entirely, premium early TE locked in, and a floor-first backend to close. The Reliable built this team to produce every single week regardless of matchup, weather, or circumstance. The floor is high enough that the ceiling doesn't need to be."
  },
  {
    "name": "The Wildcatter",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside stacked WRs, QB punt accepted, premium early TE, and boom-or-bust upside picks filling the backend. The Wildcatter drills deep into every round looking for the reservoir of value nobody else found. Some wells hit. The wildcatter drills anyway."
  },
  {
    "name": "The Systematic",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with deep WR investment, QB fully punted, early TE premium, and value-based drafting tracking the backend with mathematical precision. The Systematic built a process and followed it, the Hero RB was the cornerstone, the TE the second premium, and value-based drafting the blueprint for every remaining selection. The system produced results."
  },
  {
    "name": "The Enduring",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with stacked WRs, QB punted for maximum value elsewhere, mid-round TE, and a floor-first backend built to last. The Enduring endures, the punted QB position is a discomfort accepted, the floor-first backend is a philosophy adopted, and the team is built to survive every variance the season produces. Endurance is the strategy."
  },
  {
    "name": "The Gambit",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB paired with heavy WR depth, QB punt accepted, mid-round TE, and upside picks swinging hard through the backend. The Gambit sacrifices the quarterback position to load up everywhere else and bets that the swing picks in the backend pay off at the right moment. The gambit is set. Now wait."
  },
  {
    "name": "The Methodist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with stacked WRs, QB punted, mid-round TE, and value-based drafting executing every backend pick with the precision of a denomination register. The Methodist follows the doctrine: Hero RB first, WRs stacked behind it, QB punted for maximum value at other positions, value-based drafting closing the sermon. Amen."
  },
  {
    "name": "The Blue Collar",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB anchored early, deep WR investment behind it, QB punted completely, streamed TE, and a floor-first backend built on grit. The Blue Collar punts the glamour position and builds the roster on the players who show up every week and do their job. No stars required. Just production."
  },
  {
    "name": "The Lone Wolf",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with full WR investment, QB punt, streamed TE, and boom-or-bust upside picks taking swings all the way through the backend. The Lone Wolf operates without the QB crutch, trusts the RB anchor, and swings for ceiling in every remaining selection. Solo operation. Maximum range."
  },
  {
    "name": "The Spartan General",
    "strategies": {
      "rb": "hero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB alongside heavy WRs, QB fully punted, streamed TE, and value-based drafting extracting every unit of value from the backend. The Spartan General commands without excess, the QB position is a sacrifice, the WRs are the army, and value-based drafting is the battle plan. Discipline. Precision. Victory."
  },
  {
    "name": "The Sure Thing",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with WRs taken late across the board, early QB priority established, premium early TE investment, and a floor-first backend. The Sure Thing builds around certainties, the elite RB, the premium TE, the reliable QB, and lets the late WRs add depth behind it. Certain foundation. Solid structure."
  },
  {
    "name": "The Certainty",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with late WRs, late QB at excellent value, premium early TE, and a floor-first backend. The Certainty anchors both skill positions, the Robust RB room and the premium TE, and gets the QB at tremendous value late. Two sure things locked in. The late QB was the third."
  },
  {
    "name": "The Luxury Tax",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs taken at value, early QB locked in, premium early TE, and boom-or-bust upside filling the backend. The Luxury Tax pays a premium for the RB, the QB, and the TE, then collects upside at a discount in the backend rounds. Premium inputs. Explosive potential output."
  },
  {
    "name": "The Balance Sheet",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with late WRs at value, early QB, premium early TE, and value-based drafting tracking every backend selection. The Balance Sheet runs every pick through a cost-benefit analysis and ensures the value column always wins. Every asset was purchased below market. The books prove it."
  },
  {
    "name": "The Blueprint",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with WRs taken late, early QB secured, mid-round TE, and a floor-first backend built for consistent production. The Blueprint was drawn before the first pick and followed without revision, the Hero RB is the load-bearing wall, everything else is built to spec. Plans don't deviate. Neither did this draft."
  },
  {
    "name": "The Schematic",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB strategy committed, heavy Robust WR investment built alongside it, early QB locked in, premium early TE, and a floor-first backend. The Schematic was drawn before the first pick and followed without a single revision. Zero RB as the architecture, early QB and TE as the load-bearing walls, and a floor-first backend as the foundation. Plans don't deviate. Neither did this draft."
  },
  {
    "name": "The Signal Caller",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside late WRs, early QB locked in, mid-round TE, and boom-or-bust upside picks filling the backend. The Signal Caller has a clear chain of command, the QB sets the tone, the RB carries the ground game, and the backend swings for the big play. The signal was sent. The backend received it."
  },
  {
    "name": "The Franchise QB",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with WRs taken late, early QB on the board, streamed TE, and boom-or-bust upside picks through every backend round. The Franchise QB built around the signal-caller first and stacked the skill positions behind the arm talent. The franchise believes in the QB. The QB had better deliver."
  },
  {
    "name": "The Immovable Object",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, late QB at real value, premium early TE, and a floor-first backend that refuses to give anything away. The Immovable Object cannot be dislodged, every lineup slot produces, every week is covered, and the roster generates points even when everything else in the league is broken. Unmovable. Unstoppable."
  },
  {
    "name": "The Cornerstone",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB paired with late WRs, late QB at value, premium early TE, and boom-or-bust upside picks through the backend. The Cornerstone stakes the entire structure on two premium investments and builds the rest with ceiling-chasing picks at value. The cornerstone is set. The ceiling is wherever the picks land."
  },
  {
    "name": "The Load Bearing",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth anchored alongside a Hero WR, mid-round QB, premium early TE, and a floor-first backend. The Load Bearing stakes the structure on three premium positions, the Robust RBs, the WR, and the TE, and builds reliable floor around them. Three cornerstones. Unshakeable structure."
  },
  {
    "name": "The Value Engineer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with late WRs, late QB taken at maximum value, early TE premium, and value-based drafting tracking the entire backend. The Value Engineer identifies inefficiency in every round and corrects it with the most defensible pick available. Every selection was engineered. Every value gap was closed."
  },
  {
    "name": "The Reliable Duo",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB paired with late WRs, late QB at a discount, mid-round TE, and a floor-first backend with reliable depth throughout. The Reliable Duo is exactly what the name says, the RB and TE are locked in every week, the rest fills in around them, and the team wins more than it loses. Reliability is repeatable."
  },
  {
    "name": "The Twin Pillars",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with a Hero WR, late QB at value, streamed TE, and a floor-first backend built for consistent weekly output. The Twin Pillars version two is still built around two reliable anchors, the Robust RB depth and the Hero WR, with everything else managed efficiently at value. The duo is different. The reliability is not."
  },
  {
    "name": "The Late Bloomer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs taken at value, late QB, mid-round TE, and boom-or-bust upside picks going deep in the backend. The Late Bloomer builds for the second half of the season, the late picks get cheaper and more explosive as the draft progresses, and this team is built to peak at the right time. The bloom is coming."
  },
  {
    "name": "The Second Wind",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside a Hero WR, late QB at great value, streamed TE, and boom-or-bust upside picks timing the backend for a late surge. The Second Wind with a Robust RB foundation has more ground-game security than its namesake, the RB depth provides the floor while the upside backend schedules the bloom. Two anchors. One bloom."
  },
  {
    "name": "The Hard Hat",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, late QB at a discount, streamed TE, and a floor-first backend filled with reliable depth. The Hard Hat clocks in every week and produces without complaint, no flashy moments, no fantasy headlines, just points in the box score and wins on the schedule. Clock in. Clock out. Win."
  },
  {
    "name": "The Steel Toed",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth with late WRs, late QB at a discount, mid-round TE, and a floor-first backend built on grind-ready reliability. The Steel Toed with Robust RB depth clocks in twice every week, once from the backfield and once from the WR corps, and produces without asking for recognition. Clock in. Clock out. Win."
  },
  {
    "name": "The Bet Hedger",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside late WRs, late QB at value, streamed TE, and boom-or-bust upside picks hedging the entire backend. The Bet Hedger diversifies the risk, the RB anchors, the QB comes cheap, and every backend pick is a different kind of lottery ticket. The hedge is on. Multiple ways to win."
  },
  {
    "name": "The Mileage",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with late WRs, late QB at maximum value, streamed TE, and value-based drafting executing the backend with total discipline. The Mileage logs every pick at positive expected value and runs the season the same way, efficiently, without waste, and with the depth to cover every lineup emergency. High mileage. Low friction."
  },
  {
    "name": "The Fortress Wall",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB alongside late WRs, mid-round QB, premium early TE, and a floor-first backend that won't surrender an easy week. The Fortress Wall combines the Hero RB anchor with a premium TE and lets the mid-round QB hold the line in between. Multiple walls. No gaps."
  },
  {
    "name": "The Thunder",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs, mid-round QB, premium early TE, and boom-or-bust upside picks thundering through every backend round. The Thunder rolls early with the Hero RB and TE investments, then strikes hard with every backend swing pick. The ground shakes before the lightning lands."
  },
  {
    "name": "The Return on Investment",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with late WRs, mid-round QB, early TE premium, and value-based drafting generating positive returns through every backend selection. The Return on Investment treats every draft pick as a capital allocation, the Hero RB is the core position, the TE is the alternative asset, and value-based drafting tracks the portfolio. The ROI is positive."
  },
  {
    "name": "The Old School",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, mid-round QB, mid-round TE, and a floor-first backend that plays for the long game. The Old School doesn't need the analytics era to tell it what works. Hero RB, stacked depth, manageable QB cost, and a team that shows up every week. Old school still wins."
  },
  {
    "name": "The Backfield Boss",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs, mid-round QB, mid-round TE, and boom-or-bust upside picks all through the backend. The Backfield Boss establishes ground dominance in round one and builds the aerial attack in the backend with maximum swing picks. The backfield runs it. The boss calls the plays."
  },
  {
    "name": "The Classicist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB alongside late WRs, mid-round QB, mid-round TE, and value-based drafting running the backend operation without deviation. The Classicist builds the roster the way it has always been built. Hero RB at the top, WRs underneath, QB and TE at value, and value-based drafting closing every round. Classic. Still works."
  },
  {
    "name": "The Traditionalist",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, mid-round QB, streamed TE, and a floor-first backend built around reliable depth at every spot. The Traditionalist doesn't need to experiment, the Hero RB philosophy has been producing winning teams for decades and the backend confirms every traditional wisdom. Tradition holds."
  },
  {
    "name": "The Ground & Pound",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs, mid-round QB, streamed TE, and boom-or-bust upside picks filling every backend slot. The Ground & Pound establishes the run game early and then attacks with high-ceiling picks through the rest of the draft. Pound the ground. Punch the upside."
  },
  {
    "name": "The Arbitrageur",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with late WRs, mid-round QB, streamed TE, and value-based drafting arbitraging value differentials through every backend pick. The Arbitrageur identifies price discrepancies between actual value and draft cost at every position and corrects them every single round. The spread was favorable. Every time."
  },
  {
    "name": "The Iron Curtain",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, QB fully punted, premium early TE, and a floor-first backend that refuses to give ground. The Iron Curtain drops at the RB and TE positions and dares the rest of the draft room to score. Impenetrable in the trenches. Uncompromising in the backend."
  },
  {
    "name": "The Brute Force",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside late WRs, QB punt accepted, premium early TE, and boom-or-bust upside picks crashing through the backend. The Brute Force drafts without subtlety: Hero RB, premium TE, punt the QB, and swing hard on every remaining selection. Blunt. Direct. Dangerous."
  },
  {
    "name": "The Sledgehammer",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with late WRs, QB fully punted, premium early TE, and value-based drafting driving every backend pick with maximum efficiency. The Sledgehammer hits the same spot every round, the most defensible value available, and builds a roster that's harder to beat than it is to build. The hammer dropped. The draft ended."
  },
  {
    "name": "The Workhorse",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Hero RB anchored at the top, late WRs taken at value, QB punt accepted, mid-round TE, and a floor-first backend. The Workhorse builds around the player who touches the ball the most and stacks reliable depth behind it. Every week is a grind. The workhorse is built for it."
  },
  {
    "name": "The Ground Game",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Hero RB with late WRs, QB fully punted, mid-round TE, and boom-or-bust upside picks filling every backend slot. The Ground Game is exactly what it says, establish the run, stack the upside, and let the backend swings decide the championship. The ground was established. The swings are loaded."
  },
  {
    "name": "The Run First",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB paired with late WRs, QB punted completely, mid-round TE, and value-based drafting extracting maximum value through the backend. The Run First commits to the ground game as the draft identity and executes value-based drafting with the same discipline it uses to select running backs. Run the draft the same way. First."
  },
  {
    "name": "The Bruiser",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Hero RB with late WRs, QB punt, streamed TE, and a floor-first backend built on reliable production above all else. The Bruiser takes the hits and keeps moving, a punted QB, streamed TE, and floor-first backend means this team produces without relying on volatility. Durable. Relentless."
  },
  {
    "name": "The Battering Ram",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB investment with late WRs, QB fully punted, streamed TE, and a floor-first backend built to absorb any blow the schedule delivers. The Battering Ram with a Robust RB foundation hits harder than the single-back version, the depth at running back means the ground game never stops, even when the QB position is empty. Durable. Relentless. Every week."
  },
  {
    "name": "The Lone Ranger",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Hero RB alongside late WRs, QB fully punted, streamed TE, and boom-or-bust upside picks taking swings through the entire backend. The Lone Ranger operates without the safety net of a reliable QB and trusts the upside picks to come through when it counts. Solo ride. High variance. Worth it."
  },
  {
    "name": "The Run Committee",
    "strategies": {
      "rb": "hero_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Hero RB with late WRs, QB punt, streamed TE, and value-based drafting tracking the committee through every backend round. The Run Committee distributes the draft equity across every position except QB and uses value-based drafting to ensure every selection carries its weight. The committee voted. Value-based drafting ran the meeting."
  },
  {
    "name": "The Blue Chip",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB investment anchored the draft, Hero WR paired alongside it, early QB locked in, premium early TE, and a floor-first backend. The Blue Chip draft has the two most valuable assets in fantasy, the elite RB room and the premium receiver, surrounded by reliable supporting pieces. The chips were blue. The floor is high."
  },
  {
    "name": "The Big Four",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth established early, Hero WR alongside it, early QB on board, premium early TE, and boom-or-bust upside late. The Big Four locked up four premium positions before the middle rounds and built the backend on upside ceiling. Four big assets. One direction: up."
  },
  {
    "name": "The Asset Manager",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with a Hero WR, early QB secured, premium early TE, and value-based drafting managing every backend pick with total precision. The Asset Manager identifies undervalued assets at every position and accumulates them systematically, the Robust RBs, the Hero WR, the early TE are all performing assets. The portfolio is stacked."
  },
  {
    "name": "The Grand Slam",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth alongside a Hero WR, early QB locked in, mid-round TE, and a floor-first backend with no weak spots. The Grand Slam connects at every major position, the RBs, the WR, the QB, the TE, and builds out from there with conservative depth. Base hit on every pick. Grand slam on the roster."
  },
  {
    "name": "The Big Three",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, early QB, mid-round TE, and boom-or-bust upside picks swinging hard through the backend. The Big Three locked up three premium offensive positions and dared the backend to deliver a championship. The three are big. The ceiling is bigger."
  },
  {
    "name": "The GM",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB investment alongside a Hero WR, early QB, mid-round TE, and value-based drafting managing every remaining pick with precision. The GM runs the most complete front office in the draft room, the early investments are premium, the backend picks are optimal, and every roster decision is defensible. GMs build winners. This one did."
  },
  {
    "name": "The Power Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with a Hero WR, early QB, streamed TE, and a floor-first backend built around reliable weekly production. The Power Play sets up the formation with elite RBs and a top WR and runs it straight at the defense every week. The power is on. The play is called."
  },
  {
    "name": "The Triple Header",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth alongside a Hero WR, early QB, streamed TE, and boom-or-bust upside picks filling every backend spot. The Triple Header puts three scoring threats on the field and backs them up with high-ceiling depth that can hit on any given week. Three ways to win. All of them active."
  },
  {
    "name": "The Brass Tacks",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with a Hero WR, early QB, streamed TE, and value-based drafting extracting every available unit of value through the entire backend. The Brass Tacks gets to the point: Robust RB, Hero WR, early QB, value-based drafting backend, no complexity, no overthinking, just the core principles applied without compromise. Tacks are in. Poster is up."
  },
  {
    "name": "The Long Shot",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth with a Hero WR, late QB taken at real value, premium early TE, and a floor-first backend. The Long Shot plays the odds, the Robust RBs and Hero WR are the reliable core, the late QB is the value play, and the floor-first backend is the insurance policy. Long shot. Solid floor."
  },
  {
    "name": "The Underdog Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB alongside a Hero WR, late QB at maximum value, early TE premium, and value-based drafting closing out the backend. The Underdog Play doesn't need every pick to hit, the Robust RB depth provides redundancy, the Hero WR anchors, and value-based drafting fills in around them with the most defensible picks available. The underdog always has a path."
  },
  {
    "name": "The Reliable Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth with a Hero WR, late QB at a discount, mid-round TE, and a floor-first backend that produces every week. The Reliable Roster has depth at every position, value at the QB and TE spots, and a floor-first backend that doesn't leave points on the bench. Reliability wasn't accidental. It was the goal."
  },
  {
    "name": "The Late Surge",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, late QB at great value, mid-round TE, and boom-or-bust upside picks surging through the backend. The Late Surge builds the foundation first and saves the fireworks for the second half of the draft, and the second half of the season. The surge is loaded. Wait for it."
  },
  {
    "name": "The Loaded Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, mid-round QB, premium early TE, and boom-or-bust upside picks loading up the backend. The Loaded Roster is exactly what it sounds like, premium at RB, WR, and TE, reliable QB in the middle, and upside picks stacking the bench behind it. It's loaded. Handle accordingly."
  },
  {
    "name": "The Complete Roster",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB alongside a Hero WR, mid-round QB, premium early TE, and value-based drafting running the backend with systematic precision. The Complete Roster checks every box, the RB depth, the WR anchor, the TE premium, the QB value, and the value-based backend. Every column has a number. Every number is positive."
  },
  {
    "name": "The Balanced Attack",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB depth with a Hero WR, mid-round QB, mid-round TE, and a floor-first backend built for consistent weekly output. The Balanced Attack doesn't need to win with any one position, it wins with balance, depth, and the inability to be targeted at a single weak spot. Every attack was balanced. Every week is covered."
  },
  {
    "name": "The Dual Threat",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, mid-round QB, mid-round TE, and boom-or-bust upside picks filling every backend slot. The Dual Threat runs it and throws it, the Robust RBs carry the ground game and the Hero WR commands the air, with the backend swings deciding the margin. Two threats. Multiple ways to score."
  },
  {
    "name": "The Diversified",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB alongside a Hero WR, mid-round QB, mid-round TE, and value-based drafting diversifying the backend across every available value. The Diversified holds positions in every category and manages the portfolio with the same analytical rigor applied to every single pick. No concentration risk. Maximum diversification."
  },
  {
    "name": "The Coalition",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with a Hero WR, mid-round QB, streamed TE, and a floor-first backend built through collective reliability. The Coalition combines every ground-game asset with a receiving star, manages the QB and TE efficiently, and closes with a floor-first backend that never surrenders a week. The coalition holds."
  },
  {
    "name": "The Alliance",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, early QB locked in, mid-round TE, and a floor-first backend. The Alliance brings together the pass-catching investments. Hero WR, early QB, and builds floor-first reliability around them. The coalition holds every week."
  },
  {
    "name": "The Contrarian",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth alongside a Hero WR, mid-round QB, streamed TE, and boom-or-bust upside picks going against the grain throughout. The Contrarian builds the team the room is avoiding and trusts that the unpopular combination is actually the correct one. The contrarian position is often the best one. Often is enough."
  },
  {
    "name": "The Dissenter",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt, mid-round TE, and value-based drafting identifying the contrarian value the room left on the board. The Dissenter disagrees with consensus at every position and builds the case with value-based drafting at every backend pick. The contrarian position was correct. Value-based drafting is the evidence."
  },
  {
    "name": "The Diversified Portfolio",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with a Hero WR, mid-round QB, streamed TE, and value-based drafting diversifying the backend across multiple positions and values. The Diversified Portfolio holds assets in every fantasy category and rebalances through value-based drafting all the way to the final round. Diverse inputs. Optimized output."
  },
  {
    "name": "The Chaos Theory",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside a Hero WR, QB fully punted, mid-round TE, and boom-or-bust upside picks shattering conventional wisdom. The Chaos Theory generates unpredictable outcomes from organized inputs, the Robust RBs and Hero WR are the structure, the punted QB and upside backend are the chaos. Theory confirmed."
  },
  {
    "name": "The Spartan",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with a Hero WR, QB punt accepted, mid-round TE, and value-based drafting extracting every unit of value from the backend. The Spartan eliminates waste at the QB position and redirects the value saved into the deepest, most defensible roster possible. No excess. Only necessity."
  },
  {
    "name": "The Stripped Down",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB alongside heavy Robust WR depth, QB punt, streamed TE, and a floor-first backend. The Stripped Down has no room for luxury: Zero RB, punted QB, streamed TE, and a floor-first backend mean every resource was deployed at WR depth. Nothing wasted. No luxuries. Results only."
  },
  {
    "name": "The Iron Will",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB alongside a Hero WR, QB punted entirely, streamed TE, and a floor-first backend built with iron discipline. The Iron Will bends around the absence of a reliable QB and holds together through sheer depth and floor-first discipline at every remaining position. The will is iron. The roster holds."
  },
  {
    "name": "The Maverick's Mirror",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with a Hero WR, QB punt, streamed TE, and boom-or-bust upside picks filling the backend with maximum variance. The Maverick's Mirror reflects the original approach, punt the conventional, chase the ceiling, trust the process even when nobody else does. The reflection is correct. So is the roster."
  },
  {
    "name": "The Stoic's Formula",
    "strategies": {
      "rb": "robust_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth alongside a Hero WR, QB fully punted, streamed TE, and value-based drafting driving the backend with systematic discipline. The Stoic's Formula accepts the discomfort of the punted QB and executes value-based drafting through the backend without emotional interference. The formula doesn't require comfort. Just execution."
  },
  {
    "name": "The Power Formation",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB investment anchored the formation, late WRs added at value, early QB locked in, premium early TE, and a floor-first backend. The Power Formation stacks the ground game first, secures the signal-caller early, anchors the TE position, and fills in the WRs at value behind it. The formation is set. Run the play."
  },
  {
    "name": "The Triple Crown",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with late WRs, early QB priority, premium early TE, and boom-or-bust upside picks sweeping through the backend. The Triple Crown claims three distinct positional titles, the RB room, the early QB, and the premium TE, then rides upside swings to the finish line. The crown has three points. All three are set."
  },
  {
    "name": "The War Room General",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB alongside late WRs, early QB, premium early TE, and value-based drafting running the entire backend operation. The War Room General maps the entire draft before pick one and executes the playbook without improvisation. The war room prepared. The general delivered."
  },
  {
    "name": "The Triple Threat",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with late WRs, early QB, mid-round TE, and boom-or-bust upside picks threatening at every backend spot. The Triple Threat attacks from three directions, the ground game, the signal-caller, and the upside swings, and forces the schedule to defend all of them simultaneously. Three threats. One direction."
  },
  {
    "name": "The Draft Board",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, early QB, mid-round TE, and value-based drafting building the entire backend from a ranked list. The Draft Board trusts the board completely, the early picks are premium, the QB is secured, and value-based drafting handles every decision from round five onward. The board was correct. It always is."
  },
  {
    "name": "The Formation",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB alongside late WRs, early QB secured, streamed TE, and a floor-first backend built on consistent production. The Formation sets up the ground game, locks in the signal-caller early, and fills the remaining positions with reliable floor-first pieces. The formation is locked. Run it every week."
  },
  {
    "name": "The Gambler's Gambit",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB with late WRs, early QB, streamed TE, and boom-or-bust upside picks executing the most aggressive backend gambit available. The Gambler's Gambit locks in the safe investments first, the RBs and QB, then swings on everything else. The gambit was set before the draft started. The chips are all in."
  },
  {
    "name": "The Draft Room",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB alongside late WRs, early QB, streamed TE, and value-based drafting managing every backend selection with the precision of a scouting department. The Draft Room runs the process the way it was designed, early positional priority, QB secured, value-based drafting closing, and the roster reflects every decision made correctly. The room produced."
  },
  {
    "name": "The Trenches",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth with late WRs, late QB at real value, premium early TE, and boom-or-bust upside picks attacking from the backend. The Trenches wins in the line of scrimmage, the RBs and TE are the premium investments, the QB is the value find, and the backend swings are the fourth quarter surge. Win in the trenches. Win the league."
  },
  {
    "name": "The Return on Rushes",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with late WRs, late QB at a discount, premium early TE, and value-based drafting extracting maximum value through every backend pick. The Return on Rushes calculates the value generated by every ground-game carry and applies the same principle to every draft pick. The return was positive at every position."
  },
  {
    "name": "The Lottery Ticket",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, late QB at value, mid-round TE, and boom-or-bust upside picks stacking every backend slot. The Lottery Ticket buys all of them, the Robust RBs are the certain investment, the late QB is the value play, and every backend pick is a ticket stub. One of them hits. That's enough."
  },
  {
    "name": "The Value Play",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, late QB, mid-round TE, and value-based drafting running the backend with clean mathematical discipline. The Value Play runs the same calculation every round, which player returns the most value relative to position scarcity, and executes without sentiment. Every pick was a value play. The value played."
  },
  {
    "name": "The Workhorse Classic",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with late WRs, late QB at real value, streamed TE, and a floor-first backend that never takes a bad week. The Workhorse Classic builds around the ground game, grabs the QB at maximum value, and fills every remaining position with floor-first reliability. Classic approach. Classic results."
  },
  {
    "name": "The Hammer Drop",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, late QB, streamed TE, and boom-or-bust upside picks hammering the entire backend. The Hammer Drop establishes position at RB, grabs the QB at a discount, and then drops the hammer on every upside pick remaining. The hammer was raised in round three. It fell everywhere else."
  },
  {
    "name": "The Mileage Counter",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, late QB at value, streamed TE, and value-based drafting counting every yard of value from the first pick to the last. The Mileage Counter logs every pick at optimal efficiency and measures the season the same way, one correct decision at a time, from week one to the championship. Every mile was logged."
  },
  {
    "name": "The Portfolio",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with late WRs, mid-round QB, premium early TE, and a floor-first backend with diversified depth throughout. The Portfolio allocates capital to every premium position and manages the remaining assets with floor-first discipline. Diversified. Defensible. Durable."
  },
  {
    "name": "The Full House",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, mid-round QB, premium early TE, and boom-or-bust upside picks filling the house. The Full House has a premium player at every position that matters and chaos picks filling in behind them. The house is full. The visitors have nowhere to sit."
  },
  {
    "name": "The Machine",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, mid-round QB, premium early TE, and value-based drafting optimizing every backend pick with systematic precision. The Machine does not miss picks, the inputs are correct, the process is clean, and value-based drafting generates the most defensible output available at every position. The machine ran perfectly."
  },
  {
    "name": "The Trench Worker",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with late WRs, mid-round QB, mid-round TE, and a floor-first backend filled with trench-level reliability. The Trench Worker punches the clock at every draft position and builds a team that wins through sheer production volume rather than star power. The work ethic is visible in every round."
  },
  {
    "name": "The Gridiron",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, mid-round QB, mid-round TE, and boom-or-bust upside picks ripping through the backend. The Gridiron was built on the ground game and finished on big swings, the RBs set the tone and the backend picks decide whether this team has a championship ceiling. The gridiron is ready."
  },
  {
    "name": "The Meat and Potatoes",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, mid-round QB, mid-round TE, and value-based drafting providing simple, unadorned value at every backend pick. The Meat and Potatoes doesn't need a sophisticated strategy, the best available player at every position, priced fairly, taken when the board says to. Meat. Potatoes. Wins."
  },
  {
    "name": "The Powerhouse",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Robust RB with late WRs, mid-round QB, streamed TE, and a floor-first backend that powers through every week without breaking. The Powerhouse generates consistent output across every lineup slot and refuses to surrender a week to circumstance. The power is always on."
  },
  {
    "name": "The Hammer",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, mid-round QB, streamed TE, and boom-or-bust upside picks falling with maximum impact. The Hammer struck at RB in the early rounds and kept swinging on upside picks all the way through the backend. The impact of each swing is cumulative. The ceiling is high."
  },
  {
    "name": "The Strongman",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, mid-round QB, streamed TE, and value-based drafting building out the backend with structural precision. The Strongman carries the weight of the ground-game investment and supports it with a value-based backend that never bends under pressure. The structure holds. It was built that way."
  },
  {
    "name": "The Behemoth",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Robust RB alongside late WRs, QB fully punted, premium early TE, and a floor-first backend that gives nothing away. The Behemoth is the largest possible commitment to non-QB positions, the RBs and TE are both premium investments, the QB is punted, and the backend is built to absorb any shock. Enormous. Immovable."
  },
  {
    "name": "The Tank",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth with late WRs, QB punt, premium early TE, and boom-or-bust upside picks filling every backend slot. The Tank rolls through the draft with no concern for the QB position and maximum concern for peak roster upside. Armored at the skill positions. Exposed at QB. Worth it."
  },
  {
    "name": "The Juggernaut",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with late WRs, QB punted entirely, premium early TE, and value-based drafting driving every backend pick. The Juggernaut cannot be stopped by a missing QB, the RB depth, the WR value, and the premium TE generate enough production to overwhelm most opponents without a top signal-caller. The juggernaut is rolling."
  },
  {
    "name": "The Steel Curtain",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Robust RB alongside late WRs, QB fully punted, mid-round TE, and a floor-first backend that holds the line every week. The Steel Curtain drops at the QB position and builds an impenetrable wall of RB depth, WR value, and floor-first reliability everywhere else. The curtain is steel. It doesn't move."
  },
  {
    "name": "The Bulldozer",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Robust RB depth with late WRs, QB punt, mid-round TE, and boom-or-bust upside picks bulldozing through the backend. The Bulldozer clears every obstacle in its path, the RBs are the blade, the backend swings are the engine, and the punted QB is just a speed bump. The path is clear."
  },
  {
    "name": "The No-QB Club",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB with late WRs, QB fully punted, mid-round TE, and value-based drafting maximizing every unit of value at every backend position. The No-QB Club has zero interest in drafting a starting quarterback early and complete interest in value-based drafting at every other position. The club has one rule. Value-based drafting has the rest."
  },
  {
    "name": "The Gunslinger's Nemesis",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Robust RB alongside late WRs, QB punted, streamed TE, and boom-or-bust upside picks all the way through the backend. The Gunslinger's Nemesis was built to beat exactly one type of team, the QB-first roster that sacrificed positional depth to grab a signal-caller early. The nemesis is ready."
  },
  {
    "name": "The Old Faithful",
    "strategies": {
      "rb": "robust_rb",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Robust RB depth with late WRs, QB punt, streamed TE, and value-based drafting extracting every last unit of value from the backend. The Old Faithful runs the same course every season. Robust RBs, punt QB, trust value-based drafting, and the geyser goes off on schedule every time. Reliable. Predictable. Correct."
  },
  {
    "name": "The Lock In",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Skill positions dominated the first six rounds in a deliberate RB and WR mix, with a quarterback who fell well past his ADP proving too valuable to pass up early, and WRs circled back to later when the value returned. The Lock In committed to the skill position philosophy but recognized a steal at QB when the board presented one and did not hesitate. The floor-first backend confirms the conviction: this roster was built to produce every single week."
  },
  {
    "name": "The Two Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "The first six rounds were a disciplined rotation of running backs and wide receivers, with a quarterback and tight end both falling far enough past their consensus value to demand early attention before returning to skill positions the rest of the way. The Two Premium secured the two hardest positions to find at value and then let the skill position foundation carry the load. The upside backend is the wager that the foundation is good enough to take some swings."
  },
  {
    "name": "The Premium Purist",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were the priority for the first six rounds of this skill-position-heavy build, interrupted only by a quarterback and tight end who each fell significantly below their expected draft position and were too valuable to leave on the board. The Premium Purist holds the line on paying full price for nothing, and both early investments were purchased at a discount. Value-based drafting in the backend confirms that every pick on this roster has a mathematical justification."
  },
  {
    "name": "The Methodical Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Skill positions headlined the opening rounds in a balanced RB and WR rotation, with a quarterback secured early when the board offered value well below consensus, and a tight end added in the middle rounds once the skill position foundation was set. The Methodical Premium moves deliberately through every tier, taking the opportunistic early QB only because the price was right, not because the plan called for it. The floor-first backend is the proof that discipline extends from the first round to the last."
  },
  {
    "name": "The Early Adopter",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Running backs and wide receivers were loaded up through the first six rounds before a quarterback who fell past his ADP made an early appearance, with the tight end added in the middle rounds after the skill position base was established. The Early Adopter recognized the value before the rest of the room reacted and moved on the positional opportunity without apology. The upside backend is built on the same instinct: find the opportunity, take it before anyone else does."
  },
  {
    "name": "The Structured Gamble",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "The first half of this draft was a structured skill position rotation of RBs and WRs, with a quarterback drafted early after falling well past his ADP, and the tight end added in the middle rounds to complete the supporting cast. The Structured Gamble accepts that breaking the skill position script for a fallen QB is not chaos but rather the exact situation the hybrid philosophy was designed for. Value-based drafting closes the roster out with the same structured logic that opened it."
  },
  {
    "name": "The Signal First",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Skill positions drove the early rounds in a deliberate RB and WR mix before a quarterback who fell well below his consensus value made the early pick impossible to decline, with the tight end position left to the waiver wire and late rounds. The Signal First secured the signal-caller before the skill position foundation was fully complete because the price demanded it, then returned to WRs later to finish the job. The floor-first backend is the safety net built behind an otherwise aggressive early approach."
  },
  {
    "name": "The Bold Departure",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Running backs and wide receivers were stacked through the first six rounds in a deliberate skill position rotation, with a quarterback secured early after falling significantly past his expected value, and the tight end left entirely to the late rounds and wire. The Bold Departure breaks from the pure late-QB script only when the board forces the issue, and a quarterback falling that far past his ADP forces the issue. The upside backend rewards the departure with boom-or-bust picks that match the aggressive posture of the early rounds."
  },
  {
    "name": "The QB Truther",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "The opening rounds of this draft were a calculated RB and WR rotation, with a quarterback who fell well past his ADP making the early investment an obvious move, and the tight end left to streaming and late-round fliers. The QB Truther believes in the signal-caller advantage and jumped at the opportunity the moment the board made it affordable. Value-based drafting in the backend confirms that the QB investment was one of many correct decisions made from the first pick to the last."
  },
  {
    "name": "The Locked In",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were the focus of the first six rounds in a balanced skill position build, with the tight end secured early after dropping well below consensus value, and the quarterback left patiently until the backend. The Locked In commits to the skill position rotation as the core identity and only breaks that script when a premium tight end falls far enough to justify the early investment. The floor-first backend is the natural conclusion of a roster built on certainty at every position."
  },
  {
    "name": "The Last Resort Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Skill positions headlined the first six rounds in an intentional RB and WR mix, with a tight end who fell past his ADP too valuable to leave, and the quarterback added late as the final piece of a skill-heavy build. The Last Resort Premium only breaks the hybrid script when the board presents a gift, and a premium tight end falling that far is a gift. The upside backend is the reward for the patience shown at every other position."
  },
  {
    "name": "The Late Value",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "The first six rounds were a deliberate rotation of running backs and wide receivers, with a tight end secured early when the value dropped far past consensus, and the quarterback taken late at maximum value. The Late Value extracts a discount at the two non-skill positions and redirects the savings into the skill position foundation that drives this roster. Value-based drafting closes out a roster where no position was overpaid."
  },
  {
    "name": "The Deep Value",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were stacked through the first six rounds of this skill-first build, with a mid-round tight end investment added once the skill position base was secured, and the quarterback deferred patiently until the backend. The Deep Value finds the discount at every non-skill position and builds the skill position foundation first before addressing anything else. The floor-first backend is the finishing touch on a roster with no unnecessary risks anywhere."
  },
  {
    "name": "The Longshot",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated the early rounds in a balanced RB and WR rotation, with the tight end added in the middle rounds after the foundation was laid, and the quarterback left all the way to the backend where value awaited. The Longshot knows the late QB is the gamble and the upside backend doubles down on that posture, this roster is built for variance with a skill position core sturdy enough to absorb a miss. One of the late picks hits big. That is always the plan."
  },
  {
    "name": "The Waiver Wire Maestro",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were loaded early in a deliberate skill position mix, with a mid-round tight end adding structure to the middle of the roster, and the quarterback found late where the value justified the patience. The Waiver Wire Maestro knows that the late QB and streamed positions will need active waiver management and built the skill position foundation strong enough to carry any early-season gaps. The wire is already open and the maestro is already watching."
  },
  {
    "name": "The Steady Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "The first six rounds were a methodical RB and WR rotation before the tight end position was skipped entirely and the quarterback added deep in the backend after the skill positions were fully stacked. The Steady Builder lays the foundation one skill position at a time and does not address supporting roles until the core is complete. The floor-first backend confirms that every decision on this roster was made in the correct order."
  },
  {
    "name": "The Hail Mary Classic",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Skill positions led every early round decision in a balanced RB and WR mix, with both the tight end and quarterback deferred entirely to the late rounds where late fliers and backend upside take over. The Hail Mary Classic builds the skill position wall first and then swings for the fences with everything left over. The ball is in the air on multiple positions simultaneously. At least one of them connects."
  },
  {
    "name": "The Process Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were the deliberate focus of the first six rounds, with the tight end and quarterback both left to stream late in a skill position build that committed entirely to the hybrid philosophy from start to finish. The Process Builder follows the method without deviation, hammers skill positions early, and lets value-based drafting handle every non-essential decision late. The process was designed for this exact roster."
  },
  {
    "name": "The Safe Inversion",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "The early rounds were a calculated RB and WR rotation before the tight end was secured early when the value fell past consensus, and the quarterback added in the middle rounds once the skill position base was established. The Safe Inversion accepts the early TE only because the board made it a discount, inverts the standard positional sequence by filling the QB slot mid-draft, and keeps the early rounds focused entirely on skill positions. The floor-first backend is the conservative anchor behind an otherwise unconventional approach."
  },
  {
    "name": "The Inverted Draft",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Running backs and wide receivers headlined the first six rounds in a deliberate skill position mix, with a tight end secured early after falling well past his ADP, and the quarterback added mid-draft once the foundation was in place. The Inverted Draft runs the sequence in its own order, takes the opportunistic early TE when the price is right, and builds the rest with controlled aggression. The upside backend is the payoff for an early-round plan executed with full conviction."
  },
  {
    "name": "The Value Inversion",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions led the early rounds in a balanced RB and WR rotation, with a tight end secured early at well below his consensus value, and the quarterback added in the middle rounds to complete the non-skill position requirements. The Value Inversion identifies both the early TE and the mid-round QB as value plays rather than strategic commitments, then deploys value-based drafting to close out a roster built entirely on efficient pricing at every position."
  },
  {
    "name": "The Patient Investor",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were stacked through the first six rounds, with the tight end added in the middle rounds once the skill position priority was satisfied, and the quarterback taken patiently in the same mid-draft window. The Patient Investor does not rush either non-skill position, both are addressed in the middle rounds when the market softens and the value becomes defensible. The floor-first backend rewards the patience with steady, reliable depth."
  },
  {
    "name": "The Late Bloomer Special",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "The first six rounds were a deliberate mix of running backs and wide receivers before the mid-round window opened for both the tight end and quarterback to be addressed at value, with WRs circled back to late to compensate for the early RB lean. The Late Bloomer Special is designed to improve as the season progresses, the mid-round QB and TE are developmental investments, and the late WR additions are timed to peak in October. The bloom arrives on schedule."
  },
  {
    "name": "The Efficiency Play",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions dominated the early rounds in a balanced RB and WR rotation, with both the tight end and quarterback addressed efficiently in the middle rounds before WRs were revisited late. The Efficiency Play runs the most output per draft pick by taking non-skill positions only when the price is correct and never reaching for a supporting role before the foundation is complete. The value-based drafting backend confirms that efficiency was the operating principle from round one to the last."
  },
  {
    "name": "The Deep Sleeper",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were loaded up early in a deliberate skill position build, with the quarterback and tight end both handled in the middle rounds, and WRs circled back to late once the supporting roles were filled. The Deep Sleeper runs quietly through the draft, builds the skill position base without announcing itself, and fills the backend with floor-first reliability that keeps the roster in contention every week. Nobody sees this team coming. That is the whole advantage."
  },
  {
    "name": "The Waiver King",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "The first six rounds were a calculated RB and WR mix before the mid-round window handled both the quarterback and tight end, with WRs revisited in the late rounds to round out the receiving corps. The Waiver King builds the waiver wire into the game plan, the mid-round QB and streamed TE mean active management is required all season, and this drafter built the skill position foundation specifically to support that style. The king runs the wire. The wire runs the season."
  },
  {
    "name": "The Wire to Wire",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions headlined the early rounds in an intentional RB and WR rotation, with both the quarterback and tight end addressed mid-draft at value, and value-based drafting running the backend wire to wire. The Wire to Wire maintains the advantage from the first pick to the last, the hybrid skill position base is the early lead, the mid-round QB and TE are the mid-game adjustments, and value-based drafting is the late-game execution. Wire to wire. No gaps."
  },
  {
    "name": "The Safe Chaos",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were stacked through the first six rounds, with a tight end secured early when the value fell too far past consensus to ignore, and the quarterback deferred entirely to the final rounds where roster rules required it. The Safe Chaos commits to the skill position philosophy completely, accepts the early TE as the one exception to the late non-skill rule, and builds a floor-first backend that contains the variance the punted QB introduces. The chaos was always managed. That was the safety mechanism."
  },
  {
    "name": "The Chaos Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "The early rounds were a deliberate RB and WR rotation, with a tight end who fell well past his ADP securing an early spot as the lone exception to the skill-first script, and the quarterback punted entirely to the final rounds. The Chaos Premium pays for the opportunistic early TE because the price demanded it and then goes fully aggressive with upside picks through the backend while the quarterback slot waits until the last possible moment. Premium where the value appeared. Chaos everywhere else."
  },
  {
    "name": "The Value Chaos",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions dominated the first six rounds in a balanced RB and WR mix, with an early tight end secured only because the value fell far past consensus, and the quarterback left to the very end where value-based drafting governs every remaining decision. The Value Chaos identifies the early TE as the one correct departure from the plan and then applies value-based logic to the punted QB and every backend pick. The chaos had a price. The price was correct."
  },
  {
    "name": "The Survivalist",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were the priority through the first six rounds before the tight end was added in the middle rounds, the quarterback punted entirely to the final few picks, and survival became the operating principle. The Survivalist builds the skill position wall high enough that the punted QB position does not become a fatal flaw. Still standing in week fourteen is the only goal. The survivalist always reaches week fourteen."
  },
  {
    "name": "The Dumpster Fire Chic",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Skill positions were hammered in the early rounds in a deliberate RB and WR rotation, with the tight end addressed mid-draft and the quarterback left entirely to the punt window in the final rounds before the kicker and defense. The Dumpster Fire Chic builds a roster that looks chaotic on the surface and is actually deliberate underneath, the skill position base is real, the punted QB is a calculated sacrifice, and the upside backend is the aesthetic choice. The chic is intentional. The fire burns clean."
  },
  {
    "name": "The Spartan Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "The early rounds were a methodical mix of running backs and wide receivers before the tight end was added mid-draft at value, and the quarterback punted all the way to the backend where value-based drafting closes the roster out. The Spartan Builder strips the non-skill positions to their minimum viable investment and redirects every saved pick into the skill position base that drives weekly scoring. Spare. Efficient. Built to last."
  },
  {
    "name": "The Minimalist Extreme",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers filled every early round slot in a committed skill position build, with both the tight end and quarterback left entirely to streaming and the final rounds, stripping the roster to its absolute minimum non-skill investment. The Minimalist Extreme removes every luxury position from the draft strategy and concentrates entirely on the RB and WR depth that wins weekly matchups. Minimum supporting cast. Maximum skill position depth."
  },
  {
    "name": "The Total Chaos",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated every early round in a deliberate RB and WR rotation, with the tight end streamed late and the quarterback punted to the very final rounds, creating maximum variance at both non-skill positions simultaneously. The Total Chaos built the disorder intentionally, the skill position base is the structure and the punted QB, streamed TE, and upside backend are the accelerant. Total commitment. Total chaos. The skill positions hold it together."
  },
  {
    "name": "The Pure Contrarian",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_late",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were the exclusive focus of the first six rounds in a pure skill position build, with the tight end streamed late and the quarterback punted to the final rounds, leaving value-based drafting to extract every unit of value from a non-skill-heavy backend. The Pure Contrarian disagrees with the conventional wisdom that both QB and TE require real investment and builds the mathematical proof in real time. The skill positions are the argument. The contrarian was right."
  },
  {
    "name": "The Premium Build",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers rotated through the first six rounds in a balanced skill position build, with a quarterback and tight end both secured early after falling well past their consensus draft positions, and WRs revisited in the middle rounds to complete the receiving corps. The Premium Build breaks the pure skill position script only when both non-skill positions present themselves at undeniable value simultaneously, then rebuilds the WR foundation in the mid rounds. The floor-first backend is the reward for executing the opportunistic early investments correctly."
  },
  {
    "name": "The Kelce-Allen Special",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "The first six rounds were a deliberate RB and WR mix before a quarterback and tight end, both falling significantly past their expected ADP, made the early investment a no-brainer, with WRs circled back to in the middle rounds to fill out the receiving corps. The Kelce-Allen Special is named for the combination nobody turns down when the price is right: an elite signal-caller and a dominant tight end, both at a discount, surrounded by a skill position foundation built to support them. The special was worth every pick it cost."
  },
  {
    "name": "The Non-Conformist",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions drove the early rounds in an intentional RB and WR rotation, with a quarterback and tight end both secured early only because the board offered them at prices well below their consensus value, and WRs revisited mid-draft to complete the foundation. The Non-Conformist refuses to follow any script that does not survive contact with the actual draft board, and if both QB and TE fall to value in the early rounds, the non-conformist takes both and adjusts. Value-based drafting confirms every deviation was correct."
  },
  {
    "name": "The Unorthodox",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were stacked through the first six rounds with an RB lean in the early picks, interrupted by a quarterback who fell well past his ADP making the early investment impossible to decline, and the tight end added mid-draft once the skill position base was set. The Unorthodox takes the unconventional path when the board presents it and then builds a floor-first backend that makes the whole structure more stable than it looked at the time. Unorthodox entry. Reliable finish."
  },
  {
    "name": "The Upside Down",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "The early rounds were a deliberate skill position rotation before a quarterback secured an early spot after falling well past consensus, with WRs compensating in the middle rounds and a mid-round tight end completing the supporting cast. The Upside Down flips the expected draft sequence, the QB comes earlier than planned because the board said so, the WRs come later to compensate, and the upside backend is the natural result of a roster built backwards from the conventional order. Upside down. Still correct."
  },
  {
    "name": "The Contrarian Formula",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions headlined the first six rounds in a balanced RB and WR build, with a quarterback secured early when the value fell significantly past his consensus, and a mid-round tight end added once the skill position priority was fully satisfied. The Contrarian Formula proves the math: an early QB at a steep discount plus a mid-round TE at value plus a skill position foundation equals a roster the room did not expect and cannot easily beat. The formula is contrarian. The formula is correct."
  },
  {
    "name": "The Steady Signal",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were the early round priority in a deliberate skill position mix, with a quarterback secured early when the board presented him well below his ADP, and the tight end left to streaming and late rounds. The Steady Signal locks in the signal-caller early only because the price was undeniable, then returns to the skill position rhythm for the rest of the draft. The floor-first backend keeps the transmission reliable every week of the season."
  },
  {
    "name": "The Air Strike",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "The early rounds were a calculated RB and WR rotation before a quarterback who fell well past his consensus value secured an early spot, with WRs revisited in the middle rounds and the tight end left entirely to streaming. The Air Strike leads with skill positions, takes the opportunistic early QB when the board forces the decision, and fires upside shots through every remaining backend slot. The strike was aerial from the moment the QB came off the board early."
  },
  {
    "name": "The Quarterback First",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions drove the first six rounds in an intentional RB and WR mix, with a quarterback secured early after falling significantly below his expected draft position, and the tight end left to the wire and late picks. The Quarterback First broke the skill-position-only early script because the signal-caller was simply too cheap to pass up, and then returned to WRs mid-draft to complete the receiving corps. Value-based drafting closes a roster where the QB investment was the most defensible pick of the night."
  },
  {
    "name": "The Safe Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers rotated through the first six rounds in a balanced skill position build, with a tight end secured early after falling well past his ADP, WRs revisited in the middle rounds, and the quarterback left patiently to the backend where value was waiting. The Safe Premium pays the early TE price only because the board made it a discount, manages the WR mid strategy and defers the QB to maximum value late. Safe premium where it counted. Patience everywhere else."
  },
  {
    "name": "The Premium TE Play",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "The early rounds were a deliberate RB and WR rotation before a tight end who fell well past his consensus value justified an early investment, WRs were revisited mid-draft, and the quarterback was left all the way to the late rounds. The Premium TE Play centers the early non-skill investment entirely on the tight end advantage, the QB can wait because the TE cannot be replicated at that price anywhere else in the draft. The TE advantage was real. The patience at QB confirmed it."
  },
  {
    "name": "The TE Premium Value",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions led the early rounds in an intentional mix of RBs and WRs, with a tight end secured early when the value dropped far past his ADP, WRs circled back to in the middle rounds, and the quarterback found late where value-based drafting identified the correct price. The TE Premium Value identifies the early TE as the single best non-skill investment available and prices the QB accordingly, the later the better, as long as the value is there. The premium was in the TE. Value-based drafting confirmed the rest."
  },
  {
    "name": "The Patient",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers dominated the first six rounds in a balanced skill position build, with WRs revisited mid-draft after the early RB lean, the tight end added in the same mid-round window, and the quarterback deferred patiently to the late rounds. The Patient builds the skill position foundation without rushing any supporting role, the mid-round TE arrives when the value is right, the late QB arrives even later, and the floor-first backend confirms that patience was rewarded at every position."
  },
  {
    "name": "The Gambler's Process",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Skill positions headlined the early rounds in a deliberate RB and WR rotation, with WRs revisited in the middle rounds, a mid-round tight end added at value, and the quarterback left to the late rounds where the value-conscious drafter waits for the right price. The Gambler's Process runs the numbers on the late QB and mid-round TE, identifies both as correct value plays, and backs the analysis with upside picks in the backend. The process identified the gambles. Every gamble was taken."
  },
  {
    "name": "The Efficiency Expert",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were loaded up through the first six rounds in a deliberate skill position mix, with WRs supplemented mid-draft, the tight end addressed in the same mid-round window, and the quarterback taken late where the efficiency calculation pays off most. The Efficiency Expert measures every pick by value generated per draft position and confirms that the late QB approach produces the best efficiency score of any quarterback strategy. The skill positions are the engine. Efficiency is the fuel."
  },
  {
    "name": "The Patient Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "The early rounds were an intentional RB and WR rotation, with WRs revisited in the middle rounds after the early RB lean, the tight end left to streaming and late picks, and the quarterback deferred all the way to the backend where the patient drafter waits for value. The Patient Builder lays one skill position at a time and does not address the QB or TE until the foundation is complete and the correct price presents itself. Built slowly. Built correctly."
  },
  {
    "name": "The Late Skill Surge",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated the early rounds in a balanced RB and WR build, with WRs circled back to mid-draft, the tight end streamed late, and the quarterback left deep into the backend where the informed late drafter knows something the rest of the room does not. The Late Skill Surge returns to WRs mid-draft to compensate for the early RB lean and then unleashes upside picks in the backend after the QB is secured at a price nobody else was willing to wait for. The surge was always coming. It arrived on schedule."
  },
  {
    "name": "The Optimizer's Path",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were the early round priority in a deliberate skill position mix, with WRs revisited in the middle rounds, the tight end left to streaming, and the quarterback taken late where the optimizer found the most efficient path to a starting signal-caller. The Optimizer's Path runs every draft decision through the efficiency filter and confirms that late QB, mid WR, and streamed TE is the most defensible route to a complete skill-position-heavy roster. The optimizer found the path. Value-based drafting confirmed it."
  },
  {
    "name": "The Cautious Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers rotated through the first six rounds in a balanced skill position build, with a tight end secured early when the board offered him well past his consensus value, and the quarterback addressed carefully in the middle rounds. The Cautious Premium breaks the pure late non-skill script only for the early TE, and only because the price demanded it, then manages both positions conservatively from there with a floor-first backend. Premium where warranted. Caution everywhere else."
  },
  {
    "name": "The TE Believer",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Skill positions drove the early rounds in a deliberate RB and WR rotation, with a tight end who fell well past his ADP secured early as the lone non-skill exception, and the quarterback added in the middle rounds after the skill position foundation was in place. The TE Believer builds the draft identity around the elite tight end advantage and backs the belief by taking the TE early at a discount the rest of the room left on the table. The belief was correct. The mid-round QB confirmed the patience."
  },
  {
    "name": "The Balanced Premium",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers headlined the first six rounds in an intentional skill position mix, with a tight end secured early after falling well past his expected draft position, and the quarterback added in the middle rounds at a price that balanced the early TE investment. The Balanced Premium pays for the opportunistic early TE and manages the QB efficiently in the mid rounds, then closes with value-based drafting in the backend. Balanced inputs. Premium outputs."
  },
  {
    "name": "The Patient Drafter",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "The early rounds were a deliberate RB and WR rotation before the middle rounds addressed both the tight end and quarterback at measured prices, with WRs revisited mid-draft to compensate for the early RB lean. The Patient Drafter evaluates every non-skill position before committing and never addresses them before the skill position foundation justifies it. The mid-round QB and TE arrived exactly when the patient drafter determined they should. Not a round earlier."
  },
  {
    "name": "The Slow Burn",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated the early rounds in a balanced RB and WR build, with both the tight end and quarterback addressed in the middle rounds after the skill position priority was satisfied, and WRs revisited mid-draft to round out the receiving corps. The Slow Burn is designed to peak in the second half, the mid-round QB and TE develop over the first few weeks, the WRs hit their stride mid-season, and the upside backend picks ignite when the schedule opens up. The burn is slow. The fire gets large."
  },
  {
    "name": "The Contrarian BPA",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were stacked in the early rounds in a deliberate skill position mix, with WRs revisited mid-draft, both the tight end and quarterback addressed in the same mid-round window, and value-based drafting running the backend with a contrarian view of what each position is actually worth. The Contrarian BPA rejects the room's consensus at every tier and builds the board independently, the mid-round QB and TE were both taken against the grain and both represent the correct price. The contrarian was right. Value-based drafting is the proof."
  },
  {
    "name": "The Deliberate Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "The early rounds were a methodical RB and WR rotation, with WRs added mid-draft after the early RB lean, both the quarterback and tight end addressed deliberately in the middle rounds at defensible prices, and a floor-first backend closing the roster out. The Deliberate Builder makes no pick without a reason and produces a complete skill-position-heavy roster where every selection can be defended with evidence. Nothing was rushed. The deliberation produced exactly this."
  },
  {
    "name": "The Delayed Attack",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Skill positions led the early rounds in an intentional RB and WR build, with the mid-round window handling both the quarterback and tight end at value, WRs revisited mid-draft, and upside picks executing a delayed offensive strategy through the backend. The Delayed Attack conserves the early picks entirely for skill positions and then attacks with the mid-round non-skill investments and backend swings at maximum variance. The attack was delayed. It arrived with force."
  },
  {
    "name": "The Process",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers dominated the first six rounds in a balanced skill position rotation, with WRs revisited mid-draft, both the quarterback and tight end addressed in the middle rounds at the correct price, and value-based drafting running the process through the entire backend. The Process does not require a complicated strategy, skill positions early, QB and TE at mid-round value, value-based drafting to close, and it produces a complete roster where every pick is defensible. Trust the process."
  },
  {
    "name": "The TE Anchor",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were loaded up through the first six rounds in a deliberate skill position build, with a tight end secured early after falling well past his consensus value, WRs revisited mid-draft, and the quarterback punted entirely to the final rounds before the kicker and defense slots. The TE Anchor holds the early TE investment as the lone exception to the punt-everything-non-skill philosophy and builds the floor-first backend knowing the signal-caller will be a late afterthought. Anchored to the TE. Everything else is secondary."
  },
  {
    "name": "The TE Truther",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated the early rounds in an intentional RB and WR rotation, with a tight end secured early when the board presented him well below his expected ADP, WRs circled back to mid-draft, and the quarterback deferred entirely to the punt window in the final rounds. The TE Truther believes the elite tight end is the only non-skill position worth early investment and proves it by punting the QB entirely and letting the skill position foundation carry every other week. The TE advantage is real. The truther punted everything else to prove it."
  },
  {
    "name": "The TE Value Hunter",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were the exclusive early round focus before a tight end who fell well past his consensus value earned an early spot as the one non-skill exception, WRs were revisited mid-draft, and the quarterback was left entirely to the final rounds. The TE Value Hunter identified the premium tight end as the most exploitable value in the non-skill tier and punted the QB to maximize the skill position depth surrounding it. Value-based drafting confirmed every remaining decision. The value was there. The hunter found it."
  },
  {
    "name": "The Grinder's Path",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Skill positions headlined every early round in a deliberate RB and WR mix, with WRs revisited mid-draft after the early RB lean, the tight end added in the middle rounds, and the quarterback punted all the way to the final rounds before the kicker and defense are selected. The Grinder's Path accepts the discomfort of a punted QB, builds maximum skill position depth in the early and middle rounds, and grinds through the season on the strength of the RB and WR foundation. The path is long. The grinder finishes it."
  },
  {
    "name": "The Hail Mary",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Running backs and wide receivers were stacked in the early rounds in a balanced skill position build, with WRs revisited mid-draft, the tight end addressed in the middle rounds, and the quarterback thrown to the very end of the draft where boom-or-bust upside picks have already taken over. The Hail Mary punts the signal-caller and swings for the fences with every late pick including the QB slot itself. Multiple positions are in the air simultaneously. The skill position foundation is the only sure thing."
  },
  {
    "name": "The Uncommon Value",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Skill positions led the early rounds in an intentional RB and WR rotation, with WRs added mid-draft, a mid-round tight end secured at value, and the quarterback punted to the final rounds where value-based drafting identifies the most defensible late signal-caller available. The Uncommon Value finds the pick the room consistently misprices at every position, the mid-round TE, the punted QB, and every value-based backend selection, and takes it without hesitation. Uncommon picks. Common wins."
  },
  {
    "name": "The Minimalist Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Running backs and wide receivers were the exclusive early round priority in a deliberate skill position build, with WRs revisited mid-draft, the tight end and quarterback both left to the absolute minimum investment late, and a floor-first backend stripping the roster to its most efficient possible form. The Minimalist Builder removes every unnecessary premium from the strategy, concentrates all draft capital in the skill position tiers, and constructs the most floor-stable roster possible with what remains. Minimum non-skill investment. Maximum skill position depth."
  },
  {
    "name": "The Chaos Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Skill positions dominated every early round in a calculated RB and WR rotation, with WRs revisited mid-draft, the tight end streamed entirely, and the quarterback punted to the final rounds before the kicker and defense, leaving boom-or-bust upside picks to fill every backend slot. The Chaos Builder designed the disorder from the first pick, the skill position foundation is the structure, the punted QB and streamed TE are the accelerant, and the upside backend is the match. The chaos was built intentionally. It is a feature."
  },
  {
    "name": "The Robot Builder",
    "strategies": {
      "rb": "hybrid",
      "wr": "wr_mid",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Running backs and wide receivers were loaded deliberately through the early rounds, with WRs revisited mid-draft, the tight end streamed late, and the quarterback punted to the final rounds where value-based drafting runs the backend like a system that cannot be second-guessed. The Robot Builder assembled the roster using an automated process that rejected emotion at every position, skill positions early, WRs mid, QB punted, value-based drafting closing, and output the optimal roster without a single deviation. The build was systematic. The results were not accidental."
  },
  {
    "name": "The Fortress",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB commitment made, Hero WR anchored the receiving corps, early QB locked in, premium early TE, and a floor-first backend. The Fortress is impenetrable in the passing game, elite QB, top WR, and premium TE form a three-sided wall that holds up through any storm the season produces. The fortress stands."
  },
  {
    "name": "The Two Towers",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with a Hero WR, early QB priority, premium early TE, and boom-or-bust upside picks filling the backend. The Two Towers rise above the positional landscape, the Hero WR and premium TE anchor both scoring positions and the upside backend fires long-range shots at the championship. Two towers. Maximum range."
  },
  {
    "name": "The Dual Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside a Hero WR, early QB, premium early TE, and value-based drafting managing every backend pick with dual-anchor discipline. The Dual Anchor is exactly what the structure suggests, two elite position players anchoring the scoring, QB secured early, and value-based drafting filling every remaining slot. Two anchors. Zero drift."
  },
  {
    "name": "The Star Collector",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, early QB, mid-round TE, and boom-or-bust upside picks collecting high-ceiling assets at every backend position. The Star Collector acquires elite pass-catchers and pairs them with an early QB and mid-round TE before drafting ceiling in every remaining round. The collection grows. The ceiling keeps rising."
  },
  {
    "name": "The Synergist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, early QB, mid-round TE, and value-based drafting building synergistic value across every backend pick. The Synergist builds passing game assets that amplify each other's value, the Hero WR with an early QB creates stacking opportunities, and value-based drafting locks in the rest. The synergy was real. The optimizer found it."
  },
  {
    "name": "The Ironclad",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, early QB locked in, streamed TE, and a floor-first backend built with ironclad reliability. The Ironclad is forged from premium passing game investments, the WR anchor, the early QB, and reinforced with a floor-first backend that cannot be broken. Forged. Reinforced. Ironclad."
  },
  {
    "name": "The Big Play",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, early QB, streamed TE, and boom-or-bust upside picks making big plays in every backend round. The Big Play makes its money in the passing game and bets that the upside backend delivers the explosive scoring weeks needed to win. The big plays are loaded. One fires every week."
  },
  {
    "name": "The Executive",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, early QB, streamed TE, and value-based drafting executing the entire backend with the authority of a well-run front office. The Executive makes every pick decisively and with full information, the Zero RB framework is the corporate strategy, and value-based drafting is the quarterly earnings report. The executive delivered results."
  },
  {
    "name": "The Rock",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB strategy committed, Hero WR anchoring the receiving corps, late QB at excellent value, premium early TE, and a floor-first backend. The Rock doesn't move, the WR and TE anchors hold every week, the late QB provides consistent production at a discount, and the floor-first backend completes the structure. Immovable. Reliable. The Rock."
  },
  {
    "name": "The High Roller",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at a discount, premium early TE, and boom-or-bust upside picks rolling the dice through the backend. The High Roller goes all in on the passing game investment and backs it with maximum variance in the backend. The roll was high. The table was set."
  },
  {
    "name": "The Purist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside a Hero WR, late QB at maximum value, premium early TE, and value-based drafting running the backend with purist discipline. The Purist strips the draft to its most principled form. Zero RB as the theoretical ideal, Hero WR and premium TE as the premium assets, and value-based drafting as the operating code. Pure theory. Applied correctly."
  },
  {
    "name": "The Steady Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at value, mid-round TE, and a floor-first backend built to steady every lineup week. The Steady Anchor is grounded by two reliable scoring assets, the Hero WR and the mid-round TE, and reinforced by a floor-first backend that produces on schedule. Anchored. Steady. Producing."
  },
  {
    "name": "The Boom or Bust",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, late QB at a discount, mid-round TE, and boom-or-bust upside picks loading the backend. The Boom or Bust defines itself completely: Zero RB, Hero WR anchor, and a backend full of high-variance picks that will either produce a championship or a memorable story. There is no middle outcome here."
  },
  {
    "name": "The Daredevil",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with a Hero WR, late QB at value, streamed TE, and boom-or-bust upside picks taking every possible risk in the backend. The Daredevil commits to Zero RB with a Hero WR anchor and then dares the backend to deliver by filling it with maximum-variance upside picks. The dare was accepted. The backend responded."
  },
  {
    "name": "The Troika",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with a Hero WR, mid-round QB, premium early TE, and boom-or-bust upside picks forming a three-asset scoring troika. The Troika aligns three premium scoring positions. Hero WR, premium TE, mid-round QB, and backs them with maximum upside in the backend. Three horses. One direction."
  },
  {
    "name": "The Professor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside a Hero WR, mid-round QB, premium early TE, and value-based drafting building the backend with academic precision. The Professor has studied every draft strategy and determined that Zero RB with a Hero WR and premium TE produces the optimal expected value in most league formats. The thesis was published in every pick. The grade is A."
  },
  {
    "name": "The Pairing",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, mid-round QB, mid-round TE, and a floor-first backend built around reliable pairing. The Pairing manages the relationship between all roster spots, each position group supports the others, and the floor-first backend ensures the pairing never comes apart under pressure. Well paired. Well held."
  },
  {
    "name": "The Dynamic Duo",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, mid-round QB, mid-round TE, and boom-or-bust upside picks making a dynamic duo out of two high-ceiling strategies. The Dynamic Duo combines Zero RB with a Hero WR anchor and upside backend swings for a team that produces two different ways, through the WR anchor and through the backend variance. Dynamic. Duo."
  },
  {
    "name": "The Veteran Move",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, mid-round QB, streamed TE, and a floor-first backend. The Veteran Move is the experienced read: Zero RB at peak value, Hero WR as the anchor, mid-round QB at the right time. The veteran saw this draft before. The move was the same. It worked the same."
  },
  {
    "name": "The Showstopper",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, mid-round QB, streamed TE, and boom-or-bust upside picks delivering the showstopper moments in every backend round. The Showstopper builds toward the moment when every upside pick hits simultaneously and the leaderboard reflects the work. The show doesn't stop. It peaks at week fourteen."
  },
  {
    "name": "The Anchor",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt accepted, premium early TE anchoring the build, and a floor-first backend. The Anchor holds through the QB discomfort, the Hero WR and premium TE are the twin anchors that keep the roster producing every week regardless of what happens at the punted position. The anchor was set. The team holds."
  },
  {
    "name": "The All-In",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt committed, premium early TE, and boom-or-bust upside picks going all in through the backend. The All-In commits to every high-variance position simultaneously. Zero RB, QB punt, premium TE, upside backend, and bets that the combination produces a ceiling no one else can match. All in. No hedging."
  },
  {
    "name": "The Pragmatic Renegade",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt, mid-round TE, and a floor-first backend built on pragmatic, renegade principles. The Pragmatic Renegade breaks the rules and then builds a conservative backend to justify the rebellion. The renegade was pragmatic. The pragmatism was rebellious."
  },
  {
    "name": "The Renegade",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, QB punt, mid-round TE, and boom-or-bust upside picks renegading through the entire backend. The Renegade operates outside every draft convention. Zero RB, punted QB, Hero WR anchor, and takes upside swings that no consensus ranking would endorse. The renegade doesn't need endorsement. Just results."
  },
  {
    "name": "The Moonshot",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside a Hero WR, QB punt, streamed TE, and boom-or-bust upside picks aiming for the championship moon. The Moonshot commits to maximum variance in every direction. Zero RB, QB punt, upside backend, and points the entire roster at the ceiling. The moon is the target. The rocket is loaded."
  },
  {
    "name": "The Logician's Ghost",
    "strategies": {
      "rb": "zero_rb",
      "wr": "hero_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with a Hero WR, QB punt, streamed TE, and value-based drafting ghosting the conventional wisdom at every backend pick. The Logician's Ghost haunts the draft room with picks that seem irrational on the surface but are mathematically defensible at every level. Zero RB, punted QB, and value-based drafting dismantling the consensus from behind. The ghost was logical. The logic was haunting."
  },
  {
    "name": "The Franchise Builder",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside heavy Robust WR investment, early QB, premium early TE, and boom-or-bust upside picks building the franchise ceiling. The Franchise Builder commits to the long-term asset base, multiple WRs, the early QB, the premium TE, and backs it with upside picks that could build a dynasty. The franchise was built correctly."
  },
  {
    "name": "The Architect",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with stacked Robust WRs, early QB, premium early TE, and value-based drafting designing every backend pick with structural precision. The Architect draws the blueprint, runs the materials list, and builds the roster with zero waste, the Zero RB framework is the architectural philosophy, and value-based drafting is the building code. Designed. Built. Correct."
  },
  {
    "name": "The Commander",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB alongside deep Robust WR investment, early QB, mid-round TE, and a floor-first backend. The Commander locks in the early QB, stacks the WRs, and commands the mid-round TE and floor backend into formation. The command was given. The roster complied."
  },
  {
    "name": "The Gambler",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with heavy Robust WR stacking, early QB, mid-round TE, and boom-or-bust upside picks gambling through the backend. The Gambler gets the safe investments right, early QB, stacked WRs, and then rolls the dice on every backend pick with maximum conviction. The safe bets were made. Then came the gamble."
  },
  {
    "name": "The Tactician",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, early QB, mid-round TE, and value-based drafting executing every backend selection with tactical precision. The Tactician maps the draft like a military campaign. Zero RB is the strategic posture, stacked WRs are the forward units, and value-based drafting directs every subsequent action. The campaign was tactical. The execution was precise."
  },
  {
    "name": "The Signal Corps",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with deep Robust WR depth, early QB, streamed TE, and a floor-first backend built for reliable signal transmission. The Signal Corps locks in the early QB and stacks WRs to create the most reliable passing game infrastructure in the room. The signal is strong. The corps is ready."
  },
  {
    "name": "The Air Raid",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside heavy Robust WR investment, early QB, streamed TE, and boom-or-bust upside picks launching the air raid through the backend. The Air Raid is fully committed: Zero RB, stacked WRs, early QB, and upside picks that extend the aerial assault into every backend round. The raid is airborne. Every pick was a sortie."
  },
  {
    "name": "The Field Marshal",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "early_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with stacked Robust WRs, early QB, streamed TE, and value-based drafting acting as the field marshal for every backend selection. The Field Marshal coordinates the Zero RB philosophy with maximum WR investment, an early QB, and value-based drafting running the backend operation with command authority. The marshal ordered every pick. Every pick was correct."
  },
  {
    "name": "The Pillar",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB strategy established, heavy Robust WR depth alongside it, late QB at great value, premium early TE, and a floor-first backend. The Pillar is load-bearing at every major position, the WRs, the TE premium, and the late QB at value, and the floor-first backend is the structural support system. The pillar holds."
  },
  {
    "name": "The Premium Collector",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with stacked Robust WRs, late QB at a discount, premium early TE, and boom-or-bust upside picks collecting high-ceiling assets. The Premium Collector gathers premium assets at WR and TE and acquires the QB at maximum value, the collection is built on the best available premium at every tier. The collection is complete."
  },
  {
    "name": "The Route Runner",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with heavy Robust WR depth, late QB at a discount, mid-round TE, and a floor-first backend. The Route Runner runs every WR route in the passing game and trusts the late QB to distribute correctly. The routes were run. The QB was there."
  },
  {
    "name": "The Wide Open",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, late QB at value, mid-round TE, and boom-or-bust upside picks going wide open in the backend. The Wide Open has no restrictions: Zero RB, maximum WRs, late QB at a discount, and every backend pick swinging for the sky. Wide open. Maximum range."
  },
  {
    "name": "The Value Seeker",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with deep Robust WR investment, late QB at maximum value, mid-round TE, and value-based drafting identifying every underpriced asset through the backend. The Value Seeker finds the mispriced pick at every position. Zero RB was the first value call, and value-based drafting confirmed every subsequent one. The seeker found value at every turn."
  },
  {
    "name": "The Grinder",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, late QB, streamed TE, and a floor-first backend built for the grinding grind. The Grinder took the Zero RB commitment and built a floor-first roster that produces every single week without relying on the RB position for anything. Grind. Every week. Without complaint."
  },
  {
    "name": "The Boom Factory",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with heavy Robust WR depth, late QB at a discount, streamed TE, and boom-or-bust upside picks loading the backend. The Boom Factory produces explosive scoring outputs, the stacked WRs are the production line, the late QB is the machine operator, and every upside pick is another unit off the assembly line. The factory is running."
  },
  {
    "name": "The Realist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "late_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, late QB at value, streamed TE, and value-based drafting running every backend pick with clear-eyed pragmatism. The Realist accepts every trade-off without sentiment. Zero RB because the math supports it, stacked WRs because they return value, and value-based drafting because the realist doesn't trust intuition. The reality is the roster."
  },
  {
    "name": "The Foundation",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with heavy Robust WR investment, mid-round QB, premium early TE, and a floor-first backend built on a solid foundation. The Foundation holds every position steady, the Zero RB creates WR depth, the premium TE anchors, and the floor-first backend ensures no week is surrendered. The foundation supports everything built on top of it."
  },
  {
    "name": "The Double Down",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, mid-round QB, premium early TE, and boom-or-bust upside picks doubling down on the ceiling. The Double Down wins every hand with the same move, pile the chips on the passing game assets and hit on the backend swings. The down was doubled. The table is ready."
  },
  {
    "name": "The Optimizer",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "early_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with deep Robust WR investment, mid-round QB, premium early TE, and value-based drafting optimizing the backend with clean analytical precision. The Optimizer runs the objective function through every draft pick and confirms that Zero RB, stacked WRs, mid-round QB, and premium TE produce the highest expected roster score. Optimized. Confirmed."
  },
  {
    "name": "The Safe Bet",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "floor"
    },
    "flavorText": "Zero RB alongside heavy Robust WR depth, mid-round QB, mid-round TE, and a floor-first backend. The Safe Bet plays the highest-probability outcome at every position. Zero RB is the EV-positive call, stacked WRs are the safe bet, and the floor-first backend is the insurance policy. Safest bet in the draft room."
  },
  {
    "name": "The Streaker",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with stacked Robust WRs, mid-round QB, mid-round TE, and boom-or-bust upside picks streaking through the backend. The Streaker is unpredictable in the backend, the Zero RB and WR stack are the deliberate positions, and every upside pick is a naked sprint through the draft room. The streak started late. It finishes loudly."
  },
  {
    "name": "The Efficient Market",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "mid_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB alongside deep Robust WR investment, mid-round QB, mid-round TE, and value-based drafting ensuring every pick reflects market efficiency. The Efficient Market believes that the best draft is the one where no pick was made above or below its true value, the Zero RB framework is the market correction, and value-based drafting enforces it through every round. The market was efficient. The roster proves it."
  },
  {
    "name": "The Steady Receiver",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "floor"
    },
    "flavorText": "Zero RB with heavy Robust WR depth, mid-round QB, streamed TE, and a floor-first backend. The Steady Receiver runs precise routes to every valuable pick. Zero RB opens the WR depth, mid-round QB provides the arm, and the floor-first backend catches everything thrown its way. Steady routes. Reliable production."
  },
  {
    "name": "The Spreadsheet",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "mid_qb",
      "te": "stream_te",
      "late": "vbd"
    },
    "flavorText": "Zero RB with deep Robust WR investment, mid-round QB, streamed TE, and value-based drafting tracking every selection like a well-maintained spreadsheet. The Spreadsheet has a column for every position, a formula for every pick, and a formula error for none of them. The spreadsheet was correct. It always is."
  },
  {
    "name": "The Bedrock",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "floor"
    },
    "flavorText": "Zero RB strategy committed, heavy Robust WR investment built alongside it, QB fully punted, premium early TE, and a floor-first backend. The Bedrock is the most stable possible foundation, premium WRs, premium TE, no QB investment, and a floor-first backend that holds up under any schedule. The bedrock doesn't crack."
  },
  {
    "name": "The Swing Trader",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "early_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with stacked Robust WRs, QB punt, premium early TE, and boom-or-bust upside picks swinging the trade. The Swing Trader executes quick entries into the highest-upside backend positions and holds the premium assets, WRs and TE, as the core portfolio. The swing was taken. The trade was correct."
  },
  {
    "name": "The Anarchist",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "mid_te",
      "late": "upside"
    },
    "flavorText": "Zero RB alongside stacked Robust WRs, QB punt, mid-round TE, and boom-or-bust upside picks building anarchy through every backend round. The Anarchist rejects every positional authority. Zero RB refuses the conventional hierarchy, QB punt refuses the signal-caller premium, and every backend swing refuses the consensus ranking. The anarchy was principled. The picks were not."
  },
  {
    "name": "The Pure Chaos",
    "strategies": {
      "rb": "zero_rb",
      "wr": "robust_wr",
      "qb": "punt_qb",
      "te": "stream_te",
      "late": "upside"
    },
    "flavorText": "Zero RB with stacked Robust WRs, QB punt, streamed TE, and boom-or-bust upside picks creating pure chaos through the entire backend. The Pure Chaos builds the most volatile possible roster. Zero RB, maximum WRs, no QB, no TE, and upside picks everywhere else. Pure inputs. Chaotic outputs. No regrets."
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
export const ROUND_WINDOWS_BY_STRATEGY: Record<string, Record<number, string>> = {};

export const DETECTION_STRATEGY_KEYS: Record<string, string> = {"zero_rb":"zero_rb","hero_rb":"hero_rb","robust_rb":"robust_rb","skill_pos_late":"skill_pos_late","hybrid":"hybrid","bpa":"bpa","hero_wr":"hero_wr","robust_wr":"robust_wr","wr_mid":"wr_mid","wr_late":"wr_late","early_qb":"early_qb","mid_qb":"mid_qb","late_qb":"late_qb","punt_qb":"punt_qb","early_te":"early_te","mid_te":"mid_te","stream_te":"stream_te","upside":"upside","floor":"floor","vbd":"vbd","handcuff":"handcuff"};

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
