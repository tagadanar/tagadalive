// ==UserScript==
// @name         LWA Charts
// @namespace    https://leekwars.com/
// @version      1.1.0
// @description  LeekWars Fight Analyzer - Charts module (Chart.js + Analysis)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @match        https://leekwars.com/fight/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        unsafeWindow
// @inject-into  content
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js
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
        // Define locally to avoid cross-context permission issues
        const profColors = ['#5fad1b', '#32b2da', '#ff8800', '#a017d6', '#f0c040', '#2bc491', '#e22424'];

    // Analysis Tab - Charts, Heatmap, Anomalies, Efficiency
    // ========================================
    LWA.charts.hpChart = null;
    LWA.charts.scoreChart = null;

    LWA.detectAnomalies = function() {
        const anomalies = [];
        const avgOps = LWA.state.turnData.reduce((sum, t) => sum + t.ops, 0) / LWA.state.turnData.length;
        const avgScore = LWA.state.turnData.reduce((sum, t) => sum + t.mcts.best, 0) / LWA.state.turnData.length;

        for (let i = 0; i < LWA.state.turnData.length; i++) {
            const t = LWA.state.turnData[i];
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
                const prevLife = LWA.state.turnData[i - 1].ctx.life;
                const lifeDrop = prevLife - t.ctx.life;
                const dropPct = pct(lifeDrop, LWA.state.turnData[0].ctx.maxLife);
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
        const entityErrors = LWA.state.currentEntity && LWA.state.entitiesData[LWA.state.currentEntity]?.errors || {};
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

        for (const t of LWA.state.turnData) {
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

    LWA.renderAnalysis = function() {
        if (LWA.state.turnData.length === 0) return '<div style="color:' + C.textDim + '">No data</div>';

        const anomalies = LWA.detectAnomalies();
        const heatmap = computeActionHeatmap();

        // Color scale for heatmap
        const maxCount = heatmap.length > 0 ? heatmap[0].count : 1;
        const heatColors = [C.green, C.blue, C.orange, C.purple, C.red, C.cyan, C.yellow];

        // Compute chart stats for display
        const hpData = LWA.state.turnData.map(t => t.ctx.life);
        const scoreData = LWA.state.turnData.map(t => t.mcts.best);
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
                        <div class="lwa-anomaly-item ${a.type}" ${a.idx >= 0 ? `data-action="jump-to-idx" data-idx="${a.idx}" style="cursor:pointer"` : 'style="cursor:default"'}>
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

    LWA.renderAnalysisCharts = function() {
        // Use hardcoded colors for charts (CSS variables don't work in canvas)
        const chartGreen = '#5fad1b';
        const chartOrange = '#ff8800';
        const chartGray = '#888';

        // HP Chart - shows percentage (0-100%) since maxHP can change during fight
        const hpCtx = document.getElementById('hp-chart');
        if (hpCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.hpChart) LWA.charts.hpChart.destroy();

            // Calculate HP percentage for each turn (handles changing maxHP)
            const hpPctData = LWA.state.turnData.map(t => {
                const life = t.ctx?.life ?? 0;
                const maxLife = t.ctx?.maxLife ?? 1;
                return Math.round(life * 100 / maxLife);
            });
            const hpAbsData = LWA.state.turnData.map(t => t.ctx?.life ?? 0);
            const maxLifeData = LWA.state.turnData.map(t => t.ctx?.maxLife ?? 0);

            LWA.charts.hpChart = new Chart(hpCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: [{
                        label: 'HP %',
                        data: hpPctData,
                        borderColor: chartGreen,
                        backgroundColor: 'rgba(95, 173, 27, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 8 : 4),
                        pointBackgroundColor: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? chartOrange : chartGreen),
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
                                title: (items) => items[0] ? `Tour ${LWA.state.turnData[items[0].dataIndex]?.t}` : '',
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
                            LWA.state.currentIdx = elements[0].index;
                            render();
                        }
                    }
                }
            });
        }

        // Score Chart
        const scoreCtx = document.getElementById('score-chart');
        if (scoreCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.scoreChart) LWA.charts.scoreChart.destroy();

            const scoreData = LWA.state.turnData.map(t => t.mcts?.best ?? 0);
            const minScore = Math.min(...scoreData);
            const maxScore = Math.max(...scoreData);

            // Calculate better scale with padding
            const scoreRange = maxScore - minScore || Math.abs(maxScore) * 0.1 || 10;
            const yMin = minScore - scoreRange * 0.2;
            const yMax = maxScore + scoreRange * 0.15;

            LWA.charts.scoreChart = new Chart(scoreCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: [{
                        data: scoreData,
                        borderColor: chartOrange,
                        backgroundColor: 'rgba(255, 136, 0, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 8 : 4),
                        pointBackgroundColor: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? chartGreen : chartOrange),
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
                                title: (items) => items[0] ? `Tour ${LWA.state.turnData[items[0].dataIndex]?.t}` : '',
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
                            LWA.state.currentIdx = elements[0].index;
                            render();
                        }
                    }
                }
            });
        }

        // Bind anomaly click handlers
        document.querySelectorAll('.lwa-anomaly-item[data-action="jump-to-idx"]').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
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
    }

    LWA.renderAggregatedStats = function() {
        const stats = LWA.computeAggregatedStats();
        if (!stats) return '<div style="color:' + C.textDim + '">No data</div>';

        // Aggregate methods across all turns (only ROOT methods - those without a parent)
        const methodAgg = {};
        for (const t of LWA.state.turnData) {
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

    LWA.renderChart = function() {
        const ctx = document.getElementById('ops-chart');
        if (!ctx || LWA.state.turnData.length < 2) return;

        if (LWA.charts.opsChart) LWA.charts.opsChart.destroy();

        const pointColors = LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? C.orange : C.green);
        const pointRadii = LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 6 : 3);

        LWA.charts.opsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: LWA.state.turnData.map(t => 'T' + t.t),
                datasets: [{
                    data: LWA.state.turnData.map(t => t.ops),
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
                        LWA.state.currentIdx = elements[0].index;
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

        LWA.modules.charts = true;
        console.log('[LWA] Charts module loaded');
    };
    init();
})();
