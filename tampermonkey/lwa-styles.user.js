// ==UserScript==
// @name         LWA Styles
// @namespace    https://leekwars.com/
// @version      1.5.0
// @description  LeekWars Fight Analyzer - Styles module (CSS only)
// @author       Sawdium
// @match        https://leekwars.com/report/*
// @match        https://leekwars.com/fight/*
// @icon         https://leekwars.com/image/favicon.png
// @grant        GM_addStyle
// @grant        unsafeWindow
// @inject-into  content
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const styles = `
        /* ===== LWA INTEGRATED PANEL - Native LeekWars Style ===== */
        .lwa-panel {
            margin-bottom: 12px;
        }

        .lwa-panel .panel {
            background: var(--background);
            border-radius: 4px;
            box-shadow: 0px 10px 11px -11px rgba(0,0,0,0.75);
            overflow: hidden;
        }

        .lwa-panel .panel .header {
            height: 36px;
            background: #2a2a2a;
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
            color: #eee;
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
            color: #eee;
        }

        .lwa-panel .panel .content {
            padding: 15px;
            color: var(--text-color, #333);
        }

        /* Entity Selector */
        .lwa-entity-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            background: var(--background-header, #f5f5f5);
            border-bottom: 1px solid var(--border, #ddd);
        }

        .lwa-entity-bar label {
            color: var(--text-color-secondary, #666);
            font-size: 13px;
        }

        .lwa-entity-bar select {
            flex: 1;
            max-width: 250px;
            background: var(--pure-white, #fff);
            color: var(--text-color, #333);
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 13px;
            cursor: pointer;
        }

        .lwa-entity-bar select:hover {
            border-color: #5fad1b;
        }

        /* Navigation */
        .lwa-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 10px;
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            margin-bottom: 12px;
            border: 1px solid var(--border, #ddd);
        }

        .lwa-nav-btn {
            background: #5fad1b;
            border: none;
            color: #ffffff;
            padding: 6px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.15s;
        }

        .lwa-nav-btn:hover:not(:disabled) {
            background: #6ec91f;
        }

        .lwa-nav-btn:disabled {
            background: #ccc;
            color: #888;
            cursor: not-allowed;
        }

        .lwa-turn-label {
            font-weight: 700;
            font-size: 15px;
            color: var(--text-color, #333);
            min-width: 120px;
            text-align: center;
        }

        .lwa-goto-btn {
            background: #32b2da;
            border: none;
            color: #ffffff;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s;
            margin-left: 10px;
        }

        .lwa-goto-btn:hover {
            background: #41d3ff;
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
            border: 1px solid var(--border, #ddd);
        }

        .lwa-stat-card:hover {
            border-color: #5fad1b;
        }

        .lwa-stat-val {
            font-size: 18px;
            font-weight: 700;
        }

        .lwa-stat-lbl {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            margin-top: 2px;
        }

        .lwa-stat-sub {
            font-size: 10px;
            color: #888;
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
            border: 1px solid var(--border, #ddd);
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
            color: var(--text-color-secondary, #666);
            transition: all 0.15s;
        }

        .lwa-tab:hover {
            color: var(--text-color, #333);
            background: rgba(0,0,0,0.05);
        }

        .lwa-tab.active {
            background: #5fad1b;
            color: #ffffff;
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
            border: 1px solid var(--border, #ddd);
        }

        .lwa-section-title {
            font-size: 13px;
            font-weight: 600;
            color: #5fad1b;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border, #ddd);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .lwa-section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: #5fad1b;
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
            border: 1px solid var(--border, #ddd);
        }

        .lwa-mcts-card.highlight {
            background: rgba(255, 136, 0, 0.1);
            border-color: #ff8800;
        }

        .lwa-mcts-val {
            font-size: 20px;
            font-weight: 700;
        }

        .lwa-mcts-lbl {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            margin-top: 3px;
        }

        .lwa-mcts-sub {
            font-size: 10px;
            color: #888;
            margin-top: 2px;
        }

        /* Algorithm Banner */
        .lwa-algo-banner {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        .lwa-algo-banner.mcts-win {
            background: rgba(50, 178, 218, 0.1);
            border: 1px solid #32b2da;
        }

        .lwa-algo-banner.pts-win {
            background: rgba(43, 196, 145, 0.1);
            border: 1px solid #2bc491;
        }

        .lwa-algo-mode {
            background: rgba(0,0,0,0.1);
            padding: 3px 8px;
            border-radius: 3px;
            color: var(--text-color, #333);
        }

        .lwa-algo-arrow {
            color: var(--text-color-secondary, #666);
        }

        .lwa-algo-winner {
            color: #5fad1b;
            font-weight: 700;
        }

        .lwa-algo-scores {
            margin-left: auto;
            font-size: 11px;
            font-weight: 400;
            color: var(--text-color-secondary, #666);
        }

        /* Search Comparison Layout */
        .lwa-search-comparison {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
        }

        @media (max-width: 550px) {
            .lwa-search-comparison {
                grid-template-columns: 1fr;
            }
        }

        .lwa-section.winner {
            border: 2px solid #5fad1b;
            background: rgba(95, 173, 27, 0.05);
        }

        .lwa-winner-badge {
            background: #5fad1b;
            color: #fff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: auto;
        }

        /* Timeline algo badge */
        .lwa-tl-algo-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            margin-right: 6px;
        }
        .lwa-tl-algo-badge.pts {
            background: rgba(43, 196, 145, 0.2);
            color: #2bc491;
        }
        .lwa-tl-algo-badge.mcts {
            background: rgba(255, 136, 0, 0.2);
            color: #ff8800;
        }

        /* PTS-specific cards - 3 columns instead of 4 */
        .lwa-section:nth-child(2) .lwa-mcts-grid {
            grid-template-columns: repeat(3, 1fr);
        }

        @media (min-width: 600px) {
            .lwa-section:nth-child(2) .lwa-mcts-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }

        /* Chosen Action */
        .lwa-chosen {
            background: rgba(255, 136, 0, 0.08);
            border: 1px solid #ff8800;
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
            background: #ff8800;
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
            color: var(--text-color, #333);
            word-break: break-word;
        }

        .lwa-chosen-stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: var(--text-color-secondary, #666);
            margin-top: 6px;
            padding-left: 34px;
        }

        .lwa-chosen-stats span {
            color: #ff8800;
            font-weight: 600;
        }

        /* Combo source badge (PTS/MCTS) */
        .lwa-combo-source {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .lwa-combo-source.pts {
            background: rgba(43, 196, 145, 0.2);
            color: #2bc491;
        }
        .lwa-combo-source.mcts {
            background: rgba(255, 136, 0, 0.2);
            color: #ff8800;
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

        .lwa-ops-fill.ok { background: #5fad1b; }
        .lwa-ops-fill.warn { background: #ff8800; }
        .lwa-ops-fill.danger { background: #e22424; }

        .lwa-ops-text {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-family: monospace;
            font-size: 11px;
            font-weight: 600;
            color: #ffffff;
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
            border: 1px solid var(--border, #ddd);
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
            border: 1px solid var(--border, #ddd);
            border-left: 3px solid #32b2da;
        }

        .lwa-agg-card.good { border-left-color: #5fad1b; }
        .lwa-agg-card.warn { border-left-color: #ff8800; }
        .lwa-agg-card.bad { border-left-color: #e22424; }

        .lwa-agg-val {
            font-size: 22px;
            font-weight: 700;
        }

        .lwa-agg-lbl {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            margin-top: 3px;
        }

        .lwa-agg-desc {
            font-size: 10px;
            color: #888;
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
            background: #5fad1b;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            z-index: 1;
        }

        .lwa-tl-turn-marker.current {
            background: #ff8800;
            box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.25);
        }

        .lwa-tl-events {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 8px 10px;
            border: 1px solid var(--border, #ddd);
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
            color: var(--text-color, #333);
        }

        .lwa-tl-value {
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
        }

        .lwa-tl-value.damage { color: #e22424; }
        .lwa-tl-value.heal { color: #5fad1b; }
        .lwa-tl-value.neutral { color: var(--text-color-secondary, #666); }

        /* Combo List */
        .lwa-combo {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            padding: 10px;
            margin-bottom: 8px;
            border: 1px solid var(--border, #ddd);
            border-left: 3px solid #5fad1b;
        }

        .lwa-combo:hover {
            border-left-color: #6ec91f;
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
            background: #5fad1b;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
        }

        .lwa-combo-desc {
            font-family: monospace;
            font-size: 11px;
            color: var(--text-color, #333);
            word-break: break-word;
        }

        .lwa-combo-stats {
            display: flex;
            gap: 14px;
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            padding-left: 28px;
        }

        .lwa-combo-stats span {
            color: #32b2da;
            font-weight: 600;
        }

        /* Profiler */
        .lwa-prof-group {
            margin-bottom: 6px;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            border: 1px solid var(--border, #ddd);
            overflow: hidden;
        }

        .lwa-prof-group-head {
            display: flex;
            align-items: center;
            padding: 8px 10px;
            cursor: pointer;
            background: var(--background-header, #f5f5f5);
            border-bottom: 1px solid var(--border, #ddd);
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
            color: var(--text-color-secondary, #666);
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
            color: var(--text-color-secondary, #666);
        }

        .lwa-prof-group-stats b {
            color: #5fad1b;
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
            color: #32b2da;
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
            color: #888;
        }

        .lwa-prof-details b {
            color: var(--text-color-secondary, #666);
        }

        .lwa-prof-standalone {
            padding: 8px 10px;
            background: var(--pure-white, #fff);
            border-radius: 3px;
            margin-bottom: 6px;
            border: 1px solid var(--border, #ddd);
        }

        /* ===== IMPROVED LOGS WITH COLLAPSIBLE SECTIONS ===== */
        .lwa-logs-container {
            background: var(--pure-white, #fff);
            border-radius: 3px;
            border: 1px solid var(--border, #ddd);
            overflow: hidden;
            max-width: 100%;
        }

        /* Collapsible Category */
        .lwa-log-category {
            border-bottom: 1px solid var(--border, #ddd);
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
            color: var(--text-color-secondary, #666);
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

        .lwa-log-cat-icon.init { background: rgba(50, 178, 218, 0.15); color: #32b2da; }
        .lwa-log-cat-icon.refresh { background: rgba(95, 173, 27, 0.15); color: #5fad1b; }
        .lwa-log-cat-icon.pts { background: rgba(43, 196, 145, 0.15); color: #2bc491; }
        .lwa-log-cat-icon.mcts { background: rgba(255, 136, 0, 0.15); color: #ff8800; }
        .lwa-log-cat-icon.position { background: rgba(160, 23, 214, 0.15); color: #a017d6; }
        .lwa-log-cat-icon.action { background: rgba(226, 36, 36, 0.15); color: #e22424; }
        .lwa-log-cat-icon.consequences { background: rgba(240, 192, 64, 0.15); color: #f0c040; }
        .lwa-log-cat-icon.other { background: rgba(136, 136, 136, 0.15); color: #888; }
        .lwa-log-cat-icon.summary { background: rgba(43, 196, 145, 0.15); color: #2bc491; }

        .lwa-log-cat-info {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .lwa-log-cat-name {
            font-weight: 600;
            font-size: 12px;
            color: var(--text-color, #333);
        }

        .lwa-log-cat-stats {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-log-cat-stats span {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .lwa-log-cat-stats b {
            color: var(--text-color, #333);
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
            border-left: 3px solid var(--border, #ddd);
        }

        .lwa-log-method-item:hover {
            border-left-color: #5fad1b;
        }

        .lwa-log-method-name {
            flex: 1;
            font-family: monospace;
            font-size: 11px;
            color: var(--text-color, #333);
        }

        .lwa-log-method-stats {
            display: flex;
            gap: 16px;
            font-size: 10px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-log-method-stats .calls { color: #32b2da; }
        .lwa-log-method-stats .avg { color: #ff8800; }
        .lwa-log-method-stats .total { color: #5fad1b; font-weight: 600; }

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
            border: 1px solid var(--border, #ddd);
        }

        .lwa-log-summary-card .value {
            font-size: 18px;
            font-weight: 700;
        }

        .lwa-log-summary-card .label {
            font-size: 10px;
            color: var(--text-color-secondary, #666);
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
            border: 1px solid var(--border, #ddd);
            color: var(--text-color, #333);
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
            background: #5fad1b;
            color: #ffffff;
            border-color: #5fad1b;
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
            border: 1px solid var(--border, #ddd);
            overflow: hidden;
            max-width: 100%;
        }

        .lwa-log-detail-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-color-secondary, #666);
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--border, #ddd);
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
            color: var(--text-color-secondary, #666);
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
            border-left: 3px solid #ff8800;
        }

        .lwa-log-combo-label {
            font-size: 10px;
            color: var(--text-color-secondary, #666);
            margin-bottom: 4px;
        }

        .lwa-log-combo-text {
            font-family: monospace;
            font-size: 11px;
            color: var(--text-color, #333);
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
            color: #888;
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
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            padding: 12px;
        }

        .lwa-mini-chart-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color, #333);
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

        .lwa-mini-chart-title.hp::before { background: #5fad1b; }
        .lwa-mini-chart-title.score::before { background: #ff8800; }
        .lwa-mini-chart-title.ops::before { background: #32b2da; }

        .lwa-chart-range {
            font-size: 10px;
            font-weight: 400;
            color: #888;
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
            color: var(--text-color-secondary, #666);
            margin-bottom: 10px;
            line-height: 1.5;
            padding: 8px 10px;
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            border-left: 3px solid #32b2da;
        }

        /* Anomaly Legend */
        .lwa-anomaly-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 16px;
            padding: 10px 12px;
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .lwa-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-legend-icon {
            font-size: 12px;
        }

        .lwa-legend-icon.danger { color: #e22424; }
        .lwa-legend-icon.warning { color: #ff8800; }
        .lwa-legend-icon.info { color: #32b2da; }

        .lwa-anomalies-list {
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            overflow: hidden;
        }

        /* Heatmap */
        .lwa-heatmap {
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .lwa-heatmap-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color, #333);
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
            border: 1px solid var(--border, #ddd);
            min-width: 120px;
        }

        .lwa-heatmap-bar {
            width: 4px;
            height: 30px;
            border-radius: 2px;
            background: var(--border, #ddd);
        }

        .lwa-heatmap-info {
            flex: 1;
        }

        .lwa-heatmap-name {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-color, #333);
        }

        .lwa-heatmap-count {
            font-size: 10px;
            color: var(--text-color-secondary, #666);
        }

        /* Anomalies */
        .lwa-anomalies {
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
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
            border-left: 3px solid #ff8800;
        }

        .lwa-anomaly-item.danger {
            background: rgba(226, 36, 36, 0.1);
            border-left: 3px solid #e22424;
        }

        .lwa-anomaly-item.info {
            background: rgba(50, 178, 218, 0.1);
            border-left: 3px solid #32b2da;
        }

        .lwa-anomaly-item.crash {
            background: linear-gradient(135deg, rgba(226, 36, 36, 0.15) 0%, rgba(226, 36, 36, 0.05) 100%);
            border-left: 4px solid #e22424;
            border: 1px solid #e22424;
        }

        .lwa-anomaly-item.crash .lwa-anomaly-title {
            color: #e22424;
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
            color: var(--text-color, #333);
        }

        .lwa-anomaly-desc {
            font-size: 10px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-anomaly-turn {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-color-secondary, #666);
            padding: 4px 8px;
            background: rgba(0,0,0,0.05);
            border-radius: 3px;
        }

        /* No anomalies message */
        .lwa-no-anomalies {
            text-align: center;
            padding: 20px;
            color: #5fad1b;
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
            background: #2a2a2a;
            color: #ffffff;
            border-radius: 6px 6px 0 0;
            font-weight: 600;
        }

        .lwa-raw-modal-header button {
            background: transparent;
            border: none;
            color: #ffffff;
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
            color: var(--text-color, #333);
            border-radius: 0 0 6px 6px;
        }

        /* Eye Icon Button */
        .lwa-eye-btn {
            background: transparent;
            border: none;
            color: var(--text-color-secondary, #666);
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
            color: #32b2da;
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
            border-top-color: #5fad1b;
            border-radius: 50%;
            margin: 0 auto 12px;
            animation: lwa-spin 0.8s linear infinite;
        }

        @keyframes lwa-spin {
            to { transform: rotate(360deg); }
        }

        .lwa-loading-text {
            font-size: 13px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-retry-btn {
            margin-top: 12px;
            background: #5fad1b;
            border: none;
            color: #ffffff;
            padding: 8px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.15s;
        }

        .lwa-retry-btn:hover {
            background: #6ec91f;
        }

        /* No Data */
        .lwa-nodata {
            text-align: center;
            padding: 30px 20px;
            color: var(--text-color-secondary, #666);
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
            color: var(--text-color, #333);
        }

        .lwa-nodata-hint {
            font-size: 12px;
            color: #888;
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
            border: 1px solid #e22424;
            border-radius: 3px;
        }

        .lwa-error-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .lwa-error-title {
            font-size: 14px;
            font-weight: 600;
            color: #e22424;
            margin-bottom: 10px;
        }

        .lwa-error-msg {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            font-family: monospace;
            text-align: left;
            background: var(--pure-white, #fff);
            padding: 10px;
            border-radius: 3px;
            line-height: 1.5;
            border: 1px solid var(--border, #ddd);
        }

        /* Error Banner (inline with content) */
        .lwa-error-banner {
            display: flex;
            gap: 12px;
            padding: 12px 14px;
            background: linear-gradient(135deg, rgba(226,36,36,0.08) 0%, rgba(226,36,36,0.03) 100%);
            border: 1px solid #e22424;
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
            color: #e22424;
            margin-bottom: 6px;
        }

        .lwa-error-details summary {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            cursor: pointer;
            padding: 4px 0;
        }

        .lwa-error-details summary:hover {
            color: var(--text-color, #333);
        }

        .lwa-error-stack {
            margin-top: 8px;
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            overflow: hidden;
        }

        .lwa-error-turn {
            padding: 8px 10px;
            border-bottom: 1px solid var(--border, #ddd);
        }

        .lwa-error-turn:last-child {
            border-bottom: none;
        }

        .lwa-error-turn-header {
            font-size: 10px;
            font-weight: 600;
            color: #e22424;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .lwa-error-turn pre {
            font-size: 11px;
            font-family: 'Consolas', 'Monaco', monospace;
            color: var(--text-color, #333);
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
            background: #5fad1b;
            border: none;
            border-radius: 3px;
            color: #ffffff;
            font-size: 10px;
            cursor: pointer;
            margin-left: 6px;
            transition: all 0.15s;
            vertical-align: middle;
        }

        .lwa-jump-btn:hover {
            background: #6ec91f;
        }

        .lwa-jump-btn::before {
            content: '🥬';
        }

        /* Timeline clickable turns */
        .lwa-tl-turn {
            cursor: pointer;
        }

        .lwa-tl-turn:hover .lwa-tl-events {
            border-color: #5fad1b;
        }

        /* ===== HEADER ACTIONS ===== */
        .lwa-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-right: 12px;
        }

        .lwa-header-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #eee;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
            text-decoration: none;
        }

        .lwa-header-btn:hover {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
        }

        .lwa-cache-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #eee;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.15s;
        }

        .lwa-cache-btn:hover {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
        }

        .lwa-cache-count {
            background: #5fad1b;
            color: #fff;
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
        }

        .lwa-cache-badge {
            margin-left: 6px;
            font-size: 12px;
            cursor: help;
        }

        /* ===== FIGHT PAGE SIDE MODE ===== */

        /* Main content width transition */
        .app-center {
            transition: width 0.3s ease, max-width 0.3s ease !important;
        }

        /* Force width constraint when LWA panel is open */
        .app-center.lwa-panel-open {
            width: calc(100vw - var(--lwa-panel-width, 400px) - 60px) !important; /* panel + ~60px left sidebar */
            max-width: calc(100vw - var(--lwa-panel-width, 400px) - 60px) !important;
        }

        /* Disable transition during resize for smooth dragging */
        .app-center.lwa-resizing {
            transition: none !important;
        }

        /* Also constrain the fight player and page content directly */
        .app-center.lwa-panel-open .page,
        .app-center.lwa-panel-open .page-content,
        .app-center.lwa-panel-open .fight,
        .app-center.lwa-panel-open .fight-page,
        .app-center.lwa-panel-open .combat {
            max-width: 100% !important;
            width: auto !important;
        }

        @media (max-width: 900px) {
            .app-center.lwa-panel-open {
                width: 100% !important;
                max-width: 100% !important;
            }
        }

        /* Side panel - fixed position on right side */
        .lwa-panel-side {
            position: fixed !important;
            right: 0;
            top: 60px;
            width: var(--lwa-panel-width, 400px);
            min-width: 280px;
            max-width: 70vw;
            height: calc(100vh - 60px);
            overflow-y: auto;
            overflow-x: hidden;
            z-index: 900;
            margin: 0 !important;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }

        /* Disable transition during resize for smooth dragging */
        .lwa-panel-side.lwa-resizing {
            transition: none !important;
        }

        .lwa-panel-side .panel {
            border-radius: 4px 0 0 4px;
            margin: 0;
            min-height: 100%;
        }

        .lwa-panel-side .panel .header {
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .lwa-panel-side.lwa-panel-collapsed {
            transform: translateX(100%);
            opacity: 0;
            pointer-events: none;
        }

        /* Resize handle - left edge of side panel */
        .lwa-resize-handle {
            position: absolute;
            left: 0;
            top: 0;
            width: 6px;
            height: 100%;
            cursor: ew-resize;
            background: transparent;
            z-index: 1002;
            transition: background 0.2s;
        }

        .lwa-resize-handle:hover,
        .lwa-resize-handle.active {
            background: linear-gradient(90deg, #5fad1b 0%, transparent 100%);
        }

        .lwa-resize-handle::before {
            content: '';
            position: absolute;
            left: 1px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 40px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .lwa-resize-handle:hover::before,
        .lwa-resize-handle.active::before {
            opacity: 1;
            background: rgba(255,255,255,0.5);
        }

        /* Prevent text selection during resize */
        body.lwa-resizing-active {
            user-select: none !important;
            cursor: ew-resize !important;
        }

        body.lwa-resizing-active * {
            cursor: ew-resize !important;
        }

        /* Side toggle button - fixed position so it stays visible */
        /* Also acts as resize handle when dragged */
        .lwa-side-toggle {
            position: fixed;
            right: var(--lwa-panel-width, 400px);
            top: 50%;
            transform: translateY(-50%);
            width: 28px;
            height: 80px;
            background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
            border-radius: 6px 0 0 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: ew-resize;
            z-index: 1001;
            transition: right 0.3s ease, background 0.15s, box-shadow 0.15s;
            box-shadow: -3px 0 10px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
            border-right: none;
        }

        /* Disable transition during resize for smooth dragging */
        .lwa-side-toggle.lwa-resizing {
            transition: none !important;
            background: linear-gradient(180deg, #5fad1b 0%, #4a8a15 100%) !important;
            box-shadow: -3px 0 15px rgba(95,173,27,0.5) !important;
        }

        .lwa-side-toggle:hover {
            background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
            box-shadow: -3px 0 15px rgba(95,173,27,0.3);
        }

        .lwa-side-toggle:active {
            background: linear-gradient(180deg, #5fad1b 0%, #4a8a15 100%);
        }

        .lwa-side-toggle i {
            color: #5fad1b;
            font-size: 28px;
        }

        .lwa-side-toggle.lwa-toggle-collapsed {
            right: 0;
            cursor: pointer; /* Only click to expand when collapsed */
        }

        /* Adjust side panel header for compact display */
        .lwa-panel-side .panel .header h2 {
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .lwa-panel-side .panel .header .version {
            display: none;
        }

        .lwa-panel-side .panel .content {
            padding: 10px;
        }

        /* Responsive adjustments for side mode - mobile: switch to bottom mode */
        @media (max-width: 900px) {
            .lwa-panel-side {
                position: relative !important;
                width: 100% !important;
                height: auto;
                max-height: none;
                top: auto;
            }
            .lwa-panel-side .panel {
                border-radius: 4px;
            }
            .lwa-panel-side.lwa-panel-collapsed {
                transform: translateY(-100%);
                height: 0;
            }
            .lwa-side-toggle {
                position: relative;
                right: auto;
                top: auto;
                transform: none;
                width: 100%;
                height: 32px;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            .lwa-side-toggle.lwa-toggle-collapsed {
                right: auto;
            }
            /* Hide resize handle on mobile */
            .lwa-resize-handle {
                display: none;
            }
        }

        .lwa-report-link {
            color: #5fad1b;
            text-decoration: none;
            font-weight: 600;
        }

        .lwa-report-link:hover {
            text-decoration: underline;
        }

        /* ===== CACHE MODAL ===== */
        .lwa-cache-modal {
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

        .lwa-cache-modal-content {
            background: var(--background, #fff);
            border-radius: 8px;
            width: 90%;
            max-width: 550px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .lwa-cache-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 18px;
            background: #2a2a2a;
            color: #ffffff;
            font-weight: 600;
            font-size: 15px;
        }

        .lwa-cache-modal-header button {
            background: transparent;
            border: none;
            color: #ffffff;
            font-size: 18px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
        }

        .lwa-cache-modal-header button:hover {
            background: rgba(255,255,255,0.2);
        }

        .lwa-cache-modal-body {
            padding: 16px;
            overflow-y: auto;
        }

        /* Cache Stats */
        .lwa-cache-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }

        .lwa-cache-stat {
            background: var(--background-header, #f5f5f5);
            border-radius: 6px;
            padding: 14px;
            text-align: center;
            border: 1px solid var(--border, #ddd);
        }

        .lwa-cache-stat-val {
            font-size: 22px;
            font-weight: 700;
            color: #5fad1b;
        }

        .lwa-cache-stat-lbl {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
            margin-top: 4px;
        }

        /* Cache Sections */
        .lwa-cache-section {
            background: var(--pure-white, #fff);
            border: 1px solid var(--border, #ddd);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 12px;
        }

        .lwa-cache-section-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-color, #333);
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border, #ddd);
        }

        /* Cache Settings */
        .lwa-cache-setting {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .lwa-cache-setting label {
            font-size: 12px;
            color: var(--text-color, #333);
        }

        .lwa-cache-setting input {
            width: 80px;
            padding: 6px 10px;
            border: 1px solid var(--border, #ddd);
            border-radius: 4px;
            font-size: 13px;
            background: var(--background, #fff);
            color: var(--text-color, #333);
        }

        .lwa-btn-small {
            background: #5fad1b;
            border: none;
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s;
        }

        .lwa-btn-small:hover {
            background: #6ec91f;
        }

        /* Cache Actions */
        .lwa-cache-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .lwa-btn-action {
            flex: 1;
            min-width: 140px;
            background: var(--background-header, #f5f5f5);
            border: 1px solid var(--border, #ddd);
            color: var(--text-color, #333);
            padding: 10px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s;
        }

        .lwa-btn-action:hover {
            background: #5fad1b;
            color: #fff;
            border-color: #5fad1b;
        }

        .lwa-btn-action.danger:hover {
            background: #e22424;
            border-color: #e22424;
        }

        /* Cache List */
        .lwa-cache-list {
            max-height: 250px;
            overflow-y: auto;
        }

        .lwa-cache-empty {
            text-align: center;
            padding: 20px;
            color: var(--text-color-secondary, #666);
            font-size: 13px;
        }

        .lwa-cache-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            margin: 4px 0;
            background: var(--background-header, #f5f5f5);
            border-radius: 4px;
            border-left: 3px solid #5fad1b;
            transition: all 0.15s;
        }

        .lwa-cache-item:hover {
            border-left-color: #32b2da;
        }

        .lwa-cache-item-info {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .lwa-cache-item-id {
            font-weight: 600;
            font-size: 12px;
            color: #5fad1b;
            text-decoration: none;
        }

        .lwa-cache-item-id:hover {
            text-decoration: underline;
        }

        .lwa-cache-item-date {
            font-size: 11px;
            color: var(--text-color-secondary, #666);
        }

        .lwa-cache-item-age {
            font-size: 10px;
            color: #888;
        }

        .lwa-cache-item-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .lwa-cache-item-size {
            font-size: 10px;
            color: #888;
            font-family: monospace;
        }

        .lwa-cache-item-delete {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 14px;
            padding: 4px;
            border-radius: 3px;
            opacity: 0.6;
            transition: all 0.15s;
        }

        .lwa-cache-item-delete:hover {
            opacity: 1;
            background: rgba(226,36,36,0.1);
        }
    `;

    GM_addStyle(styles);

    // Register module - wait for Core to register
    const registerModule = () => {
        if (unsafeWindow.LWA && unsafeWindow.LWA.modules) {
            unsafeWindow.LWA.modules.styles = true;
            console.log('[LWA] Styles module loaded');
        } else {
            setTimeout(registerModule, 50);
        }
    };
    registerModule();
})();
