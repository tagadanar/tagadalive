// ==UserScript==
// @name         LeekWars Fight Analyzer
// @namespace    https://leekwars.com/
// @version      1.0.0
// @description  AI debug visualization, profiler & advanced stats for LeekWars fights - Integrated UI
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        GM_addStyle
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js
// ==/UserScript==

(function() {
    'use strict';

    const MARKER = '##MARKER##';
    const VERSION = '1.0.0';

    // ========================================
    // Global state
    // ========================================
    let entitiesData = {};
    let currentEntity = null;
    let turnData = [];
    let currentIdx = 0;
    let activeTab = 'overview';
    let logsExpanded = false;
    let fetchAttempts = 0;
    const MAX_FETCH_ATTEMPTS = 5;
    const FETCH_RETRY_DELAY = 2000;

    // ========================================
    // Global functions (must use unsafeWindow for page context onclick handlers)
    // ========================================
    unsafeWindow.lwaJumpToIdx = function(idx) {
        if (idx >= 0 && idx < turnData.length) {
            currentIdx = idx;
            activeTab = 'overview';
            render();
            const panel = document.getElementById('lwa-analyzer');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    unsafeWindow.lwaJumpToTurn = function(turnNum) {
        const idx = turnData.findIndex(t => t.t === turnNum);
        if (idx !== -1) {
            currentIdx = idx;
            render();
            const panel = document.getElementById('lwa-analyzer');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    unsafeWindow.lwaToggleAllLogs = function() {
        logsExpanded = !logsExpanded;
        const btn = document.querySelector('.lwa-expand-all-btn');
        const categories = document.querySelectorAll('.lwa-log-category');

        categories.forEach((cat, index) => {
            const content = cat.querySelector('.lwa-log-cat-content');
            const toggle = cat.querySelector('.lwa-log-cat-toggle');
            if (content && toggle) {
                if (logsExpanded) {
                    content.classList.remove('hidden');
                    toggle.classList.remove('collapsed');
                } else {
                    // Keep the first one (Summary) open
                    if (index !== 0) {
                        content.classList.add('hidden');
                        toggle.classList.add('collapsed');
                    }
                }
            }
        });

        if (btn) {
            btn.innerHTML = logsExpanded
                ? '<span class="expand-icon">▲</span> Tout replier'
                : '<span class="expand-icon">▼</span> Tout déplier';
        }
    };

    unsafeWindow.lwaRetryFetch = function() {
        console.log('[LWA] Manual retry triggered');
        fetchAttempts = 0;
        const content = document.getElementById('lwa-content');
        if (content) {
            content.innerHTML = `
                <div class="lwa-loading">
                    <div class="lwa-loading-spinner"></div>
                    <div class="lwa-loading-text">Retrying...</div>
                </div>
            `;
        }
        setTimeout(fetchLogs, 500);
    };

    unsafeWindow.lwaShowRawLog = function(category) {
        const d = turnData[currentIdx];
        if (!d) return;

        let rawContent = '';
        if (category === 'SUMMARY') {
            rawContent = `MCTS: ${d.mcts.pos} pos, ${d.mcts.iter} iter, ${d.mcts.nodes} nodes, score=${d.mcts.best}\n`;
            rawContent += `Turn ${d.t}: ${d.chosen.actions} actions, score=${d.chosen.score}\n`;
            if (d.chosen.desc) rawContent += `Chosen: ${d.chosen.desc}\n`;
            rawContent += `Operations: ${d.ops}/${d.max} (${Math.round(d.ops * 100 / d.max)}%)\n`;
            if (d.displayOps > 0) rawContent += `Display ops: ${d.displayOps}`;
        } else {
            const methods = d.methods.filter(m => (m.category || 'OTHER') === category);
            rawContent = `=== ${category} ===\n`;
            methods.sort((a, b) => b.total - a.total);
            for (const m of methods) {
                const avg = m.calls > 0 ? Math.round(m.total / m.calls) : 0;
                rawContent += `${m.name}: ${m.calls} calls, avg=${avg}, total=${m.total}\n`;
            }
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'lwa-raw-modal';
        modal.innerHTML = `
            <div class="lwa-raw-modal-content">
                <div class="lwa-raw-modal-header">
                    <span>Raw Log - ${category}</span>
                    <button onclick="this.closest('.lwa-raw-modal').remove()">✕</button>
                </div>
                <pre class="lwa-raw-modal-body">${rawContent}</pre>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    };

    // ========================================
    // Color Palette (Native LeekWars colors)
    // ========================================
    const C = {
        // Use CSS variables from LeekWars theme
        bg: 'var(--background)',
        bgPanel: 'var(--background)',
        bgHeader: '#2a2a2a',
        bgCard: 'var(--background-header, #f5f5f5)',
        bgCardAlt: 'var(--background-secondary, #eee)',
        border: 'var(--border, #ddd)',
        borderLight: 'var(--border-light, #ccc)',
        // LeekWars accent colors
        green: '#5fad1b',
        greenLight: '#6ec91f',
        greenDark: '#4a8a15',
        blue: '#32b2da',
        blueLight: '#41d3ff',
        orange: '#ff8800',
        orangeLight: '#ffaa33',
        red: '#e22424',
        redLight: '#ff4444',
        purple: '#a017d6',
        yellow: '#f0c040',
        cyan: '#2bc491',
        teal: '#38e9ae',
        // Text colors
        text: 'var(--text-color, #333)',
        textMuted: 'var(--text-color-secondary, #666)',
        textDim: '#888',
        textLight: '#eee',
        white: '#ffffff'
    };

    // ========================================
    // Styles - Native LeekWars Integration
    // ========================================
    const styles = `
        /* ===== LWA INTEGRATED PANEL - Native LeekWars Style ===== */
        .lwa-panel {
            margin-bottom: 12px;
        }

        .lwa-panel .panel {
            background: ${C.bg};
            border-radius: 4px;
            box-shadow: 0px 10px 11px -11px rgba(0,0,0,0.75);
            overflow: hidden;
        }

        .lwa-panel .panel .header {
            height: 36px;
            background: ${C.bgHeader};
            border-radius: 3px 3px 0 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .lwa-panel .panel .header h2 {
            margin: 0;
            font-size: 18px;
            line-height: 36px;
            padding: 0 12px;
            color: ${C.textLight};
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .lwa-panel .panel .header .version {
            font-size: 10px;
            background: rgba(255,255,255,0.15);
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 8px;
            color: ${C.textLight};
        }

        .lwa-panel .panel .content {
            padding: 15px;
            color: ${C.text};
        }

        /* Entity Selector */
        .lwa-entity-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            background: ${C.bgCard};
            border-bottom: 1px solid ${C.border};
        }

        .lwa-entity-bar label {
            color: ${C.textMuted};
            font-size: 13px;
        }

        .lwa-entity-bar select {
            flex: 1;
            max-width: 250px;
            background: var(--pure-white, #fff);
            color: ${C.text};
            border: 1px solid ${C.border};
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 13px;
            cursor: pointer;
        }

        .lwa-entity-bar select:hover {
            border-color: ${C.green};
        }

        /* Navigation */
        .lwa-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 10px;
            background: ${C.bgCard};
            border-radius: 4px;
            margin-bottom: 12px;
            border: 1px solid ${C.border};
        }

        .lwa-nav-btn {
            background: ${C.green};
            border: none;
            color: ${C.white};
            padding: 6px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.15s;
        }

        .lwa-nav-btn:hover:not(:disabled) {
            background: ${C.greenLight};
        }

        .lwa-nav-btn:disabled {
            background: #ccc;
            color: #888;
            cursor: not-allowed;
        }

        .lwa-turn-label {
            font-weight: 700;
            font-size: 15px;
            color: ${C.text};
            min-width: 120px;
            text-align: center;
        }

        .lwa-goto-btn {
            background: ${C.blue};
            border: none;
            color: ${C.white};
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s;
            margin-left: 10px;
        }

        .lwa-goto-btn:hover {
            background: ${C.blueLight};
        }

        /* Stats Grid */
        .lwa-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
            gap: 8px;
            margin-bottom: 12px;
        }

        .lwa-stat-card {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 10px 8px;
            text-align: center;
            border: 1px solid ${C.border};
        }

        .lwa-stat-card:hover {
            border-color: ${C.green};
        }

        .lwa-stat-val {
            font-size: 18px;
            font-weight: 700;
        }

        .lwa-stat-lbl {
            font-size: 11px;
            color: ${C.textMuted};
            margin-top: 2px;
        }

        .lwa-stat-sub {
            font-size: 10px;
            color: ${C.textDim};
            margin-top: 2px;
        }

        /* HP Bar */
        .lwa-hp-bar {
            height: 4px;
            background: #ddd;
            border-radius: 2px;
            margin-top: 5px;
            overflow: hidden;
        }

        .lwa-hp-fill {
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s;
        }

        /* Tabs */
        .lwa-tabs {
            display: flex;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 3px;
            margin-bottom: 12px;
            border: 1px solid ${C.border};
            flex-wrap: wrap;
        }

        .lwa-tab {
            flex: 1;
            min-width: 70px;
            padding: 8px 6px;
            text-align: center;
            font-size: 12px;
            font-weight: 500;
            border-radius: 2px;
            cursor: pointer;
            color: ${C.textMuted};
            transition: all 0.15s;
        }

        .lwa-tab:hover {
            color: ${C.text};
            background: rgba(0,0,0,0.05);
        }

        .lwa-tab.active {
            background: ${C.green};
            color: ${C.white};
        }

        .lwa-tab-badge {
            display: inline-block;
            background: rgba(0,0,0,0.1);
            padding: 1px 5px;
            border-radius: 8px;
            font-size: 10px;
            margin-left: 3px;
        }

        .lwa-tab.active .lwa-tab-badge {
            background: rgba(255,255,255,0.3);
        }

        .lwa-tab-cnt {
            display: none;
        }

        .lwa-tab-cnt.active {
            display: block;
        }

        /* Section */
        .lwa-section {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 12px;
            margin-bottom: 10px;
            border: 1px solid ${C.border};
        }

        .lwa-section-title {
            font-size: 13px;
            font-weight: 600;
            color: ${C.green};
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid ${C.border};
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .lwa-section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: ${C.green};
            border-radius: 1px;
        }

        /* MCTS Cards */
        .lwa-mcts-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }

        @media (min-width: 600px) {
            .lwa-mcts-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }

        .lwa-mcts-card {
            background: var(--background-header, #f5f5f5);
            border-radius: 3px;
            padding: 10px;
            text-align: center;
            border: 1px solid ${C.border};
        }

        .lwa-mcts-card.highlight {
            background: rgba(255, 136, 0, 0.1);
            border-color: ${C.orange};
        }

        .lwa-mcts-val {
            font-size: 20px;
            font-weight: 700;
        }

        .lwa-mcts-lbl {
            font-size: 11px;
            color: ${C.textMuted};
            margin-top: 3px;
        }

        .lwa-mcts-sub {
            font-size: 10px;
            color: ${C.textDim};
            margin-top: 2px;
        }

        /* Chosen Action */
        .lwa-chosen {
            background: rgba(255, 136, 0, 0.08);
            border: 1px solid ${C.orange};
            border-radius: 3px;
            padding: 12px;
            margin-top: 12px;
        }

        .lwa-chosen-head {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 6px;
        }

        .lwa-chosen-icon {
            width: 24px;
            height: 24px;
            background: ${C.orange};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
        }

        .lwa-chosen-desc {
            font-family: monospace;
            font-size: 12px;
            color: ${C.text};
            word-break: break-word;
        }

        .lwa-chosen-stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: ${C.textMuted};
            margin-top: 6px;
            padding-left: 34px;
        }

        .lwa-chosen-stats span {
            color: ${C.orange};
            font-weight: 600;
        }

        /* Ops Progress */
        .lwa-ops-container {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .lwa-ops-bar {
            flex: 1;
            height: 20px;
            background: #ddd;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
        }

        .lwa-ops-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s;
        }

        .lwa-ops-fill.ok { background: ${C.green}; }
        .lwa-ops-fill.warn { background: ${C.orange}; }
        .lwa-ops-fill.danger { background: ${C.red}; }

        .lwa-ops-text {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-family: monospace;
            font-size: 11px;
            font-weight: 600;
            color: ${C.white};
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .lwa-ops-pct {
            font-family: monospace;
            font-size: 14px;
            font-weight: 700;
            min-width: 45px;
            text-align: right;
        }

        /* Chart */
        .lwa-chart-container {
            background: var(--background-header, #f5f5f5);
            border-radius: 3px;
            padding: 10px;
            margin-top: 10px;
            height: 110px;
            border: 1px solid ${C.border};
        }

        /* ===== AGGREGATED STATS ===== */
        .lwa-agg-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px;
        }

        .lwa-agg-card {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 12px;
            text-align: center;
            border: 1px solid ${C.border};
            border-left: 3px solid ${C.blue};
        }

        .lwa-agg-card.good { border-left-color: ${C.green}; }
        .lwa-agg-card.warn { border-left-color: ${C.orange}; }
        .lwa-agg-card.bad { border-left-color: ${C.red}; }

        .lwa-agg-val {
            font-size: 22px;
            font-weight: 700;
        }

        .lwa-agg-lbl {
            font-size: 11px;
            color: ${C.textMuted};
            margin-top: 3px;
        }

        .lwa-agg-desc {
            font-size: 10px;
            color: ${C.textDim};
            margin-top: 2px;
        }

        /* ===== TIMELINE ===== */
        .lwa-timeline {
            position: relative;
            padding-left: 28px;
        }

        .lwa-timeline::before {
            content: '';
            position: absolute;
            left: 9px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #ddd;
        }

        .lwa-tl-turn {
            position: relative;
            margin-bottom: 12px;
        }

        .lwa-tl-turn-marker {
            position: absolute;
            left: -28px;
            top: 0;
            width: 20px;
            height: 20px;
            background: ${C.green};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 700;
            color: ${C.white};
            z-index: 1;
        }

        .lwa-tl-turn-marker.current {
            background: ${C.orange};
            box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.25);
        }

        .lwa-tl-events {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 8px 10px;
            border: 1px solid ${C.border};
        }

        .lwa-tl-event {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 0;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .lwa-tl-event:last-child {
            border-bottom: none;
        }

        .lwa-tl-icon {
            width: 22px;
            height: 22px;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
        }

        .lwa-tl-icon.attack { background: rgba(226,36,36,0.12); }
        .lwa-tl-icon.heal { background: rgba(95,173,27,0.12); }
        .lwa-tl-icon.move { background: rgba(50,178,218,0.12); }
        .lwa-tl-icon.buff { background: rgba(160,23,214,0.12); }
        .lwa-tl-icon.summon { background: rgba(240,192,64,0.12); }

        .lwa-tl-desc {
            flex: 1;
            font-size: 12px;
            color: ${C.text};
        }

        .lwa-tl-value {
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
        }

        .lwa-tl-value.damage { color: ${C.red}; }
        .lwa-tl-value.heal { color: ${C.green}; }
        .lwa-tl-value.neutral { color: ${C.textMuted}; }

        /* Combo List */
        .lwa-combo {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 10px;
            margin-bottom: 8px;
            border: 1px solid ${C.border};
            border-left: 3px solid ${C.green};
        }

        .lwa-combo:hover {
            border-left-color: ${C.greenLight};
        }

        .lwa-combo-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }

        .lwa-combo-rank {
            width: 20px;
            height: 20px;
            background: ${C.green};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 700;
            color: ${C.white};
        }

        .lwa-combo-desc {
            font-family: monospace;
            font-size: 11px;
            color: ${C.text};
            word-break: break-word;
        }

        .lwa-combo-stats {
            display: flex;
            gap: 14px;
            font-size: 11px;
            color: ${C.textMuted};
            padding-left: 28px;
        }

        .lwa-combo-stats span {
            color: ${C.blue};
            font-weight: 600;
        }

        /* Profiler */
        .lwa-prof-group {
            margin-bottom: 6px;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            border: 1px solid ${C.border};
            overflow: hidden;
        }

        .lwa-prof-group-head {
            display: flex;
            align-items: center;
            padding: 8px 10px;
            cursor: pointer;
            background: var(--background-header, #f5f5f5);
            border-bottom: 1px solid ${C.border};
            transition: all 0.15s;
        }

        .lwa-prof-group-head:hover {
            background: rgba(95,173,27,0.08);
        }

        .lwa-prof-group-head.collapsed {
            border-bottom: none;
        }

        .lwa-prof-toggle {
            width: 14px;
            height: 14px;
            margin-right: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${C.textMuted};
            font-size: 10px;
            transition: transform 0.2s;
        }

        .lwa-prof-toggle.open {
            transform: rotate(90deg);
        }

        .lwa-prof-group-info {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .lwa-prof-group-name {
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
        }

        .lwa-prof-group-stats {
            display: flex;
            gap: 10px;
            font-size: 11px;
            color: ${C.textMuted};
        }

        .lwa-prof-group-stats b {
            color: ${C.green};
            font-weight: 600;
        }

        .lwa-prof-children {
            padding: 4px 10px 8px 24px;
        }

        .lwa-prof-children.hidden {
            display: none;
        }

        .lwa-prof-item {
            padding: 6px 0;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .lwa-prof-item:last-child {
            border-bottom: none;
        }

        .lwa-prof-item.nested {
            padding-left: 10px;
            border-left: 2px solid #ddd;
            margin-left: 4px;
        }

        .lwa-prof-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .lwa-prof-name {
            font-family: monospace;
            font-size: 11px;
            color: ${C.blue};
        }

        .lwa-prof-pct {
            font-family: monospace;
            font-size: 11px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 3px;
        }

        .lwa-prof-bar {
            height: 5px;
            background: #eee;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 4px;
        }

        .lwa-prof-fill {
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s;
        }

        .lwa-prof-details {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: ${C.textDim};
        }

        .lwa-prof-details b {
            color: ${C.textMuted};
        }

        .lwa-prof-standalone {
            padding: 8px 10px;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            margin-bottom: 6px;
            border: 1px solid ${C.border};
        }

        /* ===== IMPROVED LOGS WITH COLLAPSIBLE SECTIONS ===== */
        .lwa-logs-container {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            border: 1px solid ${C.border};
            overflow: hidden;
            max-width: 100%;
        }

        /* Collapsible Category */
        .lwa-log-category {
            border-bottom: 1px solid ${C.border};
        }

        .lwa-log-category:last-child {
            border-bottom: none;
        }

        .lwa-log-cat-header {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            cursor: pointer;
            background: var(--background-header, #f5f5f5);
            transition: background 0.15s;
            user-select: none;
        }

        .lwa-log-cat-header:hover {
            background: rgba(95, 173, 27, 0.1);
        }

        .lwa-log-cat-toggle {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
            font-size: 10px;
            color: ${C.textMuted};
            transition: transform 0.2s;
        }

        .lwa-log-cat-toggle.collapsed {
            transform: rotate(-90deg);
        }

        .lwa-log-cat-icon {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-size: 12px;
        }

        .lwa-log-cat-icon.init { background: rgba(50, 178, 218, 0.15); color: ${C.blue}; }
        .lwa-log-cat-icon.refresh { background: rgba(95, 173, 27, 0.15); color: ${C.green}; }
        .lwa-log-cat-icon.mcts { background: rgba(255, 136, 0, 0.15); color: ${C.orange}; }
        .lwa-log-cat-icon.position { background: rgba(160, 23, 214, 0.15); color: ${C.purple}; }
        .lwa-log-cat-icon.action { background: rgba(226, 36, 36, 0.15); color: ${C.red}; }
        .lwa-log-cat-icon.consequences { background: rgba(240, 192, 64, 0.15); color: ${C.yellow}; }
        .lwa-log-cat-icon.other { background: rgba(136, 136, 136, 0.15); color: ${C.textDim}; }
        .lwa-log-cat-icon.summary { background: rgba(43, 196, 145, 0.15); color: ${C.cyan}; }

        .lwa-log-cat-info {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .lwa-log-cat-name {
            font-weight: 600;
            font-size: 12px;
            color: ${C.text};
        }

        .lwa-log-cat-stats {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: ${C.textMuted};
        }

        .lwa-log-cat-stats span {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .lwa-log-cat-stats b {
            color: ${C.text};
        }

        .lwa-log-cat-content {
            padding: 8px 12px;
            background: var(--pure-white, #fff);
            max-height: none;
            overflow-x: hidden;
        }

        .lwa-log-cat-content.hidden {
            display: none;
        }

        /* Log Method Item */
        .lwa-log-method-item {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            margin: 4px 0;
            background: var(--background-header, #f8f8f8);
            border-radius: 3px;
            border-left: 3px solid ${C.border};
        }

        .lwa-log-method-item:hover {
            border-left-color: ${C.green};
        }

        .lwa-log-method-name {
            flex: 1;
            font-family: monospace;
            font-size: 11px;
            color: ${C.text};
        }

        .lwa-log-method-stats {
            display: flex;
            gap: 16px;
            font-size: 10px;
            color: ${C.textMuted};
        }

        .lwa-log-method-stats .calls { color: ${C.blue}; }
        .lwa-log-method-stats .avg { color: ${C.orange}; }
        .lwa-log-method-stats .total { color: ${C.green}; font-weight: 600; }

        /* Summary Cards in Logs */
        .lwa-log-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 8px;
            padding: 8px;
        }

        .lwa-log-summary-card {
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            padding: 10px;
            text-align: center;
            border: 1px solid ${C.border};
        }

        .lwa-log-summary-card .value {
            font-size: 18px;
            font-weight: 700;
        }

        .lwa-log-summary-card .label {
            font-size: 10px;
            color: ${C.textMuted};
            margin-top: 2px;
        }

        /* Logs Toolbar */
        .lwa-logs-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
        }

        .lwa-expand-all-btn {
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            color: ${C.text};
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s;
        }

        .lwa-expand-all-btn:hover {
            background: ${C.green};
            color: ${C.white};
            border-color: ${C.green};
        }

        .lwa-expand-all-btn .expand-icon {
            transition: transform 0.2s;
        }

        .lwa-expand-all-btn.collapsed .expand-icon {
            transform: rotate(-90deg);
        }

        /* Log Detail Sections */
        .lwa-log-detail-section {
            margin-top: 12px;
            padding: 10px;
            background: var(--background-header, #f8f8f8);
            border-radius: 4px;
            border: 1px solid ${C.border};
            overflow: hidden;
            max-width: 100%;
        }

        .lwa-log-detail-title {
            font-size: 11px;
            font-weight: 600;
            color: ${C.textMuted};
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid ${C.border};
        }

        .lwa-log-detail-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 6px;
            max-width: 100%;
        }

        .lwa-log-detail-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            min-width: 0;
            gap: 8px;
            font-size: 11px;
        }

        .lwa-log-detail-item .label {
            color: ${C.textMuted};
            flex-shrink: 0;
            white-space: nowrap;
        }

        .lwa-log-detail-item .value {
            font-weight: 600;
            font-family: monospace;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Combo Box */
        .lwa-log-combo-box {
            margin-top: 10px;
            padding: 8px;
            background: rgba(255,136,0,0.08);
            border-radius: 4px;
            border-left: 3px solid ${C.orange};
        }

        .lwa-log-combo-label {
            font-size: 10px;
            color: ${C.textMuted};
            margin-bottom: 4px;
        }

        .lwa-log-combo-text {
            font-family: monospace;
            font-size: 11px;
            color: ${C.text};
            word-break: break-all;
        }

        /* Action Logs (simple list) */
        .lwa-action-logs {
            max-height: 200px;
            overflow-y: auto;
            padding: 8px;
        }

        .lwa-action-log {
            padding: 4px 8px;
            margin: 2px 0;
            font-family: monospace;
            font-size: 11px;
            background: var(--background-header, #f8f8f8);
            border-radius: 3px;
            display: flex;
            gap: 8px;
        }

        .lwa-action-log-num {
            color: ${C.textDim};
            min-width: 20px;
        }

        /* ===== ANALYSIS TAB ===== */
        .lwa-charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
        }

        @media (max-width: 600px) {
            .lwa-charts-row {
                grid-template-columns: 1fr;
            }
        }

        .lwa-mini-chart {
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            padding: 12px;
        }

        .lwa-mini-chart-title {
            font-size: 12px;
            font-weight: 600;
            color: ${C.text};
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .lwa-mini-chart-title::before {
            content: '';
            width: 3px;
            height: 12px;
            border-radius: 1px;
        }

        .lwa-mini-chart-title.hp::before { background: ${C.green}; }
        .lwa-mini-chart-title.score::before { background: ${C.orange}; }
        .lwa-mini-chart-title.ops::before { background: ${C.blue}; }

        .lwa-chart-range {
            font-size: 10px;
            font-weight: 400;
            color: ${C.textDim};
            margin-left: auto;
        }

        .lwa-mini-chart canvas {
            width: 100% !important;
            height: 120px !important;
            max-height: 120px !important;
        }

        .lwa-mini-chart {
            min-height: 150px;
        }

        /* Section descriptions */
        .lwa-section-desc {
            font-size: 11px;
            color: ${C.textMuted};
            margin-bottom: 10px;
            line-height: 1.5;
            padding: 8px 10px;
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            border-left: 3px solid ${C.blue};
        }

        /* Anomaly Legend */
        .lwa-anomaly-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 16px;
            padding: 10px 12px;
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .lwa-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            color: ${C.textMuted};
        }

        .lwa-legend-icon {
            font-size: 12px;
        }

        .lwa-legend-icon.danger { color: ${C.red}; }
        .lwa-legend-icon.warning { color: ${C.orange}; }
        .lwa-legend-icon.info { color: ${C.blue}; }

        .lwa-anomalies-list {
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            overflow: hidden;
        }

        /* Heatmap */
        .lwa-heatmap {
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .lwa-heatmap-title {
            font-size: 12px;
            font-weight: 600;
            color: ${C.text};
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .lwa-heatmap-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .lwa-heatmap-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            border: 1px solid ${C.border};
            min-width: 120px;
        }

        .lwa-heatmap-bar {
            width: 4px;
            height: 30px;
            border-radius: 2px;
            background: ${C.border};
        }

        .lwa-heatmap-info {
            flex: 1;
        }

        .lwa-heatmap-name {
            font-size: 11px;
            font-weight: 600;
            color: ${C.text};
        }

        .lwa-heatmap-count {
            font-size: 10px;
            color: ${C.textMuted};
        }

        /* Anomalies */
        .lwa-anomalies {
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .lwa-anomaly-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            margin: 6px 0;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s;
        }

        .lwa-anomaly-item:hover {
            transform: translateX(4px);
        }

        .lwa-anomaly-item.warning {
            background: rgba(255, 136, 0, 0.1);
            border-left: 3px solid ${C.orange};
        }

        .lwa-anomaly-item.danger {
            background: rgba(226, 36, 36, 0.1);
            border-left: 3px solid ${C.red};
        }

        .lwa-anomaly-item.info {
            background: rgba(50, 178, 218, 0.1);
            border-left: 3px solid ${C.blue};
        }

        .lwa-anomaly-item.crash {
            background: linear-gradient(135deg, rgba(226, 36, 36, 0.15) 0%, rgba(226, 36, 36, 0.05) 100%);
            border-left: 4px solid ${C.red};
            border: 1px solid ${C.red};
        }

        .lwa-anomaly-item.crash .lwa-anomaly-title {
            color: ${C.red};
            font-weight: 700;
        }

        .lwa-anomaly-icon {
            font-size: 16px;
        }

        .lwa-anomaly-info {
            flex: 1;
        }

        .lwa-anomaly-title {
            font-size: 12px;
            font-weight: 600;
            color: ${C.text};
        }

        .lwa-anomaly-desc {
            font-size: 10px;
            color: ${C.textMuted};
        }

        .lwa-anomaly-turn {
            font-size: 11px;
            font-weight: 600;
            color: ${C.textMuted};
            padding: 4px 8px;
            background: rgba(0,0,0,0.05);
            border-radius: 3px;
        }

        /* No anomalies message */
        .lwa-no-anomalies {
            text-align: center;
            padding: 20px;
            color: ${C.green};
            font-size: 13px;
        }

        .lwa-no-anomalies::before {
            content: '✓';
            display: block;
            font-size: 24px;
            margin-bottom: 8px;
        }

        /* Raw Log Modal */
        .lwa-raw-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .lwa-raw-modal-content {
            background: var(--background, #fff);
            border-radius: 6px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }

        .lwa-raw-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: ${C.bgHeader};
            color: ${C.white};
            border-radius: 6px 6px 0 0;
            font-weight: 600;
        }

        .lwa-raw-modal-header button {
            background: transparent;
            border: none;
            color: ${C.white};
            font-size: 18px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
        }

        .lwa-raw-modal-header button:hover {
            background: rgba(255,255,255,0.2);
        }

        .lwa-raw-modal-body {
            padding: 16px;
            overflow: auto;
            font-family: monospace;
            font-size: 11px;
            line-height: 1.6;
            white-space: pre-wrap;
            margin: 0;
            background: var(--pure-white, #fff);
            color: ${C.text};
            border-radius: 0 0 6px 6px;
        }

        /* Eye Icon Button */
        .lwa-eye-btn {
            background: transparent;
            border: none;
            color: ${C.textMuted};
            cursor: pointer;
            padding: 4px 6px;
            font-size: 14px;
            border-radius: 3px;
            margin-left: 8px;
            opacity: 0.6;
            transition: all 0.15s;
        }

        .lwa-eye-btn:hover {
            opacity: 1;
            background: rgba(0,0,0,0.1);
            color: ${C.blue};
        }

        /* Loading */
        .lwa-loading {
            text-align: center;
            padding: 30px 20px;
        }

        .lwa-loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #ddd;
            border-top-color: ${C.green};
            border-radius: 50%;
            margin: 0 auto 12px;
            animation: lwa-spin 0.8s linear infinite;
        }

        @keyframes lwa-spin {
            to { transform: rotate(360deg); }
        }

        .lwa-loading-text {
            font-size: 13px;
            color: ${C.textMuted};
        }

        .lwa-retry-btn {
            margin-top: 12px;
            background: ${C.green};
            border: none;
            color: ${C.white};
            padding: 8px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.15s;
        }

        .lwa-retry-btn:hover {
            background: ${C.greenLight};
        }

        /* No Data */
        .lwa-nodata {
            text-align: center;
            padding: 30px 20px;
            color: ${C.textMuted};
        }

        .lwa-nodata-icon {
            font-size: 36px;
            margin-bottom: 10px;
            opacity: 0.4;
        }

        .lwa-nodata-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
            color: ${C.text};
        }

        .lwa-nodata-hint {
            font-size: 12px;
            color: ${C.textDim};
            line-height: 1.5;
        }

        .lwa-nodata code {
            background: var(--background-header, #f5f5f5);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }

        /* Error Display */
        .lwa-error {
            text-align: center;
            padding: 24px 16px;
            background: rgba(226,36,36,0.05);
            border: 1px solid ${C.red};
            border-radius: 3px;
        }

        .lwa-error-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .lwa-error-title {
            font-size: 14px;
            font-weight: 600;
            color: ${C.red};
            margin-bottom: 10px;
        }

        .lwa-error-msg {
            font-size: 11px;
            color: ${C.textMuted};
            font-family: monospace;
            text-align: left;
            background: var(--pure-white, #fff);
            padding: 10px;
            border-radius: 3px;
            line-height: 1.5;
            border: 1px solid ${C.border};
        }

        /* Error Banner (inline with content) */
        .lwa-error-banner {
            display: flex;
            gap: 12px;
            padding: 12px 14px;
            background: linear-gradient(135deg, rgba(226,36,36,0.08) 0%, rgba(226,36,36,0.03) 100%);
            border: 1px solid ${C.red};
            border-radius: 6px;
            margin-bottom: 12px;
        }

        .lwa-error-banner-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .lwa-error-banner-content {
            flex: 1;
            min-width: 0;
        }

        .lwa-error-banner-title {
            font-size: 13px;
            font-weight: 600;
            color: ${C.red};
            margin-bottom: 6px;
        }

        .lwa-error-details summary {
            font-size: 11px;
            color: ${C.textMuted};
            cursor: pointer;
            padding: 4px 0;
        }

        .lwa-error-details summary:hover {
            color: ${C.text};
        }

        .lwa-error-stack {
            margin-top: 8px;
            background: var(--pure-white, #fff);
            border: 1px solid ${C.border};
            border-radius: 4px;
            overflow: hidden;
        }

        .lwa-error-turn {
            padding: 8px 10px;
            border-bottom: 1px solid ${C.border};
        }

        .lwa-error-turn:last-child {
            border-bottom: none;
        }

        .lwa-error-turn-header {
            font-size: 10px;
            font-weight: 600;
            color: ${C.red};
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .lwa-error-turn pre {
            font-size: 11px;
            font-family: 'Consolas', 'Monaco', monospace;
            color: ${C.text};
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            line-height: 1.6;
        }

        /* Tooltip */
        .lwa-tip {
            position: relative;
            cursor: help;
        }

        .lwa-tip::after {
            content: attr(data-tip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: #fff;
            padding: 5px 8px;
            border-radius: 3px;
            font-size: 10px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
            z-index: 100;
            max-width: 180px;
            white-space: normal;
            text-align: center;
        }

        .lwa-tip:hover::after {
            opacity: 1;
        }

        /* Scrollbar */
        .lwa-panel ::-webkit-scrollbar {
            width: 6px;
        }

        .lwa-panel ::-webkit-scrollbar-track {
            background: #f0f0f0;
        }

        .lwa-panel ::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 3px;
        }

        .lwa-panel ::-webkit-scrollbar-thumb:hover {
            background: #aaa;
        }

        /* Jump button injected into LeekWars turns */
        .lwa-jump-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: ${C.green};
            border: none;
            border-radius: 3px;
            color: ${C.white};
            font-size: 10px;
            cursor: pointer;
            margin-left: 6px;
            transition: all 0.15s;
            vertical-align: middle;
        }

        .lwa-jump-btn:hover {
            background: ${C.greenLight};
        }

        .lwa-jump-btn::before {
            content: '🥬';
        }

        /* Timeline clickable turns */
        .lwa-tl-turn {
            cursor: pointer;
        }

        .lwa-tl-turn:hover .lwa-tl-events {
            border-color: ${C.green};
        }
    `;

    // ========================================
    // Additional State & Constants
    // ========================================
    let opsChart = null;

    const SUMMON_NAMES = ['Tourelle', 'Turret', 'Puny', 'Chest', 'Coffre'];
    const profColors = [C.green, C.blue, C.orange, C.purple, C.yellow, C.cyan, C.red];

    // ========================================
    // Parsers
    // ========================================
    function parseLogs(text) {
        const lines = text.split('\n');
        const entities = {};

        // Multiple patterns to catch different error formats
        const errorPatterns = [
            /^\[([^\]]+)\]\s*Interruption de l'IA\s*:\s*(.+)/i,
            /^\[([^\]]+)\]\s*AI interrupted\s*:\s*(.+)/i,
            /^\[([^\]]+)\]\s*Erreur\s*:\s*(.+)/i,
            /^\[([^\]]+)\]\s*Error\s*:\s*(.+)/i
        ];
        // Stack trace pattern - LeekWars format: "▶ AI filename, line 123"
        // Use non-greedy match to capture full filename (may contain spaces like "AI Damages")
        const stackLinePattern = /^\s*▶\s+(.+?),\s*line\s*(\d+)/i;

        let currentErrorEntity = null;
        let currentErrorTurn = null;
        let currentErrorLines = [];
        let lastKnownTurn = {}; // Track last turn per entity
        let seenErrors = new Set(); // Deduplicate errors

        // FIRST PASS: Build line-by-line tracking of last seen MARKER turn per entity
        // This tracks what turn each entity was on at each line position
        // Also collect ALL seen turns per entity to detect gaps (missing turns = crash)
        let entityTurnAtLine = []; // entityTurnAtLine[i] = {entity: lastTurn, ...}
        let currentEntityTurns = {}; // entity -> last seen MARKER turn
        let entitySeenTurns = {}; // entity -> Set of all seen turn numbers
        let markerSamples = []; // For debugging
        let errorSamples = []; // For debugging

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for MARKER with turn number: [EntityName] ##MARKER##T2|...
            const markerMatch = line.match(/\[([^\]]+)\].*##MARKER##T(\d+)/);
            if (markerMatch) {
                const entityName = markerMatch[1];
                const turnNum = parseInt(markerMatch[2]);
                currentEntityTurns[entityName] = turnNum;
                // Track all seen turns for this entity
                if (!entitySeenTurns[entityName]) entitySeenTurns[entityName] = new Set();
                entitySeenTurns[entityName].add(turnNum);
                if (markerSamples.length < 5) {
                    markerSamples.push({line: i, entity: entityName, turn: turnNum, text: line.substring(0, 80)});
                }
            }
            // Check for errors (for debugging)
            if (line.includes('Interruption') && errorSamples.length < 5) {
                const errMatch = line.match(/\[([^\]]+)\]/);
                errorSamples.push({line: i, entity: errMatch?.[1], text: line.substring(0, 100)});
            }
            // Store snapshot of current entity turns at this line
            entityTurnAtLine[i] = {...currentEntityTurns};
        }

        console.log('[LWA] MARKER samples:', markerSamples);
        console.log('[LWA] Error samples:', errorSamples);
        console.log('[LWA] Final entity MARKER turns:', currentEntityTurns);
        console.log('[LWA] Entity seen turns:', Object.fromEntries(Object.entries(entitySeenTurns).map(([k, v]) => [k, [...v].sort((a,b)=>a-b)])));

        // SECOND PASS: Find ALL crash turns per entity using gap detection
        // If we see T3 and T4 but not T1 and T2, crashes were on T1 and T2
        // Build array of crash turns per entity, to be consumed as errors are encountered
        let entityCrashTurns = {}; // entity -> array of crash turn numbers

        for (const entityName of Object.keys(entitySeenTurns)) {
            const seenTurns = entitySeenTurns[entityName];
            const sortedTurns = [...seenTurns].sort((a, b) => a - b);
            const maxTurn = sortedTurns[sortedTurns.length - 1];
            const crashTurns = [];

            // Find ALL missing turns from 1 to maxTurn
            for (let t = 1; t <= maxTurn; t++) {
                if (!seenTurns.has(t)) {
                    crashTurns.push(t);
                }
            }
            // Only add maxTurn + 1 if there are NO gaps
            // (meaning AI ran successfully until last turn, then might have crashed after)
            // If there ARE gaps, those are the real crash turns - don't add extra
            if (crashTurns.length === 0) {
                crashTurns.push(maxTurn + 1);
            }

            entityCrashTurns[entityName] = crashTurns;
            console.log(`[LWA] ${entityName} potential crash turns: ${crashTurns.join(',')} (seen: ${sortedTurns.join(',')})`);
        }

        // Track which crash turn to assign next per entity (index into entityCrashTurns array)
        let entityCrashIndex = {}; // entity -> next index in crash turns array

        console.log('[LWA] Entity crash turns:', entityCrashTurns);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Try all error patterns
            let errorMatch = null;
            for (const pattern of errorPatterns) {
                errorMatch = line.match(pattern);
                if (errorMatch) break;
            }

            if (errorMatch) {
                // Use line number in key to distinguish multiple crashes with same message
                // But skip true duplicates (DOM vs Vue data showing same error within 5 lines)
                const errorKey = `${errorMatch[1]}:${i}:${errorMatch[2]}`; // entity:line:message

                // Skip duplicate errors only if they appear within 5 lines of each other
                // (likely DOM and Vue data duplicate of same error)
                let isDuplicate = false;
                for (const seenKey of seenErrors) {
                    if (seenKey.startsWith(errorMatch[1] + ':')) {
                        const parts = seenKey.split(':');
                        const seenLine = parseInt(parts[1]);
                        const seenMsg = parts.slice(2).join(':');
                        if (seenMsg === errorMatch[2] && Math.abs(seenLine - i) < 5) {
                            isDuplicate = true;
                            console.log(`[LWA] Skipping duplicate error (within 5 lines): ${errorKey}`);
                            break;
                        }
                    }
                }
                if (isDuplicate) continue;
                seenErrors.add(errorKey);

                // Save previous error if any (same or different entity)
                if (currentErrorEntity && currentErrorTurn !== null && currentErrorLines.length > 0) {
                    if (!entities[currentErrorEntity]) entities[currentErrorEntity] = { turns: [], errors: {} };
                    entities[currentErrorEntity].errors[currentErrorTurn] = currentErrorLines.join('\n');
                    console.log(`[LWA] Saved error for ${currentErrorEntity} at turn ${currentErrorTurn}`);
                }

                currentErrorEntity = errorMatch[1];
                const errorMessage = errorMatch[2];
                currentErrorLines = [errorMessage];

                // Determine crash turn from gap analysis
                // Get next available crash turn for this entity
                if (entityCrashTurns[currentErrorEntity] && entityCrashTurns[currentErrorEntity].length > 0) {
                    const idx = entityCrashIndex[currentErrorEntity] || 0;
                    const crashTurns = entityCrashTurns[currentErrorEntity];
                    if (idx < crashTurns.length) {
                        currentErrorTurn = crashTurns[idx];
                        entityCrashIndex[currentErrorEntity] = idx + 1; // Advance to next crash turn
                        console.log(`[LWA] Turn ${currentErrorTurn} from gap analysis (crash ${idx + 1}/${crashTurns.length})`);
                    } else {
                        // More errors than detected gaps - likely duplicate, skip it
                        console.log(`[LWA] Skipping extra error beyond detected gaps for ${currentErrorEntity}`);
                        currentErrorEntity = null;
                        currentErrorTurn = null;
                        currentErrorLines = [];
                        continue;
                    }
                } else {
                    // No markers seen for this entity, fallback to incrementing counter
                    const lastTurn = entityCrashIndex[currentErrorEntity] || 0;
                    currentErrorTurn = lastTurn + 1;
                    entityCrashIndex[currentErrorEntity] = currentErrorTurn;
                    console.log(`[LWA] Turn ${currentErrorTurn} (no markers, incremental fallback)`);
                }
                console.log(`[LWA] Error detected for ${currentErrorEntity} (turn ${currentErrorTurn}): ${errorMessage}`);
                continue;
            }

            const stackMatch = line.match(stackLinePattern);
            if (stackMatch && currentErrorEntity) {
                // stackMatch[1] already contains full path like "AI Damages"
                currentErrorLines.push(`▶ ${stackMatch[1]}, line ${stackMatch[2]}`);
                continue;
            }

            const markerIdx = line.indexOf(MARKER);
            if (markerIdx !== -1) {
                if (currentErrorEntity && currentErrorTurn !== null) {
                    if (!entities[currentErrorEntity]) entities[currentErrorEntity] = { turns: [], errors: {} };
                    entities[currentErrorEntity].errors[currentErrorTurn] = currentErrorLines.join('\n');
                    currentErrorEntity = null;
                    currentErrorTurn = null;
                    currentErrorLines = [];
                }

                const entityMatch = line.substring(0, markerIdx).match(/\[([^\]]+)\]/);
                const entityName = entityMatch ? entityMatch[1] : 'Unknown';

                const data = line.substring(markerIdx + MARKER.length);
                let turn = null;

                if (data.startsWith('T') && data.includes('|')) {
                    turn = parsePipeFormat(data);
                } else if (data.startsWith('JSON:')) {
                    turn = parseJSONFormat(data.substring(5));
                }

                if (turn) {
                    if (!entities[entityName]) entities[entityName] = { turns: [], errors: {} };
                    entities[entityName].turns.push(turn);
                    lastKnownTurn[entityName] = turn.t; // Track last turn for error detection
                }
            }
        }

        // Save any remaining error
        if (currentErrorEntity && currentErrorLines.length > 0) {
            // If we didn't know the turn earlier, default to 1
            if (currentErrorTurn === null) {
                currentErrorTurn = 1;
            }
            if (!entities[currentErrorEntity]) entities[currentErrorEntity] = { turns: [], errors: {} };
            entities[currentErrorEntity].errors[currentErrorTurn] = currentErrorLines.join('\n');
            console.log(`[LWA] Saved error for ${currentErrorEntity} at turn ${currentErrorTurn}`);
        }

        // Log parsed entities for debug
        console.log('[LWA] Parsed entities:', Object.keys(entities).map(name => ({
            name,
            turns: entities[name].turns.length,
            errors: Object.keys(entities[name].errors)
        })));

        for (const name in entities) {
            entities[name].turns.sort((a, b) => a.t - b.t);
        }

        return entities;
    }

    function parsePipeFormat(data) {
        const parts = data.split('|');
        const turn = {
            t: 0,
            ops: 0, max: 0,
            ctx: { life: 0, maxLife: 0, tp: 0, mp: 0, cell: 0, enemies: 0, allies: 0 },
            mcts: { iter: 0, nodes: 0, pos: 0, best: 0 },
            chosen: { score: 0, actions: 0, desc: '' },
            combos: [],
            methods: [],
            logs: [],
            funcCount: 0,
            displayOps: 0
        };

        let currentCategory = '';

        for (const p of parts) {
            if (p.startsWith('T') && !p.includes(':')) {
                turn.t = parseInt(p.substring(1)) || 0;
            }
            else if (p.startsWith('o:')) {
                const m = p.match(/o:(\d+)\/(\d+)/);
                if (m) { turn.ops = parseInt(m[1]); turn.max = parseInt(m[2]); }
            }
            else if (p.startsWith('hp:')) {
                const m = p.match(/hp:(\d+)\/(\d+)/);
                if (m) { turn.ctx.life = parseInt(m[1]); turn.ctx.maxLife = parseInt(m[2]); }
            }
            else if (p.startsWith('tp:')) {
                turn.ctx.tp = parseInt(p.substring(3)) || 0;
            }
            else if (p.startsWith('mp:')) {
                turn.ctx.mp = parseInt(p.substring(3)) || 0;
            }
            else if (p.startsWith('c:')) {
                turn.ctx.cell = parseInt(p.substring(2)) || 0;
            }
            else if (p.startsWith('e:')) {
                turn.ctx.enemies = parseInt(p.substring(2)) || 0;
            }
            else if (p.startsWith('a:')) {
                turn.ctx.allies = parseInt(p.substring(2)) || 0;
            }
            else if (p.startsWith('m:')) {
                const vals = p.substring(2).split(',');
                turn.mcts.iter = parseInt(vals[0]) || 0;
                turn.mcts.nodes = parseInt(vals[1]) || 0;
                turn.mcts.pos = parseInt(vals[2]) || 0;
                turn.mcts.best = parseInt(vals[3]) || 0;
            }
            else if (p.startsWith('ch:')) {
                const m = p.match(/ch:(-?\d+),(\d+),(.+)/);
                if (m) {
                    turn.chosen.score = parseInt(m[1]);
                    turn.chosen.actions = parseInt(m[2]);
                    turn.chosen.desc = m[3];
                }
            }
            else if (p.startsWith('cb:')) {
                const m = p.match(/cb:(-?\d+),(-?\d+),(-?\d+),(.+)/);
                if (m) {
                    turn.combos.push({
                        s: parseInt(m[1]),
                        as: parseInt(m[2]),
                        ps: parseInt(m[3]),
                        d: m[4]
                    });
                }
            }
            else if (p.startsWith('cat:')) {
                currentCategory = p.substring(4);
            }
            else if (p.startsWith('fc:')) {
                turn.funcCount = parseInt(p.substring(3)) || 0;
            }
            else if (p.startsWith('dops:')) {
                turn.displayOps = parseInt(p.substring(5)) || 0;
            }
            else if (p.startsWith('end:')) {
                const endOps = parseInt(p.substring(4)) || 0;
                if (endOps > turn.ops) turn.ops = endOps;
            }
            else if (p.startsWith('f:')) {
                const m = p.match(/f:([^,]+),(\d+),(\d+),(\d+),?(.*)?/);
                if (m) {
                    turn.methods.push({
                        name: m[1],
                        calls: parseInt(m[2]),
                        total: parseInt(m[3]),
                        avg: Math.round(parseInt(m[3]) / parseInt(m[2])),
                        pct: parseInt(m[4]),
                        parent: m[5] || '',
                        category: currentCategory
                    });
                }
            }
            else if (p.startsWith('l:')) {
                turn.logs.push(p.substring(2));
            }
            // Legacy format support
            else if (p.startsWith('ops:')) {
                const m = p.match(/ops:(\d+)\/(\d+)/);
                if (m) { turn.ops = parseInt(m[1]); turn.max = parseInt(m[2]); }
            }
            else if (p.startsWith('life:')) {
                const m = p.match(/life:(\d+)\/(\d+)/);
                if (m) { turn.ctx.life = parseInt(m[1]); turn.ctx.maxLife = parseInt(m[2]); }
            }
            else if (p.startsWith('cell:')) {
                turn.ctx.cell = parseInt(p.substring(5)) || 0;
            }
            else if (p.startsWith('enemies:')) {
                turn.ctx.enemies = parseInt(p.substring(8)) || 0;
            }
            else if (p.startsWith('allies:')) {
                turn.ctx.allies = parseInt(p.substring(7)) || 0;
            }
            else if (p.startsWith('mcts:')) {
                const vals = p.substring(5).split(',');
                turn.mcts.iter = parseInt(vals[0]) || 0;
                turn.mcts.nodes = parseInt(vals[1]) || 0;
                turn.mcts.pos = parseInt(vals[2]) || 0;
                turn.mcts.best = parseInt(vals[3]) || 0;
            }
            else if (p.startsWith('chosen:')) {
                const m = p.match(/chosen:(-?\d+),(\d+),(.+)/);
                if (m) {
                    turn.chosen.score = parseInt(m[1]);
                    turn.chosen.actions = parseInt(m[2]);
                    turn.chosen.desc = m[3];
                }
            }
            else if (p.startsWith('combo:')) {
                const m = p.match(/combo:(-?\d+),(-?\d+),(-?\d+),(.+)/);
                if (m) {
                    turn.combos.push({ s: parseInt(m[1]), as: parseInt(m[2]), ps: parseInt(m[3]), d: m[4] });
                }
            }
            else if (p.startsWith('method:')) {
                const m = p.match(/method:([^,]+),(\d+),(\d+),(\d+),(\d+)/);
                if (m) {
                    turn.methods.push({
                        name: m[1], calls: parseInt(m[2]), total: parseInt(m[3]),
                        avg: parseInt(m[4]), pct: parseInt(m[5]), parent: ''
                    });
                }
            }
            else if (p.startsWith('log:')) {
                turn.logs.push(p.substring(4));
            }
        }

        return turn.t > 0 ? turn : null;
    }

    function parseJSONFormat(jsonStr) {
        try {
            jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            let depth = 0, end = -1;
            for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') depth++;
                else if (jsonStr[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
            }
            if (end > 0) jsonStr = jsonStr.substring(0, end);

            const d = JSON.parse(jsonStr);
            return {
                t: d.t || 0,
                ops: d.ops || 0,
                max: d.max || 0,
                ctx: d.ctx || { life: 0, maxLife: 0, tp: 0, mp: 0, cell: 0, enemies: 0, allies: 0 },
                mcts: d.mcts || { iter: 0, nodes: 0, pos: 0, best: 0 },
                chosen: d.chosen || { score: 0, actions: 0, desc: '' },
                combos: (d.combos || []).map(c => ({ s: c.s, as: c.as, ps: c.ps, d: c.d })),
                methods: (d.methods || []).map(m => ({
                    name: m[0],
                    total: m[1],
                    calls: m[2],
                    avg: Math.round(m[1] / m[2]),
                    pct: 0
                })),
                logs: d.logs || []
            };
        } catch (e) {
            return null;
        }
    }

    // ========================================
    // Helpers
    // ========================================
    function fmt(n) {
        if (n == null) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return Math.round(n / 1000) + 'k';
        return n.toString();
    }

    function pct(a, b) { return b > 0 ? Math.round(a * 100 / b) : 0; }

    function opsClass(p) { return p > 90 ? 'danger' : p > 70 ? 'warn' : 'ok'; }

    /**
     * Format combo description for display.
     * Input: "Flash(81)→Spark(120)→mv(256:180=0d+0p-57g+0t+0s)"
     * Output: HTML with styled actions and position breakdown
     */
    function formatComboDesc(desc) {
        if (!desc || desc === 'stay') return '<span style="color:' + C.textDim + '">stay</span>';

        // Split by arrow
        const parts = desc.split('→');
        let html = '';

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];

            // Check if this is a move/position part: mv(cell:score=breakdown)
            const mvMatch = p.match(/^mv\((\d+):(-?\d+)=(.+)\)$/);
            if (mvMatch) {
                const [, cell, score, breakdown] = mvMatch;
                // Parse breakdown: 0d+0p-57g+0t+0s
                const components = [];
                const compRegex = /([+-]?\d+)([dpgts])/g;
                let m;
                while ((m = compRegex.exec(breakdown)) !== null) {
                    const val = parseInt(m[1]);
                    const type = m[2];
                    const labels = { d: 'danger', p: 'prox', g: 'grav', t: 'tact', s: 'shield' };
                    const colors = {
                        d: val < 0 ? C.red : (val > 0 ? C.green : C.textDim),
                        p: val < 0 ? C.red : (val > 0 ? C.green : C.textDim),
                        g: val < 0 ? C.red : (val > 0 ? C.green : C.textDim),
                        t: val > 0 ? C.green : C.textDim,
                        s: val > 0 ? C.blue : C.textDim
                    };
                    if (val !== 0) {
                        components.push(`<span style="color:${colors[type]}" title="${labels[type]}">${val}${type}</span>`);
                    }
                }
                html += `<span class="lwa-action-mv">→c${cell}</span>`;
                html += `<span class="lwa-pos-breakdown" style="color:${C.textDim};font-size:10px"> (${score}=${components.length > 0 ? components.join(' ') : '0'})</span>`;
            }
            // Check if this is an action: ItemName(score)
            else {
                const actMatch = p.match(/^(.+?)\((-?\d+)\)$/);
                if (actMatch) {
                    const [, name, score] = actMatch;
                    const scoreNum = parseInt(score);
                    const scoreColor = scoreNum > 0 ? C.green : (scoreNum < 0 ? C.red : C.textDim);
                    if (i > 0) html += '<span style="color:' + C.textDim + '">→</span>';
                    html += `<span class="lwa-action-name">${name}</span>`;
                    html += `<span class="lwa-action-score" style="color:${scoreColor}">(${score})</span>`;
                }
                // Fallback for old format or unknown
                else {
                    if (i > 0) html += '<span style="color:' + C.textDim + '">→</span>';
                    html += `<span>${p}</span>`;
                }
            }
        }

        return html;
    }

    // ========================================
    // Aggregated Stats Computation
    // ========================================
    function computeAggregatedStats() {
        if (turnData.length === 0) return null;

        let totalOps = 0, totalMaxOps = 0, totalIter = 0, totalNodes = 0, totalActions = 0;
        let totalDamage = 0, totalHeal = 0, totalTPUsed = 0, totalMPUsed = 0;
        let scores = [];
        let lifeStart = turnData[0]?.ctx.life || 0;
        let lifeEnd = turnData[turnData.length - 1]?.ctx.life || 0;
        let maxLifeStart = turnData[0]?.ctx.maxLife || 1;

        for (const t of turnData) {
            totalOps += t.ops;
            totalMaxOps += t.max;
            totalIter += t.mcts.iter;
            totalNodes += t.mcts.nodes;
            totalActions += t.chosen.actions;
            scores.push(t.mcts.best);
            totalTPUsed += t.ctx.tp;
            totalMPUsed += t.ctx.mp;

            // Parse damage/heal from combo descriptions
            const desc = t.chosen.desc || '';
            const dmgMatch = desc.match(/(\d+)\s*dmg/gi);
            const healMatch = desc.match(/(\d+)\s*heal/gi);
            if (dmgMatch) {
                for (const m of dmgMatch) {
                    totalDamage += parseInt(m) || 0;
                }
            }
            if (healMatch) {
                for (const m of healMatch) {
                    totalHeal += parseInt(m) || 0;
                }
            }
        }

        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
        const avgOpsPerTurn = Math.round(totalOps / turnData.length);
        const lifeDelta = lifeEnd - lifeStart;
        const survivalRate = pct(lifeEnd, maxLifeStart);

        // DPS = damage per turn (actions per turn that deal damage)
        const dpt = turnData.length > 0 ? Math.round(totalDamage / turnData.length) : 0;

        // Efficiency = score per 1000 ops
        const efficiency = totalOps > 0 ? Math.round((avgScore * 1000) / avgOpsPerTurn) : 0;

        return {
            totalTurns: turnData.length,
            totalOps,
            totalMaxOps,
            avgOpsPerTurn,
            totalIter,
            totalNodes,
            totalActions,
            avgScore,
            scoreMin: scores.length > 0 ? Math.min(...scores) : 0,
            scoreMax: scores.length > 0 ? Math.max(...scores) : 0,
            totalDamage,
            totalHeal,
            dpt,
            efficiency,
            lifeDelta,
            survivalRate,
            lifeStart,
            lifeEnd
        };
    }

    // ========================================
    // Timeline Event Parsing
    // ========================================
    function parseTimelineEvents(turn) {
        const events = [];
        const desc = turn.chosen.desc || '';

        // Parse action descriptions like "Pistol(42)→move(216)" or "Flash@Enemy+Heal@Self"
        // Common patterns: WeaponName(damage), ChipName@Target, move(cell), summon(name)

        const parts = desc.split(/[→+]/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            let event = { type: 'action', icon: '⚡', desc: trimmed, value: null, valueType: 'neutral' };

            // Move
            if (/^move\(/i.test(trimmed)) {
                event.type = 'move';
                event.icon = '🚶';
                const cellMatch = trimmed.match(/move\((\d+)\)/i);
                if (cellMatch) event.desc = `Move to cell ${cellMatch[1]}`;
            }
            // Summon
            else if (/summon/i.test(trimmed)) {
                event.type = 'summon';
                event.icon = '🌱';
            }
            // Heal (contains heal or specific heal chips)
            else if (/heal|bandage|cure|regen|vaccine|remedy/i.test(trimmed)) {
                event.type = 'heal';
                event.icon = '💚';
                const healMatch = trimmed.match(/(\d+)/);
                if (healMatch) {
                    event.value = '+' + healMatch[1];
                    event.valueType = 'heal';
                }
            }
            // Buff (shield, armor, etc)
            else if (/shield|armor|wall|fortress|helmet|protection|motivation|rage|doping/i.test(trimmed)) {
                event.type = 'buff';
                event.icon = '🛡️';
            }
            // Attack (weapons or damage chips)
            else if (/pistol|gun|laser|rifle|shotgun|magnum|destroyer|electrisor|grenade|katana|broadsword|axe|flash|spark|lightning|rock|rockfall|meteor|ice|fire|poison/i.test(trimmed)) {
                event.type = 'attack';
                event.icon = '⚔️';
                const dmgMatch = trimmed.match(/\((\d+)\)/);
                if (dmgMatch) {
                    event.value = '-' + dmgMatch[1];
                    event.valueType = 'damage';
                }
            }

            events.push(event);
        }

        // If no events parsed, create a generic one
        if (events.length === 0 && desc) {
            events.push({ type: 'action', icon: '⚡', desc: desc, value: null, valueType: 'neutral' });
        }

        return events;
    }

    // ========================================
    // UI Creation
    // ========================================
    function createPanel() {
        // Wait for the report page to load
        const checkInterval = setInterval(() => {
            const reportPage = document.querySelector('.report, .report-page, .page');
            if (reportPage) {
                clearInterval(checkInterval);
                injectPanel(reportPage);
            }
        }, 500);

        // Timeout after 10s
        setTimeout(() => clearInterval(checkInterval), 10000);
    }

    function injectPanel(container) {
        // Remove existing panel if any
        const existing = document.querySelector('.lwa-panel');
        if (existing) existing.remove();

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'lwa-panel';
        wrapper.id = 'lwa-analyzer';
        wrapper.innerHTML = `
            <div class="panel">
                <div class="header">
                    <h2>🥬 LeekWars Fight Analyzer <span class="version">v${VERSION}</span></h2>
                </div>
                <div id="lwa-entity-container"></div>
                <div class="content" id="lwa-content">
                    <div class="lwa-loading">
                        <div class="lwa-loading-spinner"></div>
                        <div class="lwa-loading-text">Loading fight data...</div>
                        <button class="lwa-retry-btn" onclick="window.lwaRetryFetch()" style="display:none">↻ Retry</button>
                    </div>
                </div>
            </div>
        `;

        // Show retry button after initial delay
        setTimeout(() => {
            const retryBtn = wrapper.querySelector('.lwa-retry-btn');
            if (retryBtn && turnData.length === 0) {
                retryBtn.style.display = 'inline-block';
            }
        }, 5000);

        // Insert after "Déplacements" (Movements) panel and before "Actions" panel
        // Look for the actions panel and insert before it
        const actionsPanel = container.querySelector('.actions')?.closest('.panel');
        if (actionsPanel) {
            actionsPanel.parentNode.insertBefore(wrapper, actionsPanel);
            console.log('[LWA] Panel injected before Actions panel');
        } else {
            // Fallback: try to find movements panel and insert after
            const movementsPanel = container.querySelector('.movements, .map-preview')?.closest('.panel');
            if (movementsPanel && movementsPanel.nextSibling) {
                movementsPanel.parentNode.insertBefore(wrapper, movementsPanel.nextSibling);
                console.log('[LWA] Panel injected after Movements panel');
            } else {
                // Last fallback: append at end
                container.appendChild(wrapper);
                console.log('[LWA] Panel appended at end (fallback)');
            }
        }
    }

    // Inject jump buttons into LeekWars turn headers
    function injectJumpButtons() {
        // Find turn headers in the actions panel
        // LeekWars uses elements like "Turn X" in the actions log
        const turnHeaders = document.querySelectorAll('.actions .turn, .log-turn, [class*="turn-header"], .turn-title');

        turnHeaders.forEach(header => {
            // Skip if already has our button
            if (header.querySelector('.lwa-jump-btn')) return;

            // Extract turn number from text
            const text = header.textContent || '';
            const turnMatch = text.match(/(?:Tour|Turn)\s*(\d+)/i);
            if (!turnMatch) return;

            const turnNum = parseInt(turnMatch[1]);

            // Create jump button
            const btn = document.createElement('button');
            btn.className = 'lwa-jump-btn';
            btn.title = `Jump to Turn ${turnNum} in LWA Analyzer`;
            btn.onclick = (e) => {
                e.stopPropagation();
                jumpToTurn(turnNum);
            };

            header.appendChild(btn);
        });

        // Also try to find turns in a more generic way (looking for "Turn X" text)
        document.querySelectorAll('.actions .content > div, .log-content > div').forEach(el => {
            if (el.querySelector('.lwa-jump-btn')) return;

            const text = el.textContent || '';
            const turnMatch = text.match(/^(?:Tour|Turn)\s*(\d+)/i);
            if (turnMatch && el.childNodes.length < 5) {
                const turnNum = parseInt(turnMatch[1]);
                const btn = document.createElement('button');
                btn.className = 'lwa-jump-btn';
                btn.title = `Jump to Turn ${turnNum} in LWA Analyzer`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    jumpToTurn(turnNum);
                };
                el.appendChild(btn);
            }
        });
    }

    // Jump to specific turn in the analyzer
    function jumpToTurn(turnNum) {
        // Find the turn index in our data
        const idx = turnData.findIndex(t => t.t === turnNum);
        if (idx !== -1) {
            currentIdx = idx;
            render();

            // Scroll to the analyzer panel
            const panel = document.getElementById('lwa-analyzer');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            console.log(`[LWA] Turn ${turnNum} not found in data`);
        }
    }

    // Scroll to specific turn in the Actions panel
    function scrollToTurnInReport(turnNum) {
        console.log(`[LWA] Attempting to scroll to turn ${turnNum}`);
        let targetElement = null;

        // Debug: Log all panels and their classes to understand DOM structure
        const allPanels = document.querySelectorAll('.panel');
        console.log(`[LWA] Found ${allPanels.length} panels on page`);

        // First try: find by ID (LeekWars uses id="turn-{number}")
        targetElement = document.getElementById(`turn-${turnNum}`);
        if (targetElement) console.log(`[LWA] Found by ID: turn-${turnNum}`);

        // Second try: Look for the actions panel by finding panel with "Actions" or "actions" in header
        if (!targetElement) {
            let actionsPanel = null;
            allPanels.forEach(panel => {
                const header = panel.querySelector('.header, h2, .title');
                const headerText = header?.textContent || '';
                if (headerText.toLowerCase().includes('action')) {
                    actionsPanel = panel;
                }
            });

            // Fallback to .actions class
            if (!actionsPanel) {
                actionsPanel = document.querySelector('.actions');
            }

            console.log(`[LWA] Actions panel found:`, !!actionsPanel);

            if (actionsPanel) {
                // Look for turn markers - they often have specific formatting
                // Try various selectors
                const selectors = ['.turn', '[class*="turn"]', '.log-turn', '.action-turn', 'div[id^="turn"]'];
                for (const sel of selectors) {
                    const elements = actionsPanel.querySelectorAll(sel);
                    if (elements.length > 0) {
                        console.log(`[LWA] Found ${elements.length} elements with selector "${sel}"`);
                        for (const el of elements) {
                            const text = el.textContent || '';
                            const match = text.match(/(?:Tour|Turn)\s*(\d+)/i);
                            if (match && parseInt(match[1]) === turnNum) {
                                targetElement = el;
                                console.log(`[LWA] Found by selector "${sel}"`);
                                break;
                            }
                        }
                        if (targetElement) break;
                    }
                }

                // If still not found, search all children for text "Tour X"
                if (!targetElement) {
                    const allChildren = actionsPanel.querySelectorAll('*');
                    console.log(`[LWA] Searching ${allChildren.length} children in actions panel`);
                    for (const el of allChildren) {
                        // Check if this element directly contains "Tour X" text
                        const text = el.textContent || '';
                        // Only match if the element is small (likely a header, not a container)
                        if (el.children.length < 3 && text.length < 100) {
                            if (text.match(new RegExp(`(?:Tour|Turn)\\s*${turnNum}(?:\\s|$)`, 'i'))) {
                                targetElement = el;
                                console.log(`[LWA] Found in actions panel children:`, el.tagName, el.className);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Third try: search entire document for "Tour X" text in small elements
        if (!targetElement) {
            const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6, td, th, li');
            for (const el of allElements) {
                const text = (el.textContent || '').trim();
                // Match elements that primarily contain just "Tour X" text
                if (text.match(new RegExp(`^(?:Tour|Turn)\\s*${turnNum}\\s*$`, 'i'))) {
                    targetElement = el;
                    console.log(`[LWA] Found by exact text match:`, el.tagName, el.className);
                    break;
                }
            }
        }

        // Fourth try: XPath for text containing tour/turn number
        if (!targetElement) {
            const xpath = `//*[contains(text(), 'Tour ${turnNum}') or contains(text(), 'Turn ${turnNum}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                targetElement = result.singleNodeValue;
                console.log(`[LWA] Found by XPath`);
            }
        }

        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            const originalBg = targetElement.style.background;
            const originalTransition = targetElement.style.transition;
            targetElement.style.transition = 'background 0.3s';
            targetElement.style.background = 'rgba(95, 173, 27, 0.5)';
            targetElement.style.outline = '2px solid #5fad1b';
            setTimeout(() => {
                targetElement.style.background = originalBg;
                targetElement.style.transition = originalTransition;
                targetElement.style.outline = '';
            }, 2500);
            console.log(`[LWA] ✓ Scrolled to turn ${turnNum}`, targetElement);
        } else {
            // Fallback: scroll to actions panel
            let actionsPanel = null;
            allPanels.forEach(panel => {
                const header = panel.querySelector('.header, h2, .title');
                const headerText = header?.textContent || '';
                if (headerText.toLowerCase().includes('action')) {
                    actionsPanel = panel;
                }
            });
            if (!actionsPanel) actionsPanel = document.querySelector('.actions, .report .panel:last-child');

            if (actionsPanel) {
                actionsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log(`[LWA] Turn ${turnNum} not found, scrolled to Actions panel`);
            } else {
                console.log(`[LWA] Turn ${turnNum} not found, no Actions panel found`);
            }

            // Debug: log some sample content from the page to help diagnose
            console.log(`[LWA] Debug - Page body snippet:`, document.body.innerHTML.substring(0, 2000));
        }
    }

    function renderEntitySelector() {
        const entityNames = Object.keys(entitiesData);
        if (entityNames.length <= 1) return '';

        return `
            <div class="lwa-entity-bar">
                <label>Entity:</label>
                <select id="entity-select">
                    ${entityNames.map(name => {
                        const data = entitiesData[name];
                        const isSummon = SUMMON_NAMES.some(s => name.toLowerCase().includes(s.toLowerCase()));
                        const turnCount = data.turns.length;
                        const errorCount = Object.keys(data.errors).length;
                        const label = `${name} (${turnCount}T${errorCount > 0 ? ', ' + errorCount + ' err' : ''})${isSummon ? ' [summon]' : ''}`;
                        return `<option value="${name}" ${name === currentEntity ? 'selected' : ''}>${label}</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    }

    function render() {
        const contentEl = document.getElementById('lwa-content');
        const entityContainerEl = document.getElementById('lwa-entity-container');
        if (!contentEl) return;

        // Render entity selector
        if (entityContainerEl) {
            entityContainerEl.innerHTML = renderEntitySelector();
            const select = document.getElementById('entity-select');
            if (select) {
                select.onchange = () => switchEntity(select.value);
            }
        }

        // Check for errors
        if (turnData.length === 0) {
            const hasErrors = currentEntity && entitiesData[currentEntity]?.errors && Object.keys(entitiesData[currentEntity].errors).length > 0;

            if (hasErrors) {
                const errors = entitiesData[currentEntity].errors;
                const firstErrorTurn = Object.keys(errors)[0];
                contentEl.innerHTML = `
                    <div class="lwa-error">
                        <div class="lwa-error-icon">⚠️</div>
                        <div class="lwa-error-title">AI Crashed</div>
                        <div class="lwa-error-msg">${errors[firstErrorTurn].replace(/\n/g, '<br>')}</div>
                    </div>
                `;
                return;
            }

            contentEl.innerHTML = `
                <div class="lwa-nodata">
                    <div class="lwa-nodata-icon">📊</div>
                    <div class="lwa-nodata-title">No debug data found</div>
                    <div class="lwa-nodata-hint">
                        Make sure your AI calls<br>
                        <code>Benchmark.display()</code><br>
                        at the end of each turn
                    </div>
                </div>
            `;
            return;
        }

        const d = turnData[currentIdx];
        const lifePct = pct(d.ctx.life, d.ctx.maxLife);
        const opsPct = pct(d.ops, d.max);

        // Check for errors even when we have turn data
        const entityErrors = currentEntity && entitiesData[currentEntity]?.errors || {};
        const errorTurns = Object.keys(entityErrors).map(Number).sort((a, b) => a - b);
        const hasErrors = errorTurns.length > 0;

        contentEl.innerHTML = `
            <!-- Error Banner (if any crashes) -->
            ${hasErrors ? `
            <div class="lwa-error-banner">
                <div class="lwa-error-banner-icon">⚠️</div>
                <div class="lwa-error-banner-content">
                    <div class="lwa-error-banner-title">AI Crashed on Turn${errorTurns.length > 1 ? 's' : ''} ${errorTurns.join(', ')}</div>
                    <details class="lwa-error-details">
                        <summary>Show stack trace</summary>
                        <div class="lwa-error-stack">
                            ${errorTurns.map(t => `
                                <div class="lwa-error-turn">
                                    <div class="lwa-error-turn-header">Turn ${t}:</div>
                                    <pre>${entityErrors[t]}</pre>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                </div>
            </div>
            ` : ''}

            <!-- Navigation -->
            <div class="lwa-nav">
                <button class="lwa-nav-btn" id="nav-prev" ${currentIdx === 0 ? 'disabled' : ''}>◀ Prev</button>
                <span class="lwa-turn-label">Turn ${d.t} (${currentIdx + 1}/${turnData.length})</span>
                <button class="lwa-nav-btn" id="nav-next" ${currentIdx === turnData.length - 1 ? 'disabled' : ''}>Next ▶</button>
                <button class="lwa-goto-btn" id="nav-goto-report" title="Go to this turn in Actions panel">↓ Actions</button>
            </div>

            <!-- Current Turn Stats -->
            <div class="lwa-stats-grid">
                <div class="lwa-stat-card">
                    <div class="lwa-stat-val" style="color:${lifePct < 25 ? C.red : lifePct < 50 ? C.orange : C.green}">${d.ctx.life}</div>
                    <div class="lwa-stat-lbl">HP / ${d.ctx.maxLife}</div>
                    <div class="lwa-hp-bar"><div class="lwa-hp-fill" style="width:${lifePct}%;background:${lifePct < 25 ? C.red : lifePct < 50 ? C.orange : C.green}"></div></div>
                </div>
                <div class="lwa-stat-card">
                    <div class="lwa-stat-val" style="color:${C.blue}">${d.ctx.tp}</div>
                    <div class="lwa-stat-lbl">TP</div>
                </div>
                <div class="lwa-stat-card">
                    <div class="lwa-stat-val" style="color:${C.orange}">${d.ctx.mp}</div>
                    <div class="lwa-stat-lbl">MP</div>
                </div>
                <div class="lwa-stat-card">
                    <div class="lwa-stat-val" style="color:${C.red}">${d.ctx.enemies}</div>
                    <div class="lwa-stat-lbl">Enemies</div>
                </div>
                <div class="lwa-stat-card">
                    <div class="lwa-stat-val" style="color:${C.purple}">${d.ctx.cell}</div>
                    <div class="lwa-stat-lbl">Cell</div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="lwa-tabs">
                <div class="lwa-tab ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</div>
                <div class="lwa-tab ${activeTab === 'analysis' ? 'active' : ''}" data-tab="analysis">Analysis</div>
                <div class="lwa-tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</div>
                <div class="lwa-tab ${activeTab === 'combos' ? 'active' : ''}" data-tab="combos">Combos<span class="lwa-tab-badge">${d.combos.length}</span></div>
                <div class="lwa-tab ${activeTab === 'profiler' ? 'active' : ''}" data-tab="profiler">Profiler</div>
                <div class="lwa-tab ${activeTab === 'logs' ? 'active' : ''}" data-tab="logs">Logs</div>
                <div class="lwa-tab ${activeTab === 'stats' ? 'active' : ''}" data-tab="stats">Aggregated</div>
            </div>

            <div id="tab-overview" class="lwa-tab-cnt ${activeTab === 'overview' ? 'active' : ''}">${renderOverview(d, opsPct)}</div>
            <div id="tab-analysis" class="lwa-tab-cnt ${activeTab === 'analysis' ? 'active' : ''}">${renderAnalysis()}</div>
            <div id="tab-timeline" class="lwa-tab-cnt ${activeTab === 'timeline' ? 'active' : ''}">${renderTimeline()}</div>
            <div id="tab-combos" class="lwa-tab-cnt ${activeTab === 'combos' ? 'active' : ''}">${renderCombos(d)}</div>
            <div id="tab-profiler" class="lwa-tab-cnt ${activeTab === 'profiler' ? 'active' : ''}">${renderProfiler(d)}</div>
            <div id="tab-logs" class="lwa-tab-cnt ${activeTab === 'logs' ? 'active' : ''}">${renderLogs(d)}</div>
            <div id="tab-stats" class="lwa-tab-cnt ${activeTab === 'stats' ? 'active' : ''}">${renderAggregatedStats()}</div>
        `;

        // Bind events
        document.querySelectorAll('.lwa-tab').forEach(t => {
            t.onclick = () => { activeTab = t.dataset.tab; render(); };
        });
        document.getElementById('nav-prev')?.addEventListener('click', () => { if (currentIdx > 0) { currentIdx--; render(); } });
        document.getElementById('nav-next')?.addEventListener('click', () => { if (currentIdx < turnData.length - 1) { currentIdx++; render(); } });
        document.getElementById('nav-goto-report')?.addEventListener('click', () => { scrollToTurnInReport(d.t); });

        // Render charts
        if (activeTab === 'overview') {
            setTimeout(() => renderChart(), 50);
        }
        if (activeTab === 'analysis') {
            setTimeout(() => renderAnalysisCharts(), 50);
        }

        // Bind collapsible log categories
        document.querySelectorAll('.lwa-log-cat-header').forEach(header => {
            header.onclick = () => {
                const content = header.nextElementSibling;
                const toggle = header.querySelector('.lwa-log-cat-toggle');
                if (content && toggle) {
                    content.classList.toggle('hidden');
                    toggle.classList.toggle('collapsed');
                }
            };
        });
    }

    function renderOverview(d, opsPct) {
        const chosenDesc = d.chosen.desc;

        return `
            <div class="lwa-section">
                <div class="lwa-section-title">MCTS Search</div>
                <div class="lwa-mcts-grid">
                    <div class="lwa-mcts-card lwa-tip" data-tip="Nombre de simulations MCTS effectuées">
                        <div class="lwa-mcts-val" style="color:${C.green}">${d.mcts.iter}</div>
                        <div class="lwa-mcts-lbl">Iterations</div>
                    </div>
                    <div class="lwa-mcts-card lwa-tip" data-tip="Nombre de noeuds explorés dans l'arbre">
                        <div class="lwa-mcts-val" style="color:${C.blue}">${d.mcts.nodes}</div>
                        <div class="lwa-mcts-lbl">Nodes</div>
                    </div>
                    <div class="lwa-mcts-card lwa-tip" data-tip="Positions de départ testées">
                        <div class="lwa-mcts-val" style="color:${C.purple}">${d.mcts.pos}</div>
                        <div class="lwa-mcts-lbl">Positions</div>
                    </div>
                    <div class="lwa-mcts-card highlight lwa-tip" data-tip="Meilleur score trouvé">
                        <div class="lwa-mcts-val" style="color:${C.orange}">${d.mcts.best}</div>
                        <div class="lwa-mcts-lbl">Best Score</div>
                    </div>
                </div>
            </div>

            ${chosenDesc ? `
            <div class="lwa-chosen">
                <div class="lwa-chosen-head">
                    <div class="lwa-chosen-icon">★</div>
                    <div class="lwa-chosen-desc">${formatComboDesc(chosenDesc)}</div>
                </div>
                <div class="lwa-chosen-stats">
                    Score: <span>${d.chosen.score}</span> &nbsp;|&nbsp; Actions: <span>${d.chosen.actions}</span>
                </div>
            </div>
            ` : ''}

            <div class="lwa-section" style="margin-top:14px">
                <div class="lwa-section-title">Operations Used</div>
                <div class="lwa-ops-container">
                    <div class="lwa-ops-bar">
                        <div class="lwa-ops-fill ${opsClass(opsPct)}" style="width:${opsPct}%"></div>
                        <div class="lwa-ops-text">${fmt(d.ops)} / ${fmt(d.max)}</div>
                    </div>
                    <div class="lwa-ops-pct" style="color:${opsPct > 90 ? C.red : opsPct > 70 ? C.orange : C.green}">${opsPct}%</div>
                </div>
                ${turnData.length > 1 ? '<div class="lwa-chart-container"><canvas id="ops-chart"></canvas></div>' : ''}
            </div>
        `;
    }

    function renderTimeline() {
        if (turnData.length === 0) return '<div style="color:' + C.textDim + '">No data</div>';

        let html = '<div class="lwa-timeline">';

        for (let i = 0; i < turnData.length; i++) {
            const turn = turnData[i];
            const events = parseTimelineEvents(turn);
            const isCurrent = i === currentIdx;

            html += `
                <div class="lwa-tl-turn" data-turn-idx="${i}" onclick="window.lwaJumpToIdx(${i})">
                    <div class="lwa-tl-turn-marker ${isCurrent ? 'current' : ''}">${turn.t}</div>
                    <div class="lwa-tl-events">
            `;

            if (events.length === 0) {
                html += `<div class="lwa-tl-event"><div class="lwa-tl-desc" style="color:${C.textDim}">No actions</div></div>`;
            } else {
                for (const event of events) {
                    html += `
                        <div class="lwa-tl-event">
                            <div class="lwa-tl-icon ${event.type}">${event.icon}</div>
                            <div class="lwa-tl-desc">${event.desc}</div>
                            ${event.value ? `<div class="lwa-tl-value ${event.valueType}">${event.value}</div>` : ''}
                        </div>
                    `;
                }
            }

            // Add score info
            html += `
                <div class="lwa-tl-event" style="border-top:1px solid rgba(255,255,255,0.1);margin-top:6px;padding-top:8px">
                    <div class="lwa-tl-desc" style="color:${C.textMuted}">Score: ${turn.mcts.best} | ${turn.mcts.iter} iter | ${fmt(turn.ops)} ops</div>
                </div>
            `;

            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    function renderCombos(d) {
        const chosenDesc = d.chosen.desc;

        return `
            ${chosenDesc ? `
            <div class="lwa-chosen" style="margin-bottom:14px">
                <div class="lwa-chosen-head">
                    <div class="lwa-chosen-icon">★</div>
                    <div class="lwa-chosen-desc">${formatComboDesc(chosenDesc)}</div>
                </div>
                <div class="lwa-chosen-stats">
                    Score: <span>${d.chosen.score}</span> &nbsp;|&nbsp; Actions: <span>${d.chosen.actions}</span>
                </div>
            </div>
            ` : ''}

            <div class="lwa-section">
                <div class="lwa-section-title">Top ${d.combos.length} Combos</div>
                ${d.combos.length > 0 ? d.combos.map((c, i) => `
                    <div class="lwa-combo">
                        <div class="lwa-combo-head">
                            <div class="lwa-combo-rank">${i + 1}</div>
                            <div class="lwa-combo-desc">${formatComboDesc(c.d)}</div>
                        </div>
                        <div class="lwa-combo-stats">
                            Total: <span>${c.s}</span> &nbsp;|&nbsp; Actions: <span>${c.as}</span> &nbsp;|&nbsp; Position: <span>${c.ps}</span>
                        </div>
                    </div>
                `).join('') : '<div style="color:' + C.textDim + ';text-align:center;padding:20px">No combos tracked</div>'}
            </div>
        `;
    }

    function renderProfiler(d) {
        if (d.methods.length === 0) {
            return '<div style="color:' + C.textDim + ';text-align:center;padding:40px">No method data</div>';
        }

        // Recalculate percentages against turn's max budget (d.max)
        const turnBudget = d.max || 1;
        const sorted = [...d.methods].map(m => ({
            ...m,
            pct: Math.round(m.total * 100 / turnBudget)
        })).sort((a, b) => b.total - a.total);
        const maxOps = sorted[0]?.total || 1;

        const groups = {};
        const roots = [];

        sorted.forEach(m => {
            if (m.parent && m.parent !== '') {
                if (!groups[m.parent]) groups[m.parent] = [];
                groups[m.parent].push(m);
            } else {
                roots.push(m);
            }
        });

        let html = '<div class="lwa-section"><div class="lwa-section-title">Operations by Method</div>';

        roots.forEach((root, ri) => {
            const children = groups[root.name] || [];
            const hasChildren = children.length > 0;
            const groupColor = profColors[ri % profColors.length];
            const barPct = (root.total / maxOps * 100);
            const bgColor = root.pct > 30 ? 'rgba(217,83,79,0.2)' : root.pct > 15 ? 'rgba(232,155,60,0.2)' : 'transparent';

            if (hasChildren) {
                const groupId = 'prof-group-' + ri;

                html += `
                    <div class="lwa-prof-group">
                        <div class="lwa-prof-group-head" onclick="document.getElementById('${groupId}').classList.toggle('hidden'); this.querySelector('.lwa-prof-toggle').classList.toggle('open'); this.classList.toggle('collapsed');">
                            <span class="lwa-prof-toggle open">▶</span>
                            <div class="lwa-prof-group-info">
                                <span class="lwa-prof-group-name" style="color:${groupColor}">${root.name}</span>
                                <div class="lwa-prof-group-stats">
                                    <span><b>${root.pct}%</b></span>
                                    <span>${children.length} sub</span>
                                    <span><b>${fmt(root.total)}</b></span>
                                </div>
                            </div>
                        </div>
                        <div id="${groupId}" class="lwa-prof-children">
                `;

                children.sort((a, b) => b.total - a.total).forEach((m, mi) => {
                    const childColor = profColors[(ri + mi + 1) % profColors.length];
                    const cBarPct = (m.total / maxOps * 100);

                    html += `
                        <div class="lwa-prof-item nested">
                            <div class="lwa-prof-head">
                                <span class="lwa-prof-name">${m.name}</span>
                                <span class="lwa-prof-pct" style="color:${m.pct > 30 ? C.red : m.pct > 15 ? C.orange : C.textMuted}">${m.pct}%</span>
                            </div>
                            <div class="lwa-prof-bar">
                                <div class="lwa-prof-fill" style="width:${cBarPct}%;background:${childColor}"></div>
                            </div>
                            <div class="lwa-prof-details">
                                <span><b>${m.calls}x</b></span>
                                <span><b>${fmt(m.total)}</b></span>
                            </div>
                        </div>
                    `;
                });

                html += '</div></div>';
            } else {
                html += `
                    <div class="lwa-prof-standalone">
                        <div class="lwa-prof-head">
                            <span class="lwa-prof-name" style="color:${groupColor};font-weight:600">${root.name}</span>
                            <span class="lwa-prof-pct" style="background:${bgColor};color:${root.pct > 30 ? C.red : root.pct > 15 ? C.orange : C.textMuted}">${root.pct}%</span>
                        </div>
                        <div class="lwa-prof-bar">
                            <div class="lwa-prof-fill" style="width:${barPct}%;background:${groupColor}"></div>
                        </div>
                        <div class="lwa-prof-details">
                            <span><b>${root.calls}x</b></span>
                            <span><b>${fmt(root.total)}</b></span>
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';
        return html;
    }

    function renderLogs(d) {
        // Category icons and colors
        const catConfig = {
            'SUMMARY': { icon: '📊', class: 'summary', label: 'Turn Summary' },
            'INIT': { icon: '🚀', class: 'init', label: 'Initialization' },
            'REFRESH': { icon: '🔄', class: 'refresh', label: 'Refresh' },
            'MCTS': { icon: '🌳', class: 'mcts', label: 'MCTS Search' },
            'POSITION': { icon: '📍', class: 'position', label: 'Position Analysis' },
            'ACTION': { icon: '⚔️', class: 'action', label: 'Action Generation' },
            'CONSEQUENCES': { icon: '💥', class: 'consequences', label: 'Consequences' },
            'OTHER': { icon: '📋', class: 'other', label: 'Other' },
            'LOGS': { icon: '📝', class: 'other', label: 'Action Logs' }
        };

        // Group methods by category
        const categories = {};
        const categoryOrder = ['SUMMARY', 'INIT', 'REFRESH', 'MCTS', 'POSITION', 'ACTION', 'CONSEQUENCES', 'OTHER'];

        for (const m of d.methods) {
            const cat = m.category || 'OTHER';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(m);
        }

        // Sort methods within each category by total ops
        for (const cat in categories) {
            categories[cat].sort((a, b) => b.total - a.total);
        }

        // Calculate category totals
        const catTotals = {};
        for (const cat in categories) {
            catTotals[cat] = categories[cat].reduce((sum, m) => sum + m.total, 0);
        }

        // Expand/Collapse All button
        let html = `
            <div class="lwa-logs-toolbar">
                <button class="lwa-expand-all-btn" onclick="window.lwaToggleAllLogs()">
                    <span class="expand-icon">▼</span> Tout déplier
                </button>
            </div>
        `;

        html += '<div class="lwa-logs-container">';

        // Summary section (always first, always open)
        const opsPct = pct(d.ops, d.max);
        const displayOpsPct = d.displayOps > 0 ? pct(d.displayOps, d.max) : 0;

        html += `
            <div class="lwa-log-category">
                <div class="lwa-log-cat-header">
                    <span class="lwa-log-cat-toggle">▼</span>
                    <div class="lwa-log-cat-icon summary">📊</div>
                    <div class="lwa-log-cat-info">
                        <span class="lwa-log-cat-name">Turn ${d.t} Summary</span>
                        <div class="lwa-log-cat-stats">
                            <span>Ops: <b style="color:${opsPct > 90 ? C.red : opsPct > 70 ? C.orange : C.green}">${fmt(d.ops)}/${fmt(d.max)} (${opsPct}%)</b></span>
                        </div>
                    </div>
                    <button class="lwa-eye-btn" onclick="event.stopPropagation(); window.lwaShowRawLog('SUMMARY')" title="Voir le log brut">👁</button>
                </div>
                <div class="lwa-log-cat-content">
                    <!-- MCTS Stats -->
                    <div class="lwa-log-summary">
                        <div class="lwa-log-summary-card">
                            <div class="value" style="color:${C.green}">${d.mcts.iter}</div>
                            <div class="label">MCTS Iterations</div>
                        </div>
                        <div class="lwa-log-summary-card">
                            <div class="value" style="color:${C.blue}">${d.mcts.nodes}</div>
                            <div class="label">Nodes Explored</div>
                        </div>
                        <div class="lwa-log-summary-card">
                            <div class="value" style="color:${C.purple}">${d.mcts.pos}</div>
                            <div class="label">Positions</div>
                        </div>
                        <div class="lwa-log-summary-card">
                            <div class="value" style="color:${C.orange}">${d.mcts.best}</div>
                            <div class="label">Best Score</div>
                        </div>
                    </div>

                    <!-- Chosen Action Details -->
                    <div class="lwa-log-detail-section">
                        <div class="lwa-log-detail-title">Chosen Action</div>
                        <div class="lwa-log-detail-grid">
                            <div class="lwa-log-detail-item">
                                <span class="label">Actions:</span>
                                <span class="value">${d.chosen.actions}</span>
                            </div>
                            <div class="lwa-log-detail-item">
                                <span class="label">Score:</span>
                                <span class="value" style="color:${C.orange}">${d.chosen.score}</span>
                            </div>
                        </div>
                        ${d.chosen.desc ? `
                            <div class="lwa-log-combo-box">
                                <div class="lwa-log-combo-label">Combo Description:</div>
                                <div class="lwa-log-combo-text">${formatComboDesc(d.chosen.desc)}</div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Operations Details -->
                    <div class="lwa-log-detail-section">
                        <div class="lwa-log-detail-title">Operations</div>
                        <div class="lwa-log-detail-grid">
                            <div class="lwa-log-detail-item">
                                <span class="label">EndTurn Ops:</span>
                                <span class="value" style="color:${opsPct > 90 ? C.red : opsPct > 70 ? C.orange : C.green}">${fmt(d.ops)} / ${fmt(d.max)} (${opsPct}%)</span>
                            </div>
                            ${d.displayOps > 0 ? `
                            <div class="lwa-log-detail-item">
                                <span class="label">Display Ops:</span>
                                <span class="value" style="color:${C.purple}">${fmt(d.displayOps)} (${displayOpsPct}%)</span>
                            </div>
                            ` : ''}
                            <div class="lwa-log-detail-item">
                                <span class="label">Remaining:</span>
                                <span class="value" style="color:${C.green}">${fmt(d.max - d.ops)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render each benchmark category
        for (const cat of categoryOrder) {
            if (cat === 'SUMMARY') continue; // Already rendered
            if (!categories[cat] || categories[cat].length === 0) continue;

            const cfg = catConfig[cat] || catConfig['OTHER'];
            const methods = categories[cat];
            const totalOps = catTotals[cat];
            const catPct = pct(totalOps, d.max); // Use budget (d.max) not actual (d.ops)

            html += `
                <div class="lwa-log-category">
                    <div class="lwa-log-cat-header">
                        <span class="lwa-log-cat-toggle collapsed">▼</span>
                        <div class="lwa-log-cat-icon ${cfg.class}">${cfg.icon}</div>
                        <div class="lwa-log-cat-info">
                            <span class="lwa-log-cat-name">${cfg.label}</span>
                            <div class="lwa-log-cat-stats">
                                <span>${methods.length} methods</span>
                                <span><b style="color:${catPct > 30 ? C.red : catPct > 15 ? C.orange : C.green}">${catPct}%</b></span>
                                <span><b>${fmt(totalOps)}</b> ops</span>
                            </div>
                        </div>
                        <button class="lwa-eye-btn" onclick="event.stopPropagation(); window.lwaShowRawLog('${cat}')" title="Voir le log brut">👁</button>
                    </div>
                    <div class="lwa-log-cat-content hidden">
                        ${methods.map(m => {
                            const avg = m.calls > 0 ? Math.round(m.total / m.calls) : 0;
                            const methodPct = pct(m.total, d.max); // Use budget (d.max) not actual (d.ops)
                            return `
                                <div class="lwa-log-method-item" style="border-left-color:${methodPct > 10 ? C.red : methodPct > 5 ? C.orange : C.border}">
                                    <span class="lwa-log-method-name">${m.name}</span>
                                    <div class="lwa-log-method-stats">
                                        <span class="calls">${m.calls}x</span>
                                        <span class="avg">~${fmt(avg)}</span>
                                        <span class="total">${fmt(m.total)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Action logs section
        if (d.logs.length > 0) {
            html += `
                <div class="lwa-log-category">
                    <div class="lwa-log-cat-header">
                        <span class="lwa-log-cat-toggle collapsed">▼</span>
                        <div class="lwa-log-cat-icon other">📝</div>
                        <div class="lwa-log-cat-info">
                            <span class="lwa-log-cat-name">Action Logs</span>
                            <div class="lwa-log-cat-stats">
                                <span><b>${d.logs.length}</b> entries</span>
                            </div>
                        </div>
                    </div>
                    <div class="lwa-log-cat-content hidden">
                        <div class="lwa-action-logs">
                            ${d.logs.map((log, i) => `
                                <div class="lwa-action-log">
                                    <span class="lwa-action-log-num">${i + 1}.</span>
                                    <span>${log}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // ========================================
    // Analysis Tab - Charts, Heatmap, Anomalies, Efficiency
    // ========================================
    let hpChart = null;
    let scoreChart = null;

    function detectAnomalies() {
        const anomalies = [];
        const avgOps = turnData.reduce((sum, t) => sum + t.ops, 0) / turnData.length;
        const avgScore = turnData.reduce((sum, t) => sum + t.mcts.best, 0) / turnData.length;

        for (let i = 0; i < turnData.length; i++) {
            const t = turnData[i];
            const opsPct = pct(t.ops, t.max);

            // High ops usage (>90%)
            if (opsPct > 90) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'danger',
                    icon: '⚠️',
                    title: 'Near Timeout',
                    desc: `${opsPct}% ops used (${fmt(t.ops)}/${fmt(t.max)})`
                });
            } else if (opsPct > 80) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'warning',
                    icon: '⏱️',
                    title: 'High Ops Usage',
                    desc: `${opsPct}% ops used`
                });
            }

            // Low score compared to average
            if (t.mcts.best < avgScore * 0.5 && avgScore > 0) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'warning',
                    icon: '📉',
                    title: 'Low Score',
                    desc: `Score ${t.mcts.best} (avg: ${Math.round(avgScore)})`
                });
            }

            // HP drop
            if (i > 0) {
                const prevLife = turnData[i - 1].ctx.life;
                const lifeDrop = prevLife - t.ctx.life;
                const dropPct = pct(lifeDrop, turnData[0].ctx.maxLife);
                if (dropPct > 20) {
                    anomalies.push({
                        turn: t.t,
                        idx: i,
                        type: 'danger',
                        icon: '💔',
                        title: 'Major HP Loss',
                        desc: `-${lifeDrop} HP (-${dropPct}%)`
                    });
                }
            }

            // Few MCTS iterations
            if (t.mcts.iter < 5 && t.mcts.iter > 0) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'info',
                    icon: '🔍',
                    title: 'Low Search Depth',
                    desc: `Only ${t.mcts.iter} iterations`
                });
            }
        }

        // Add AI crash errors as critical anomalies
        const entityErrors = currentEntity && entitiesData[currentEntity]?.errors || {};
        for (const turnNum in entityErrors) {
            const errorMsg = entityErrors[turnNum].split('\n')[0]; // First line
            anomalies.push({
                turn: parseInt(turnNum),
                idx: -1, // No valid turn data
                type: 'crash',
                icon: '💥',
                title: 'AI CRASHED',
                desc: errorMsg
            });
        }

        // Sort by turn number
        anomalies.sort((a, b) => a.turn - b.turn);

        return anomalies;
    }

    function computeActionHeatmap() {
        const actions = {};

        for (const t of turnData) {
            const desc = t.chosen.desc || '';
            // Parse actions from description (format: Item1→Item2→c123 where c123 is final cell)
            const parts = desc.split(/[→+,]/);
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                // Skip cell references (c123, c456) and "stay"
                if (/^c\d+$/i.test(trimmed) || trimmed === 'stay') continue;

                // Extract action name (before parentheses or @)
                const match = trimmed.match(/^([A-Za-z_]+)/);
                if (match) {
                    const name = match[1];
                    if (!actions[name]) actions[name] = { count: 0, damage: 0, heal: 0 };
                    actions[name].count++;

                    // Try to extract damage/heal values
                    const dmgMatch = trimmed.match(/\((\d+)\)/);
                    if (dmgMatch) {
                        const val = parseInt(dmgMatch[1]);
                        if (/heal|bandage|cure|regen/i.test(name)) {
                            actions[name].heal += val;
                        } else {
                            actions[name].damage += val;
                        }
                    }
                }
            }
        }

        return Object.entries(actions)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count);
    }

    function renderAnalysis() {
        if (turnData.length === 0) return '<div style="color:' + C.textDim + '">No data</div>';

        const anomalies = detectAnomalies();
        const heatmap = computeActionHeatmap();

        // Color scale for heatmap
        const maxCount = heatmap.length > 0 ? heatmap[0].count : 1;
        const heatColors = [C.green, C.blue, C.orange, C.purple, C.red, C.cyan, C.yellow];

        // Compute chart stats for display
        const hpData = turnData.map(t => t.ctx.life);
        const scoreData = turnData.map(t => t.mcts.best);
        const hpMin = Math.min(...hpData);
        const hpMax = Math.max(...hpData);
        const scoreMin = Math.min(...scoreData);
        const scoreMax = Math.max(...scoreData);

        return `
            <!-- Charts Section -->
            <div class="lwa-section">
                <div class="lwa-section-title">📈 Evolution Charts</div>
                <div class="lwa-section-desc">
                    Visualisez l'évolution des métriques clés au fil du combat. Cliquez sur un point pour naviguer vers ce tour.
                </div>
                <div class="lwa-charts-row">
                    <div class="lwa-mini-chart">
                        <div class="lwa-mini-chart-title hp">
                            HP Evolution
                            <span class="lwa-chart-range">${hpMin} - ${hpMax}</span>
                        </div>
                        <canvas id="hp-chart"></canvas>
                    </div>
                    <div class="lwa-mini-chart">
                        <div class="lwa-mini-chart-title score">
                            Score MCTS
                            <span class="lwa-chart-range">${scoreMin} - ${scoreMax}</span>
                        </div>
                        <canvas id="score-chart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Anomalies Section -->
            <div class="lwa-section">
                <div class="lwa-section-title">⚠️ Anomaly Detection</div>
                <div class="lwa-section-desc">
                    Détection automatique des tours problématiques. Cliquez sur une anomalie pour y naviguer.
                </div>
                <div class="lwa-anomaly-legend">
                    <div class="lwa-legend-item"><span class="lwa-legend-icon danger">⚠️</span> Near Timeout: >90% des ops utilisées</div>
                    <div class="lwa-legend-item"><span class="lwa-legend-icon warning">⏱️</span> High Ops: >80% des ops utilisées</div>
                    <div class="lwa-legend-item"><span class="lwa-legend-icon warning">📉</span> Low Score: Score < 50% de la moyenne</div>
                    <div class="lwa-legend-item"><span class="lwa-legend-icon danger">💔</span> HP Loss: Perte > 20% des PV max</div>
                    <div class="lwa-legend-item"><span class="lwa-legend-icon info">🔍</span> Low Depth: < 5 itérations MCTS</div>
                    <div class="lwa-legend-item"><span class="lwa-legend-icon crash">💥</span> AI Crash: L'IA a crashé ce tour</div>
                </div>
                <div class="lwa-anomalies-list">
                    ${anomalies.length > 0 ? anomalies.slice(0, 10).map(a => `
                        <div class="lwa-anomaly-item ${a.type}" ${a.idx >= 0 ? `onclick="window.lwaJumpToIdx(${a.idx})" style="cursor:pointer"` : 'style="cursor:default"'}>
                            <div class="lwa-anomaly-icon">${a.icon}</div>
                            <div class="lwa-anomaly-info">
                                <div class="lwa-anomaly-title">${a.title}</div>
                                <div class="lwa-anomaly-desc">${a.desc}</div>
                            </div>
                            <div class="lwa-anomaly-turn">T${a.turn}</div>
                        </div>
                    `).join('') : '<div class="lwa-no-anomalies">Aucune anomalie détectée - Le combat s\'est bien passé !</div>'}
                </div>
            </div>

            <!-- Action Heatmap Section -->
            <div class="lwa-section">
                <div class="lwa-section-title">🔥 Action Usage Heatmap</div>
                <div class="lwa-section-desc">
                    Fréquence d'utilisation de chaque action durant le combat. Plus la barre est haute, plus l'action a été utilisée.
                </div>
                ${heatmap.length > 0 ? `
                <div class="lwa-heatmap-grid">
                    ${heatmap.slice(0, 12).map((a, i) => {
                        const intensity = a.count / maxCount;
                        const color = heatColors[i % heatColors.length];
                        return `
                            <div class="lwa-heatmap-item">
                                <div class="lwa-heatmap-bar" style="background:${color};height:${Math.max(15, intensity * 40)}px"></div>
                                <div class="lwa-heatmap-info">
                                    <div class="lwa-heatmap-name">${a.name}</div>
                                    <div class="lwa-heatmap-count">${a.count}x${a.damage > 0 ? ` • ${a.damage} dmg` : ''}${a.heal > 0 ? ` • ${a.heal} heal` : ''}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ` : '<div style="color:' + C.textDim + ';text-align:center;padding:20px">Aucune action détectée</div>'}
            </div>
        `;
    }

    function renderAnalysisCharts() {
        // Use hardcoded colors for charts (CSS variables don't work in canvas)
        const chartGreen = '#5fad1b';
        const chartOrange = '#ff8800';
        const chartGray = '#888';

        // HP Chart - shows percentage (0-100%) since maxHP can change during fight
        const hpCtx = document.getElementById('hp-chart');
        if (hpCtx && turnData.length >= 1) {
            if (hpChart) hpChart.destroy();

            // Calculate HP percentage for each turn (handles changing maxHP)
            const hpPctData = turnData.map(t => {
                const life = t.ctx?.life ?? 0;
                const maxLife = t.ctx?.maxLife ?? 1;
                return Math.round(life * 100 / maxLife);
            });
            const hpAbsData = turnData.map(t => t.ctx?.life ?? 0);
            const maxLifeData = turnData.map(t => t.ctx?.maxLife ?? 0);

            hpChart = new Chart(hpCtx, {
                type: 'line',
                data: {
                    labels: turnData.map(t => 'T' + t.t),
                    datasets: [{
                        label: 'HP %',
                        data: hpPctData,
                        borderColor: chartGreen,
                        backgroundColor: 'rgba(95, 173, 27, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: turnData.map((_, i) => i === currentIdx ? 8 : 4),
                        pointBackgroundColor: turnData.map((_, i) => i === currentIdx ? chartOrange : chartGreen),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                title: (items) => items[0] ? `Tour ${turnData[items[0].dataIndex]?.t}` : '',
                                label: (item) => {
                                    const idx = item.dataIndex;
                                    const hp = hpAbsData[idx];
                                    const maxHp = maxLifeData[idx];
                                    const pct = hpPctData[idx];
                                    return [`HP: ${hp} / ${maxHp}`, `(${pct}%)`];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { font: { size: 9 }, color: chartGray, maxRotation: 0 }
                        },
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(0,0,0,0.08)' },
                            ticks: { font: { size: 10 }, color: chartGray, callback: (v) => v + '%' }
                        }
                    },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            currentIdx = elements[0].index;
                            render();
                        }
                    }
                }
            });
        }

        // Score Chart
        const scoreCtx = document.getElementById('score-chart');
        if (scoreCtx && turnData.length >= 1) {
            if (scoreChart) scoreChart.destroy();

            const scoreData = turnData.map(t => t.mcts?.best ?? 0);
            const minScore = Math.min(...scoreData);
            const maxScore = Math.max(...scoreData);

            // Calculate better scale with padding
            const scoreRange = maxScore - minScore || Math.abs(maxScore) * 0.1 || 10;
            const yMin = minScore - scoreRange * 0.2;
            const yMax = maxScore + scoreRange * 0.15;

            scoreChart = new Chart(scoreCtx, {
                type: 'line',
                data: {
                    labels: turnData.map(t => 'T' + t.t),
                    datasets: [{
                        data: scoreData,
                        borderColor: chartOrange,
                        backgroundColor: 'rgba(255, 136, 0, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: turnData.map((_, i) => i === currentIdx ? 8 : 4),
                        pointBackgroundColor: turnData.map((_, i) => i === currentIdx ? chartGreen : chartOrange),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                title: (items) => items[0] ? `Tour ${turnData[items[0].dataIndex]?.t}` : '',
                                label: (item) => `Score: ${item.raw}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { font: { size: 9 }, color: chartGray, maxRotation: 0 }
                        },
                        y: {
                            min: yMin,
                            max: yMax,
                            grid: { color: 'rgba(0,0,0,0.08)' },
                            ticks: { font: { size: 10 }, color: chartGray, callback: (v) => Math.round(v) }
                        }
                    },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            currentIdx = elements[0].index;
                            render();
                        }
                    }
                }
            });
        }
    }

    function renderAggregatedStats() {
        const stats = computeAggregatedStats();
        if (!stats) return '<div style="color:' + C.textDim + '">No data</div>';

        // Aggregate methods across all turns (only ROOT methods - those without a parent)
        const methodAgg = {};
        for (const t of turnData) {
            for (const m of t.methods) {
                // Only count root methods to avoid double-counting nested calls
                if (m.parent && m.parent.length > 0) continue;
                if (!methodAgg[m.name]) methodAgg[m.name] = { calls: 0, total: 0 };
                methodAgg[m.name].calls += m.calls;
                methodAgg[m.name].total += m.total;
            }
        }

        // Use totalMaxOps (budget) for percentage to show resource usage vs available
        const topMethods = Object.entries(methodAgg)
            .map(([name, d]) => ({ name, ...d, pct: Math.round(d.total * 100 / stats.totalMaxOps) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return `
            <div class="lwa-section">
                <div class="lwa-section-title">Fight Summary</div>
                <div class="lwa-agg-grid">
                    <div class="lwa-agg-card good">
                        <div class="lwa-agg-val" style="color:${C.green}">${stats.totalTurns}</div>
                        <div class="lwa-agg-lbl">Turns Survived</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.blue}">${stats.totalActions}</div>
                        <div class="lwa-agg-lbl">Total Actions</div>
                        <div class="lwa-agg-desc">${(stats.totalActions / stats.totalTurns).toFixed(1)}/turn</div>
                    </div>
                    <div class="lwa-agg-card ${stats.lifeDelta >= 0 ? 'good' : 'bad'}">
                        <div class="lwa-agg-val" style="color:${stats.lifeDelta >= 0 ? C.green : C.red}">${stats.lifeDelta >= 0 ? '+' : ''}${stats.lifeDelta}</div>
                        <div class="lwa-agg-lbl">Life Delta</div>
                        <div class="lwa-agg-desc">${stats.lifeStart} → ${stats.lifeEnd}</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.orange}">${stats.avgScore}</div>
                        <div class="lwa-agg-lbl">Avg Score</div>
                        <div class="lwa-agg-desc">${stats.scoreMin} - ${stats.scoreMax}</div>
                    </div>
                </div>
            </div>

            <div class="lwa-section">
                <div class="lwa-section-title">Performance Metrics</div>
                <div class="lwa-agg-grid">
                    <div class="lwa-agg-card ${stats.avgOpsPerTurn < 300000 ? 'good' : stats.avgOpsPerTurn < 400000 ? 'warn' : 'bad'}">
                        <div class="lwa-agg-val" style="color:${C.purple}">${fmt(stats.avgOpsPerTurn)}</div>
                        <div class="lwa-agg-lbl">Avg Ops/Turn</div>
                        <div class="lwa-agg-desc">${fmt(stats.totalOps)} total</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.green}">${stats.totalIter}</div>
                        <div class="lwa-agg-lbl">Total MCTS Iter</div>
                        <div class="lwa-agg-desc">${(stats.totalIter / stats.totalTurns).toFixed(1)}/turn</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.blue}">${stats.totalNodes}</div>
                        <div class="lwa-agg-lbl">Total Nodes</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.cyan}">${stats.efficiency}</div>
                        <div class="lwa-agg-lbl">Efficiency</div>
                        <div class="lwa-agg-desc">score per 1k ops</div>
                    </div>
                </div>
            </div>

            ${topMethods.length > 0 ? `
            <div class="lwa-section">
                <div class="lwa-section-title">Top 5 Methods (All Turns)</div>
                ${topMethods.map((m, i) => `
                    <div class="lwa-prof-standalone">
                        <div class="lwa-prof-head">
                            <span class="lwa-prof-name" style="color:${profColors[i]};font-weight:600">${m.name}</span>
                            <span class="lwa-prof-pct" style="color:${C.textMuted}">${m.pct}%</span>
                        </div>
                        <div class="lwa-prof-bar">
                            <div class="lwa-prof-fill" style="width:${m.pct}%;background:${profColors[i]}"></div>
                        </div>
                        <div class="lwa-prof-details">
                            <span><b>${m.calls}x</b></span>
                            <span><b>${fmt(m.total)}</b></span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
    }

    function renderChart() {
        const ctx = document.getElementById('ops-chart');
        if (!ctx || turnData.length < 2) return;

        if (opsChart) opsChart.destroy();

        const pointColors = turnData.map((_, i) => i === currentIdx ? C.orange : C.green);
        const pointRadii = turnData.map((_, i) => i === currentIdx ? 6 : 3);

        opsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: turnData.map(t => 'T' + t.t),
                datasets: [{
                    data: turnData.map(t => t.ops),
                    borderColor: C.green,
                    backgroundColor: 'rgba(92,173,74,0.15)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: pointRadii,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointHoverRadius: 8,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: C.border }, ticks: { color: C.textDim, font: { size: 9 } } },
                    y: { grid: { color: C.border }, ticks: { color: C.textDim, font: { size: 9 }, callback: v => fmt(v) } }
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        currentIdx = elements[0].index;
                        render();
                    }
                },
                onHover: (e, elements) => {
                    e.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                }
            }
        });
    }

    // ========================================
    // Fetch & Parse
    // ========================================
    function fetchLogs(isRetry = false) {
        if (!isRetry) {
            fetchAttempts = 0;
        }
        fetchAttempts++;
        console.log(`[LWA] Looking for logs... (attempt ${fetchAttempts}/${MAX_FETCH_ATTEMPTS})`);

        let allLogs = '';
        let foundLogs = false;

        // DOM selectors
        const sels = ['.logs-content', '.log-content', '.fight-logs', '.logs', '[class*="log"]', 'pre'];
        for (const s of sels) {
            document.querySelectorAll(s).forEach(el => {
                const text = el.textContent || '';
                if (text.length > 0) {
                    allLogs += text + '\n';
                    foundLogs = true;
                }
            });
        }

        // Vue data - try multiple approaches
        const app = document.querySelector('#app');
        if (app) {
            // Try Vue 2 style
            if (app.__vue__) {
                try {
                    const vue = app.__vue__;
                    const fight = vue.$store?.state?.fight || vue.fight || vue.$data?.fight;
                    if (fight?.logs) {
                        console.log('[LWA] Found logs via Vue 2');
                        for (const id in fight.logs) {
                            if (Array.isArray(fight.logs[id])) {
                                allLogs += fight.logs[id].join('\n') + '\n';
                                foundLogs = true;
                            }
                        }
                    }
                } catch (e) {
                    console.log('[LWA] Vue 2 access error:', e);
                }
            }

            // Try Vue 3 style
            if (app._instance?.proxy) {
                try {
                    const proxy = app._instance.proxy;
                    const fight = proxy.fight || proxy.$store?.state?.fight;
                    if (fight?.logs) {
                        console.log('[LWA] Found logs via Vue 3');
                        for (const id in fight.logs) {
                            if (Array.isArray(fight.logs[id])) {
                                allLogs += fight.logs[id].join('\n') + '\n';
                                foundLogs = true;
                            }
                        }
                    }
                } catch (e) {
                    console.log('[LWA] Vue 3 access error:', e);
                }
            }
        }

        // Try fetching from API if we have the fight ID
        const fightIdMatch = location.pathname.match(/\/report\/(\d+)/);
        if (!foundLogs && fightIdMatch) {
            const fightId = fightIdMatch[1];
            console.log(`[LWA] Attempting to fetch fight ${fightId} from API...`);

            // Try to get logs from localStorage or sessionStorage
            try {
                const cachedFight = sessionStorage.getItem(`fight_${fightId}`) || localStorage.getItem(`fight_${fightId}`);
                if (cachedFight) {
                    const fight = JSON.parse(cachedFight);
                    if (fight?.logs) {
                        for (const id in fight.logs) {
                            if (Array.isArray(fight.logs[id])) {
                                allLogs += fight.logs[id].join('\n') + '\n';
                                foundLogs = true;
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        }

        const hasMarkerData = allLogs.includes(MARKER);
        const hasErrorData = allLogs.includes('Interruption de l\'IA') || allLogs.includes('AI interrupted');

        console.log(`[LWA] Logs found: ${foundLogs}, Marker data: ${hasMarkerData}, Error data: ${hasErrorData}`);

        if (hasMarkerData || hasErrorData) {
            entitiesData = parseLogs(allLogs);
            const entityNames = Object.keys(entitiesData);
            console.log('[LWA] Found entities:', entityNames);

            if (entityNames.length > 0) {
                entityNames.sort((a, b) => {
                    const aIsSummon = SUMMON_NAMES.some(s => a.toLowerCase().includes(s.toLowerCase()));
                    const bIsSummon = SUMMON_NAMES.some(s => b.toLowerCase().includes(s.toLowerCase()));
                    if (aIsSummon !== bIsSummon) return aIsSummon ? 1 : -1;
                    return entitiesData[b].turns.length - entitiesData[a].turns.length;
                });

                currentEntity = entityNames[0];
                turnData = entitiesData[currentEntity].turns;
                console.log('[LWA] Selected entity:', currentEntity, 'with', turnData.length, 'turns');
            }

            currentIdx = 0;
            render();

            // Inject jump buttons into LeekWars turn headers
            setTimeout(injectJumpButtons, 500);
        } else if (fetchAttempts < MAX_FETCH_ATTEMPTS) {
            // Retry after delay - data might not be loaded yet
            console.log(`[LWA] No data found, retrying in ${FETCH_RETRY_DELAY}ms...`);
            setTimeout(() => fetchLogs(true), FETCH_RETRY_DELAY);
        } else {
            // Max attempts reached, show no data state
            console.log('[LWA] Max fetch attempts reached, showing no data state');
            currentIdx = 0;
            render();
        }
    }

    function switchEntity(name) {
        if (entitiesData[name]) {
            currentEntity = name;
            turnData = entitiesData[name].turns;
            currentIdx = 0;
            render();
        }
    }

    // ========================================
    // Init
    // ========================================
    function isReportPage() {
        return /\/report\/\d+/.test(location.pathname);
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const el = document.querySelector(selector);
                if (el) {
                    obs.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null); // Resolve with null instead of rejecting
            }, timeout);
        });
    }

    async function initializeOnReportPage() {
        console.log('[LWA] Initializing on report page...');

        // Reset state
        entitiesData = {};
        currentEntity = null;
        turnData = [];
        currentIdx = 0;
        fetchAttempts = 0;

        // Wait for the page structure to be ready
        const pageReady = await waitForElement('.report, .report-page, .page-content, .panel', 8000);

        if (!pageReady) {
            console.log('[LWA] Page structure not found after timeout, attempting anyway...');
        }

        // Create the panel
        createPanel();

        // Wait a bit more for fight data to load, then fetch logs
        // LeekWars loads fight data asynchronously
        setTimeout(fetchLogs, 1500);
    }

    function init() {
        GM_addStyle(styles);
        console.log('%c[LWA] Fight Analyzer v' + VERSION + ' loaded', 'color: #5cad4a; font-weight: bold;');

        // Only initialize panel on report pages
        if (isReportPage()) {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(initializeOnReportPage, 500);
                });
            } else {
                setTimeout(initializeOnReportPage, 500);
            }
        }

        // SPA navigation - handle page changes
        let lastUrl = location.href;
        let navigationTimeout = null;

        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;

                // Clear any pending navigation timeout
                if (navigationTimeout) {
                    clearTimeout(navigationTimeout);
                }

                if (isReportPage()) {
                    // Navigated to a report page - wait a bit then initialize
                    console.log('[LWA] Navigated to report page, initializing...');
                    navigationTimeout = setTimeout(initializeOnReportPage, 1000);
                } else {
                    // Left report page - remove the panel
                    const panel = document.querySelector('.lwa-panel');
                    if (panel) {
                        panel.remove();
                        console.log('[LWA] Panel removed (left report page)');
                    }
                }
            }
        }).observe(document, { subtree: true, childList: true });

        // Also listen for popstate (browser back/forward)
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                if (isReportPage()) {
                    const existing = document.querySelector('.lwa-panel');
                    if (!existing) {
                        initializeOnReportPage();
                    }
                }
            }, 500);
        });
    }

    init();
})();
