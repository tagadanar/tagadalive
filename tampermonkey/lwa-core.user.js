// ==UserScript==
// @name         LWA Core
// @namespace    https://leekwars.com/
// @version      1.5.0
// @description  LeekWars Fight Analyzer - Core module (state, colors, helpers)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @match        https://leekwars.com/fight/*
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
    LWA.VERSION = '1.5.0';
    LWA.SUMMON_NAMES = ['Tourelle', 'Turret', 'Puny', 'Chest', 'Coffre'];
    LWA.MAX_FETCH_ATTEMPTS = 2;
    LWA.FETCH_RETRY_DELAY = 1000;

    // ========================================
    // Cache Configuration
    // ========================================
    LWA.CACHE_PREFIX = 'lwa_fight_';
    LWA.CACHE_INDEX_KEY = 'lwa_cache_index';
    LWA.CACHE_MAX_AGE_HOURS = 48; // Default: auto-cleanup after 48 hours

    // ========================================
    // localStorage Cache System
    // ========================================
    LWA.cache = {
        /**
         * Save fight logs to localStorage
         * @param {string|number} fightId - Fight ID
         * @param {string} logs - Raw log text
         */
        save: function(fightId, logs) {
            try {
                const key = LWA.CACHE_PREFIX + fightId;
                const data = {
                    logs: logs,
                    timestamp: Date.now(),
                    fightId: fightId
                };
                localStorage.setItem(key, JSON.stringify(data));

                // Update index
                const index = LWA.cache.getIndex();
                if (!index.includes(String(fightId))) {
                    index.push(String(fightId));
                    localStorage.setItem(LWA.CACHE_INDEX_KEY, JSON.stringify(index));
                }
                console.log(`[LWA Cache] Saved fight ${fightId} (${(logs.length / 1024).toFixed(1)} KB)`);
            } catch (e) {
                console.error('[LWA Cache] Error saving:', e);
            }
        },

        /**
         * Get fight logs from localStorage
         * @param {string|number} fightId - Fight ID
         * @returns {object|null} - { logs, timestamp, fightId } or null
         */
        get: function(fightId) {
            try {
                const key = LWA.CACHE_PREFIX + fightId;
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    console.log(`[LWA Cache] Loaded fight ${fightId} from cache`);
                    return parsed;
                }
            } catch (e) {
                console.error('[LWA Cache] Error loading:', e);
            }
            return null;
        },

        /**
         * Check if fight is cached
         * @param {string|number} fightId - Fight ID
         * @returns {boolean}
         */
        has: function(fightId) {
            return localStorage.getItem(LWA.CACHE_PREFIX + fightId) !== null;
        },

        /**
         * Get cache index (list of cached fight IDs)
         * @returns {string[]}
         */
        getIndex: function() {
            try {
                const index = localStorage.getItem(LWA.CACHE_INDEX_KEY);
                return index ? JSON.parse(index) : [];
            } catch (e) {
                return [];
            }
        },

        /**
         * Get cache statistics
         * @returns {object} - { count, totalSize, items }
         */
        getStats: function() {
            const index = LWA.cache.getIndex();
            let totalSize = 0;
            const items = [];

            for (const fightId of index) {
                const key = LWA.CACHE_PREFIX + fightId;
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    const size = data.length;
                    totalSize += size;
                    items.push({
                        fightId: fightId,
                        timestamp: parsed.timestamp,
                        size: size,
                        age: Date.now() - parsed.timestamp
                    });
                }
            }

            // Sort by timestamp (newest first)
            items.sort((a, b) => b.timestamp - a.timestamp);

            return {
                count: items.length,
                totalSize: totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(1),
                items: items
            };
        },

        /**
         * Remove old cached fights
         * @param {number} maxAgeHours - Max age in hours (default: LWA.CACHE_MAX_AGE_HOURS)
         * @returns {number} - Number of items removed
         */
        cleanup: function(maxAgeHours) {
            const maxAge = (maxAgeHours || LWA.CACHE_MAX_AGE_HOURS) * 60 * 60 * 1000;
            const now = Date.now();
            const index = LWA.cache.getIndex();
            const newIndex = [];
            let removed = 0;

            for (const fightId of index) {
                const key = LWA.CACHE_PREFIX + fightId;
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (now - parsed.timestamp > maxAge) {
                            localStorage.removeItem(key);
                            removed++;
                            console.log(`[LWA Cache] Removed old fight ${fightId}`);
                        } else {
                            newIndex.push(fightId);
                        }
                    } catch (e) {
                        localStorage.removeItem(key);
                        removed++;
                    }
                }
            }

            localStorage.setItem(LWA.CACHE_INDEX_KEY, JSON.stringify(newIndex));
            if (removed > 0) {
                console.log(`[LWA Cache] Cleanup: removed ${removed} old fights`);
            }
            return removed;
        },

        /**
         * Clear all cached fights
         * @returns {number} - Number of items removed
         */
        clear: function() {
            const index = LWA.cache.getIndex();
            let removed = 0;

            for (const fightId of index) {
                const key = LWA.CACHE_PREFIX + fightId;
                localStorage.removeItem(key);
                removed++;
            }

            localStorage.removeItem(LWA.CACHE_INDEX_KEY);
            console.log(`[LWA Cache] Cleared ${removed} fights`);
            return removed;
        },

        /**
         * Remove a specific fight from cache
         * @param {string|number} fightId - Fight ID
         */
        remove: function(fightId) {
            const key = LWA.CACHE_PREFIX + fightId;
            localStorage.removeItem(key);

            const index = LWA.cache.getIndex();
            const newIndex = index.filter(id => id !== String(fightId));
            localStorage.setItem(LWA.CACHE_INDEX_KEY, JSON.stringify(newIndex));
            console.log(`[LWA Cache] Removed fight ${fightId}`);
        },

        /**
         * Set max age for auto-cleanup
         * @param {number} hours - Max age in hours
         */
        setMaxAge: function(hours) {
            LWA.CACHE_MAX_AGE_HOURS = hours;
            localStorage.setItem('lwa_cache_max_age', hours);
            console.log(`[LWA Cache] Max age set to ${hours} hours`);
        },

        /**
         * Get max age setting
         * @returns {number}
         */
        getMaxAge: function() {
            try {
                const saved = localStorage.getItem('lwa_cache_max_age');
                if (saved) {
                    LWA.CACHE_MAX_AGE_HOURS = parseInt(saved);
                }
            } catch (e) {}
            return LWA.CACHE_MAX_AGE_HOURS;
        }
    };

    // Initialize and run auto-cleanup on load
    LWA.cache.getMaxAge();
    LWA.cache.cleanup();

    // ========================================
    // User Settings (persisted, never auto-cleared)
    // ========================================
    LWA.SETTINGS_KEY = 'lwa_settings';

    LWA.settings = {
        /**
         * Get all settings
         * @returns {object}
         */
        getAll: function() {
            try {
                const saved = localStorage.getItem(LWA.SETTINGS_KEY);
                return saved ? JSON.parse(saved) : {};
            } catch (e) {
                return {};
            }
        },

        /**
         * Get a specific setting
         * @param {string} key - Setting key
         * @param {*} defaultValue - Default value if not set
         * @returns {*}
         */
        get: function(key, defaultValue) {
            const all = LWA.settings.getAll();
            return all.hasOwnProperty(key) ? all[key] : defaultValue;
        },

        /**
         * Set a specific setting
         * @param {string} key - Setting key
         * @param {*} value - Value to save
         */
        set: function(key, value) {
            const all = LWA.settings.getAll();
            all[key] = value;
            localStorage.setItem(LWA.SETTINGS_KEY, JSON.stringify(all));
            console.log(`[LWA Settings] ${key} = ${value}`);
        }
    };

    // Setting keys
    LWA.SETTING_FIGHT_PANEL_POSITION = 'fightPanelPosition'; // 'bottom' or 'side'
    LWA.SETTING_FIGHT_PANEL_COLLAPSED = 'fightPanelCollapsed'; // true or false
    LWA.SETTING_FIGHT_PANEL_WIDTH = 'fightPanelWidth'; // custom width in pixels (default: 400)

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
        scoreChart: null,
        tpChart: null,
        mpChart: null,
        ramChart: null
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
