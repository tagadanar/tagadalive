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
│   │   ├── PTS           # Priority Target Simulation (greedy, ~50k ops)
│   │   ├── MCTS          # Monte Carlo Tree Search (~300k ops)
│   │   ├── BeamSearch    # Recherche en faisceau (~150k ops)
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

| Mode | Description | Ops typiques |
|------|-------------|--------------|
| `MODE_PTS` | Greedy target-first | ~50k |
| `MODE_MCTS` | Tree search avec UCB1 | ~300k |
| `MODE_BEAM` | Multi-path beam search | ~150k |
| `MODE_HYBRID` | PTS → MCTS sur 1 cellule | ~150k |
| `MODE_HYBRID_GUIDED` | PTS guide MCTS (recommandé) | ~250k |
| `MODE_HYBRID_BEAM` | PTS guide BeamSearch | ~200k |

**Mode par défaut** : `HYBRID_GUIDED`

Voir [docs/ALGORITHMS.md](../docs/ALGORITHMS.md) pour la documentation détaillée.

## Tampermonkey

Scripts de visualisation pour analyser les combats dans le navigateur.
Affiche les statistiques des algorithmes, le profiler, les combos, etc.

Voir [tampermonkey/README.md](tampermonkey/README.md) pour l'installation et l'utilisation.  
