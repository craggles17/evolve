# Damn Nature You Scary - Development Notes

## Project Overview

A scientifically accurate evolution lineage-builder board game spanning the Phanerozoic eon (540 MYA to present). Players evolve organisms through geological time by drafting traits from era-specific decks, competing for hexagonal biome tiles, and surviving extinction events.

## Current Status

**Phase: Initial Implementation Complete**

All core game data and assets have been created:
- [x] Core data structures (traits, phylogeny, events, tiles)
- [x] 12 era-specific trait decks with color-coded backs
- [x] Hexagonal tile system with era locks
- [x] Event cards with binary SAFE/DOOMED extinction rules
- [x] Personal lineage board design
- [x] Central era board with scientific facts
- [x] Card templates (trait, event, deck backs)
- [x] Companion book with scientific explanations
- [x] Organism database with 30+ organisms for matching
- [x] Balance simulator for playtesting

## Key Design Decisions

### Binary Extinction System
- No percentages or d100 rolls
- SAFE tag = survive, DOOMED tag = lose half, NEUTRAL = roll d6 (4+)
- Simple to resolve at the table

### Hard vs Soft Prerequisites
- HARD: Required to purchase trait (solid line on card)
- SOFT: Reduces cost by 1-3 alleles (dashed line on card)
- Example: Flight requires Hollow Bones, but Feathers just make it cheaper

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
│   ├── traits.json           # 50+ traits with era windows
│   ├── events.json           # 12 era events
│   ├── tiles.json            # 37 hex tiles
│   ├── era_decks.json        # Deck compositions
│   ├── phylogeny.json        # Tech tree structure
│   └── organisms.json        # 30+ organisms for matching
├── assets/
│   ├── cards/
│   │   ├── trait_template.svg
│   │   ├── event_template.svg
│   │   └── era_deck_backs/
│   ├── tiles/
│   │   └── hex_template.svg
│   └── boards/
│       ├── lineage_board.svg
│       └── era_board.svg
└── tools/
    ├── card_generator.py     # Generate printable cards
    ├── organism_matcher.py   # Find closest organism
    └── balance_simulator.py  # Test game balance
```

## Next Steps

### For Physical Prototype
1. Run `python tools/card_generator.py` to generate all card SVGs
2. Print cards on cardstock
3. Laser cut hex tiles or print on heavy paper
4. 3D print or purchase creature markers

### For Playtesting
1. Run `python tools/balance_simulator.py 1000` for stats
2. Use `python tools/balance_simulator.py --analyze` for trait analysis
3. Adjust costs/complexity values based on results

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
Feature branch: `feature/initial-implementation`

Commits should be atomic with informative messages:
- `[feat] Add trait data with era windows`
- `[feat] Create extinction event cards`
- `[docs] Add scientific companion book`

