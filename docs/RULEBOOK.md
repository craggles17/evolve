# Damn Nature You Scary
## Official Rulebook

*A strategic lineage-building game of evolution*

---

## Components

### Per Player
- 1 Personal Lineage Board (with 12 era columns)
- 12 Creature Markers (wooden tokens or meeples)
- 10 Allele Tokens

### Shared
- 1 Central Era Board
- 12 Era Trait Decks (color-coded, 10 cards per player per deck)
- 18 Event Cards (shuffled deck with visible backs)
- 19-37 Hexagonal Biome Tiles
- 2 Standard d6 dice

---

## Game Setup

1. **Place the Central Era Board** in the center of the table
2. **Arrange Hex Tiles** in the starting layout (see Era Board for configuration)
3. **Sort Era Decks** by color and place face-down near the board
4. **Shuffle Event Deck:**
   - Shuffle all 18 event cards face-down
   - Place the deck where all players can see the BACKS
   - **RED BACK (skull)** = Extinction event - danger ahead!
   - **GREEN BACK (question mark)** = Positive or neutral event
5. **Each Player Takes:**
   - 1 Personal Lineage Board
   - 12 Creature Markers in their color
   - Starting Alleles: Roll 2d6, this is your starting allele pool
6. **Place Starting Markers:** Each player places 3 markers on any Shallow Marine or Ocean tile

---

## Personal Lineage Board

Your lineage board has **12 era columns** (one per geological era):

```
| Era 0    | Era 1     | Era 2    | ... | Era 11     |
| Cambrian | Ordovician| Silurian |     | Quaternary |
|----------|-----------|----------|-----|------------|
| [slot]   | [slot]    | [slot]   |     | [slot]     |
| [slot]   | [slot]    | [slot]   |     | [slot]     |
| [slot]   | [slot]    | [slot]   |     | [slot]     |
```

When you play a trait, place it in the **current era's column**. This tracks your evolutionary timeline and shows when you acquired each adaptation.

The right panel tracks:
- **Creature Markers** (12 total)
- **Alleles** (current currency)
- **Total Complexity** (sum of trait values)
- **Active Tags** (for biomes and extinction checks)
- **Fecundity Bonus** (allele income modifier)

---

## Era Structure

The game progresses through 12 eras. Each era follows this sequence:

### Phase 1: Allele Roll
All players simultaneously roll 2d6 and add:
- **Population Tier:** 1-3 markers on board = +0, 4-6 = +1, 7-9 = +2, 10+ = +3
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
4. Place card in the **current era's column** on your Lineage Board
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
**Reveal the top event card** from the shuffled deck.

**Event Types:**

| Card Back | Event Type | Effect |
|-----------|------------|--------|
| 🔴 Red/Skull | Extinction | Survival check for all players |
| 🟢 Green/? | Positive | Bonus effect as stated |
| 🟢 Green/? | Neutral | Environmental change as stated |

**Positive Events:** Apply bonus effects as stated on the card.

**Neutral Events:** Apply effects as stated on the card.

**Extinction Events:** Resolve for each player:
1. **SAFE Check:** Do you have ANY tag in the SAFE list?
   - YES → You survive with full population. Skip to next player.
2. **DOOMED Check:** Do you have ANY tag in the DOOMED list?
   - YES → Lose half your markers (round up losses). Keep at least 1.
3. **NEUTRAL Check:** If neither SAFE nor DOOMED:
   - Roll 1d6. Need 4+ to survive (5+ for "The Great Dying")
   - Fail = Lose half your markers

**After resolution:** Place the event card in a discard pile. The "REAL EXAMPLES" section on each card shows when this type of event actually happened on Earth!

### Phase 8: Advance
Move the era marker to the next era. Begin the next era's Phase 1.

---

## Event Card Strategy

**The event deck is shuffled**, so you don't know exactly when extinctions will hit. But you CAN see the card backs!

**Reading the Event Deck:**
- Count the **RED backs** visible - that's how many extinctions remain
- If the next card is RED, prepare your survival tags!
- If the next card is GREEN, you might risk a more aggressive strategy

**Building for Survival:**
- Acquire [Burrowing], [Small], [Freshwater], or [Deep-Sea] - these appear on many SAFE lists
- Avoid over-investing in [Reef-Dependent], [Tropical], or [Large] - often DOOMED

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
| PREREQS: Lungs ━, Lobed Fins ┅   |  ← ━ = Hard, ┅ = Soft
+----------------------------------+
| COMPLEXITY: +3                   |  ← Victory points
| TAGS: [Terrestrial] [Mobile]     |  ← For biomes & extinction
+----------------------------------+
| GRANTS: TILES: Occupy land.      |  ← Special abilities
| FOUNDATION: Required for amniotes|
+----------------------------------+
| [Clade: Tetrapoda]               |  ← Phylogenetic placement
+----------------------------------+
```

**Grants Format:**
- `TILES:` - What biomes you can occupy
- `COMPETITION:` - Bonuses in tile control
- `ALLELES:` - Income modifiers
- `SURVIVAL:` - Extinction benefits
- `FOUNDATION:` - Unlocks other traits

---

## Event Card Anatomy

```
+----------------------------------+
| ★ EXTINCTION ★                   |  ← Event type header
+----------------------------------+
| ICE AGE                          |  ← Generic event name
+----------------------------------+
| SAFE (survive):                  |
| [Freshwater] [Deep-Sea]          |  ← Tags that auto-survive
| [Warm-Blooded] [Burrowing]       |
+----------------------------------+
| DOOMED (lose half):              |
| [Tropical] [Shallow-Marine]      |  ← Tags that suffer losses
| [Cold-Vulnerable]                |
+----------------------------------+
| NEUTRAL: Roll d6, need 4+        |  ← Everyone else rolls
+----------------------------------+
| REAL EXAMPLES:                   |  ← When this happened on Earth
| • End-Ordovician (~445 MYA)      |
| • Pleistocene (~2.6 MYA)         |
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
- Add Osteoderms and Crocodilian Body Plan
- Focus on population AND complexity
- Survive nearly every extinction
- Control Swamp and Coast tiles

### The Bird Strategy
- Long trait chain: Archosaur → Hollow Bones → Feathers → Flight
- High complexity payoff
- Excellent mobility (any tile)
- K-Pg survivor (with [Avian] tag)

### The Mammal Strategy
- Synapsid skull → Endothermy → Fur → Mammary Glands
- Live Birth + Placenta for protected offspring
- Strong against Ice Ages with [Warm-Blooded]
- High complexity late game

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
2d6 + Pop Tier (0/+1/+2/+3) + Tiles Controlled + Fecundity Bonus
```

### Population Tiers
- 1-3 markers: +0
- 4-6 markers: +1
- 7-9 markers: +2
- 10+ markers: +3

### Extinction Resolution
1. SAFE tag? → Survive
2. DOOMED tag? → Lose half (min 1 survivor)
3. Neither? → Roll d6, need 4+ (5+ for Great Dying)

### Event Back Colors
- 🔴 **RED/SKULL** = Extinction coming - prepare!
- 🟢 **GREEN/?** = Positive or neutral event

### Scoring
```
Population × Complexity + (Tiles × 3)
```

---

*For scientific explanations of all rules, see the Companion Book.*
