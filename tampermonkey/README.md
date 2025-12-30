# LeekWars Fight Analyzer

A Tampermonkey userscript that provides AI debug visualization, profiler, and advanced statistics for LeekWars fight reports.

## Features

- **Turn-by-turn navigation**: Browse through each turn of your AI's execution
- **Performance profiler**: See operation counts and percentages for each function, grouped by category
- **MCTS visualization**: Track iterations, nodes explored, positions evaluated, and best scores
- **Combo analysis**: View top-scored combos with their position and action scores
- **Resource tracking**: Monitor HP, TP, MP, cell position, and entity counts
- **Action logs**: See movement, attacks, heals, buffs, and kills with structured formatting
- **Native UI integration**: Seamlessly integrates with LeekWars' dark/light theme

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click on the Tampermonkey icon → "Create a new script"
3. Copy the contents of `leekwars-fight-analyzer.user.js` and paste it
4. Save (Ctrl+S)
5. Navigate to any fight report page (`https://leekwars.com/report/*`)

## How It Works

### The Benchmark Protocol

The script parses structured debug output from the `Services/Benchmark` class in your LeekScript AI. The Benchmark class outputs a single `debug()` call at the end of each turn with a special marker format:

```
##MARKER##T5|n:TagadaLive|o:45000/500000|hp:450/500|tp:8|mp:3|c:256|e:2|a:1|m:100,500,50,1234|ch:850,3,Flash>Enemy...
```

### Debug Format Reference

| Prefix | Content | Example |
|--------|---------|---------|
| `T` | Turn number | `T5` |
| `n:` | Entity name | `n:TagadaLive` |
| `o:` | Operations used/max | `o:45000/500000` |
| `hp:` | Current/max health | `hp:450/500` |
| `tp:` | Action points | `tp:8` |
| `mp:` | Movement points | `mp:3` |
| `c:` | Cell position | `c:256` |
| `e:` | Enemy count | `e:2` |
| `a:` | Ally count | `a:1` |
| `m:` | MCTS stats (iter,nodes,pos,best) | `m:100,500,50,1234` |
| `ch:` | Chosen combo (score,actions,desc) | `ch:850,3,Flash>Enemy` |
| `cb:` | Top combo (score,actScore,posScore,desc) | `cb:900,600,300,Spark>Target` |
| `cat:` | Function category | `cat:MCTS` |
| `f:` | Function stats (name,calls,total,pct,parent) | `f:AI.search,10,5000,11,` |
| `l:` | Log entry | `l:Attack dealt 150 damage` |

### Function Categories

The profiler groups functions into categories for easier analysis:

| Category | Functions |
|----------|-----------|
| INIT | `init`, `Map.init`, `Items.init` |
| REFRESH | `MapPath.refresh`, `Fight.refresh`, `Map.refresh`, etc. |
| MCTS | `AI.getMCTSCombo`, `MCTS.iter` |
| POSITION | `MP.evalPos`, `MP.findBest` |
| ACTION | `addAction` |
| CONSEQUENCES | `Consequences`, `Consequences.fromConseq` |
| OTHER | Any function not in above categories |

## Using Benchmark in Your AI

### Basic Profiling

```javascript
// At start of turn
Benchmark.initTurn()

// Wrap expensive functions
Benchmark.start("MyFunction")
// ... your code ...
Benchmark.stop("MyFunction")

// At end of turn
Benchmark.display()
```

### Logging Actions

```javascript
// Movement
Benchmark.logMove(fromCell, toCell)

// Combat
Benchmark.logAttack("Pistol", targetId, damage)
Benchmark.logHeal("Cure", amount)
Benchmark.logKill(targetId)
Benchmark.logBuff("Shield")

// General
Benchmark.log("Custom message")
Benchmark.logWarn("Warning!")
Benchmark.logError("Error occurred")
```

### Tracking MCTS/AI Decisions

```javascript
// After MCTS search
Benchmark.setMCTS(iterations, nodesExplored, positionsEvaluated, bestScore)

// After choosing final action
Benchmark.setChosen(score, actionCount, description)

// Add top combos for analysis
Benchmark.addCombo(totalScore, actionCount, description, positionScore, actionScore)
```

## Viewing Results

1. Run a fight (test or real)
2. Open the fight report page
3. The analyzer panel appears below the fight replay
4. Select your entity from the dropdown (if multiple)
5. Use Prev/Next buttons to navigate turns
6. Click on tabs to see Overview, Profiler, Combos, or Logs

## Screenshots

The analyzer integrates natively with LeekWars UI:
- Matches LeekWars color scheme (dark/light mode)
- Uses familiar panel styling
- Responsive grid layout for stats
- Collapsible log categories
