# AI Code TODO

Reference for issues and improvements in the LeekScript combat AI.

---

## AI Effect Implementations

### Recently Added Effects (need testing)

The following effects were added but need to be tested with actual items that use them:

| Effect | Implementation | Status |
|--------|----------------|--------|
| `EFFECT_RAW_HEAL` | Full (instant heal, no wisdom scaling) | Needs testing with item |
| `EFFECT_KILL_TO_TP` | Empty (passive) | Needs testing with item |
| `EFFECT_CRITICAL_TO_HEAL` | Empty (passive) | Needs testing with item |
| `EFFECT_ADD_STATE` | Stub (no state tracking) | Needs testing with item |

**To test**: Equip a chip/weapon that uses these effects and verify no `unhandledEffect` warnings appear, and that the scoring behaves correctly (for RAW_HEAL).

### Movement Effects (not scored)

The following effects have empty implementations in `Model/Combos/Consequences`. The AI won't crash when encountering them, but it cannot evaluate their strategic value.

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_TELEPORT` | Teleport to a cell | AI ignores teleportation chips |
| `EFFECT_INVERT` | Swap positions with target | AI ignores inversion chips |
| `EFFECT_PUSH` | Push target away | AI ignores push effects |
| `EFFECT_ATTRACT` | Pull target closer | AI ignores attract/grapple effects |
| `EFFECT_REPEL` | Repel targets | AI ignores repel effects |

**Why it matters**: Movement chips can be crucial for positioning (escaping danger, pushing enemies into AoE, pulling enemies into range). Without scoring, the AI will never prioritize these actions.

**To implement**: Would need to integrate with `MapDanger` to evaluate position changes and their impact on danger/opportunity.

### Summoning Effects (not scored)

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_SUMMON` | Summon a bulb | AI ignores summoning chips |
| `EFFECT_RESURRECT` | Resurrect dead ally | AI ignores resurrection chips |

**Why it matters**: Bulbs provide additional actions, damage, and can absorb enemy attacks. Resurrection can swing fights. Without scoring, the AI will never summon or resurrect.

**To implement**: Would need to evaluate bulb value (HP, damage potential, utility) and factor in the TP/chip cost vs expected return.

### State Effects (stub implementation)

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_ADD_STATE` | Apply states (stunned, etc.) | AI doesn't evaluate state value |

**Why it matters**: States like "stunned" skip enemy turns, which is extremely valuable. Without proper scoring, the AI undervalues these effects.

**To implement**: Would need a state->value mapping (e.g., stunned = ~enemy's average turn damage value).

---

## Static Analysis Issues

### Critical Issues

#### Null Pointer Dereferences

- [x] ~~**AI/AI.ls:122** - `getPotentialCombo()` returns `bestCombo!`~~ FALSE POSITIVE: `reachableCells` always contains at least current cell by design
- [x] ~~**AI/AI.ls:148** - `findBestDanger()` returns `bestDanger!`~~ FALSE POSITIVE: same invariant guarantees at least one iteration
- [x] ~~**Services/Damages.ls:16** - No null check on `MapDanger._map_entity_item_danger[e]![item]![cell]!`~~ SAFE BY DESIGN: LS4 coerces null->0 in numeric context; untargetable cell = 0 ratio = 0 damage (correct semantics)

#### Variable Shadowing

- [x] ~~**Controlers/Fight.ls:162** - Rename `integer self = self.turnOrder` to `selfOrder`~~ FIXED

#### Uninitialized Variables

- [x] ~~**Controlers/Items.ls:123** - `getOrderedDefensiveItems()` iterates over uninitialized `effects` array instead of `item.effects`~~ FIXED: changed to `item.effects`, removed unused declarations
- [x] ~~**Model/Combos/Position.ls:2-3** - Fields `danger` and `consequences` have no type or initialization~~ FUTURE WORK: Intentional placeholder - Position will regroup danger+consequences to determine best end-of-turn positioning

#### Logic Errors

- [x] ~~**Model/Combos/Combo.ls:32-36** - `score` initialized to `null` then accumulated with `+=`~~ SAFE BY DESIGN: LS4 null->0 coercion; lazy initialization pattern (compute score only when requested)
- [x] ~~**Model/Combos/Consequences.ls:65** - Comparing nullable `boostMP` with integer `boostMPbefore`~~ SAFE BY DESIGN: Both are `integer?`; short-circuit `&&` guards null, then null->0 coercion handles comparison and subtraction

---

### Medium Issues

#### Dead Code / Incomplete Implementations

- [x] ~~**AI/AI.ls:154-158** - `findBestPosition()` is empty (TODO stub)~~ FUTURE WORK: Related to Position class - will determine best end-of-turn positioning
- [x] ~~**Model/GameObject/Item.ls:67-75** - Target type logic is commented out, causing `targetKey` to always be `NONE` (except lasers)~~ FUTURE WORK: Unfinished target type implementation
- [x] ~~**Model/GameObject/Item.ls:137** - `targetSet()` missing default return statement~~ FALSE POSITIVE: All 10 possible targetKey values are handled exhaustively

#### Hardcoded Magic Numbers

- [x] ~~**Model/GameObject/Cell.ls:15-18** - Magic cell ID `1312` used as self-cast sentinel~~ FIXED: Added `Cell.SELF_CAST_ID` constant
- [x] ~~**Model/Combos/Consequences.ls:155,169,207,215** - Erosion divisor `20` should be constant~~ FIXED: Added `Stats.DMG_EROSION_DIVISOR`
- [x] ~~**Model/Combos/Consequences.ls:192** - Poison erosion uses `/10`~~ FIXED: Added `Stats.PSN_EROSION_DIVISOR`
- [x] ~~**Model/GameObject/EntityEffect.ls:17** - Infinite duration `-1` mapped to arbitrary `7`~~ FIXED: Uses `Scoring.MAX_DURATION - 1`; added `Scoring.getEffectiveDuration()` with caching for proper duration calculation (TODO: wire up once init order verified)

#### Type Safety

- [x] ~~**Services/Benchmark.ls:45** - `format(num)` missing parameter and return types~~ FIXED: `static string format(real num)` with proper typed internals
- [x] ~~**Controlers/Maps/MapPath.ls:5** - `refresh()` missing return type annotation~~ FIXED: Added `void`

---

### Low Priority

#### Performance

- [ ] **Model/GameObject/Cell.ls:77-231** - Heavy area initialization (11 arrays x 613 cells)
- [ ] **Model/Combos/Consequences.ls:25-26** - Deep clone on every action evaluation
- [ ] **main.ls:31-39** - `failSafe()` uses force-unwrap on items that may not be equipped

#### Code Quality

- [ ] Standardize comments language (currently mixed French/English)
- [ ] **Services/Targets.ls:153-292** - Refactor duplicate launch type handlers
- [ ] **AI/Scoring.ls:31-46** - Remove unused `computeCoef` map with function values

---

## Notes

- Code is LeekScript v4 (typed variant)
- **LS4 null coercion**: `null` is coerced to `0` in numeric contexts (like JavaScript)
- **LS4 type annotations are FREE**: Empirically tested - `integer a = 42` costs same ops as `var a = 42`, `as integer` costs same as `| 0`, typed function params have no overhead (compile-time only)
- Cell 1312 is a sentinel for "self-cast" actions (out of valid range 0-612)
- `Fight.selfCell` references this sentinel cell
- Movement/summon implementations would require significant architecture changes to properly simulate position changes and entity creation in consequences
