// ==UserScript==
// @name         LWA UI
// @namespace    https://leekwars.com/
// @version      1.5.0
// @description  LeekWars Fight Analyzer - UI module (rendering)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @match        https://leekwars.com/fight/*
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

        // Clean up toggle button if switching modes
        const existingToggle = document.querySelector('.lwa-side-toggle');
        if (existingToggle) existingToggle.remove();

        // Remove margin class and CSS variable when switching modes
        const appCenter = document.querySelector('.app-center');
        if (appCenter) {
            appCenter.classList.remove('lwa-panel-open');
            appCenter.classList.remove('lwa-resizing');
        }
        document.body.classList.remove('lwa-resizing-active');
        // Don't remove the CSS variable here - we want to preserve the saved width

        // Get cache stats for display (clone to avoid permission issues)
        const cacheStats = JSON.parse(JSON.stringify(LWA.cache.getStats()));
        const isFightPage = LWA.isFightPage();
        const fightId = LWA.getFightId();
        const hasCachedData = fightId && LWA.cache.has(fightId);

        // On fight page without cached data, don't show anything
        if (isFightPage && !hasCachedData) {
            console.log('[LWA] Fight page without cache - nothing to show');
            return;
        }

        // Get fight page settings
        const panelPosition = LWA.settings.get(LWA.SETTING_FIGHT_PANEL_POSITION, 'side');
        const panelCollapsed = LWA.settings.get(LWA.SETTING_FIGHT_PANEL_COLLAPSED, false);
        const panelWidth = LWA.settings.get(LWA.SETTING_FIGHT_PANEL_WIDTH, 400);
        const isSideMode = isFightPage && panelPosition === 'side';

        console.log('[LWA] injectPanel - isFightPage:', isFightPage, 'panelPosition:', panelPosition, 'panelCollapsed:', panelCollapsed, 'panelWidth:', panelWidth, 'isSideMode:', isSideMode);

        // Set CSS variable for panel width
        if (isSideMode) {
            document.documentElement.style.setProperty('--lwa-panel-width', panelWidth + 'px');
        }

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'lwa-panel' + (isSideMode ? ' lwa-panel-side' : '') + (isSideMode && panelCollapsed ? ' lwa-panel-collapsed' : '');
        wrapper.id = 'lwa-analyzer';

        // Build header actions based on page type
        let headerActions = '';
        if (isFightPage) {
            // Fight page: button to toggle panel position
            headerActions += `
                <button class="lwa-header-btn" data-action="toggle-panel-position" title="${panelPosition === 'side' ? 'Mettre en bas' : 'Mettre sur le côté'}">
                    ${panelPosition === 'side' ? '⬇️' : '➡️'}
                </button>
            `;
        } else {
            // Report page: button to go to fight page
            headerActions += `
                <a href="/fight/${fightId}" class="lwa-header-btn" title="Voir le combat">
                    ▶️
                </a>
            `;
        }
        headerActions += `
            <button class="lwa-cache-btn" data-action="open-cache-modal" title="Gérer le cache (${cacheStats.count} fights, ${cacheStats.totalSizeKB} KB)">
                💾 <span class="lwa-cache-count">${cacheStats.count}</span>
            </button>
        `;

        wrapper.innerHTML = `
            <div class="panel">
                <div class="header">
                    <h2>🥬 LeekWars Fight Analyzer <span class="version">v${LWA.VERSION}</span></h2>
                    <div class="lwa-header-actions">
                        ${headerActions}
                    </div>
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

        // Bind cache button handler (use unsafeWindow to avoid permission issues)
        const cacheBtn = wrapper.querySelector('[data-action="open-cache-modal"]');
        if (cacheBtn) {
            cacheBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                unsafeWindow.LWA.openCacheModal();
            });
        }

        // Bind toggle position button (fight page only)
        const togglePositionBtn = wrapper.querySelector('[data-action="toggle-panel-position"]');
        if (togglePositionBtn) {
            togglePositionBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const _LWA = unsafeWindow.LWA;
                const currentPos = _LWA.settings.get(_LWA.SETTING_FIGHT_PANEL_POSITION, 'side');
                const newPos = currentPos === 'side' ? 'bottom' : 'side';
                _LWA.settings.set(_LWA.SETTING_FIGHT_PANEL_POSITION, newPos);

                // Remove old panel and toggle button first
                const oldPanel = document.querySelector('.lwa-panel');
                const oldToggle = document.querySelector('.lwa-side-toggle');
                if (oldPanel) oldPanel.remove();
                if (oldToggle) oldToggle.remove();

                // Remove width class from app-center
                const appCenter = document.querySelector('.app-center');
                if (appCenter) appCenter.classList.remove('lwa-panel-open');

                // Re-create panel with new position, then render existing data
                _LWA.createPanel();

                // Wait for NEW panel to be inserted in DOM before rendering
                const waitForPanel = setInterval(function() {
                    const panel = document.querySelector('.lwa-panel');
                    const content = panel && panel.querySelector('#lwa-content');
                    if (panel && content && document.body.contains(panel)) {
                        clearInterval(waitForPanel);
                        console.log('[LWA] Panel ready, rendering data');
                        _LWA.render();
                    }
                }, 100);
                // Timeout safety
                setTimeout(function() { clearInterval(waitForPanel); }, 5000);
            });
        }


        // Insert based on mode
        if (isSideMode) {
            // Side mode: use fixed positioning for the panel, add margin to main content
            // Find the main content area to add margin
            const appCenter = document.querySelector('.app-center');
            console.log('[LWA] Side mode - appCenter found:', !!appCenter, 'panelCollapsed:', panelCollapsed);

            // Apply class to push content when panel is visible (using CSS !important to override Vue inline styles)
            if (!panelCollapsed && appCenter) {
                appCenter.classList.add('lwa-panel-open');
                console.log('[LWA] Added lwa-panel-open class to appCenter. Classes:', appCenter.className);

                // Trigger Vue's internal resize event through unsafeWindow
                // LeekWars fight player listens to $root.$emit('resize'), not window resize
                const triggerResize = () => {
                    try {
                        const app = unsafeWindow.document.querySelector('#app');
                        if (app && app.__vue__ && app.__vue__.$root && app.__vue__.$root.$emit) {
                            console.log('[LWA] Emitting Vue resize event');
                            app.__vue__.$root.$emit('resize');
                        } else {
                            console.log('[LWA] Vue not found, trying window resize');
                            unsafeWindow.dispatchEvent(new Event('resize'));
                        }
                    } catch (e) {
                        console.log('[LWA] Resize error:', e);
                        unsafeWindow.dispatchEvent(new Event('resize'));
                    }
                };
                // Wait for CSS to apply, then trigger resize
                setTimeout(triggerResize, 100);
                setTimeout(triggerResize, 400);
            }

            // Append panel to body with fixed positioning
            document.body.appendChild(wrapper);
            console.log('[LWA] Panel injected in side mode (fixed position), wrapper classes:', wrapper.className);

            // Create toggle button (fixed position so it stays visible when collapsed)
            // Also acts as resize handle when dragged horizontally
            const toggleBtn = document.createElement('div');
            toggleBtn.className = 'lwa-side-toggle' + (panelCollapsed ? ' lwa-toggle-collapsed' : '');
            toggleBtn.title = panelCollapsed ? 'Ouvrir le panel' : 'Clic: fermer | Glisser: redimensionner | Double-clic: réinitialiser';
            toggleBtn.innerHTML = `<i class="v-icon notranslate mdi ${panelCollapsed ? 'mdi-chevron-left' : 'mdi-chevron-right'} theme--dark"></i>`;
            document.body.appendChild(toggleBtn);

            // State for distinguishing click vs drag vs double-click
            let isDragging = false;
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            let clickTimer = null;
            let preventClick = false;
            const DRAG_THRESHOLD = 5; // pixels before considering it a drag
            const DBLCLICK_DELAY = 250; // ms to wait before treating as single click

            // Helper to trigger Vue resize
            const triggerVueResize = () => {
                try {
                    const app = unsafeWindow.document.querySelector('#app');
                    if (app && app.__vue__ && app.__vue__.$root && app.__vue__.$root.$emit) {
                        app.__vue__.$root.$emit('resize');
                    } else {
                        unsafeWindow.dispatchEvent(new Event('resize'));
                    }
                } catch (err) {
                    unsafeWindow.dispatchEvent(new Event('resize'));
                }
            };

            // Helper to perform toggle action
            const performToggle = () => {
                const panel = document.querySelector('.lwa-panel');
                const isCollapsed = panel.classList.contains('lwa-panel-collapsed');
                const appCenterEl = document.querySelector('.app-center');

                console.log('[LWA] Toggle clicked - isCollapsed:', isCollapsed);

                panel.classList.toggle('lwa-panel-collapsed');
                toggleBtn.classList.toggle('lwa-toggle-collapsed');

                if (appCenterEl) {
                    if (isCollapsed) {
                        appCenterEl.classList.add('lwa-panel-open');
                    } else {
                        appCenterEl.classList.remove('lwa-panel-open');
                    }
                    setTimeout(triggerVueResize, 100);
                    setTimeout(triggerVueResize, 400);
                }

                // Update icon and title
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = `v-icon notranslate mdi ${isCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-left'} theme--dark`;
                }
                toggleBtn.title = isCollapsed ? 'Clic: fermer | Glisser: redimensionner | Double-clic: réinitialiser' : 'Ouvrir le panel';
                unsafeWindow.LWA.settings.set(unsafeWindow.LWA.SETTING_FIGHT_PANEL_COLLAPSED, !isCollapsed);
            };

            // Double-click to reset to default width (only when panel is open)
            toggleBtn.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Cancel any pending single-click action
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                preventClick = true;

                // If panel is collapsed, just expand it
                if (wrapper.classList.contains('lwa-panel-collapsed')) {
                    console.log('[LWA] Double-click on collapsed panel - expanding');
                    performToggle();
                    return;
                }

                // Reset to default width
                const defaultWidth = 400;
                document.documentElement.style.setProperty('--lwa-panel-width', defaultWidth + 'px');
                unsafeWindow.LWA.settings.set('fightPanelWidth', defaultWidth);
                console.log('[LWA] Reset to default width:', defaultWidth);
                setTimeout(triggerVueResize, 100);
            });

            // Mouse down - start potential drag (or prepare for click)
            toggleBtn.addEventListener('mousedown', function(e) {
                e.preventDefault();

                // If panel is collapsed, just mark that we started a click (for mouseup)
                if (wrapper.classList.contains('lwa-panel-collapsed')) {
                    isDragging = true; // Will be used to detect click in mouseup
                    isResizing = false;
                    startX = e.clientX;
                    return;
                }

                isDragging = true;
                isResizing = false;
                startX = e.clientX;
                startWidth = wrapper.offsetWidth;

                console.log('[LWA] Mousedown on toggle - startX:', startX, 'startWidth:', startWidth);
            });

            // Mouse move - detect if it's a drag (resize) or will be a click
            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;

                // Don't try to resize if panel is collapsed
                if (wrapper.classList.contains('lwa-panel-collapsed')) return;

                const diff = Math.abs(e.clientX - startX);

                // If moved beyond threshold, start resizing
                if (!isResizing && diff > DRAG_THRESHOLD) {
                    isResizing = true;
                    console.log('[LWA] Drag threshold exceeded, starting resize');

                    // Add visual feedback
                    wrapper.classList.add('lwa-resizing');
                    toggleBtn.classList.add('lwa-resizing');
                    document.body.classList.add('lwa-resizing-active');
                    const appCenterEl = document.querySelector('.app-center');
                    if (appCenterEl) appCenterEl.classList.add('lwa-resizing');
                }

                if (isResizing) {
                    e.preventDefault();

                    // Calculate new width (dragging left = larger, dragging right = smaller)
                    const widthDiff = startX - e.clientX;
                    let newWidth = startWidth + widthDiff;

                    // Clamp to min/max
                    const minWidth = 280;
                    const maxWidth = Math.min(window.innerWidth * 0.7, 800);
                    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

                    // Update CSS variable
                    document.documentElement.style.setProperty('--lwa-panel-width', newWidth + 'px');
                }
            });

            // Mouse up - end drag/resize or perform click
            document.addEventListener('mouseup', function(e) {
                if (!isDragging) return;

                const wasResizing = isResizing;
                isDragging = false;
                isResizing = false;

                // Remove visual feedback
                wrapper.classList.remove('lwa-resizing');
                toggleBtn.classList.remove('lwa-resizing');
                document.body.classList.remove('lwa-resizing-active');
                const appCenterEl = document.querySelector('.app-center');
                if (appCenterEl) appCenterEl.classList.remove('lwa-resizing');

                if (wasResizing) {
                    // Was resizing - save the new width
                    const finalWidth = wrapper.offsetWidth;
                    unsafeWindow.LWA.settings.set('fightPanelWidth', finalWidth);
                    console.log('[LWA] Resize ended - finalWidth:', finalWidth);
                    setTimeout(triggerVueResize, 100);
                } else {
                    // Was a click - delay to allow dblclick to cancel
                    if (preventClick) {
                        preventClick = false;
                        return;
                    }

                    // Use timer to allow dblclick to cancel
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                        if (!preventClick) {
                            console.log('[LWA] Single click detected - toggling panel');
                            performToggle();
                        }
                        preventClick = false;
                    }, DBLCLICK_DELAY);
                }
            });

            console.log('[LWA] Toggle button with resize created');
        } else {
            // Bottom mode (default for report, optional for fight)
            // Insert after "Déplacements" (Movements) panel and before "Actions" panel
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
                <span class="lwa-turn-label">
                    Turn ${d.t} (${LWA.state.currentIdx + 1}/${LWA.state.turnData.length})
                    ${LWA.state.isFromCache ? '<span class="lwa-cache-badge" title="Données chargées depuis le cache">📦</span>' : ''}
                </span>
                <button class="lwa-nav-btn" id="nav-next" ${LWA.state.currentIdx === LWA.state.turnData.length - 1 ? 'disabled' : ''}>Next ▶</button>
                ${LWA.isReportPage() ? '<button class="lwa-goto-btn" id="nav-goto-report" title="Go to this turn in Actions panel">↓ Actions</button>' : ''}
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
        // Open cache management modal (use unsafeWindow to avoid permission issues)
        document.querySelectorAll('[data-action="open-cache-modal"]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                unsafeWindow.LWA.openCacheModal();
            });
        });

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
    // Cache Management Modal
    // ========================================
    LWA.openCacheModal = function() {
        // Use unsafeWindow.LWA to avoid permission issues in event handlers
        const _LWA = unsafeWindow.LWA;

        // Remove existing modal if any
        const existing = document.querySelector('.lwa-cache-modal');
        if (existing) existing.remove();

        // Clone data to avoid permission issues with cross-context objects
        const stats = JSON.parse(JSON.stringify(_LWA.cache.getStats()));
        const maxAge = _LWA.cache.getMaxAge();

        // Format age for display
        function formatAge(ms) {
            const hours = Math.floor(ms / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            if (hours > 24) {
                const days = Math.floor(hours / 24);
                return `${days}j ${hours % 24}h`;
            }
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        // Format date for display
        function formatDate(ts) {
            const d = new Date(ts);
            return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }

        const modal = document.createElement('div');
        modal.className = 'lwa-cache-modal';
        modal.innerHTML = `
            <div class="lwa-cache-modal-content">
                <div class="lwa-cache-modal-header">
                    <span>💾 Gestion du Cache</span>
                    <button class="lwa-modal-close">✕</button>
                </div>
                <div class="lwa-cache-modal-body">
                    <!-- Stats -->
                    <div class="lwa-cache-stats">
                        <div class="lwa-cache-stat">
                            <div class="lwa-cache-stat-val">${stats.count}</div>
                            <div class="lwa-cache-stat-lbl">Combats</div>
                        </div>
                        <div class="lwa-cache-stat">
                            <div class="lwa-cache-stat-val">${stats.totalSizeKB} KB</div>
                            <div class="lwa-cache-stat-lbl">Taille totale</div>
                        </div>
                        <div class="lwa-cache-stat">
                            <div class="lwa-cache-stat-val">${maxAge}h</div>
                            <div class="lwa-cache-stat-lbl">Durée max</div>
                        </div>
                    </div>

                    <!-- Settings -->
                    <div class="lwa-cache-section">
                        <div class="lwa-cache-section-title">⚙️ Configuration</div>
                        <div class="lwa-cache-setting">
                            <label>Durée de conservation (heures):</label>
                            <input type="number" id="lwa-cache-max-age" value="${maxAge}" min="1" max="720" />
                            <button id="lwa-save-max-age" class="lwa-btn-small">Sauvegarder</button>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="lwa-cache-section">
                        <div class="lwa-cache-section-title">🧹 Actions</div>
                        <div class="lwa-cache-actions">
                            <button id="lwa-cache-cleanup" class="lwa-btn-action">
                                🕐 Nettoyer les anciens (>${maxAge}h)
                            </button>
                            <button id="lwa-cache-clear" class="lwa-btn-action danger">
                                🗑️ Tout supprimer
                            </button>
                        </div>
                    </div>

                    <!-- Cached fights list -->
                    <div class="lwa-cache-section">
                        <div class="lwa-cache-section-title">📋 Combats en cache (${stats.count})</div>
                        <div class="lwa-cache-list">
                            ${stats.items.length === 0 ? '<div class="lwa-cache-empty">Aucun combat en cache</div>' : ''}
                            ${stats.items.map(item => `
                                <div class="lwa-cache-item" data-fight-id="${item.fightId}">
                                    <div class="lwa-cache-item-info">
                                        <a href="/fight/${item.fightId}" class="lwa-cache-item-id">Fight #${item.fightId}</a>
                                        <span class="lwa-cache-item-date">${formatDate(item.timestamp)}</span>
                                        <span class="lwa-cache-item-age">(il y a ${formatAge(item.age)})</span>
                                    </div>
                                    <div class="lwa-cache-item-actions">
                                        <span class="lwa-cache-item-size">${(item.size / 1024).toFixed(1)} KB</span>
                                        <button class="lwa-cache-item-delete" data-action="delete-cache-item" data-fight-id="${item.fightId}" title="Supprimer">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers (use addEventListener to avoid permission issues)
        modal.querySelector('.lwa-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        // Save max age
        modal.querySelector('#lwa-save-max-age').addEventListener('click', () => {
            const input = modal.querySelector('#lwa-cache-max-age');
            const hours = parseInt(input.value);
            if (hours >= 1 && hours <= 720) {
                _LWA.cache.setMaxAge(hours);
                // Refresh modal
                modal.remove();
                _LWA.openCacheModal();
            }
        });

        // Cleanup old
        modal.querySelector('#lwa-cache-cleanup').addEventListener('click', () => {
            const removed = _LWA.cache.cleanup();
            alert(`${removed} combat(s) supprimé(s)`);
            modal.remove();
            _LWA.openCacheModal();
            // Update cache button count
            const cacheBtnCount = document.querySelector('.lwa-cache-count');
            if (cacheBtnCount) {
                const newStats = _LWA.cache.getStats();
                cacheBtnCount.textContent = newStats.count;
            }
        });

        // Clear all
        modal.querySelector('#lwa-cache-clear').addEventListener('click', () => {
            if (confirm('Supprimer tous les combats en cache ?')) {
                const removed = _LWA.cache.clear();
                alert(`${removed} combat(s) supprimé(s)`);
                modal.remove();
                _LWA.openCacheModal();
                // Update cache button count
                const cacheBtnCount = document.querySelector('.lwa-cache-count');
                if (cacheBtnCount) cacheBtnCount.textContent = '0';
            }
        });

        // Delete individual item
        modal.querySelectorAll('[data-action="delete-cache-item"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fightId = btn.dataset.fightId;
                _LWA.cache.remove(fightId);
                // Remove item from list
                const item = btn.closest('.lwa-cache-item');
                if (item) item.remove();
                // Update stats
                const newStats = _LWA.cache.getStats();
                const statVal = modal.querySelector('.lwa-cache-stat-val');
                if (statVal) statVal.textContent = newStats.count;
                // Update cache button count
                const cacheBtnCount = document.querySelector('.lwa-cache-count');
                if (cacheBtnCount) cacheBtnCount.textContent = newStats.count;
            });
        });
    };

        LWA.modules.ui = true;
        console.log('[LWA] UI module loaded');
    };
    init();
})();
