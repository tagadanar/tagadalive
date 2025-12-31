// ==UserScript==
// @name         LWA UI
// @namespace    https://leekwars.com/
// @version      1.0.0
// @description  LeekWars Fight Analyzer - UI module (rendering)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        unsafeWindow
// @inject-into  content
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    // Wait for Core module
    const init = () => {
        if (!unsafeWindow.LWA || !unsafeWindow.LWA.modules || !unsafeWindow.LWA.modules.core) {
            setTimeout(init, 50);
            return;
        }

        // Local reference (safe inside this function scope)
        const LWA = unsafeWindow.LWA;
        const C = LWA.C;
        const fmt = LWA.fmt;
        const pct = LWA.pct;
        const opsClass = LWA.opsClass;
        const formatComboDesc = LWA.formatComboDesc;
        // Define locally to avoid cross-context permission issues
        const profColors = ['#5fad1b', '#32b2da', '#ff8800', '#a017d6', '#f0c040', '#2bc491', '#e22424'];
        // Define locally to avoid cross-context permission issues
        const SUMMON_NAMES = ['Tourelle', 'Turret', 'Puny', 'Chest', 'Coffre'];

    // UI Creation
    // ========================================
    LWA.createPanel = function() {
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
                    <h2>🥬 LeekWars Fight Analyzer <span class="version">v${LWA.VERSION}</span></h2>
                </div>
                <div id="lwa-entity-container"></div>
                <div class="content" id="lwa-content">
                    <div class="lwa-loading">
                        <div class="lwa-loading-spinner"></div>
                        <div class="lwa-loading-text">Loading fight data...</div>
                        <button class="lwa-retry-btn" data-action="retry-fetch" style="display:none">↻ Retry</button>
                    </div>
                </div>
            </div>
        `;

        // Show retry button after initial delay
        setTimeout(() => {
            const retryBtn = wrapper.querySelector('.lwa-retry-btn');
            if (retryBtn && LWA.state.turnData.length === 0) {
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
    LWA.injectJumpButtons = function() {
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
                LWA.jumpToTurn(turnNum);
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
                    LWA.jumpToTurn(turnNum);
                };
                el.appendChild(btn);
            }
        });
    }

    // Jump to specific turn in the analyzer
    LWA.jumpToTurn = function(turnNum) {
        // Find the turn index in our data
        const idx = LWA.state.turnData.findIndex(t => t.t === turnNum);
        if (idx !== -1) {
            LWA.state.currentIdx = idx;
            LWA.render();

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
        const entityNames = Object.keys(LWA.state.entitiesData);
        if (entityNames.length <= 1) return '';

        return `
            <div class="lwa-entity-bar">
                <label>Entity:</label>
                <select id="entity-select">
                    ${entityNames.map(name => {
                        const data = LWA.state.entitiesData[name];
                        const isSummon = SUMMON_NAMES.some(s => name.toLowerCase().includes(s.toLowerCase()));
                        const turnCount = data.turns.length;
                        const errorCount = Object.keys(data.errors).length;
                        const label = `${name} (${turnCount}T${errorCount > 0 ? ', ' + errorCount + ' err' : ''})${isSummon ? ' [summon]' : ''}`;
                        return `<option value="${name}" ${name === LWA.state.currentEntity ? 'selected' : ''}>${label}</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    }

    LWA.render = function() {
        const contentEl = document.getElementById('lwa-content');
        const entityContainerEl = document.getElementById('lwa-entity-container');
        if (!contentEl) return;

        // Render entity selector
        if (entityContainerEl) {
            entityContainerEl.innerHTML = renderEntitySelector();
            const select = document.getElementById('entity-select');
            if (select) {
                select.onchange = () => LWA.switchEntity(select.value);
            }
        }

        // Check for errors
        if (LWA.state.turnData.length === 0) {
            const hasErrors = LWA.state.currentEntity && LWA.state.entitiesData[LWA.state.currentEntity]?.errors && Object.keys(LWA.state.entitiesData[LWA.state.currentEntity].errors).length > 0;

            if (hasErrors) {
                const errors = LWA.state.entitiesData[LWA.state.currentEntity].errors;
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

        const d = LWA.state.turnData[LWA.state.currentIdx];
        const lifePct = pct(d.ctx.life, d.ctx.maxLife);
        const opsPct = pct(d.ops, d.max);

        // Check for errors even when we have turn data
        const entityErrors = LWA.state.currentEntity && LWA.state.entitiesData[LWA.state.currentEntity]?.errors || {};
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
                <button class="lwa-nav-btn" id="nav-prev" ${LWA.state.currentIdx === 0 ? 'disabled' : ''}>◀ Prev</button>
                <span class="lwa-turn-label">Turn ${d.t} (${LWA.state.currentIdx + 1}/${LWA.state.turnData.length})</span>
                <button class="lwa-nav-btn" id="nav-next" ${LWA.state.currentIdx === LWA.state.turnData.length - 1 ? 'disabled' : ''}>Next ▶</button>
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
                <div class="lwa-tab ${LWA.state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</div>
                <div class="lwa-tab ${LWA.state.activeTab === 'analysis' ? 'active' : ''}" data-tab="analysis">Analysis</div>
                <div class="lwa-tab ${LWA.state.activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</div>
                <div class="lwa-tab ${LWA.state.activeTab === 'combos' ? 'active' : ''}" data-tab="combos">Combos<span class="lwa-tab-badge">${d.combos.length}</span></div>
                <div class="lwa-tab ${LWA.state.activeTab === 'profiler' ? 'active' : ''}" data-tab="profiler">Profiler</div>
                <div class="lwa-tab ${LWA.state.activeTab === 'logs' ? 'active' : ''}" data-tab="logs">Logs</div>
                <div class="lwa-tab ${LWA.state.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">Aggregated</div>
            </div>

            <div id="tab-overview" class="lwa-tab-cnt ${LWA.state.activeTab === 'overview' ? 'active' : ''}">${LWA.renderOverview(d, opsPct)}</div>
            <div id="tab-analysis" class="lwa-tab-cnt ${LWA.state.activeTab === 'analysis' ? 'active' : ''}">${LWA.renderAnalysis()}</div>
            <div id="tab-timeline" class="lwa-tab-cnt ${LWA.state.activeTab === 'timeline' ? 'active' : ''}">${LWA.renderTimeline()}</div>
            <div id="tab-combos" class="lwa-tab-cnt ${LWA.state.activeTab === 'combos' ? 'active' : ''}">${LWA.renderCombos(d)}</div>
            <div id="tab-profiler" class="lwa-tab-cnt ${LWA.state.activeTab === 'profiler' ? 'active' : ''}">${LWA.renderProfiler(d)}</div>
            <div id="tab-logs" class="lwa-tab-cnt ${LWA.state.activeTab === 'logs' ? 'active' : ''}">${LWA.renderLogs(d)}</div>
            <div id="tab-stats" class="lwa-tab-cnt ${LWA.state.activeTab === 'stats' ? 'active' : ''}">${LWA.renderAggregatedStats()}</div>
        `;

        // Bind events
        document.querySelectorAll('.lwa-tab').forEach(t => {
            t.onclick = () => { LWA.state.activeTab = t.dataset.tab; LWA.render(); };
        });
        document.getElementById('nav-prev')?.addEventListener('click', () => { if (LWA.state.currentIdx > 0) { LWA.state.currentIdx--; LWA.render(); } });
        document.getElementById('nav-next')?.addEventListener('click', () => { if (LWA.state.currentIdx < LWA.state.turnData.length - 1) { LWA.state.currentIdx++; LWA.render(); } });
        document.getElementById('nav-goto-report')?.addEventListener('click', () => { scrollToTurnInReport(d.t); });

        // Render charts
        if (LWA.state.activeTab === 'overview') {
            setTimeout(() => LWA.renderChart(), 50);
        }
        if (LWA.state.activeTab === 'analysis') {
            setTimeout(() => LWA.renderAnalysisCharts(), 50);
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

        // Bind data-action handlers (replaces inline onclick for cross-context safety)
        bindDataActionHandlers();
    }

    function bindDataActionHandlers() {
        // Toggle all logs
        document.querySelectorAll('[data-action="toggle-all-logs"]').forEach(btn => {
            btn.onclick = () => {
                LWA.state.logsExpanded = !LWA.state.logsExpanded;
                const categories = document.querySelectorAll('.lwa-log-category');

                categories.forEach((cat) => {
                    const content = cat.querySelector('.lwa-log-cat-content');
                    const toggle = cat.querySelector('.lwa-log-cat-toggle');
                    if (content && toggle) {
                        if (LWA.state.logsExpanded) {
                            content.classList.remove('hidden');
                            toggle.classList.remove('collapsed');
                        } else {
                            content.classList.add('hidden');
                            toggle.classList.add('collapsed');
                        }
                    }
                });

                btn.innerHTML = LWA.state.logsExpanded
                    ? '<span class="expand-icon">▲</span> Tout replier'
                    : '<span class="expand-icon">▼</span> Tout déplier';
            };
        });

        // Show raw log
        document.querySelectorAll('[data-action="show-raw-log"]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const category = btn.dataset.category;
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
                            <button class="lwa-modal-close">✕</button>
                        </div>
                        <pre class="lwa-raw-modal-body">${rawContent}</pre>
                    </div>
                `;
                document.body.appendChild(modal);
                modal.querySelector('.lwa-modal-close').onclick = () => modal.remove();
                modal.onclick = (ev) => { if (ev.target === modal) modal.remove(); };
            };
        });

        // Jump to turn index (timeline)
        document.querySelectorAll('[data-action="jump-to-idx"]').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.turnIdx);
                if (idx >= 0 && idx < LWA.state.turnData.length) {
                    LWA.state.currentIdx = idx;
                    LWA.state.activeTab = 'overview';
                    LWA.render();
                    const panel = document.getElementById('lwa-analyzer');
                    if (panel) {
                        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            };
        });

        // Retry fetch
        document.querySelectorAll('[data-action="retry-fetch"]').forEach(btn => {
            btn.onclick = () => {
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
        });
    }

    LWA.renderOverview = function(d, opsPct) {
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
                ${LWA.state.turnData.length > 1 ? '<div class="lwa-chart-container"><canvas id="ops-chart"></canvas></div>' : ''}
            </div>
        `;
    }

    LWA.renderTimeline = function() {
        if (LWA.state.turnData.length === 0) return '<div style="color:' + C.textDim + '">No data</div>';

        let html = '<div class="lwa-timeline">';

        for (let i = 0; i < LWA.state.turnData.length; i++) {
            const turn = LWA.state.turnData[i];
            const events = LWA.parseTimelineEvents(turn);
            const isCurrent = i === LWA.state.currentIdx;

            html += `
                <div class="lwa-tl-turn" data-turn-idx="${i}" data-action="jump-to-idx">
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

    LWA.renderCombos = function(d) {
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

    LWA.renderProfiler = function(d) {
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

    LWA.renderLogs = function(d) {
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
                <button class="lwa-expand-all-btn" data-action="toggle-all-logs">
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
                    <button class="lwa-eye-btn" data-action="show-raw-log" data-category="SUMMARY" title="Voir le log brut">👁</button>
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
                        <button class="lwa-eye-btn" data-action="show-raw-log" data-category="${cat}" title="Voir le log brut">👁</button>
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

        LWA.modules.ui = true;
        console.log('[LWA] UI module loaded');
    };
    init();
})();
