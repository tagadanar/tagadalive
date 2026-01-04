# TAGADALIVE

AI de combat pour LeekWars écrite en LeekScript v4.

twitch : https://www.twitch.tv/ideesnoireslive
discord : https://discord.gg/7dpAPWqC
leek wars : https://leekwars.com/
topic sur le forum : https://leekwars.com/forum/category-6/topic-10261

## Architecture

```
tagadalive/
├── main                  # Point d'entrée, sélection du mode algorithme
├── auto                  # Agrégateur d'includes
├── AI/
│   ├── AI                # Façade et dispatcher de mode
│   ├── Algorithms/       # Algorithmes de recherche
│   │   ├── PTS           # Priority Target Simulation (greedy)
│   │   ├── MCTS          # Monte Carlo Tree Search
│   │   ├── BeamSearch    # Recherche en faisceau
│   │   ├── UnifiedMCTS   # MCTS unifié (cellules au 1er niveau) [DEFAULT]
│   │   └── Hybrid        # Modes hybrides (combinaisons)
│   ├── Scoring           # Système de scoring
│   ├── ScoringConfig     # Constantes ML-tunable
│   └── BattleState       # État de la bataille
├── Model/                # Entity, Item, Cell, Combo, Action, Consequences
├── Controlers/           # Fight, Board, Maps (Path, Danger, Position, Action)
├── Services/             # Damages, Targets, Benchmark
└── tampermonkey/         # Scripts de visualisation (voir README dédié)
```

## Modes d'algorithme

Configurable dans `main` via `AI.mode = AI.MODE_*` :

| Mode | Description |
|------|-------------|
| `MODE_PTS` | Greedy target-first |
| `MODE_MCTS` | Tree search avec UCB1 |
| `MODE_BEAM` | Multi-path beam search |
| `MODE_HYBRID` | PTS → MCTS sur 1 cellule |
| `MODE_HYBRID_GUIDED` | PTS guide MCTS (recommandé) |
| `MODE_HYBRID_BEAM` | PTS guide BeamSearch |

**Mode par défaut** : `HYBRID_GUIDED`

Voir [docs/ALGORITHMS.md](../docs/ALGORITHMS.md) pour la documentation détaillée.

## Tampermonkey

Scripts de visualisation pour analyser les combats dans le navigateur.
Affiche les statistiques des algorithmes, le profiler, les combos, etc.

Voir [tampermonkey/README.md](tampermonkey/README.md) pour l'installation et l'utilisation.  
