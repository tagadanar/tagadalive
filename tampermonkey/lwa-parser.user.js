// ==UserScript==
// @name         LWA Parser
// @namespace    https://leekwars.com/
// @version      1.1.0
// @description  LeekWars Fight Analyzer - Parser module (log parsing)
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
        const MARKER = LWA.MARKER;
        const pct = LWA.pct;

    // ========================================
    // Parsers
    // ========================================
    LWA.parseLogs = function(text) {
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
            ctx: { life: 0, maxLife: 0, tp: 0, maxTp: 0, mp: 0, maxMp: 0, usedRam: 0, maxRam: 0, cell: 0, enemies: 0, allies: 0 },
            mcts: { iter: 0, nodes: 0, pos: 0, best: 0 },
            pts: { opps: 0, actions: 0, best: 0 },
            beam: { depth: 0, candidates: 0, opsExpand: 0, opsSort: 0, opsPos: 0, opsTotal: 0, best: 0, budgetLow: false },
            algo: { mode: '', winner: '' },
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
                // Format: tp:current/max or legacy tp:current
                const tpMatch = p.match(/tp:(\d+)(?:\/(\d+))?/);
                if (tpMatch) {
                    turn.ctx.tp = parseInt(tpMatch[1]) || 0;
                    turn.ctx.maxTp = parseInt(tpMatch[2]) || turn.ctx.tp;
                }
            }
            else if (p.startsWith('mp:')) {
                // Format: mp:current/max or legacy mp:current
                const mpMatch = p.match(/mp:(\d+)(?:\/(\d+))?/);
                if (mpMatch) {
                    turn.ctx.mp = parseInt(mpMatch[1]) || 0;
                    turn.ctx.maxMp = parseInt(mpMatch[2]) || turn.ctx.mp;
                }
            }
            else if (p.startsWith('ram:')) {
                // Format: ram:used/max
                const ramMatch = p.match(/ram:(\d+)\/(\d+)/);
                if (ramMatch) {
                    turn.ctx.usedRam = parseInt(ramMatch[1]) || 0;
                    turn.ctx.maxRam = parseInt(ramMatch[2]) || 0;
                }
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
            else if (p.startsWith('p:')) {
                const vals = p.substring(2).split(',');
                turn.pts.opps = parseInt(vals[0]) || 0;
                turn.pts.actions = parseInt(vals[1]) || 0;
                turn.pts.best = parseInt(vals[2]) || 0;
            }
            else if (p.startsWith('b:')) {
                const vals = p.substring(2).split(',');
                turn.beam.depth = parseInt(vals[0]) || 0;
                turn.beam.candidates = parseInt(vals[1]) || 0;
                turn.beam.opsExpand = parseInt(vals[2]) || 0;
                turn.beam.opsSort = parseInt(vals[3]) || 0;
                turn.beam.opsPos = parseInt(vals[4]) || 0;
                turn.beam.opsTotal = parseInt(vals[5]) || 0;
                turn.beam.best = parseInt(vals[6]) || 0;
                turn.beam.budgetLow = parseInt(vals[7]) === 1;
            }
            else if (p.startsWith('algo:')) {
                const vals = p.substring(5).split(',');
                turn.algo.mode = vals[0] || '';
                turn.algo.winner = vals[1] || '';
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
                ctx: d.ctx || { life: 0, maxLife: 0, tp: 0, maxTp: 0, mp: 0, maxMp: 0, usedRam: 0, maxRam: 0, cell: 0, enemies: 0, allies: 0 },
                mcts: d.mcts || { iter: 0, nodes: 0, pos: 0, best: 0 },
                pts: d.pts || { opps: 0, actions: 0, best: 0 },
                beam: d.beam || { depth: 0, candidates: 0, opsExpand: 0, opsSort: 0, opsPos: 0, opsTotal: 0, best: 0, budgetLow: false },
                algo: d.algo || { mode: '', winner: '' },
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

    // ========================================
    // Aggregated Stats Computation
    // ========================================
    LWA.computeAggregatedStats = function() {
        if (LWA.state.turnData.length === 0) return null;

        let totalOps = 0, totalMaxOps = 0, totalIter = 0, totalNodes = 0, totalActions = 0;
        let totalDamage = 0, totalHeal = 0, totalTPUsed = 0, totalMPUsed = 0;
        let mctsScores = [], ptsScores = [], beamScores = [];
        let ptsWins = 0, mctsWins = 0, beamWins = 0, totalPtsOpps = 0;
        let lifeStart = LWA.state.turnData[0]?.ctx.life || 0;
        let lifeEnd = LWA.state.turnData[LWA.state.turnData.length - 1]?.ctx.life || 0;
        let maxLifeStart = LWA.state.turnData[0]?.ctx.maxLife || 1;

        for (const t of LWA.state.turnData) {
            totalOps += t.ops;
            totalMaxOps += t.max;
            totalIter += t.mcts.iter;
            totalNodes += t.mcts.nodes;
            totalActions += t.chosen.actions;
            mctsScores.push(t.mcts.best);
            if (t.pts?.best) ptsScores.push(t.pts.best);
            if (t.beam?.best) beamScores.push(t.beam.best);
            totalPtsOpps += t.pts?.opps || 0;
            totalTPUsed += t.ctx.tp;
            totalMPUsed += t.ctx.mp;

            // Track algo wins
            if (t.algo?.winner === 'PTS') ptsWins++;
            else if (t.algo?.winner === 'MCTS') mctsWins++;
            else if (t.algo?.winner === 'BEAM') beamWins++;

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

        const avgMctsScore = mctsScores.length > 0 ? Math.round(mctsScores.reduce((a,b) => a+b, 0) / mctsScores.length) : 0;
        const avgPtsScore = ptsScores.length > 0 ? Math.round(ptsScores.reduce((a,b) => a+b, 0) / ptsScores.length) : 0;
        const avgBeamScore = beamScores.length > 0 ? Math.round(beamScores.reduce((a,b) => a+b, 0) / beamScores.length) : 0;
        const avgScore = Math.max(avgMctsScore, avgPtsScore, avgBeamScore); // Use best for efficiency calc
        const avgOpsPerTurn = Math.round(totalOps / LWA.state.turnData.length);
        const lifeDelta = lifeEnd - lifeStart;
        const survivalRate = pct(lifeEnd, maxLifeStart);

        // DPS = damage per turn (actions per turn that deal damage)
        const dpt = LWA.state.turnData.length > 0 ? Math.round(totalDamage / LWA.state.turnData.length) : 0;

        // Efficiency = score per 1000 ops
        const efficiency = totalOps > 0 ? Math.round((avgScore * 1000) / avgOpsPerTurn) : 0;

        return {
            totalTurns: LWA.state.turnData.length,
            totalOps,
            totalMaxOps,
            avgOpsPerTurn,
            totalIter,
            totalNodes,
            totalActions,
            avgScore,
            avgMctsScore,
            avgPtsScore,
            avgBeamScore,
            scoreMin: mctsScores.length > 0 ? Math.min(...mctsScores) : 0,
            scoreMax: mctsScores.length > 0 ? Math.max(...mctsScores) : 0,
            ptsWins,
            mctsWins,
            beamWins,
            totalPtsOpps,
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

    // ========================================
    // Timeline Event Parsing
    // ========================================
    LWA.parseTimelineEvents = function(turn) {
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

        LWA.modules.parser = true;
        console.log('[LWA] Parser module loaded');
    };
    init();
})();
