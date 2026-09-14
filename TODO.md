# TagadAI Code TODO

Improvements, refactoring, and cleanup for the LeekScript combat AI.

**Last Cleaned**: 2026-09-01

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
- [ ] **ComboBuilder (~2000 lines)**: extract `SingleCellBuilder` / `TargetFocusBuilder` / `MultiCellBuilder` / `MPBuffCalculator` (helpers already extracted, commit a3e029c)
- [ ] **CombatContext pattern** — decouple algorithms from `Fight.self` / `MapAction.*` globals for testability
- [ ] **COW improvements** — lazy shared-snapshot materialization; lazy-clone pending structures (bulbs, resurrect)

## Known Scoring Gaps

- **MapDanger early exits under-count danger** — when Phase 4 exits early, ally danger (and thus `canDie`) is underestimated in exactly the crowded fights where it matters most (boss). Flagged 2026-08-31.
- **shieldStatus diminishing returns** — within-turn shield stacking is not discounted; first and fifth shield chip score alike.
- **Reachability-blind ranking** — MapAction Phase-1 tuples rank on raw snapshot score, ignoring whether the cast cell is reachable this turn.
- `EFFECT_TELEPORT` — unscored (empty handler)
- `EFFECT_ADD_STATE` — only `STATE_STERILE` scored; map other states to value (stunned ≈ enemy avg turn damage)
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
