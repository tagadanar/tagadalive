# AI Code TODO - Static Analysis Issues

Reference for fixing issues found in the LeekScript combat AI.

---

## Critical Issues

### Null Pointer Dereferences

- [x] ~~**AI/AI.ls:122** - `getPotentialCombo()` returns `bestCombo!`~~ FALSE POSITIVE: `reachableCells` always contains at least current cell by design
- [x] ~~**AI/AI.ls:148** - `findBestDanger()` returns `bestDanger!`~~ FALSE POSITIVE: same invariant guarantees at least one iteration
- [x] ~~**Services/Damages.ls:16** - No null check on `MapDanger._map_entity_item_danger[e]![item]![cell]!`~~ SAFE BY DESIGN: LS4 coerces null→0 in numeric context; untargetable cell = 0 ratio = 0 damage (correct semantics)

### Variable Shadowing

- [x] ~~**Controlers/Fight.ls:162** - Rename `integer self = self.turnOrder` to `selfOrder`~~ FIXED

### Uninitialized Variables

- [x] ~~**Controlers/Items.ls:123** - `getOrderedDefensiveItems()` iterates over uninitialized `effects` array instead of `item.effects`~~ FIXED: changed to `item.effects`, removed unused declarations
- [x] ~~**Model/Combos/Position.ls:2-3** - Fields `danger` and `consequences` have no type or initialization~~ FUTURE WORK: Intentional placeholder - Position will regroup danger+consequences to determine best end-of-turn positioning

### Logic Errors

- [x] ~~**Model/Combos/Combo.ls:32-36** - `score` initialized to `null` then accumulated with `+=`~~ SAFE BY DESIGN: LS4 null→0 coercion; lazy initialization pattern (compute score only when requested)
- [x] ~~**Model/Combos/Consequences.ls:65** - Comparing nullable `boostMP` with integer `boostMPbefore`~~ SAFE BY DESIGN: Both are `integer?`; short-circuit `&&` guards null, then null→0 coercion handles comparison and subtraction

---

## Medium Issues

### Dead Code / Incomplete Implementations

- [x] ~~**AI/AI.ls:154-158** - `findBestPosition()` is empty (TODO stub)~~ FUTURE WORK: Related to Position class - will determine best end-of-turn positioning
- [x] ~~**Model/GameObject/Item.ls:67-75** - Target type logic is commented out, causing `targetKey` to always be `NONE` (except lasers)~~ FUTURE WORK: Unfinished target type implementation
- [x] ~~**Model/GameObject/Item.ls:137** - `targetSet()` missing default return statement~~ FALSE POSITIVE: All 10 possible targetKey values are handled exhaustively

### Hardcoded Magic Numbers

- [x] ~~**Model/GameObject/Cell.ls:15-18** - Magic cell ID `1312` used as self-cast sentinel~~ FIXED: Added `Cell.SELF_CAST_ID` constant
- [x] ~~**Model/Combos/Consequences.ls:155,169,207,215** - Erosion divisor `20` should be constant~~ FIXED: Added `Stats.DMG_EROSION_DIVISOR`
- [x] ~~**Model/Combos/Consequences.ls:192** - Poison erosion uses `/10`~~ FIXED: Added `Stats.PSN_EROSION_DIVISOR`
- [x] ~~**Model/GameObject/EntityEffect.ls:17** - Infinite duration `-1` mapped to arbitrary `7`~~ FIXED: Uses `Scoring.MAX_DURATION - 1`; added `Scoring.getEffectiveDuration()` with caching for proper duration calculation (TODO: wire up once init order verified)

### Type Safety

- [x] ~~**Services/Benchmark.ls:45** - `format(num)` missing parameter and return types~~ FIXED: `static string format(real num)` with proper typed internals
- [x] ~~**Controlers/Maps/MapPath.ls:5** - `refresh()` missing return type annotation~~ FIXED: Added `void`

---

## Low Priority

### Performance

- [ ] **Model/GameObject/Cell.ls:77-231** - Heavy area initialization (11 arrays × 613 cells)
- [ ] **Model/Combos/Consequences.ls:25-26** - Deep clone on every action evaluation
- [ ] **main.ls:31-39** - `failSafe()` uses force-unwrap on items that may not be equipped

### Code Quality

- [ ] Standardize comments language (currently mixed French/English)
- [ ] **Services/Targets.ls:153-292** - Refactor duplicate launch type handlers
- [ ] **AI/Scoring.ls:31-46** - Remove unused `computeCoef` map with function values

---

## Quick Reference

| File | Line | Severity | Issue |
|------|------|----------|-------|
| ~~AI/AI.ls~~ | ~~122~~ | ~~Critical~~ | ~~Null deref on bestCombo~~ (false positive) |
| ~~AI/AI.ls~~ | ~~148~~ | ~~Critical~~ | ~~Null deref on bestDanger~~ (false positive) |
| ~~Fight.ls~~ | ~~162~~ | ~~Low~~ | ~~Variable shadowing~~ FIXED |
| ~~Damages.ls~~ | ~~16~~ | ~~Critical~~ | ~~Unchecked map access~~ (safe by design) |
| ~~Items.ls~~ | ~~123~~ | ~~Critical~~ | ~~Uninitialized `effects`~~ FIXED |
| ~~Position.ls~~ | ~~2-3~~ | ~~Critical~~ | ~~Untyped fields~~ (future work) |
| ~~Combo.ls~~ | ~~32~~ | ~~Critical~~ | ~~Null score accumulation~~ (safe by design) |
| ~~Consequences.ls~~ | ~~65~~ | ~~Critical~~ | ~~Null comparison~~ (safe by design) |
| ~~AI.ls~~ | ~~154~~ | ~~Medium~~ | ~~Empty function~~ (future work) |
| ~~Item.ls~~ | ~~67~~ | ~~Medium~~ | ~~Commented out logic~~ (future work) |
| ~~Item.ls~~ | ~~137~~ | ~~Medium~~ | ~~Missing return~~ (false positive) |
| ~~Cell.ls~~ | ~~15~~ | ~~Medium~~ | ~~Magic number 1312~~ FIXED |
| ~~Consequences.ls~~ | ~~155~~ | ~~Medium~~ | ~~Magic number 20~~ FIXED |
| ~~EntityEffect.ls~~ | ~~17~~ | ~~Medium~~ | ~~Magic number 7~~ FIXED |
| ~~Benchmark.ls~~ | ~~45~~ | ~~Medium~~ | ~~Missing types~~ FIXED |
| ~~MapPath.ls~~ | ~~5~~ | ~~Medium~~ | ~~Missing return type~~ FIXED |

---

## Notes

- Code is LeekScript v4 (typed variant)
- **LS4 null coercion**: `null` is coerced to `0` in numeric contexts (like JavaScript)
- **LS4 type annotations are FREE**: Empirically tested - `integer a = 42` costs same ops as `var a = 42`, `as integer` costs same as `| 0`, typed function params have no overhead (compile-time only)
- Cell 1312 is a sentinel for "self-cast" actions (out of valid range 0-612)
- `Fight.selfCell` references this sentinel cell
- The commented-out Item target logic at line 67-75 is likely causing targeting issues
