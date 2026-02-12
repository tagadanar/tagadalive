# TagadAI Code TODO

Improvements, refactoring, and cleanup for the LeekScript combat AI.

**Last Cleaned**: 2026-02-12
**Total Files**: 62 LeekScript files (~12,000 lines)

---

## Phase 1: Quick Wins (Low Risk)

### 1.1 Remove Unused Functions

- [ ] **Remove AI.getModeName()** (~6 lines) — `AI/AI:25-30`, never called
- [ ] **Remove MCTSNode.getBestChildByValue()** (~14 lines) — `MCTS:145-158`, never called

### 1.2 Fix Typo in Board

- [ ] **Delete or fix typo line** — `Controlers/Board:5` has `/tatic` (comment typo of `static`), variable never used

### 1.3 Remove Dead Include Reference

- [ ] **Remove commented Jump include** — `auto:69`, references non-existent `Model/Combos/Jump`

### 1.4 Extract Named Constants for Magic Numbers

- [ ] **Extract life ratio constants in ScoringModifiers** — magic numbers (10/5 ally, 15/10 enemy) still hardcoded

---

## Phase 2: Code Consolidation (Medium Risk)

### 2.1 Extract shouldStop() to OperationBudget

- [ ] **Consolidate 3 duplicate implementations** (~12 lines saved)

Identical operation budget check in MCTS:177-179, BeamSearch:144-146, ComboExplorer:117-119. Extract to `Services/OperationBudget.shouldStop(buffer)`.

### 2.2 Consolidate Hybrid.runMCTSFull/runBeamFull

- [ ] **Extract common logic** (~40 lines saved) — `Hybrid:11-124`, both methods 55 lines, 95% identical (only algorithm call differs)

### 2.3 Centralize Operation Buffer Constants

- [ ] **Consolidate buffer constants** — MCTS `SAFETY_BUFFER=200000`, BeamSearch `SAFETY_BUFFER=200000`, and ComboExplorer buffers. Move to ExplorerConfig.

---

## Phase 3: Performance Optimization (Medium-High Risk)

### 3.1 Optimize findBestCellAtDistance (CRITICAL)

- [ ] **Pre-bucket cells by distance** — `ComboExplorer:724-765`, currently O(all cells) per distance query. Pre-bucket during MapCellScore.refresh() for O(bucket size) lookups.

### 3.2 Optimize Entity Effect Loading

- [ ] **Replace O(n) elseif chain with map lookup** — `Entity:293-315`, 10+ comparisons per effect. Group effect types into a map.

### 3.3 Single Map Lookup Pattern

- [ ] **Avoid double lookups throughout codebase** — e.g. `Scoring:117-122` checks `map[key] == null` then accesses `map[key]!`. Cache the first lookup.

---

## Phase 4: Architecture Refactoring (High Risk)

### 4.1 Address God Class: Consequences (~1036 lines)

Internal improvements done (COW, pending bulb methods, effect dispatch map). Remaining extractions:
- [ ] Extract COW logic to `ConsequencesStore`
- [ ] Move scoring to `ConsequencesScorer`
- [ ] Create `PendingBulbManager` for bulb logic

### 4.2 Address God Class: ComboBuilder (~2014 lines)

Helpers extracted (commit a3e029c): `_getMPBuffs`, `_sumBuffTPCost`, `_findCellSequences`, `_poolFromCells`, `_partitionToCells`, unified `_tryAddActionImpl` with reserveTP param, `_addFinalPosition` used consistently. ~187 lines saved. Full builder pattern extraction remaining:
- [ ] Extract `SingleCellBuilder`
- [ ] Extract `TargetFocusBuilder`
- [ ] Extract `MultiCellBuilder`
- [ ] Extract `MPBuffCalculator`
- [ ] Use builder pattern to reduce parameter explosion

### 4.3 Introduce CombatContext Pattern

- [ ] **Decouple algorithms from global state** — algorithms use `Fight.self`, `MapAction.*` etc. directly. Pass a `CombatContext` object instead for testability and cleaner data flow.

### 4.4 Lazy Copy-on-Write Improvements

Per-entity lazy COW is implemented. Remaining:
- [ ] Make shared snapshot materialization lazy (currently marks ALL entities as local immediately)
- [ ] Lazy-clone pending structures (bulbs, resurrect)

---

## Future Features

### Turn Number Modifiers

Late-game coefficient adjustments in `Scoring.getDynamicCoef()`:

| Turn | Effect | Rationale |
|------|--------|-----------|
| `> 55` | HPMAX *= 0.2 | Erosion less valuable late game |
| `> 50` | RATIO_DANGER /= 2 | Less risk-averse late game |
| `> 58` | RATIO_DANGER /= 2 again | Very aggressive in final turns |

### Cooldown-Based Modifiers

Cooldown tracking infrastructure is implemented: `antidoteCD`, `liberationCD`, `manumissionCD`, `jumpCD` on Entity, with `nextAntidote`/`nextLiberation`/`nextManumission` computed by MapDanger coverage maps. Poison duration is capped by `nextAntidote`, MP shackle scoring accounts for manumission CD. Remaining:

**Ally ICED_BULB**: ICEBERG/STALACTITE ready → STR +10 each, both ready → TP +6
**Ally FIRE_BULB**: METEORITE ready && level < 240 → TP +4

### Interleaved Movement in MCTS

Multi-cell combos exist but execute ALL actions per cell before moving. True interleaved move-attack-move-attack not yet supported. Consider when current cell has ≤1 valid offensive action; prune to top 3 cells by score.

---

## Reference: Unscored Effects

### Movement Effects
~~`EFFECT_INVERT`~~ — **now scored** via `movementCandidate` pre-computed score + position tracking.
~~`EFFECT_PUSH`~~ — **now scored** via `movementCandidate` pre-computed score.
~~`EFFECT_ATTRACT`~~ — **now scored** via `movementCandidate` pre-computed score.
`EFFECT_TELEPORT`, `EFFECT_REPEL` — still unscored (empty handlers).

### Summoning Effects
~~`EFFECT_SUMMON`~~ — **now scored** via `EffectHandlers.summon()` (level-based bulb value).
~~`EFFECT_RESURRECT`~~ — **now scored** via `ScoringConfig.RESURRECT_VALUE` + dynamic modifiers (commits 89e015f, 7814079).

### State Effects
`EFFECT_ADD_STATE` (stunned, etc.) — not evaluated. Map state → value (stunned = enemy avg turn damage).

---

## Reference: Passive Effects

### Unimplemented Passives

| Passive | Problem | Complexity |
|---------|---------|------------|
| `MOVED_TO_MP` | Triggers on movement, not item use | Medium |
| `CRITICAL_TO_HEAL` | Requires crit simulation | Medium |
| `ALLY_KILLED_TO_AGILITY` | Requires iterating all allies of killed entity | Not feasible |

### Future: Enemy Passives in Danger Map

Account for enemy passive bonuses (DAMAGE_TO_STRENGTH, KILL_TO_TP, DAMAGE_TO_ABSOLUTE_SHIELD) when calculating danger. High complexity — requires multi-turn sequence prediction.

---

## Notes

### Naming Conventions

- Private fields: `_camelCase`
- Public fields: `camelCase`
- Constants: `SCREAMING_SNAKE`
- Local variables: `camelCase`
- Map caches: `_cache_*` for computed data, `_index_*` for lookup maps

### Variable Abbreviations

- `consequences` → `csq`
- `damage` → `damage` (not `dmg` or `dommage`)
- `position` → `pos`
- `entity` → `entity` in signatures, `e` in loops
