# TagadAI Code TODO

Improvements, refactoring, and cleanup for the LeekScript combat AI.

**Last Cleaned**: 2026-09-15 (design review + game v3.00 mechanics added)

---

## Game v3.00 mechanics (generator rebased 2026-09-15, first pass shipped to the tree the same day)

Source: `.cache/leek-wars-generator` upstream commits 2026-09-04 → 2026-09-15 (tag v3.00),
diffed against the previous fork base `b6fc4a8`. Fork branch `tagadai` carries our 6 patches
on top; two rebase conflicts were resolved by hand (`Fight.java`: keep `runPlantAwakening`
AND `resolveBulbFunction`; `EffectVitality.java`: the resume `injecting` guard goes BEFORE
the UNHEALABLE branch).

### Done (uncommitted first pass, probe scripts in `.cache/v300_scripts/`)

- [x] `EFFECT_SUPERINFECTION` registered in `TargetType` (was 4 `debugE` per fight); the ten
  chips have `Item.PRIORITIES` entries (confirmed, table below).
- [x] Infinite duration (-1) bug: `EffectOverTime` maps -1 to `Scoring.turnsLeft`; the raw
  `durationMitigation(ef.duration)` sites in Damages / Items / MapDamage got the same rule.
  Maturation's permanent PWR buff scored NEGATIVE before this.
- [x] **Superinfection** (`EffectHandlers.superinfection`, engine rule of generator f379d92,
  2026-09-15): the target's poisons DETONATE. All of them vanish and the target takes, once, 50 %
  of the sum of their current per-turn values (no remaining-turns factor), as poison damage with
  erosion and the kill check. The handler zeroes the per-turn poison for every later check and,
  on a survivor, charges the poison thrown away: the whole scored share of this combo's poisons
  and the antidote-capped remaining ticks of the turn-start ones. No target filter: the score
  decides, which in practice means "secure a kill on a poisoned target that could still cure
  or heal". Lesson from fight 53671908: the first model followed the pre-fix source
  (half of total × turns), predicted a kill that never came, scored the end cell at danger 0
  and teleported into range. Always `git fetch` the generator before modelling a new effect.
- [x] **Plants** as ordinary 0-MP summons on `BulbGreedy`: `Entity.isPlant`/`isRooted`,
  `extendedType` from `getPlantType`, rooted cells never in `cellsToIgnore`, rooted skipped by
  push/pull/repel and by the puny lock and nearest-enemy gravity (inversion still allowed).
  MapSummon profiles for corn (ally-heal mode, self allowed as target) and chilli; BulbGreedy
  gained the self-centred range-0 AoE branch (capsaicin, popcorn, and devil strike which could
  never be cast before) and a `Fight.self`/`Fight.selfCell` save-restore around a wake fired
  mid-combo. Probe: 40 corn / 37 chilli summons, 341 wakes, 0 errors over 4 fights.
- [x] **Hemorrhage** (`EffectHandlers.unhealableValue`): `Entity.isUnhealable` blocks heal, raw
  heal, vitality's HP half, steal-life and lifesteal; value = denied heal = `min(enemy heal
  potential on the target, missing HP + guaranteed poison tick + ally damage before it plays +
  own damage potential after the cast)` × |HP coef|; `BattleState.enemyHealPotential` /
  `selfDamagePotential` computed only when an ally owns the chip.
  Danger side: an enemy hemorrhage in range cancels our ally-heal credit in `computeDanger`.
- [x] **Heal-aware poison kills + hemorrhage as the kill** (2026-09-16): `EffectHandlers.poisonLethalNow`
  (first tick kills, no antidote before it, and the target's teammates that play before it cannot
  out-heal it: `BattleState.enemyHealBeforeTurn`) marks the target dead; `poisonLethalNext` (second
  tick, antidote cd ≥ 2, poisons still ticking, no own heal or chain-unhealable, no teammate heal)
  only CREDITS the kill (`addPendingKill`) because the target still plays a turn in between and
  must stay a threat for the danger map. A hemorrhage cast makes the target chain-unhealable, so a
  lethal poison whose only escape was a heal becomes the kill. `willBeDead` and the overkill skip use
  the first-tick test only. Probe: 1v1 vs heals+antidote, 10 hemorrhage kills credited, all died.

### Item priorities (confirmed by the user 2026-09-15)

| chip | priority | reason |
|---|---|---|
| corn, chilli pepper, prototaxite | 2 | with the bulbs in the summon band |
| superinfection | 25 | after the poison band 18-24: converts poisons cast this turn |
| hemorrhage | 26 | after our damage so the missing-HP gap includes it |
| maturation | 37 | with the max-HP buffs (elevation, armoring) |
| piquant, capsaicin, sugar, popcorn | 42 | plant-only chips, after everything, order moot |

### Still open

- [ ] **Prototaxite** (chip 441): `SUMMON_VALUES` = 0 so it is never cast. Model it as a wall:
  value = lock/LoS-block on the nearest enemy (reuse `_lock_cell` logic), body block on a
  chokepoint, spawn cell must not block our own lanes.
- [ ] **Plant zone model**: placement scores plants like bulbs (target in chip range now).
  The real value is enemy traffic through the 3-cell zone and wakes per round; BulbSimulator
  values capsaicin/popcorn at full single-target value (optimistic, no AoE decay); a wake's
  `getPlantTrigger()` is not used as a target priority.
- [ ] **Hemorrhage scale**: outside the poison-kill case the denied heal is valued 1:1 with
  damage, so offensive builds rarely cast it. Knobs: multiplier on `unhealableValue`, more than
  one round of heals. Lifesteal is skipped in the enemy heal maps (TODO in BattleState).
- [ ] **Superinfection danger side**: an enemy superinfection on us turns our psnDmg into dmg;
  `computeDanger` does not model it.
- [ ] **Critical repel** pushes `round(4 × 1.3) = 5` cells for the sun spear; `applyRepel` models 4.
- [ ] **Colossus** (`EFFECT_MULTIPLY_STATS`): no handling by user decision.
- [ ] **`getStats()`**: dropped — saves ~140 ops per entity construction, not worth the churn.
- [ ] **Python side**: `src/scraper/metadata.py` and `src/localfight` know nothing of action ids
  17/18 (`PLANT_AWAKE`/`PLANT_ASLEEP`, payload `[17, plantId, triggerId, plantTP]`) nor
  `ENTITY_PLANT`; walkers attribute a plant's chips to the last `LEEK_TURN` entity. Probe
  gotcha: `USE_CHIP` logs the chip TEMPLATE (hemorrhage = 101), not the chip id. CLAUDE.md
  action table needs the two rows.
- [ ] States: the enum has 12 (RESURRECTED 1, UNHEALABLE 2, INVINCIBLE 3, PACIFIST 4, HEAVY 5,
  DENSE 6, MAGNETIZED 7, CHAINED 8, ROOTED 9, PETRIFIED 10, STATIC 11, STERILE 12); the AI reads
  5. `SnapshotEffects` EFFECT_DEBUFF still scales `entityEffect.value` for ADD_STATE effects
  (the generator only removes a state at 100 %): skip them.

---

## Design review (2026-09-15) — weak designs, recommendations, pro/con

Ranked by expected impact. Evidence from `localfight --seed 42` (Claudius vs Claudias, 26 turns).

### D1. Setup→payoff actions cannot be discovered by the search
`Combo.add` only keeps an action that raises the cumulative score NOW, so Liberation, str
buffs, Neutrino vuln, MP buffs, pulls, pushes, swaps and jumps each need a hand-written prefix
family (12 phases in `ComboExplorer`, ~2.6k lines of near-identical builders in `ComboBuilder`).
None of them re-solve the knapsack after the prefix changes the state.
- **Recommendation**: one generic "setup step" in ComboBuilder: apply candidate action A, re-run
  the knapsack from the resulting consequences, keep the combo if `total(A + resolve) > total(no A)`.
  Candidate setups = any action whose snapshot score is ≤ 0 but which alters STR/AGI/shields/
  position/targets (flag on `Item`). Retire the lib/str/neutrino/MP families first, tactical
  (I/R/A/P/AP/PIP) second.
- *Pro*: new mechanics become data (a chip with a delayed payoff needs no new phase); fewer
  duplicate builders; prefixes get a knapsack re-solve for free.
- *Con*: each setup costs one full knapsack + chain (~10-30k ops); needs a candidate filter and
  a cap per turn; risk of regressing tuned phases (T phase enumerates lib×str×neutrino×MP jointly,
  a greedy setup chain may miss the joint optimum) → bench with pool positions before retiring.

### D2. The score scale is not grounded; multiplicative modifier stacks explode
KILL = 30k, but a Reflexes self-buff scored 72k (AGI base × offensive ramp ×10 × chip-ready
×10) and a full-HP leek spent whole turns self-buffing. Cooldown cost = `cdDuration` points
(a 5-turn chip costs 5 against scores in the thousands): Liberation burned for 1.4k.
- **Recommendation** (cheap first): cooldown opportunity cost in score units = `k × (item's best
  turn-start score) × cdDuration / expectedRemainingTurns`; cap the product of stacked modifiers
  per stat (e.g. ≤ 20 total); log per-action score decomposition to spot runaway terms.
  Long term: keep the value-net line (`nn` memories) but only after the hand scale is sane —
  every fit so far learned the hand scale's noise.
- *Pro*: fixes visibly absurd turns; makes the ML tuning target smoother.
- *Con*: HiddenKnowledges weights were fitted against the current products; every clamp shifts
  the balance and needs a pool bench (ties are common, p-values need 50+ fights).

### D3. Coefficients are frozen at turn start (`DYNAMIC_COEFS = false`)
Enemy life-ratio, ally `canDie`, self-critical are fixed before the combo exists: no diminishing
returns on a target inside a combo, heals-over-time scored at pre-heal ratio.
- **Recommendation**: partial dynamic mode — recompute ONLY the life-ratio factor of the entity
  being altered, from `consequences` HP, in `Consequences.add` for HP/HPTIME/KILL keys; keep all
  other modifiers cached. Measure op delta (expected ≪ the 4× of full dynamic).
- *Pro*: overkill and heal-stacking are priced; kill focus emerges from scores rather than from
  `stopWhenKilled` plumbing.
- *Con*: the danger cache key (`hashcode`) does not include target HP ratios; must verify that
  `MapDanger`/`MapPosition` caches stay valid (they key on self/enemy alterations, fine).

### D4. Danger model = worst case of independent enemies, never an expectation
Every enemy reaches its best cell and dumps all TP on self, summed across enemies, ignoring
that they split fire or prefer an ally. It is also the most expensive init step (6.4M ops on
turn 1 of a 1v1, 35 % budget hit) and is truncated in exactly the crowded fights it matters.
- **Recommendation**: (a) reverse query — `canHit(enemy, item, cell)` computed from the CELL
  side using the fight-invariant `getCachedTargetableCells(item, cell)` ∩ `enemy.reachableCells`,
  evaluated lazily only for cells the explorer visits (≤ 200 vs 613 × items); (b) discount
  the k-th enemy's contribution (e.g. ×0.7^k after sorting by damage) in team fights; (c) keep
  the worst case for `canDie`/DEATH detection only.
- *Pro*: (a) removes the early exits; (b) stops over-defensive play in 2v2+/farmer fights.
- *Con*: (a) changes cache shapes used by `Damages.computeDanger` shackle/jump filtering — a
  real refactor; (b) is a tuned constant with no ground truth until benched.

### D5. Thin sampling then wasted budget on duplicates
Cell ranking is a TP-blind sum of best-per-item scores; phase 1 keeps one cell per movement
ring; phases 2/3 re-run the knapsack for every cell pair/triplet. Turn 24: 338 combos, the
top-5 were ONE combo found from 5 pairs; 3 of 26 turns ended within 3 % of the op cap.
- **Recommendation**: hash the knapsack-selected action set per phase and skip repeats; rank
  cells by their single-cell knapsack value (already computed for the ~6 ring cells) with the
  end-position danger subtracted; drop phase 3 unless ≥ 3 distinct target cells exist.
- *Pro*: frees 30-60 % of explorer ops on crowded turns for phases that currently get cut.
- *Con*: ranking change alters which cells phase 1 samples → bench.

### D6. Knapsack selects on turn-start static scores; ordering by static priority
Selection never sees buffs applied earlier in the combo; interactions are only captured because
`Item.PRIORITIES` happens to be ordered right; post-kill fallback is greedy, not knapsack.
- **Recommendation**: covered by D1 (re-solve after setups) + re-solve once after the first
  kill with the freed pool. *Con*: cost; keep the greedy fallback as the last pass.

### D7. Certain death is not recognised
A leek at 348 HP facing 1.3k poison spent its last turn on shields and a heal (heals score high
at low life ratio; every reachable cell already carries DEATH_VALUE).
- **Recommendation**: in `Position.applyLifeScaling` / `Scoring.refresh`: if the best reachable
  cell is lethal even after the best own support, set own HP/HPTIME/shield coefs to 0 for this
  turn and let offense (kill, erosion, poison, shackles that outlive us in team fights) win.
- *Pro*: cheap, strictly better last turns, matters in farmer/team fights where our debuffs
  persist. *Con*: must not trigger on the worst-case danger alone (see D4) — use the danger
  after ally support and require `dmg ≥ HP + best self-heal`.

### D8. Poison-kill assumptions ignore enemy heals
`willBeDead` drops the target from every offensive pool but only checks antidote availability,
not heal/regeneration/vampirism chips or allied healers. A healer survives and we did nothing.
- **Recommendation**: `willBeDead` only if `psnlife + enemyHealPotential ≤ 0`, where the heal
  potential is the target team's ready heal chips (reuse `Items.computeSupportValue` raw
  values). *Con*: over-estimating heals makes us over-hit; use the same 75th-percentile
  convention as `avgmax`.

### D9. Smaller model gaps
- Crits ignored except `CRITICAL_FACTOR` for OTK enemies; AGI is priced by an ad-hoc chip-ready
  term instead of expected crit damage (`agi/1000 × 0.3` more damage on every hit).
- `isOTK` = str ≥ 400 ∧ agi ≥ 400 ∧ snc ≥ 400: a hard-coded meta build; a 1000-STR 0-AGI leek
  is not "OTK". Recommendation: define OTK as `maxTurnDamage(enemy) ≥ self HP`.
- `_buildWithSwap` / AP / PIP / jump builders mutate `consequences.currentCell/MP` of a node
  already in the chain to fake movement; works because it is the tail node, fragile otherwise.
- `Danger.addShackle` and `computeDanger` assume the enemy uses shackles only with leftover TP.

### D10. Code health
- `MCTS`, `BeamSearch`, `Hybrid` are dead paths still included by `auto` (compile cost, budget of
  `ExplorerConfig` constants duplicated: `SAFETY_BUFFER`). Recommendation: drop from `auto`,
  keep files until the nn line is decided.
- LeekScript-level tests are thin; the real harness is pool positions + `poolscen`. Recommendation:
  a "decision regression" list of recorded positions with expected properties (kills a leek at
  X HP, never ends adjacent to Y) run by `localfight` resume injection.
- `EffectCache` hit rate 8-19 % in 1v1: snapshot sharing pays only in crowded fights; fine.

---

## Quick Wins (Low Risk)

- [ ] **Remove `AI.getModeName()`** — `AI/AI:25`, never called
- [ ] **Remove `MCTSNode.getBestChildByValue()`** — `MCTS:145`, never called
- [ ] **Fix `/tatic` typo line** — `Controlers/Board:5`, commented-out variable
- [ ] **Remove commented Jump include** — `auto`, references non-existent `Model/Combos/Jump`
- [ ] **Extract life ratio constants in ScoringModifiers** — magic numbers (10/5 ally, 15/10 enemy) hardcoded

## Consolidation (Medium Risk)

- [ ] **Extract `shouldStop()` to a shared service** — identical op-budget check in MCTS, BeamSearch, ComboExplorer
- [ ] **Consolidate `Hybrid.runMCTSFull`/`runBeamFull`** — 95% identical, only the algorithm call differs
- [ ] **Centralize `SAFETY_BUFFER` constants** — duplicated in MCTS:167 and BeamSearch:133; move to ExplorerConfig

## Performance (Medium-High Risk)

- [ ] **Entity effect loading** — `Model/GameObject/Entity:~310`: per-effect `switch` over ~20 effect types runs for every effect of every entity each turn ("piste d'optimisation" comment in code). Profile before acting; may be cheap enough.
- [ ] **Single map lookup pattern** — avoid `map[key] == null` then `map[key]!` double lookups (e.g. `Scoring:117`). Hot getters already done (MapDanger/MapDamage/MapSupport/MapAction).

### Held-back micro-optimizations (each needs verification first)

- [ ] **`Combo.getUsageCount` scan → maintained count** — ~17 `push(combo.actions, …)` sites bypass `Combo.add()`; a counter desyncs unless all update it. Low value.
- [ ] **`ComboExplorer.recordResult` sort+slice → sorted insert** — min-replace leaves `topResults` unsorted; trace consumers first.
- [ ] **`Targets.getLazerCellsToUseItemOnCell` distance arithmetic** — axis-aligned identity valid but off-by-one-prone; laser-only benefit.

## Architecture (High Risk)

- [ ] **Consequences (~1000 lines)**: extract `ConsequencesStore` (COW), `ConsequencesScorer`, `PendingBulbManager`
- [ ] **ComboBuilder (~2000 lines)**: extract `SingleCellBuilder` / `TargetFocusBuilder` / `MultiCellBuilder` / `MPBuffCalculator` (helpers already extracted, commit a3e029c) — superseded by D1 if the generic setup step lands
- [ ] **CombatContext pattern** — decouple algorithms from `Fight.self` / `MapAction.*` globals for testability
- [ ] **COW improvements** — lazy shared-snapshot materialization; lazy-clone pending structures (bulbs, resurrect)

## Known Scoring Gaps

- **MapDanger early exits under-count danger** — when Phase 4 exits early, ally danger (and thus `canDie`) is underestimated in exactly the crowded fights where it matters most (boss). Flagged 2026-08-31. See D4.
- **shieldStatus diminishing returns** — within-turn shield stacking is not discounted; first and fifth shield chip score alike. See D3.
- **Reachability-blind ranking** — MapAction Phase-1 tuples rank on raw snapshot score, ignoring whether the cast cell is reachable this turn. See D5.
- `EFFECT_TELEPORT` — unscored (empty handler)
- `EFFECT_ADD_STATE` — only `STATE_STERILE` scored; UNHEALABLE (hemorrhage) now live, see v3.00 section; map other states to value (stunned ≈ enemy avg turn damage)
- Push/attract target-position tracking after displacement still missing (see `applyRepel`'s `_movedTargetCells` for the pattern); repel crit distance (5) unmodelled

## Future Features

- **Turn-number modifiers** — late-game coef adjustments (turn > 55: HPMAX ×0.2; > 50 and > 58: RATIO_DANGER /2)
- **Cooldown-based ally bulb modifiers** — ICED_BULB: ICEBERG/STALACTITE ready → STR +10 each, both → TP +6; FIRE_BULB: METEORITE ready && level < 240 → TP +4 (CD infra done)
- **Interleaved movement** — move-attack-move-attack within a combo; consider when current cell has ≤1 valid offensive action

## Unimplemented Passives

| Passive | Problem |
|---------|---------|
| `MOVED_TO_MP` | Triggers on movement, not item use |
| `CRITICAL_TO_HEAL` | Requires crit simulation |
| `ALLY_KILLED_TO_AGILITY` | Not feasible |

Enemy passives (DAMAGE_TO_STRENGTH, KILL_TO_TP, DAMAGE_TO_ABSOLUTE_SHIELD) not in danger map — needs multi-turn prediction.

## Notes

- Naming: `_camelCase` private, `camelCase` public, `SCREAMING_SNAKE` constants, `_cache_*` computed / `_index_*` lookup maps
- Abbreviations: `csq` (consequences), `pos`, `e` (loop entity); `damage` never abbreviated

## Resolved (kept for context)

- **Self-cast rank zero** (2026-08-31, commit bebdd90) — `Board.entityCells` excludes self, so MapAction Phase-1 ranked every self-cast at 0; dropped under budget pressure (boss regime). Fixed via `computeSnapshotForTarget` + `_canSelfCast` guard.
- **Ally canDie coefs never applied** (2026-09-01, commits 2c83c98 + HK 6fa8131) — `Scoring.refresh()` cached coefs before `allyDanger` existed, so `ALLY_CANDIE_MODIFIER` only ever reached mid-turn summons. Fixed via `Scoring.refreshAllyDangerCoefs()` after `computeAllAllyDanger()`; modifier re-tuned 5.0 → 2.0 (bulb-fitted value over-paid for leeks; preregistered bench farmer p=0.041).
- `findBestCellAtDistance` pre-bucketing (commit f7ebc61); movement effects (invert/push/attract/repel), summon, resurrect all scored.
