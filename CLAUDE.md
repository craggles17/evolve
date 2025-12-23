# Damn Nature You Scary - Development Notes

## Project Overview

A scientifically accurate evolution lineage-builder board game spanning the Phanerozoic eon (540 MYA to present). Players evolve organisms through geological time by drafting traits from era-specific decks, competing for hexagonal biome tiles, and surviving extinction events.

## Current Status

**Phase: Initial Implementation Complete**

All core game data and assets have been created:
- [x] Core data structures (traits, phylogeny, events, tiles)
- [x] 12 era-specific trait decks with color-coded backs
- [x] Hexagonal tile system with era locks
- [x] 18 generic event cards with shuffled deck mechanic
- [x] Event card backs (red=extinction, green=positive/neutral)
- [x] Personal lineage board with 12 era columns
- [x] Central era board with scientific facts
- [x] Card templates (trait, event, deck backs)
- [x] Companion book with scientific explanations
- [x] Organism database with 30+ organisms for matching
- [x] Balance simulator for playtesting

## Recent Changes

### Event System Overhaul
- Events are now **generic archetypes** (Ice Age, Volcanic Winter, etc.)
- Events are **shuffled** at game start - one revealed per era
- Card backs show if **extinction** (red/skull) or **other** (green/?)
- Each event has **REAL EXAMPLES** showing when it actually happened
- 18 total events: 7 extinction, 6 positive, 5 neutral

### Lineage Board Redesign
- **12 era columns** for tracking trait acquisition timeline
- Color-coded columns matching era deck colors
- 3 trait slots per era (36 total)
- Stats panel: markers, alleles, complexity, tags, fecundity

### Trait Enhancements
- **55 traits** with soft prerequisites for cost reduction
- Grants use explicit format: `TILES: | COMPETITION: | ALLELES: | SURVIVAL:`
- Prerequisites show names (not IDs) with visual indicators:
  - Solid line (━) = hard prerequisite (required)
  - Dashed line (┅) = soft prerequisite (cost reduction)

## Key Design Decisions

### Binary Extinction System
- No percentages or d100 rolls
- SAFE tag = survive, DOOMED tag = lose half, NEUTRAL = roll d6 (4+)
- Simple to resolve at the table

### Hard vs Soft Prerequisites
- HARD: Required to purchase trait (solid line on card)
- SOFT: Reduces cost by 1-3 alleles (dashed line on card)
- Example: Flight requires Hollow Bones, but Feathers just make it cheaper

### Shuffled Event Deck
- All 18 events shuffled face-down at game start
- Players can see card BACKS (extinction vs other)
- Creates tension: you know danger is coming, but not what
- More replayability than fixed era-bound events

### Fecundity-based Allele Economy
- R-strategy reproduction: +2 alleles/era (boom/bust)
- K-strategy reproduction: -1 allele/era but protected offspring
- Reflects real population genetics

### Tile Competition with Markers
- 12 creature markers per player
- Competition resolved by: marker count + matching tags
- Displacement requires 2+ advantage in both

## File Structure

```
damn_nature_you_scary/
├── docs/
│   ├── RULEBOOK.md           # Complete game rules
│   ├── COMPANION_BOOK.md     # Scientific explanations
│   └── QUICK_REFERENCE.md    # Player aid card
├── data/
│   ├── traits.json           # 55 traits with era windows
│   ├── events.json           # 18 generic events
│   ├── tiles.json            # 37 hex tiles
│   ├── era_decks.json        # Deck compositions
│   ├── phylogeny.json        # Tech tree structure
│   └── organisms.json        # 30+ organisms for matching
├── assets/
│   ├── cards/
│   │   ├── trait_template.svg
│   │   ├── event_template.svg
│   │   ├── event_back_extinction.svg
│   │   ├── event_back_other.svg
│   │   └── era_deck_backs/
│   ├── tiles/
│   │   └── hex_template.svg
│   └── boards/
│       ├── lineage_board.svg   # Era-column design
│       └── era_board.svg
├── generated_cards/
│   ├── traits/          # 55 trait card SVGs
│   ├── events/          # 18 event card SVGs
│   └── event_backs/     # 2 back designs
└── tools/
    ├── card_generator.py     # Generate printable cards
    ├── organism_matcher.py   # Find closest organism
    └── balance_simulator.py  # Test game balance
```

## Next Steps

### For Physical Prototype
1. Run `python tools/card_generator.py` to generate all card SVGs
2. Print cards on cardstock (use print sheets)
3. Laser cut hex tiles or print on heavy paper
4. 3D print or purchase creature markers

### For Playtesting
1. Run `python tools/balance_simulator.py 1000` for stats
2. Use `python tools/balance_simulator.py --analyze` for trait analysis
3. Adjust costs/complexity values based on results

### Balance Notes
Current win rates (needs tuning):
- generalist: ~35%
- Mammalia: ~33%
- Aves: ~20%
- Crocodilia: ~12% (needs boost)

### Future Features
- [ ] Digital companion app
- [ ] Expansion packs (Precambrian, specific ecosystems)
- [ ] Solo mode with AI opponents
- [ ] Campaign mode with persistent lineages

## Scientific Sources

- Benton, M.J. - "Vertebrate Palaeontology"
- Dawkins, R. - "The Ancestor's Tale"
- TimeTree.org - Molecular dating
- Paleobiology Database (paleobiodb.org)

## Git Workflow

Target branch: `main`

Commits should be atomic with informative messages:
- `[feat] Add trait data with era windows`
- `[feat] Create extinction event cards`
- `[fix] Balance simulator for shuffled events`
- `[docs] Update rulebook with new mechanics`
