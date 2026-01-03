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
        // Use the winning score (max of MCTS/PTS) for average calculation
        const avgScore = LWA.state.turnData.reduce((sum, t) => {
            const winningScore = Math.max(t.mcts.best, t.pts?.best || 0);
            return sum + winningScore;
        }, 0) / LWA.state.turnData.length;

        for (let i = 0; i < LWA.state.turnData.length; i++) {
            const t = LWA.state.turnData[i];
            const opsPct = pct(t.ops, t.max);
            const winningScore = Math.max(t.mcts.best, t.pts?.best || 0);
            const winner = t.algo?.winner || '';

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
            if (winningScore < avgScore * 0.5 && avgScore > 0) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'warning',
                    icon: '📉',
                    title: 'Low Score',
                    desc: `${winner || 'Best'} score ${winningScore} (avg: ${Math.round(avgScore)})`
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

            // Few MCTS iterations (only if MCTS was used)
            if (t.mcts.iter < 5 && t.mcts.iter > 0 && (winner === 'MCTS' || winner === '')) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'info',
                    icon: '🔍',
                    title: 'Low Search Depth',
                    desc: `Only ${t.mcts.iter} MCTS iterations`
                });
            }

            // PTS won with significant margin
            if (winner === 'PTS' && t.pts?.best > t.mcts.best * 1.2 && t.mcts.best > 0) {
                anomalies.push({
                    turn: t.t,
                    idx: i,
                    type: 'info',
                    icon: '🎯',
                    title: 'PTS Outperformed',
                    desc: `PTS ${t.pts.best} vs MCTS ${t.mcts.best} (+${Math.round((t.pts.best / t.mcts.best - 1) * 100)}%)`
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
        const mctsScoreData = LWA.state.turnData.map(t => t.mcts.best);
        const ptsScoreData = LWA.state.turnData.map(t => t.pts?.best || 0);
        const hasPTSData = ptsScoreData.some(v => v !== 0);
        const hpMin = Math.min(...hpData);
        const hpMax = Math.max(...hpData);
        const allScores = [...mctsScoreData, ...ptsScoreData.filter(s => s !== 0)];
        const scoreMin = allScores.length > 0 ? Math.min(...allScores) : 0;
        const scoreMax = allScores.length > 0 ? Math.max(...allScores) : 0;

        // Compute TP/MP/RAM stats - calculate USED values (maxTP - remainingTP = usedTP)
        const tpUsedData = LWA.state.turnData.map(t => (t.ctx.maxTp || 0) - (t.ctx.tp || 0));
        const tpMaxData = LWA.state.turnData.map(t => t.ctx.maxTp || 0);
        const mpUsedData = LWA.state.turnData.map(t => (t.ctx.maxMp || 0) - (t.ctx.mp || 0));
        const mpMaxData = LWA.state.turnData.map(t => t.ctx.maxMp || 0);
        const ramUsedData = LWA.state.turnData.map(t => t.ctx.usedRam || 0);
        const ramMaxData = LWA.state.turnData.map(t => t.ctx.maxRam || 0);

        // Check if we have data for new charts
        const hasTPData = tpMaxData.some(v => v > 0);
        const hasMPData = mpMaxData.some(v => v > 0);
        const hasRAMData = ramMaxData.some(v => v > 0);

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
                            ${hasPTSData ? 'MCTS vs PTS Scores' : 'Score MCTS'}
                            <span class="lwa-chart-range">${scoreMin} - ${scoreMax}</span>
                        </div>
                        <canvas id="score-chart"></canvas>
                    </div>
                </div>
                ${hasTPData || hasMPData || hasRAMData ? `
                <div class="lwa-charts-row" style="margin-top:12px">
                    ${hasTPData ? `
                    <div class="lwa-mini-chart">
                        <div class="lwa-mini-chart-title tp" style="color:${C.blue}">
                            TP Used
                            <span class="lwa-chart-range">${Math.min(...tpUsedData)} - ${Math.max(...tpUsedData)} / ${Math.max(...tpMaxData)}</span>
                        </div>
                        <canvas id="tp-chart"></canvas>
                    </div>
                    ` : ''}
                    ${hasMPData ? `
                    <div class="lwa-mini-chart">
                        <div class="lwa-mini-chart-title mp" style="color:${C.cyan}">
                            MP Used
                            <span class="lwa-chart-range">${Math.min(...mpUsedData)} - ${Math.max(...mpUsedData)} / ${Math.max(...mpMaxData)}</span>
                        </div>
                        <canvas id="mp-chart"></canvas>
                    </div>
                    ` : ''}
                    ${hasRAMData ? `
                    <div class="lwa-mini-chart">
                        <div class="lwa-mini-chart-title ram" style="color:${C.purple}">
                            RAM Used
                            <span class="lwa-chart-range">${Math.min(...ramUsedData)} - ${Math.max(...ramUsedData)} / ${Math.max(...ramMaxData)}</span>
                        </div>
                        <canvas id="ram-chart"></canvas>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
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

        // Score Chart - MCTS vs PTS comparison
        const scoreCtx = document.getElementById('score-chart');
        if (scoreCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.scoreChart) LWA.charts.scoreChart.destroy();

            const mctsData = LWA.state.turnData.map(t => t.mcts?.best ?? 0);
            const ptsData = LWA.state.turnData.map(t => t.pts?.best ?? 0);
            const hasPTS = ptsData.some(v => v !== 0);
            const winnerData = LWA.state.turnData.map(t => t.algo?.winner || '');

            const allScores = [...mctsData, ...ptsData.filter(s => s !== 0)];
            const minScore = allScores.length > 0 ? Math.min(...allScores) : 0;
            const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;

            // Calculate better scale with padding
            const scoreRange = maxScore - minScore || Math.abs(maxScore) * 0.1 || 10;
            const yMin = minScore - scoreRange * 0.2;
            const yMax = maxScore + scoreRange * 0.15;

            const datasets = [{
                label: 'MCTS',
                data: mctsData,
                borderColor: chartOrange,
                backgroundColor: 'rgba(255, 136, 0, 0.15)',
                fill: false,
                tension: 0.3,
                pointRadius: LWA.state.turnData.map((t, i) => {
                    if (i === LWA.state.currentIdx) return 8;
                    return winnerData[i] === 'MCTS' ? 6 : 4;
                }),
                pointBackgroundColor: LWA.state.turnData.map((t, i) => {
                    if (i === LWA.state.currentIdx) return chartGreen;
                    return winnerData[i] === 'MCTS' ? chartOrange : 'rgba(255, 136, 0, 0.5)';
                }),
                pointBorderColor: LWA.state.turnData.map((t, i) => winnerData[i] === 'MCTS' ? '#fff' : 'transparent'),
                pointBorderWidth: 2,
                borderWidth: 2
            }];

            if (hasPTS) {
                datasets.push({
                    label: 'PTS',
                    data: ptsData,
                    borderColor: '#2bc491',
                    backgroundColor: 'rgba(43, 196, 145, 0.15)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: LWA.state.turnData.map((t, i) => {
                        if (i === LWA.state.currentIdx) return 8;
                        return winnerData[i] === 'PTS' ? 6 : 4;
                    }),
                    pointBackgroundColor: LWA.state.turnData.map((t, i) => {
                        if (i === LWA.state.currentIdx) return chartGreen;
                        return winnerData[i] === 'PTS' ? '#2bc491' : 'rgba(43, 196, 145, 0.5)';
                    }),
                    pointBorderColor: LWA.state.turnData.map((t, i) => winnerData[i] === 'PTS' ? '#fff' : 'transparent'),
                    pointBorderWidth: 2,
                    borderWidth: 2
                });
            }

            LWA.charts.scoreChart = new Chart(scoreCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: { display: hasPTS, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                title: (items) => {
                                    if (!items[0]) return '';
                                    const idx = items[0].dataIndex;
                                    const winner = winnerData[idx];
                                    return `Tour ${LWA.state.turnData[idx]?.t}${winner ? ` - ${winner} wins` : ''}`;
                                },
                                label: (item) => `${item.dataset.label}: ${item.raw}`
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

        // TP Chart - shows percentage of TP used
        const tpCtx = document.getElementById('tp-chart');
        if (tpCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.tpChart) LWA.charts.tpChart.destroy();

            const tpUsedData = LWA.state.turnData.map(t => (t.ctx?.maxTp || 0) - (t.ctx?.tp || 0));
            const tpMaxData = LWA.state.turnData.map(t => t.ctx?.maxTp || 0);
            const tpPctData = LWA.state.turnData.map(t => {
                const maxTp = t.ctx?.maxTp || 1;
                const usedTp = maxTp - (t.ctx?.tp || 0);
                return Math.round(usedTp * 100 / maxTp);
            });

            LWA.charts.tpChart = new Chart(tpCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: [{
                        label: 'TP Used %',
                        data: tpPctData,
                        borderColor: '#32b2da',
                        backgroundColor: 'rgba(50, 178, 218, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 8 : 4),
                        pointBackgroundColor: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? chartOrange : '#32b2da'),
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
                                    const used = tpUsedData[idx];
                                    const max = tpMaxData[idx];
                                    const pct = tpPctData[idx];
                                    return [`TP Used: ${used} / ${max}`, `(${pct}%)`];
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
                            LWA.render();
                        }
                    }
                }
            });
        }

        // MP Chart - shows percentage of MP used
        const mpCtx = document.getElementById('mp-chart');
        if (mpCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.mpChart) LWA.charts.mpChart.destroy();

            const mpUsedData = LWA.state.turnData.map(t => (t.ctx?.maxMp || 0) - (t.ctx?.mp || 0));
            const mpMaxData = LWA.state.turnData.map(t => t.ctx?.maxMp || 0);
            const mpPctData = LWA.state.turnData.map(t => {
                const maxMp = t.ctx?.maxMp || 1;
                const usedMp = maxMp - (t.ctx?.mp || 0);
                return Math.round(usedMp * 100 / maxMp);
            });

            LWA.charts.mpChart = new Chart(mpCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: [{
                        label: 'MP Used %',
                        data: mpPctData,
                        borderColor: '#2bc491',
                        backgroundColor: 'rgba(43, 196, 145, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 8 : 4),
                        pointBackgroundColor: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? chartOrange : '#2bc491'),
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
                                    const used = mpUsedData[idx];
                                    const max = mpMaxData[idx];
                                    const pct = mpPctData[idx];
                                    return [`MP Used: ${used} / ${max}`, `(${pct}%)`];
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
                            LWA.render();
                        }
                    }
                }
            });
        }

        // RAM Chart - shows percentage of RAM used
        const ramCtx = document.getElementById('ram-chart');
        if (ramCtx && LWA.state.turnData.length >= 1) {
            if (LWA.charts.ramChart) LWA.charts.ramChart.destroy();

            const ramUsedData = LWA.state.turnData.map(t => t.ctx?.usedRam || 0);
            const ramMaxData = LWA.state.turnData.map(t => t.ctx?.maxRam || 0);
            const ramPctData = LWA.state.turnData.map(t => {
                const maxRam = t.ctx?.maxRam || 1;
                const usedRam = t.ctx?.usedRam || 0;
                return Math.round(usedRam * 100 / maxRam);
            });

            LWA.charts.ramChart = new Chart(ramCtx, {
                type: 'line',
                data: {
                    labels: LWA.state.turnData.map(t => 'T' + t.t),
                    datasets: [{
                        label: 'RAM Used %',
                        data: ramPctData,
                        borderColor: '#a017d6',
                        backgroundColor: 'rgba(160, 23, 214, 0.25)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? 8 : 4),
                        pointBackgroundColor: LWA.state.turnData.map((_, i) => i === LWA.state.currentIdx ? chartOrange : '#a017d6'),
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
                                    const used = ramUsedData[idx];
                                    const max = ramMaxData[idx];
                                    const pct = ramPctData[idx];
                                    return [`RAM Used: ${used} / ${max}`, `(${pct}%)`];
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
                            LWA.render();
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

            ${(stats.ptsWins > 0 || stats.mctsWins > 0) ? `
            <div class="lwa-section">
                <div class="lwa-section-title">Algorithm Comparison (PTS vs MCTS)</div>
                <div class="lwa-agg-grid">
                    <div class="lwa-agg-card ${stats.ptsWins > stats.mctsWins ? 'good' : ''}">
                        <div class="lwa-agg-val" style="color:#2bc491">${stats.ptsWins}</div>
                        <div class="lwa-agg-lbl">PTS Wins</div>
                        <div class="lwa-agg-desc">${pct(stats.ptsWins, stats.totalTurns)}%</div>
                    </div>
                    <div class="lwa-agg-card ${stats.mctsWins > stats.ptsWins ? 'good' : ''}">
                        <div class="lwa-agg-val" style="color:${C.orange}">${stats.mctsWins}</div>
                        <div class="lwa-agg-lbl">MCTS Wins</div>
                        <div class="lwa-agg-desc">${pct(stats.mctsWins, stats.totalTurns)}%</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:#2bc491">${stats.avgPtsScore}</div>
                        <div class="lwa-agg-lbl">Avg PTS Score</div>
                    </div>
                    <div class="lwa-agg-card">
                        <div class="lwa-agg-val" style="color:${C.orange}">${stats.avgMctsScore}</div>
                        <div class="lwa-agg-lbl">Avg MCTS Score</div>
                    </div>
                </div>
            </div>
            ` : ''}

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
