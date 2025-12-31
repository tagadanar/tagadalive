// ==UserScript==
// @name         LWA Core
// @namespace    https://leekwars.com/
// @version      1.0.0
// @description  LeekWars Fight Analyzer - Core module (state, colors, helpers)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ========================================
    // Shared Namespace
    // ========================================
    const LWA = unsafeWindow.LWA = unsafeWindow.LWA || {};

    // ========================================
    // Constants
    // ========================================
    LWA.MARKER = '##MARKER##';
    LWA.VERSION = '1.0.0';
    LWA.SUMMON_NAMES = ['Tourelle', 'Turret', 'Puny', 'Chest', 'Coffre'];
    LWA.MAX_FETCH_ATTEMPTS = 5;
    LWA.FETCH_RETRY_DELAY = 2000;

    // ========================================
    // Global State
    // ========================================
    LWA.state = {
        entitiesData: {},
        currentEntity: null,
        turnData: [],
        currentIdx: 0,
        activeTab: 'overview',
        logsExpanded: false,
        fetchAttempts: 0
    };

    // Chart instances (managed by lwa-charts)
    LWA.charts = {
        opsChart: null,
        hpChart: null,
        scoreChart: null
    };

    // ========================================
    // Color Palette (Native LeekWars colors)
    // ========================================
    LWA.C = {
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

    LWA.profColors = [LWA.C.green, LWA.C.blue, LWA.C.orange, LWA.C.purple, LWA.C.yellow, LWA.C.cyan, LWA.C.red];

    // ========================================
    // Helper Functions
    // ========================================
    LWA.fmt = function(n) {
        if (n == null) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return Math.round(n / 1000) + 'k';
        return n.toString();
    };

    LWA.pct = function(a, b) {
        return b > 0 ? Math.round(a * 100 / b) : 0;
    };

    LWA.opsClass = function(p) {
        return p > 90 ? 'danger' : p > 70 ? 'warn' : 'ok';
    };

    /**
     * Format combo description for display.
     * Input: "Flash(81)->Spark(120)->mv(256:180=0d+0p-57g+0t+0s)"
     * Output: HTML with styled actions and position breakdown
     */
    LWA.formatComboDesc = function(desc) {
        const C = LWA.C;
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
    };

    // ========================================
    // Global Functions (for onclick handlers)
    // ========================================
    unsafeWindow.lwaJumpToIdx = function(idx) {
        if (idx >= 0 && idx < LWA.state.turnData.length) {
            LWA.state.currentIdx = idx;
            LWA.state.activeTab = 'overview';
            if (LWA.render) LWA.render();
            const panel = document.getElementById('lwa-analyzer');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    unsafeWindow.lwaJumpToTurn = function(turnNum) {
        const idx = LWA.state.turnData.findIndex(t => t.t === turnNum);
        if (idx !== -1) {
            LWA.state.currentIdx = idx;
            if (LWA.render) LWA.render();
            const panel = document.getElementById('lwa-analyzer');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    unsafeWindow.lwaToggleAllLogs = function() {
        LWA.state.logsExpanded = !LWA.state.logsExpanded;
        const btn = document.querySelector('.lwa-expand-all-btn');
        const categories = document.querySelectorAll('.lwa-log-category');

        categories.forEach((cat, index) => {
            const content = cat.querySelector('.lwa-log-cat-content');
            const toggle = cat.querySelector('.lwa-log-cat-toggle');
            if (content && toggle) {
                if (LWA.state.logsExpanded) {
                    content.classList.remove('hidden');
                    toggle.classList.remove('collapsed');
                } else {
                    if (index !== 0) {
                        content.classList.add('hidden');
                        toggle.classList.add('collapsed');
                    }
                }
            }
        });

        if (btn) {
            btn.innerHTML = LWA.state.logsExpanded
                ? '<span class="expand-icon">▲</span> Tout replier'
                : '<span class="expand-icon">▼</span> Tout déplier';
        }
    };

    unsafeWindow.lwaRetryFetch = function() {
        console.log('[LWA] Manual retry triggered');
        LWA.state.fetchAttempts = 0;
        const content = document.getElementById('lwa-content');
        if (content) {
            content.innerHTML = `
                <div class="lwa-loading">
                    <div class="lwa-loading-spinner"></div>
                    <div class="lwa-loading-text">Retrying...</div>
                </div>
            `;
        }
        if (LWA.fetchLogs) setTimeout(LWA.fetchLogs, 500);
    };

    unsafeWindow.lwaShowRawLog = function(category) {
        const d = LWA.state.turnData[LWA.state.currentIdx];
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
    // Module System
    // ========================================
    LWA.modules = {
        core: true,
        styles: false,
        parser: false,
        ui: false,
        charts: false,
        main: false
    };

    // Helper for other modules to wait for LWA
    LWA.waitForCore = function(callback) {
        if (unsafeWindow.LWA && unsafeWindow.LWA.modules && unsafeWindow.LWA.modules.core) {
            callback();
        } else {
            setTimeout(() => LWA.waitForCore(callback), 50);
        }
    };

    // Helper to wait for a specific module
    LWA.waitForModule = function(moduleName, callback) {
        const check = () => {
            if (unsafeWindow.LWA && unsafeWindow.LWA.modules && unsafeWindow.LWA.modules[moduleName]) {
                callback();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    };

    // Helper to wait for all modules
    LWA.waitForAllModules = function(callback) {
        const check = () => {
            const m = unsafeWindow.LWA?.modules;
            if (m && m.core && m.styles && m.parser && m.ui && m.charts) {
                callback();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    };

    console.log('[LWA] Core module loaded');
})();
