# Damn Nature You Scary
## Official Rulebook

*A strategic lineage-building game of evolution*

---

## Components

### Per Player
- 1 Personal Lineage Board
- 12 Creature Markers (wooden tokens or meeples)
- 10 Allele Tokens

### Shared
- 1 Central Era Board
- 12 Era Trait Decks (color-coded, 10 cards per player per deck)
- 12 Event Cards (pre-sorted by era)
- 19-37 Hexagonal Biome Tiles
- 2 Standard d6 dice

---

## Game Setup

1. **Place the Central Era Board** in the center of the table
2. **Arrange Hex Tiles** in the starting layout (see Era Board for configuration)
3. **Sort Era Decks** by color and place face-down near the board
4. **Place Event Cards** in their slots on the Era Board (or face-down in era order)
5. **Each Player Takes:**
   - 1 Personal Lineage Board
   - 12 Creature Markers in their color
   - Starting Alleles: Roll 2d6, this is your starting allele pool
6. **Place Starting Markers:** Each player places 3 markers on any Shallow Marine or Ocean tile

---

## Era Structure

The game progresses through 12 eras. Each era follows this sequence:

### Phase 1: Allele Roll
All players simultaneously roll 2d6 and add:
- **Population Tier:** 1-3 markers on board = +0, 4-6 = +1, 7+ = +2
- **Tile Control:** +1 per tile you control
- **Fecundity Bonus:** As indicated by your traits

### Phase 2: Draw
Shuffle the current era's deck. Deal cards until the deck is exhausted:
- Deal 1 card to each player in turn order
- Continue until all cards are dealt
- Players keep cards in hand (hidden from others)
- **Duplicates are kept** - multiple copies of a trait are allowed

### Phase 3: Evolution
In turn order, players may play any number of trait cards from hand:

**To Play a Trait:**
1. Check **Era Window** - Current era must be within Min-Max range
2. Check **Hard Prerequisites** - Must have all required traits already
3. Pay **Allele Cost** (reduced by soft prerequisites)
4. Place card on your Lineage Board, connected to prerequisites
5. Gain the trait's tags and abilities

**Soft Prerequisite Discounts:**
| Soft Prereqs Owned | Discount |
|-------------------|----------|
| 1 | -1 Allele |
| 2 | -2 Alleles |
| 3+ (all) | -3 Alleles |

**Keeping Cards:** Unplayed cards stay in hand for future eras.

### Phase 4: Populate
In turn order, players may place or move creature markers:
- **Place** markers from supply onto tiles where you have valid tags
- **Move** markers to adjacent tiles (if you have [Mobile])
- You must have required tags to occupy a biome (e.g., [Aquatic] for Ocean)

### Phase 5: Tile Competition
Resolve control for each tile with multiple players:

1. Count each player's markers on the tile
2. Count each player's matching tags for that biome
3. **Winner** = Most markers + Most matching tags (tags break ties)
4. Winner controls the tile (gains +1 allele income next era)
5. **Ties:** Both players share control (+0.5 each, rounded down)

**Displacement:** If you have 2+ more markers AND 2+ more relevant tags than an opponent, you may displace their markers (return to their supply).

### Phase 6: Tile Flip
Roll 1d6 for the entire tile grid:
- Check each tile's flip number
- If roll ≥ flip number AND current era ≥ tile's era lock, the tile flips
- Draw a new tile from the stack and place it in the same location
- Any markers on flipped tiles remain (but must check if still valid)

### Phase 7: Event Resolution
Reveal and resolve the current era's event card:

**Positive Events:** Apply bonus effects as stated

**Neutral Events:** Apply effects as stated

**Extinction Events:** Resolve for each player:
1. **SAFE Check:** Do you have ANY tag in the SAFE list?
   - YES → You survive with full population. Skip to next player.
2. **DOOMED Check:** Do you have ANY tag in the DOOMED list?
   - YES → Lose half your markers (round up losses). Keep at least 1.
3. **NEUTRAL Check:** If neither SAFE nor DOOMED:
   - Roll 1d6. Need 4+ to survive (5+ for End-Permian)
   - Fail = Lose half your markers

### Phase 8: Advance
Move the era marker to the next era. Begin the next era's Phase 1.

---

## Winning the Game

After completing Era 11 (Quaternary), calculate final scores:

```
FINAL SCORE = Population × Complexity + Tile Bonus

Population = Number of your markers on the board
Complexity = Sum of all trait complexity values on your Lineage Board
Tile Bonus = 3 points × number of tiles you control
```

**Highest score wins!**

### Tiebreakers (in order)
1. Highest Complexity
2. Most tiles controlled
3. Most markers on board
4. Share victory

---

## Trait Card Anatomy

```
+----------------------------------+
| ERA WINDOW: 3-8                  |  ← Must play between these eras
| (Devonian to Cretaceous)         |
+----------------------------------+
| TRAIT: Tetrapod Limbs            |  ← Trait name
+----------------------------------+
| COST: 4 Alleles                  |  ← Base cost
| PREREQS: Lungs ━━, Lobed Fins ┅┅ |  ← ━━ = Hard, ┅┅ = Soft
+----------------------------------+
| COMPLEXITY: +3                   |  ← Victory points
| TAGS: [Terrestrial] [Mobile]     |  ← For biomes & extinction
+----------------------------------+
| GRANTS: Claim land tiles         |  ← Special abilities
+----------------------------------+
| [Clade: Tetrapoda]               |  ← Phylogenetic placement
+----------------------------------+
```

---

## Biome Requirements

Each biome type requires specific tags to occupy:

| Biome | Required Tags | Bonus Tags |
|-------|--------------|------------|
| Ocean | [Aquatic] | [Marine-Only], [Deep-Sea] |
| Shallow Sea | [Aquatic] | [Marine-Only] |
| Reef | [Aquatic] | [Reef-Dependent] |
| Coast | None | [Aquatic] or [Terrestrial] |
| Freshwater | [Aquatic] | [Freshwater] |
| Swamp | None | [Aquatic], [Terrestrial], [Amphibian] |
| Forest | [Terrestrial] | [Arboreal] |
| Grassland | [Terrestrial] | [Mobile] |
| Desert | [Terrestrial] | [Burrowing] |
| Mountain | [Terrestrial] | [Aerial], [Cold-Resistant] |
| Ice | [Cold-Resistant] | [Warm-Blooded], [Burrowing] |

---

## Reading Opponent Strategy

**Card backs are color-coded by era!** When opponents draw cards:

| If They're Hoarding... | They're Probably Building... |
|----------------------|----------------------------|
| Deep Blue (Era 0) | Basic body plans |
| Teal/Green (Eras 1-4) | Fish → Amphibian → Reptile |
| Brown/Orange (Eras 5-6) | Proto-mammals or Archosaurs |
| Red (Era 7) | Birds/Flight |
| Purple (Era 8) | Pollinators, Mammals |
| Pink/Yellow (Eras 9-10) | Big brains, Primates |
| White (Era 11) | Cold-resistant survival |

Use this information to compete for tiles or avoid their strategy!

---

## Strategy Tips

### The Crocodile Strategy
- Acquire basic Archosaur traits
- Get [Burrowing] + [Aquatic] early
- Focus on population, not complexity
- Survive every extinction
- Win through sheer numbers

### The Bird Strategy
- Long trait chain: Archosaur → Hollow Bones → Feathers → Flight
- High complexity payoff
- Excellent mobility (any tile)
- K-Pg survivor

### The Generalist Strategy
- Spread markers across many biomes
- Acquire survival tags: [Burrowing], [Small], [Freshwater]
- Accept lower complexity for extinction resilience

### The Specialist Strategy
- Dominate one biome type completely
- High risk if that biome flips
- Can score big on tile control bonus

---

## Quick Reference

### Allele Income
```
2d6 + Pop Tier (0/+1/+2) + Tiles Controlled + Fecundity Bonus
```

### Population Tiers
- 1-3 markers: +0
- 4-6 markers: +1
- 7+ markers: +2

### Extinction Resolution
1. SAFE tag? → Survive
2. DOOMED tag? → Lose half (min 1 survivor)
3. Neither? → Roll d6, need 4+ (5+ End-Permian)

### Scoring
```
Population × Complexity + (Tiles × 3)
```

---

*For scientific explanations of all rules, see the Companion Book.*

