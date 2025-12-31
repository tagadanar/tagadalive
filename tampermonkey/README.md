# LeekWars Fight Analyzer

A modular Tampermonkey userscript that provides AI debug visualization, profiler, and advanced statistics for LeekWars fight reports.

## Features

- **Turn-by-turn navigation**: Browse through each turn of your AI's execution
- **Performance profiler**: See operation counts and percentages for each function, grouped by category
- **MCTS visualization**: Track iterations, nodes explored, positions evaluated, and best scores
- **Combo analysis**: View top-scored combos with action scores and position breakdown
- **Resource tracking**: Monitor HP, TP, MP, cell position, and entity counts
- **Action logs**: See movement, attacks, heals, buffs, and kills with structured formatting
- **Native UI integration**: Seamlessly integrates with LeekWars' dark/light theme

## Architecture

The script is split into 6 modular files for easier maintenance:

```
tampermonkey/
├── lwa-core.user.js      # Core: state, colors, helpers (~11KB)
├── lwa-styles.user.js    # Styles: CSS only (~45KB)
├── lwa-parser.user.js    # Parser: log parsing (~26KB)
├── lwa-ui.user.js        # UI: rendering functions (~45KB)
├── lwa-charts.user.js    # Charts: Chart.js + Analysis (~26KB)
└── lwa-main.user.js      # Main: init + orchestration (~11KB)
```

**Load order**: The modules must load in this order (handled by `@run-at` directive):
1. `lwa-core` (document-start) - Sets up shared namespace `unsafeWindow.LWA`
2. `lwa-styles` (document-start) - Injects CSS
3. `lwa-parser` (document-body) - Adds parsing functions
4. `lwa-ui` (document-body) - Adds UI rendering
5. `lwa-charts` (document-body) - Adds Chart.js visualizations
6. `lwa-main` (document-idle) - Initializes the application

Each module uses `@inject-into content` for script isolation, and cross-context arrays are defined locally to avoid permission issues.

## Installation

### Modular Installation (Recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Create **6 new scripts** in Tampermonkey (one for each module)
3. Copy each `lwa-*.user.js` file content into its corresponding script
4. Save all scripts (Ctrl+S)
5. Ensure all 6 scripts are enabled
6. Navigate to any fight report page (`https://leekwars.com/report/*`)

### Quick Installation Order

Install in this exact order:
1. `lwa-core.user.js`
2. `lwa-styles.user.js`
3. `lwa-parser.user.js`
4. `lwa-ui.user.js`
5. `lwa-charts.user.js`
6. `lwa-main.user.js`

## How It Works

### The Benchmark Protocol

The script parses structured debug output from the `Services/Benchmark` class in your LeekScript AI. The Benchmark class outputs a single `debug()` call at the end of each turn with a special marker format:

```
##MARKER##T5|n:TagadaLive|o:45000/500000|hp:450/500|tp:8|mp:3|c:256|e:2|a:1|m:100,500,50,1234|ch:850,3,Flash(81)→Spark(120)→mv(256:180=0d+0p-57g+0t+0s)
```

### Combo Description Format

Actions and positions use a detailed format:

```
Flash(81)→Spark(120)→mv(256:180=0d+0p-57g+0t+0s)
```

Where:
- `Flash(81)` - Action "Flash" with score 81
- `Spark(120)` - Action "Spark" with score 120
- `mv(256:180=0d+0p-57g+0t+0s)` - Move to cell 256, total score 180, breakdown:
  - `d` = danger (enemy damage potential)
  - `p` = proximity (nearby enemy penalty)
  - `g` = gravity (target attraction/repulsion)
  - `t` = tactical (lock, CAC, COVID bonuses)
  - `s` = shield (value of kept shields)

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
| `ch:` | Chosen combo (score,actions,desc) | `ch:850,3,Flash(81)→mv(256:...)` |
| `cb:` | Top combo (score,actScore,posScore,desc) | `cb:900,600,300,Spark(120)→...` |
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

## Module Details

### lwa-core.user.js
- Shared namespace `unsafeWindow.LWA`
- Global state management
- Color palette
- Helper functions (`fmt`, `pct`, `opsClass`, `formatComboDesc`)
- Global onclick handlers

### lwa-styles.user.js
- All CSS styles
- LeekWars theme integration
- Responsive layout rules

### lwa-parser.user.js
- `parseLogs()` - Main log parser
- `computeAggregatedStats()` - Statistics aggregation
- `parseTimelineEvents()` - Timeline event parsing
- Error and crash detection

### lwa-ui.user.js
- `createPanel()` - Panel creation
- `render()` - Main render function
- `renderOverview()` - Overview tab
- `renderCombos()` - Combos tab
- `renderProfiler()` - Profiler tab
- `renderLogs()` - Logs tab
- `renderTimeline()` - Timeline tab
- `renderAggregatedStats()` - Stats tab

### lwa-charts.user.js
- `detectAnomalies()` - Anomaly detection
- `renderAnalysis()` - Analysis tab
- `initAnalysisCharts()` - Chart.js initialization
- `computeActionStats()` - Action statistics
- HP/Score chart visualizations

### lwa-main.user.js
- `fetchLogs()` - Log fetching from DOM/Vue/API
- `switchEntity()` - Entity switching
- `injectJumpButtons()` - Turn jump buttons
- `initAll()` - Application initialization

## Screenshots

The analyzer integrates natively with LeekWars UI:
- Matches LeekWars color scheme (dark/light mode)
- Uses familiar panel styling
- Responsive grid layout for stats
- Collapsible log categories
