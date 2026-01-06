# AI Code TODO

Reference for issues and improvements in the LeekScript combat AI.

---

## Pending Tasks

### Position Magic Numbers
Move magic numbers from Position to Scoring for consistency.

---

## Unscored Effects

### Movement Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_TELEPORT` | Teleport to a cell | AI ignores teleportation chips |
| `EFFECT_INVERT` | Swap positions with target | AI ignores inversion chips |
| `EFFECT_PUSH` | Push target away | AI ignores push effects |
| `EFFECT_ATTRACT` | Pull target closer | AI ignores attract/grapple effects |
| `EFFECT_REPEL` | Repel targets | AI ignores repel effects |

**To implement**: Integrate with `MapDanger` to evaluate position changes and their impact on danger/opportunity.

### Summoning Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_SUMMON` | Summon a bulb | AI ignores summoning chips |
| `EFFECT_RESURRECT` | Resurrect dead ally | AI ignores resurrection chips |

**To implement**: Evaluate bulb value (HP, damage potential, utility) and factor in TP/chip cost vs expected return.

### State Effects

| Effect | Description | Impact |
|--------|-------------|--------|
| `EFFECT_ADD_STATE` | Apply states (stunned, etc.) | AI doesn't evaluate state value |

**To implement**: State->value mapping (e.g., stunned = enemy's average turn damage value).

---

## Passive Effects

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
| `MOVED_TO_MP` | Triggers on movement, not item use. Movement isn't processed through Consequences. | Medium |
| `CRITICAL_TO_HEAL` | Requires crit simulation (currently using avg damage). Formula: `crit_rate = agility / (agility + 1000)` | Medium |
| `ALLY_KILLED_TO_AGILITY` | Requires iterating all allies of killed entity to find passive holders. Cannot handle with current architecture. | Not feasible |

### Future: Enemy Passives in Danger Map

When calculating danger from enemy attacks, account for their passive bonuses:
- Enemy with DAMAGE_TO_STRENGTH gets stronger after each hit
- Enemy with KILL_TO_TP gains TP on kill -> more actions
- Enemy with DAMAGE_TO_ABSOLUTE_SHIELD gains survivability

**Complexity**: High - requires multi-turn sequence prediction.

---

## Performance

- [ ] **Cell.ls:77-231** - Heavy area initialization (11 arrays x 613 cells)
- [ ] **Consequences.ls:25-26** - Deep clone on every action evaluation
- [ ] **main.ls:31-39** - `failSafe()` uses force-unwrap on items that may not be equipped

### Consequences Clone Optimization - Copy-on-Write Pattern

**Problem**: Deep clone on every action evaluation (~150×/MCTS search = 2-3M ops/search).

**Proposed Solution**: Copy-on-Write (CoW) pattern - shallow copy initially, only deep clone when modifying.

```javascript
// Shallow copy initially
this._alterations = consequences._alterations
this._alterationsModified = false

// Only clone when writing
function setAlteration(entity, stat, value) {
    if (!this._alterationsModified) {
        this._alterations = clone(this._alterations, 2)
        this._alterationsModified = true
    }
    // ... write
}
```

**Needs deeper study**:
- [ ] Profile actual write frequency vs read-only paths in MCTS/PTS/Beam
- [ ] Identify which fields are most frequently modified (_alterations, _altEffects, _killed?)
- [ ] Measure baseline operation count to quantify improvement
- [ ] Consider object pooling as alternative (reuse Consequences objects)
- [ ] Risk: CoW adds branching overhead - only beneficial if writes are infrequent

## Code Quality

- [ ] Standardize comments language (mixed French/English)
- [ ] **Targets.ls:153-292** - Refactor duplicate launch type handlers

---

## Future Modifiers (from old weight system)

### Turn Number Modifiers
Late-game coefficient adjustments from old AI - to be implemented in `Scoring.getDynamicCoef()`:

| Turn | Effect | Rationale |
|------|--------|-----------|
| `> 55` | HPMAX *= 0.2 | Erosion less valuable late game (fewer turns to benefit) |
| `> 50` | RATIO_DANGER /= 2 | Less risk-averse late game |
| `> 58` | RATIO_DANGER /= 2 again | Very aggressive in final turns |
| `< 55` | WSD_BOOST -= 25 | Wisdom buff less valuable early? (needs review) |

**Implementation**: Add `getTurnModifier(stat)` function in Scoring class.

### Cooldown-Based Modifiers (Remaining)
Some cooldown-based modifiers from old AI. WSD/RST are now implemented via `getChipReadyModifier()`.

#### For Ally ICED_BULB - Strength Boost (Stats.STR)
Boost strength when iced bulb has damage chips ready:

| Chip | Condition | Effect | Rationale |
|------|-----------|--------|-----------|
| `CHIP_ICEBERG` | cooldown == 0 | STR += 10 | Big ice attack ready |
| `CHIP_STALACTITE` | cooldown == 0 | STR += 10 | Ice attack ready |

#### For Ally ICED_BULB - TP Boost (Stats.TP)
| Chips | Condition | Effect | Rationale |
|-------|-----------|--------|-----------|
| `ICEBERG` + `STALACTITE` | both cooldown == 0 | TP += 6 | Full combo ready |
| `CHIP_ICEBERG` | cooldown == 0 && level < 200 | TP += 3 | Low level, big attack ready |

#### For Ally FIRE_BULB - TP Boost (Stats.TP)
| Chip | Condition | Effect | Rationale |
|------|-----------|--------|-----------|
| `CHIP_METEORITE` | cooldown == 0 && level < 240 | TP += 4 | Big fire attack ready |

#### For Enemy LEEK - Poison Value (Stats.HPTIME)
Boost poison when enemy can't cleanse:

| Chip | Condition | Effect | Rationale |
|------|-----------|--------|-----------|
| `CHIP_ANTIDOTE` | cooldown > 1 OR not equipped | PSN += 35 | Can't cure poison |
| `CHIP_LIBERATION` | cooldown > 1 OR not equipped | PSN += 15 | Can't remove debuffs |

---

## Future: Interleaved Movement in MCTS

Mid-combo repositioning: move → attack → move → attack (instead of move once, then all actions).

### Strategy 1+2: Escape Hatch + Top K Pruning

**When to consider movement**: Only when current cell has few/no valid offensive actions left (≤1 action).

**How to prune**: Only offer top 3 cells by `(bestActionScore - moveCost * penalty)`.

```
// Pseudo-code for action expansion
getExpandableActions(node, baseActions):
    valid = filterValidActions(baseActions, node)

    // Normal case: enough offensive options, no movement
    if count(valid) >= 2:
        return valid

    // Stuck case: add top 3 repositioning cells
    if node.remainingMP > 0:
        topCells = getTopRepositionCells(node, 3)  // scored by opportunity - move cost
        for cell in topCells:
            push(valid, MoveAction(cell))

    return valid
```

**Branching impact**: +3 only when stuck, not every node.

**Prerequisites**:
- Precompute `cellBestScores[cell]` = max action score from each cell
- Reuse existing `MapPath.getCachedReachableCells()` for reachability

**When to implement**: After unified MCTS is stable, measure how often mid-combo repositioning would help (>20% of turns = worth it).

---

## Notes

- **LeekScript v4** (typed variant)
- **LS4 null coercion**: `null` -> `0` in numeric contexts
