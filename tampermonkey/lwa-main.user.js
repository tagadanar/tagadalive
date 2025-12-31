// ==UserScript==
// @name         LWA Main
// @namespace    https://leekwars.com/
// @version      1.0.0
// @description  LeekWars Fight Analyzer - Main module (init + orchestration)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        unsafeWindow
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Wait for all other modules to be loaded before initializing
    function waitForLWA(callback) {
        const check = () => {
            const LWA = unsafeWindow.LWA;
            if (LWA && LWA.modules && LWA.modules.core && LWA.modules.styles && LWA.modules.parser && LWA.modules.ui && LWA.modules.charts) {
                callback(LWA);
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    }

    waitForLWA(function(LWA) {
        console.log('[LWA Main] All modules ready, initializing...');

        const MARKER = LWA.MARKER;
        // Define locally to avoid cross-context permission issues
        const SUMMON_NAMES = ['Tourelle', 'Turret', 'Puny', 'Chest', 'Coffre'];

    // Fetch & Parse
    // ========================================
    LWA.fetchLogs = function(isRetry = false) {
        if (!isRetry) {
            LWA.state.fetchAttempts = 0;
        }
        LWA.state.fetchAttempts++;
        console.log(`[LWA] Looking for logs... (attempt ${LWA.state.fetchAttempts}/${LWA.MAX_FETCH_ATTEMPTS})`);

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
            LWA.state.entitiesData = LWA.parseLogs(allLogs);
            const entityNames = Object.keys(LWA.state.entitiesData);
            console.log('[LWA] Found entities:', entityNames);

            if (entityNames.length > 0) {
                entityNames.sort((a, b) => {
                    const aIsSummon = SUMMON_NAMES.some(s => a.toLowerCase().includes(s.toLowerCase()));
                    const bIsSummon = SUMMON_NAMES.some(s => b.toLowerCase().includes(s.toLowerCase()));
                    if (aIsSummon !== bIsSummon) return aIsSummon ? 1 : -1;
                    return LWA.state.entitiesData[b].turns.length - LWA.state.entitiesData[a].turns.length;
                });

                LWA.state.currentEntity = entityNames[0];
                LWA.state.turnData = LWA.state.entitiesData[LWA.state.currentEntity].turns;
                console.log('[LWA] Selected entity:', LWA.state.currentEntity, 'with', LWA.state.turnData.length, 'turns');
            }

            LWA.state.currentIdx = 0;
            LWA.render();

            // Inject jump buttons into LeekWars turn headers
            setTimeout(LWA.injectJumpButtons, 500);
        } else if (LWA.state.fetchAttempts < LWA.MAX_FETCH_ATTEMPTS) {
            // Retry after delay - data might not be loaded yet
            console.log(`[LWA] No data found, retrying in ${LWA.FETCH_RETRY_DELAY}ms...`);
            setTimeout(() => LWA.fetchLogs(true), LWA.FETCH_RETRY_DELAY);
        } else {
            // Max attempts reached, show no data state
            console.log('[LWA] Max fetch attempts reached, showing no data state');
            LWA.state.currentIdx = 0;
            LWA.render();
        }
    }

    LWA.switchEntity = function(name) {
        if (LWA.state.entitiesData[name]) {
            LWA.state.currentEntity = name;
            LWA.state.turnData = LWA.state.entitiesData[name].turns;
            LWA.state.currentIdx = 0;
            LWA.render();
        }
    }

    // ========================================
    // Init
    // ========================================
    LWA.isReportPage = function() {
        return /\/report\/\d+/.test(location.pathname);
    }

    LWA.waitForElement = function(selector, timeout = 10000) {
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
        LWA.state.entitiesData = {};
        LWA.state.currentEntity = null;
        LWA.state.turnData = [];
        LWA.state.currentIdx = 0;
        LWA.state.fetchAttempts = 0;

        // Wait for the page structure to be ready
        const pageReady = await LWA.waitForElement('.report, .report-page, .page-content, .panel', 8000);

        if (!pageReady) {
            console.log('[LWA] Page structure not found after timeout, attempting anyway...');
        }

        // Create the panel
        LWA.createPanel();

        // Wait a bit more for fight data to load, then fetch logs
        // LeekWars loads fight data asynchronously
        setTimeout(LWA.fetchLogs, 1500);
    }

    function init() {
        // Styles are loaded by lwa-styles.user.js module
        console.log('%c[LWA] Fight Analyzer v' + LWA.VERSION + ' loaded', 'color: #5cad4a; font-weight: bold;');

        // Only initialize panel on report pages
        if (LWA.isReportPage()) {
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

                if (LWA.isReportPage()) {
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
                if (LWA.isReportPage()) {
                    const existing = document.querySelector('.lwa-panel');
                    if (!existing) {
                        initializeOnReportPage();
                    }
                }
            }, 500);
        });
    }

    // Register module and start initialization
    LWA.modules.main = true;
    init();

    console.log('[LWA] Main module loaded - Application started');
    });
})();
