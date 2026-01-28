# TagadAI Code TODO

Comprehensive task list for improvements, refactoring, and cleanup in the LeekScript combat AI.

**Analysis Date**: 2026-01-26
**Total Files**: 62 LeekScript files (~12,000 lines)

---

## Table of Contents

1. [Phase 1: Quick Wins (Low Risk)](#phase-1-quick-wins-low-risk)
2. [Phase 2: Code Consolidation (Medium Risk)](#phase-2-code-consolidation-medium-risk)
3. [Phase 3: Performance Optimization (Medium-High Risk)](#phase-3-performance-optimization-medium-high-risk)
4. [Phase 4: Architecture Refactoring (High Risk)](#phase-4-architecture-refactoring-high-risk)
5. [Future Features](#future-features)
6. [Reference: Unscored Effects](#reference-unscored-effects)
7. [Reference: Passive Effects](#reference-passive-effects)
8. [Notes](#notes)

---

## Phase 1: Quick Wins (Low Risk)

Safe changes with immediate benefit. No functionality change, minimal testing required.

### 1.1 Delete Dead Module: MapAllyDamage

- [ ] **Delete entire module** (~360 lines)

**File**: `Controlers/Maps/MapAllyDamage`

**Full Description**:
The MapAllyDamage module is included in `auto:50` but the initialization call `MapAllyDamage.refresh()` is **commented out** in `auto:168-170`. Without this initialization, all cached data structures remain empty and all methods are unreachable. Grep confirms no external code calls any MapAllyDamage method.

**Dead Methods**:
- `refresh()` (line 30) - commented out in auto
- `getAllyDmgMap()` (line 61)
- `getAllyTargetableCells()` (line 104)
- `getCellDamage()` (lines 122, 132)
- `computeDamage()` (line 155)
- `getDamage()` (line 212)
- `showDamage()` (line 234)
- `showDamageAll()` (line 255)
- `debugAllyWeapons()` (line 278)
- `debugEnemyCellDamage()` (line 322)
- `showAllyDamageCoverage()` (line 335)

**Steps**:
1. Delete file `Controlers/Maps/MapAllyDamage`
2. Remove include from `auto:50`: `include('Controlers/Maps/MapAllyDamage')`
3. Remove commented refresh calls from `auto:168-170`
4. Remove commented debug calls from `auto:194-195`

**Risk**: LOW - Module already inactive, verified no external callers.

---

### 1.2 Remove Unused Functions

- [ ] **Remove AI.getModeName()** (~6 lines)

**File**: `AI/AI` lines 25-30

**Full Description**:
Helper function to get readable algorithm mode names. Defined but never called anywhere in the codebase. Likely added for debugging but never used.

```javascript
static string getModeName(integer m) {
    if (m == AI.MODE_MCTS) return "MCTS"
    if (m == AI.MODE_BEAM) return "BEAM"
    if (m == AI.MODE_COMBO_EXPLORER) return "EXPLORER"
    return "UNKNOWN"
}
```

**Steps**:
1. Delete lines 25-30 in `AI/AI`

**Risk**: LOW - Never called.

---

- [ ] **Remove MCTSNode.getBestChildByValue()** (~14 lines)

**File**: `AI/Algorithms/MCTS` lines 145-158

**Full Description**:
Alternative child selection method that returns best child by average value instead of visit count. Only `getBestChild()` (by visit count) is actually used in `extractBestCombo()` at line 391. This method was likely an experiment that was never adopted.

```javascript
MCTSNode? getBestChildByValue() {
    MCTSNode? best = null
    real bestValue = -999999.0
    for (MCTSNode child in this.children) {
        if (child.visits > 0) {
            real avg = child.getAverageValue()
            if (avg > bestValue) {
                bestValue = avg
                best = child
            }
        }
    }
    return best
}
```

**Steps**:
1. Delete lines 145-158 in `AI/Algorithms/MCTS`

**Risk**: LOW - Never called.

---

### 1.3 Fix Typo in Board

- [ ] **Fix or remove typo comment**

**File**: `Controlers/Board` line 5

**Full Description**:
Line 5 contains `/tatic Map<Cell, boolean> obstacles = [:]` which is a typo (`/tatic` instead of `static`). The leading `/` makes this line a comment. The variable is never declared properly and never used.

**Steps**:
1. Either delete line 5 entirely, OR
2. Fix to `static Map<Cell, boolean> obstacles = [:]` if the feature is needed

**Risk**: LOW - Currently a no-op comment.

---

### 1.4 Remove Dead Include Reference

- [ ] **Remove Jump include**

**File**: `auto` line 60

**Full Description**:
Line 60 contains `//include('Model/Combos/Jump')` which references a file that doesn't exist. The file `Model/Combos/Jump` was either never created or was deleted, but the include reference remained (commented out).

**Steps**:
1. Delete line 60 from `auto`

**Risk**: LOW - Already commented, file doesn't exist.

---

### 1.5 Add Named Constants for Magic Numbers

- [ ] **Document magic numbers in ScoringModifiers**

**File**: `AI/ScoringModifiers` lines 15, 63, 66

**Full Description**:
Several magic numbers lack explanation, making ML tuning difficult:

```javascript
// Line 15 - Where does 0.0876 come from?
static real LEVEL_RATIO_SCALE = 0.0876

// Lines 63-66 - What do 10, 8, 6 represent?
static real _computeLifeRatioModifier(real lifeRatio, boolean isFriend) {
    if (isFriend) {
        return 10.0 - 8.0 * lifeRatio  // Magic: 10, 8
    } else {
        return 10.0 - 6.0 * lifeRatio  // Magic: 10, 6
    }
}
```

**Steps**:
1. Add comment explaining `LEVEL_RATIO_SCALE = 0.0876` is `0.5 / log(301)` where 301 is max level
2. Extract named constants:
   ```javascript
   static real LIFE_RATIO_MAX_MODIFIER = 10.0      // Max multiplier at 0% HP
   static real LIFE_RATIO_ALLY_SCALE = 8.0         // Ally: linear 10→2 (steeper)
   static real LIFE_RATIO_ENEMY_SCALE = 6.0        // Enemy: linear 10→4 (gentler)
   ```

**Risk**: LOW - Documentation only, no logic change.

---

## Phase 2: Code Consolidation (Medium Risk)

Refactoring to remove duplication. Same logic, better organization.

### 2.1 Extract buildComboDesc() to Combo Class

- [ ] **Consolidate 5 duplicate implementations** (~70 lines saved)

**Files with duplicates**:
- `AI/Algorithms/MCTS` lines 468-481
- `AI/Algorithms/BeamSearch` lines 306-319
- `AI/Algorithms/ComboExplorer` lines 517-529
- `AI/Algorithms/BulbGreedy` lines 206-219
- `AI/Algorithms/Hybrid` (uses MCTS/BeamSearch versions)

**Full Description**:
All 5 algorithm files contain nearly identical `buildComboDesc()` functions that format a combo for debug output:

```javascript
static string buildComboDesc(Combo combo) {
    string desc = ""
    for (Action a in combo.actions) {
        if (desc != "") desc += "→"
        desc += a.item.name + "(" + round(a.score!) + ")"
    }
    if (combo.finalPosition) {
        if (desc != "") desc += "→"
        Position p = combo.finalPosition!
        desc += "mv(" + p.cell.id + ":" + round(p.score) + ")"
    }
    if (desc == "") desc = "stay"
    return desc
}
```

**Steps**:
1. Add `getDescription()` method to `Model/Combos/Combo` class
2. Replace all `MCTS.buildComboDesc(combo)` with `combo.getDescription()`
3. Replace all `BeamSearch.buildComboDesc(combo)` with `combo.getDescription()`
4. Replace all `ComboExplorer.buildComboDesc(combo)` with `combo.getDescription()`
5. Replace all `BulbGreedy.buildComboDesc(combo)` with `combo.getDescription()`
6. Delete the 5 static methods

**Risk**: MEDIUM - Multiple files touched, but pure refactoring.

---

### 2.2 Extract pruneActions() to Utility

- [ ] **Consolidate 2 duplicate implementations** (~37 lines saved)

**Files with duplicates**:
- `AI/Algorithms/MCTS` lines 419-455
- `AI/Algorithms/BeamSearch` lines 269-301

**Full Description**:
Both MCTS and BeamSearch contain identical `pruneActions()` functions that filter and sort actions:

```javascript
static Array<Action> pruneActions(Array<Action> actions) {
    // 1. Filter out non-positive score actions
    Array<Action> viable = []
    for (Action act in actions) {
        if (act.score! > 0) push(viable, act)
    }
    if (count(viable) == 0) return []

    // 2. Separate self-cast from other actions
    Array<Action> selfCast = []
    Array<Action> other = []
    for (Action act in viable) {
        if (act.from == Fight.selfCell) push(selfCast, act)
        else push(other, act)
    }

    // 3. If within limit, return all
    if (count(other) <= MAX_ACTIONS_TO_TRY) {
        return viable
    }

    // 4. Sort by priority, take top K
    Array<Action> sorted = arraySort(other, ...)
    Array<Action> pruned = selfCast
    for (integer i = 0; i < MAX_ACTIONS_TO_TRY && i < count(sorted); i++) {
        push(pruned, sorted[i])
    }
    return pruned
}
```

**Steps**:
1. Create new file `Services/ActionFilter` or add to existing utility
2. Move `pruneActions(actions, maxActions)` to the utility
3. Update MCTS to call `ActionFilter.prune(actions, MCTS.MAX_ACTIONS_TO_TRY)`
4. Update BeamSearch to call `ActionFilter.prune(actions, BeamSearch.MAX_ACTIONS_TO_TRY)`
5. Delete duplicate implementations

**Risk**: MEDIUM - Two files touched, pure refactoring.

---

### 2.3 Extract shouldStop() to OperationBudget

- [ ] **Consolidate 3 duplicate implementations** (~12 lines saved)

**Files with duplicates**:
- `AI/Algorithms/MCTS` lines 177-179
- `AI/Algorithms/BeamSearch` lines 144-146
- `AI/Algorithms/ComboExplorer` (ExplorationContext.shouldStop) lines 107-109

**Full Description**:
Three implementations of identical operation budget checking logic:

```javascript
// MCTS
static boolean shouldStop() {
    return getOperations() > getMaxOperations() - MCTS.SAFETY_BUFFER
}

// BeamSearch
static boolean shouldStop() {
    return getOperations() > getMaxOperations() - BeamSearch.SAFETY_BUFFER
}

// ComboExplorer (context-based)
boolean shouldStop() {
    return getOperations() > getMaxOperations() - this.operationBuffer
}
```

**Steps**:
1. Create `Services/OperationBudget` class:
   ```javascript
   class OperationBudget {
       static boolean shouldStop(integer buffer) {
           return getOperations() > getMaxOperations() - buffer
       }
   }
   ```
2. Update all callers to use `OperationBudget.shouldStop(SAFETY_BUFFER)`
3. Delete duplicate methods

**Risk**: MEDIUM - Three files touched, pure refactoring.

---

### 2.4 Consolidate Hybrid.runMCTSFull/runBeamFull

- [ ] **Extract common logic** (~40 lines saved)

**File**: `AI/Algorithms/Hybrid` lines 11-124

**Full Description**:
`runMCTSFull()` and `runBeamFull()` are 95% identical - same cell iteration, budget checking, action merging, and best combo tracking. Only the algorithm call differs:

```javascript
// runMCTSFull calls:
Combo combo = MCTS.search(cell, cellActions, ...)

// runBeamFull calls:
Combo combo = BeamSearch.search(cell, cellActions, ...)
```

**Steps**:
1. Create private helper:
   ```javascript
   static Combo _runSearchFull(
       string name,
       function(Cell, Map, integer, integer, Item?) => Combo searchFunc,
       function() => boolean shouldStopFunc
   ) { /* unified implementation */ }
   ```
2. Simplify `runMCTSFull()` to call helper with MCTS functions
3. Simplify `runBeamFull()` to call helper with BeamSearch functions

**Risk**: MEDIUM - Single file, but core algorithm dispatch.

---

### 2.5 Centralize Operation Buffer Constants

- [ ] **Consolidate buffer constants in ExplorerConfig**

**Files with duplicates**:
- `AI/Algorithms/MCTS` line 167: `SAFETY_BUFFER = 200000`
- `AI/Algorithms/BeamSearch` line 133: `SAFETY_BUFFER = 200000`
- `AI/Algorithms/ComboExplorer` (ExplorerConfig) lines 37-40: Multiple buffers

**Full Description**:
Operation buffer constants are scattered across files with duplicate values:

```javascript
// MCTS
static integer SAFETY_BUFFER = 200000

// BeamSearch
static integer SAFETY_BUFFER = 200000

// ExplorerConfig
static integer OPERATION_BUFFER_LEEK_BASE = 250000
static integer OPERATION_BUFFER_PER_BULB = 200000
static integer OPERATION_BUFFER_POTENTIAL_SUMMON = 200000
static integer OPERATION_BUFFER_BULB = 200000
```

**Steps**:
1. Add to ExplorerConfig: `static integer OPERATION_BUFFER_SEARCH = 200000`
2. Update MCTS to use `ExplorerConfig.OPERATION_BUFFER_SEARCH`
3. Update BeamSearch to use `ExplorerConfig.OPERATION_BUFFER_SEARCH`
4. Delete duplicate constants

**Risk**: LOW - Pure constant consolidation.

---

## Phase 3: Performance Optimization (Medium-High Risk)

Optimizations that preserve functionality but change implementation details.

### 3.1 Optimize findBestCellAtDistance (CRITICAL)

- [ ] **Pre-bucket cells by distance** (Major operation savings)

**File**: `AI/Algorithms/ComboExplorer` lines 310-367

**Full Description**:
Current implementation searches ALL cells for each distance value:

```javascript
static Cell? findBestCellAtDistance(ExplorationContext ctx, integer distance) {
    Cell? best = null
    real bestScore = -999999.0

    for (Cell cell : real score in MapCellScore.cellScores) {
        integer? dist = reachable[cell]
        if (dist == null || dist! != distance) continue  // Filters EVERY cell

        if (score > bestScore) {
            bestScore = score
            best = cell
        }
    }
    return best
}
```

This is O(all cells) per distance query. With multiple distance queries per exploration phase, this is a major bottleneck.

**Proposed Solution**:
Pre-bucket cells by distance during MapCellScore.refresh():

```javascript
// In MapCellScore
static Map<integer, Array<Cell>> cellsByDistance = [:]

static void refresh() {
    // ... existing code ...

    // After computing cellScores, bucket by distance
    cellsByDistance = [:]
    for (Cell cell : real score in cellScores) {
        integer? dist = Fight.self.reachableCells[cell]
        if (dist == null) continue
        if (!cellsByDistance[dist!]) cellsByDistance[dist!] = []
        push(cellsByDistance[dist!]!, cell)
    }
}

// Then in ComboExplorer:
static Cell? findBestCellAtDistance(ExplorationContext ctx, integer distance) {
    Array<Cell>? candidates = MapCellScore.cellsByDistance[distance]
    if (candidates == null) return null

    Cell? best = null
    real bestScore = -999999.0

    for (Cell cell in candidates!) {
        real score = MapCellScore.cellScores[cell]!
        if (score > bestScore) {
            bestScore = score
            best = cell
        }
    }
    return best
}
```

**Steps**:
1. Add `cellsByDistance` map to MapCellScore
2. Populate during `refresh()`
3. Update `findBestCellAtDistance` to use pre-bucketed data
4. Test thoroughly

**Risk**: MEDIUM - Changes hot path, needs testing.

---

### 3.2 Optimize Entity Effect Loading

- [ ] **Replace O(n) comparison chain with O(1) map lookup**

**File**: `Model/GameObject/Entity` lines 222-261

**Full Description**:
Effect loading uses 10+ elseif comparisons per effect:

```javascript
for(Array<boolean|integer> e in getEffects(this.id)!) {
    EntityEffect effect = EntityEffect(e)

    if(effect.type == EFFECT_POISON) {
        this.psnTurn += effect.value
    } else if(effect.type == EFFECT_HEAL) {
        this.psnTurn += -effect.value
    } else if(effect.type == EFFECT_SHACKLE_STRENGTH) {
        this.altStr += -effect.value
    } // ... 10+ more branches
}
```

Each comparison is O(1), but with 10+ effects on an entity and 10+ comparisons each, this adds up.

**Proposed Solution**:
Group effect types and use map lookup:

```javascript
// At class level
static Map<integer, integer> EFFECT_GROUPS = [
    EFFECT_POISON: 1,
    EFFECT_HEAL: 2,
    EFFECT_SHACKLE_STRENGTH: 3,
    // ... etc
]

// In loadEffects:
for(Array<boolean|integer> e in getEffects(this.id)!) {
    EntityEffect effect = EntityEffect(e)
    integer? group = EFFECT_GROUPS[effect.type]
    if (group == null) continue

    if (group! == 1) { // PSN group
        this.psnTurn += effect.value
        this.psnTotal += effect.value * effect.turns
    } else if (group! == 2) { // HEAL group
        // ...
    }
}
```

**Steps**:
1. Define effect group constants and mapping
2. Refactor effect processing to use groups
3. Test with various entity configurations

**Risk**: MEDIUM - Core entity initialization, needs thorough testing.

---

### 3.3 Combine Loops in Scoring.refresh()

- [ ] **Reduce entity iterations** (~50% fewer loops)

**File**: `AI/Scoring` lines 79-92

**Full Description**:
Current code iterates entities twice:

```javascript
// Loop 1: Build base coefs
for (Entity entity in Fight.getAllAlive()) {
    _cache_coef[entity] = [:]
    for (integer stat in ScoringConfig.ALL_STATS) {
        _cache_coef[entity]![stat] = EntityCoefs.getStatCoef(entity, stat)
    }
}

// Loop 2: Build dynamic coefs
for (Entity entity in Fight.getAllAlive()) {
    _cache_dynamic_coef[entity] = [:]
    for (integer stat in ScoringConfig.ALL_STATS) {
        _cache_dynamic_coef[entity]![stat] = _computeDynamicCoef(entity, stat, null)
    }
}
```

**Proposed Solution**:
Combine into single loop:

```javascript
for (Entity entity in Fight.getAllAlive()) {
    Map<integer, real> entityCoefs = [:]
    Map<integer, real> entityDynamicCoefs = [:]

    for (integer stat in ScoringConfig.ALL_STATS) {
        entityCoefs[stat] = EntityCoefs.getStatCoef(entity, stat)
        if (!ScoringConfig.DYNAMIC_COEFS) {
            entityDynamicCoefs[stat] = _computeDynamicCoef(entity, stat, null)
        }
    }

    _cache_coef[entity] = entityCoefs
    if (!ScoringConfig.DYNAMIC_COEFS) {
        _cache_dynamic_coef[entity] = entityDynamicCoefs
    }
}
```

**Steps**:
1. Merge loops in Scoring.refresh()
2. Test scoring calculations match

**Risk**: LOW - Same logic, fewer iterations.

---

### 3.4 Single Map Lookup Pattern

- [ ] **Avoid double lookups throughout codebase**

**File**: `AI/Scoring` lines 117-122 (and throughout)

**Full Description**:
Common anti-pattern of checking then accessing:

```javascript
// Current - Two lookups
static real getCoef(Entity entity, integer key) {
    if (_cache_coef[entity] == null) {  // Lookup 1
        _addEntityToCache(entity)
    }
    return _cache_coef[entity]![key]!   // Lookup 2
}
```

**Proposed Solution**:
Cache the lookup result:

```javascript
// Improved - One lookup
static real getCoef(Entity entity, integer key) {
    Map<integer, real>? entityMap = _cache_coef[entity]  // Single lookup
    if (entityMap == null) {
        _addEntityToCache(entity)
        entityMap = _cache_coef[entity]
    }
    return entityMap![key]!
}
```

**Steps**:
1. Search for pattern: `if (map[key] == null)` followed by `map[key]!`
2. Refactor each instance to cache the lookup
3. Apply across codebase (Scoring, MapAction, MapDanger, etc.)

**Risk**: LOW - Pattern-based refactoring.

---

### 3.5 Reduce Array Cloning in Cell.initAreas()

- [ ] **Build areas independently instead of cloning**

**File**: `Model/GameObject/Cell` lines 92-114

**Full Description**:
Cell initialization clones arrays repeatedly:

```javascript
Array<Cell> result = [this]
pushAll(result, this.neighborsObstacles)
_AREAS[AREA_CIRCLE_1] = clone(result) as Array<Cell>  // Clone 1

// ... add more cells ...
_AREAS[AREA_PLUS_2] = clone(result) as Array<Cell>    // Clone 2

// ... add more cells ...
_AREAS[AREA_CIRCLE_2] = clone(result) as Array<Cell>  // Clone 3
```

With 613 cells × 10+ areas = 6000+ clone operations at startup.

**Proposed Solution**:
Build each area independently:

```javascript
// AREA_CIRCLE_1
Array<Cell> circle1 = [this]
pushAll(circle1, this.neighborsObstacles)
_AREAS[AREA_CIRCLE_1] = circle1

// AREA_PLUS_2 - reference circle1 cells by value
Array<Cell> plus2 = []
pushAll(plus2, circle1)
// ... add plus2-specific cells ...
_AREAS[AREA_PLUS_2] = plus2
```

**Steps**:
1. Refactor initAreas() to build each area independently
2. Test area calculations match

**Risk**: MEDIUM - Initialization code, needs testing.

---

## Phase 4: Architecture Refactoring (High Risk)

Major structural changes requiring careful planning and testing.

### 4.1 Address God Class: Consequences

- [ ] **Extract sub-components from 858-line class**

**File**: `Model/Combos/Consequences`

**Full Description**:
Consequences class has 7 major responsibilities (violates Single Responsibility Principle):

1. **State simulation** - tracking alterations, kills, effects
2. **Copy-on-Write implementation** - materialize, clone, parent chain walking
3. **Effect scoring inline** - `add()` calls `Scoring.getDynamicCoef()`
4. **Resource tracking** - TP, MP, cell, weapon
5. **Pathfinding** - `construct()` calls `MapPath.getCachedReachableCells()`
6. **Target resolution** - `construct()` calls `Targets.getTargets()`
7. **Pending bulb management** - `handlePendingBulbBuff()`, `pendingBulbs` map

**Tight coupling**: Depends on Scoring, MapPath, Targets, EffectHandlers, ScoringConfig, Stats.

**Proposed Extractions**:
1. Extract COW logic to `ConsequencesStore` class
2. Move scoring to external `ConsequencesScorer` service
3. Move pathfinding/targeting to constructor caller
4. Create `PendingBulbManager` for bulb-related logic

**Steps**:
1. Create extraction plan with clear interfaces
2. Extract one component at a time
3. Test after each extraction
4. Update all callers

**Risk**: HIGH - Core class, affects everything.

---

### 4.2 Address God Class: ComboBuilder

- [ ] **Extract strategy classes from 841-line class**

**File**: `AI/Algorithms/ComboBuilder`

**Full Description**:
ComboBuilder contains 6 major responsibilities:

1. **Combo construction strategies** - 5 different modes
2. **MP buff calculation** - complex buff application logic
3. **Reachability filtering** - cell reach checks
4. **Action partitioning** - by cell grouping
5. **Greedy fallback logic** - when knapsack fails
6. **Bulb buff expansion** - special bulb handling

Has 15+ static methods, many with 7+ parameters.

**Proposed Extractions**:
1. Extract `SingleCellBuilder` class
2. Extract `TargetFocusBuilder` class
3. Extract `MultiCellBuilder` class
4. Extract `MPBuffCalculator` utility
5. Use builder pattern instead of parameter explosion

**Steps**:
1. Define strategy interface
2. Extract one strategy at a time
3. Test combo construction matches
4. Simplify main class to orchestrator

**Risk**: HIGH - Core algorithm, affects AI quality.

---

### 4.3 Introduce CombatContext Pattern

- [ ] **Decouple algorithms from global state**

**Full Description**:
Current code relies heavily on global state (`Fight.self`, `MapAction.*`, etc.). This makes testing difficult and prevents parallel exploration.

**Proposed Solution**:
Create context object passed to algorithms:

```javascript
class CombatContext {
    Entity self
    Map<integer, Entity> allies
    Map<integer, Entity> enemies
    Map<Cell, integer> reachableCells
    ActionPool actionPool
    ScoringService scoring
}

// Algorithms take context instead of accessing globals
class ComboExplorer {
    static Combo explore(CombatContext ctx) {
        // No more Fight.self, MapAction.*, etc.
    }
}
```

**Benefits**:
- Testable algorithms
- Clear data flow
- Parallel exploration possible (for ML training)

**Steps**:
1. Define CombatContext interface
2. Create context builder in init()
3. Update algorithms one at a time
4. Remove global state dependencies

**Risk**: HIGH - Architectural change, all algorithms affected.

---

### 4.4 Implement Lazy Copy-on-Write

- [ ] **Optimize COW to clone only on write**

**File**: `Model/Combos/Consequences` lines 134-136

**Full Description**:
Current COW marks ALL entities as local after materialization:

```javascript
// In constructor after materialization
for (Entity e : Map<integer, integer> _ in this._alterations) {
    this._localEntities[e] = true
}
```

This iterates every entity even though only a few may be modified.

**Proposed Solution**:
Mark local only on actual write:

```javascript
void _ensureLocalEntity(Entity entity) {
    if (_localEntities[entity]) return;  // Already local

    if (_parent != null) {
        // COW: clone parent's data for this entity
        Map<integer, integer>? parentAlts = _parent!.getAlterations(entity)
        if (parentAlts != null) {
            _alterations[entity] = clone(parentAlts!) as Map<integer, integer>
        }
    }
    _localEntities[entity] = true
}

// Call _ensureLocalEntity() in every write operation
```

**Steps**:
1. Profile current write frequency
2. Implement lazy marking
3. Test extensively (COW bugs are subtle)
4. Measure operation savings

**Risk**: HIGH - Core optimization, hard to debug if wrong.

---

## Future Features

Features that would enhance AI capabilities (not refactoring).

### Turn Number Modifiers

Late-game coefficient adjustments to implement in `Scoring.getDynamicCoef()`:

| Turn | Effect | Rationale |
|------|--------|-----------|
| `> 55` | HPMAX *= 0.2 | Erosion less valuable late game |
| `> 50` | RATIO_DANGER /= 2 | Less risk-averse late game |
| `> 58` | RATIO_DANGER /= 2 again | Very aggressive in final turns |

**Implementation**: Add `getTurnModifier(stat)` function in Scoring class.

---

### Cooldown-Based Modifiers

Remaining cooldown-based modifiers from old AI:

**Ally ICED_BULB - Strength Boost**:
- `CHIP_ICEBERG` cooldown == 0 → STR += 10
- `CHIP_STALACTITE` cooldown == 0 → STR += 10

**Ally ICED_BULB - TP Boost**:
- Both ICEBERG + STALACTITE ready → TP += 6
- Only ICEBERG ready && level < 200 → TP += 3

**Ally FIRE_BULB - TP Boost**:
- `CHIP_METEORITE` cooldown == 0 && level < 240 → TP += 4

**Enemy LEEK - Poison Value**:
- `CHIP_ANTIDOTE` cooldown > 1 OR not equipped → PSN += 35
- `CHIP_LIBERATION` cooldown > 1 OR not equipped → PSN += 15

---

### Interleaved Movement in MCTS

Mid-combo repositioning: move → attack → move → attack.

**When to consider movement**: Only when current cell has ≤1 valid offensive action.

**How to prune**: Only offer top 3 cells by `(bestActionScore - moveCost * penalty)`.

**Prerequisites**:
- Precompute `cellBestScores[cell]` = max action score from each cell
- Reuse `MapPath.getCachedReachableCells()` for reachability

**When to implement**: After unified MCTS is stable, measure how often repositioning helps.

---

## Reference: Unscored Effects

Effects the AI currently ignores.

### Movement Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_TELEPORT` | Teleport to a cell | AI ignores teleportation chips |
| `EFFECT_INVERT` | Swap positions with target | AI ignores inversion chips |
| `EFFECT_PUSH` | Push target away | AI ignores push effects |
| `EFFECT_ATTRACT` | Pull target closer | AI ignores attract/grapple effects |
| `EFFECT_REPEL` | Repel targets | AI ignores repel effects |

**To implement**: Integrate with `MapDanger` to evaluate position changes.

### Summoning Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_SUMMON` | Summon a bulb | AI ignores summoning chips |
| `EFFECT_RESURRECT` | Resurrect dead ally | AI ignores resurrection chips |

**To implement**: Evaluate bulb value vs TP/chip cost.

### State Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_ADD_STATE` | Apply states (stunned, etc.) | AI doesn't evaluate state value |

**To implement**: State→value mapping (stunned = enemy's average turn damage).

---

## Reference: Passive Effects

### Working Passives

| Passive | Trigger | Who has passive | Who gets bonus | Status |
|---------|---------|-----------------|----------------|--------|
| `DAMAGE_TO_STRENGTH` | Take damage | Target | Target | Working |
| `DAMAGE_TO_ABSOLUTE_SHIELD` | Take damage | Target | Target | Working |
| `NOVA_DAMAGE_TO_MAGIC` | Take erosion | Target | Target | Working |
| `POISON_TO_SCIENCE` | Get poisoned | Target | Target | Working |
| `KILL_TO_TP` | Kill enemy | Killer (self) | Killer (self) | Working |

### Unimplemented Passives

| Passive | Problem | Complexity |
|---------|---------|------------|
| `MOVED_TO_MP` | Triggers on movement, not item use | Medium |
| `CRITICAL_TO_HEAL` | Requires crit simulation | Medium |
| `ALLY_KILLED_TO_AGILITY` | Requires iterating all allies of killed entity | Not feasible |

### Future: Enemy Passives in Danger Map

Account for enemy passive bonuses when calculating danger:
- Enemy with DAMAGE_TO_STRENGTH gets stronger after each hit
- Enemy with KILL_TO_TP gains TP on kill → more actions
- Enemy with DAMAGE_TO_ABSOLUTE_SHIELD gains survivability

**Complexity**: High - requires multi-turn sequence prediction.

---

## Notes

- **LeekScript v4** (typed variant)
- **LS4 null coercion**: `null` → `0` in numeric contexts
- **Type annotations are FREE**: Zero runtime operation cost (empirically tested)
- **Cell 1312** (`Cell.SELF_CAST_ID`): Sentinel for self-cast actions (outside valid range 0-612)
- **Entity.extendedType**: Cached bulb type (101-108) computed once in constructor

### Naming Conventions

Standardize to:
- Private fields: `_camelCase`
- Public fields: `camelCase`
- Constants: `SCREAMING_SNAKE`
- Local variables: `camelCase`
- Map caches: `_cache_*` for computed data, `_index_*` for lookup maps

### Variable Abbreviations

Use consistently:
- `consequences` → `csq`
- `damage` → `damage` (not `dmg` or `dommage`)
- `position` → `pos`
- `entity` → `entity` in signatures, `e` in loops
