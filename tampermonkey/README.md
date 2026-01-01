# LeekWars Fight Analyzer

A modular Tampermonkey userscript that provides AI debug visualization, profiler, and advanced statistics for LeekWars fight reports and fight pages.

## Features

- **Turn-by-turn navigation**: Browse through each turn of your AI's execution
- **Performance profiler**: See operation counts and percentages for each function, grouped by category
- **MCTS visualization**: Track iterations, nodes explored, positions evaluated, and best scores
- **Combo analysis**: View top-scored combos with action scores and position breakdown
- **Resource tracking**: Monitor HP, TP, MP, RAM, cell position, and entity counts
- **Resource charts**: Visualize HP%, TP Used%, MP Used%, and RAM Used% over time
- **Action logs**: See movement, attacks, heals, buffs, and kills with structured formatting
- **Native UI integration**: Seamlessly integrates with LeekWars' dark/light theme
- **Fight page support**: View stats on `/fight/*` pages with a resizable, collapsible side panel
- **Cache system**: Logs are cached in localStorage for viewing on fight pages
- **Quick navigation**: Jump between report and fight pages with one click

## Page Support

| Page | Features |
|------|----------|
| **Report** (`/report/*`) | Full panel at bottom, logs cached automatically, button to view fight |
| **Fight** (`/fight/*`) | Side panel (collapsible), toggle to bottom position, resizes combat player |

## Architecture

The script is split into 6 modular files for easier maintenance:

```
tampermonkey/
├── lwa-core.user.js      # Core: state, cache, settings, helpers
├── lwa-styles.user.js    # Styles: CSS only
├── lwa-parser.user.js    # Parser: log parsing
├── lwa-ui.user.js        # UI: rendering, cache modal, side panel
├── lwa-charts.user.js    # Charts: Chart.js + Analysis
└── lwa-main.user.js      # Main: init + orchestration
```

**Current versions**: Core/Styles/UI/Main at v1.5.0, Parser/Charts at v1.1.0

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

## Cache System

### How it works

- When you visit a **report page**, logs are automatically saved to localStorage
- When you visit a **fight page**, logs are loaded from the cache
- If no cache exists for a fight, nothing is shown on the fight page
- Cache is automatically cleaned up after 48 hours (configurable)

### Cache Management

Click the cache button in the panel header to:
- View all cached fights with dates and sizes
- Change the cache duration (default: 48 hours)
- Manually cleanup old fights
- Delete individual cached fights
- Clear all cache

## Fight Page Side Panel

On fight pages, the analyzer displays as a **resizable, collapsible side panel**:

- **Toggle button**: Chevron on the right edge with multiple functions:
  - **Click**: Collapse/expand the panel
  - **Drag horizontally**: Resize the panel width (drag left = wider, drag right = narrower)
  - **Double-click**: Reset to default width (400px)
- **Width limits**: Min 280px, max 70% of screen or 800px
- **Position toggle**: Button in header to switch between side and bottom modes
- **Responsive resize**: Combat player automatically resizes when panel opens/closes or is resized
- **State persistence**: Panel position, collapsed state, and custom width are saved in settings

## How It Works

### The Benchmark Protocol

The script parses structured debug output from the `Services/Benchmark` class in your LeekScript AI. The Benchmark class outputs a single `debug()` call at the end of each turn with a special marker format:

```
##MARKER##T5|n:TagadaLive|o:45000/500000|hp:450/500|tp:2/10|mp:1/4|ram:1500/3000|c:256|e:2|a:1|m:100,500,50,1234|ch:850,3,Flash(81)->Spark(120)->mv(256:180=0d+0p-57g+0t+0s)
```

### Combo Description Format

Actions and positions use a detailed format:

```
Flash(81)->Spark(120)->mv(256:180=0d+0p-57g+0t+0s)
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
| `tp:` | Remaining/max action points | `tp:2/10` |
| `mp:` | Remaining/max movement points | `mp:1/4` |
| `ram:` | Used/max RAM | `ram:1500/3000` |
| `c:` | Cell position | `c:256` |
| `e:` | Enemy count | `e:2` |
| `a:` | Ally count | `a:1` |
| `m:` | MCTS stats (iter,nodes,pos,best) | `m:100,500,50,1234` |
| `ch:` | Chosen combo (score,actions,desc) | `ch:850,3,Flash(81)->mv(256:...)` |
| `cb:` | Top combo (score,actScore,posScore,desc) | `cb:900,600,300,Spark(120)->...` |
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

### On Report Page
1. Run a fight (test or real)
2. Open the fight report page (`/report/{id}`)
3. The analyzer panel appears below the fight replay
4. Logs are automatically cached for later viewing
5. Click the play button to view the fight

### On Fight Page
1. Visit a fight page (`/fight/{id}`)
2. If logs are cached, the side panel appears
3. Use the chevron button to:
   - **Click**: Collapse/expand the panel
   - **Drag**: Resize the panel width
   - **Double-click**: Reset to default width
4. The combat player resizes automatically
5. Use the position button to switch to bottom mode

## Module Details

### lwa-core.user.js
- Shared namespace `unsafeWindow.LWA`
- Global state management
- **Cache system** (localStorage-based)
- **User settings** (persistent, never auto-cleared)
- Color palette
- Helper functions (`fmt`, `pct`, `opsClass`, `formatComboDesc`)
- Global onclick handlers

### lwa-styles.user.js
- All CSS styles
- LeekWars theme integration
- Responsive layout rules
- **Side panel styles** (fixed position, transitions, CSS variable for width)
- **Toggle button styles** (resize cursor, visual feedback)
- Cache modal styles

### lwa-parser.user.js
- `parseLogs()` - Main log parser
- `computeAggregatedStats()` - Statistics aggregation
- `parseTimelineEvents()` - Timeline event parsing
- Error and crash detection

### lwa-ui.user.js
- `createPanel()` - Panel creation
- `injectPanel()` - Panel injection (bottom or side mode)
- `render()` - Main render function
- `renderOverview()` - Overview tab
- `renderCombos()` - Combos tab
- `renderProfiler()` - Profiler tab
- `renderLogs()` - Logs tab
- `renderTimeline()` - Timeline tab
- `renderAggregatedStats()` - Stats tab
- **`openCacheModal()`** - Cache management modal
- **Side panel toggle** - Collapse/expand with drag-to-resize

### lwa-charts.user.js
- `detectAnomalies()` - Anomaly detection
- `renderAnalysis()` - Analysis tab
- `renderAnalysisCharts()` - Chart.js initialization
- `computeActionStats()` - Action statistics
- **Charts**: HP%, Score, TP Used%, MP Used%, RAM Used%

### lwa-main.user.js
- `fetchLogs()` - Log fetching from DOM/Vue/Cache
- `switchEntity()` - Entity switching
- `injectJumpButtons()` - Turn jump buttons
- Page detection (`isReportPage`, `isFightPage`)
- SPA navigation handling

## Configuration

### Settings (persisted in localStorage)

| Setting | Default | Description |
|---------|---------|-------------|
| `fightPanelPosition` | `'side'` | Panel position on fight page (`'side'` or `'bottom'`) |
| `fightPanelCollapsed` | `false` | Whether side panel is collapsed |
| `fightPanelWidth` | `400` | Custom width of side panel in pixels (280-800) |

### Cache Configuration

| Config | Default | Description |
|--------|---------|-------------|
| `CACHE_MAX_AGE_HOURS` | `48` | Auto-cleanup after this many hours |
| `MAX_FETCH_ATTEMPTS` | `2` | Number of retry attempts for loading logs |
| `FETCH_RETRY_DELAY` | `1000` | Delay between retries (ms) |

## Screenshots

The analyzer integrates natively with LeekWars UI:
- Matches LeekWars color scheme (dark/light mode)
- Uses familiar panel styling
- Responsive grid layout for stats
- Collapsible log categories
- Side panel with smooth transitions on fight pages
