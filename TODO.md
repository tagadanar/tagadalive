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

## Code Quality

- [ ] Standardize comments language (mixed French/English)
- [ ] **Targets.ls:153-292** - Refactor duplicate launch type handlers

---

## Notes

- **LeekScript v4** (typed variant)
- **LS4 null coercion**: `null` -> `0` in numeric contexts
