---
name: Evolution Lineage Builder
overview: Design a scientifically accurate evolution lineage-builder with era-specific trait decks, hexagonal biome competition, personal phylogeny boards, and binary extinction mechanics. Strategy emphasized through deck color reads and multi-era planning.
todos:
  - id: core-data
    content: Create JSON data for traits (with min/max era windows), phylogeny, and events
    status: completed
  - id: era-decks
    content: Design 12 era-specific trait decks with color-coded backs (10 cards/player)
    status: completed
    dependencies:
      - core-data
  - id: tile-system
    content: Design simplified hex tiles with era lock on front, single d6 flip mechanic
    status: completed
    dependencies:
      - core-data
  - id: event-cards
    content: Create one event card per era with binary SAFE/DOOMED extinction rules
    status: completed
    dependencies:
      - core-data
  - id: lineage-board
    content: Design personal phylogenetic lineage boards for each player
    status: completed
    dependencies:
      - core-data
  - id: era-board
    content: Design central era board with event slots and scientific facts
    status: completed
    dependencies:
      - event-cards
  - id: card-templates
    content: Design printable card templates with era windows and colored backs
    status: completed
    dependencies:
      - era-decks
  - id: companion-book
    content: Write companion book explaining scientific basis for all rules
    status: completed
    dependencies:
      - core-data
      - event-cards
  - id: organism-db
    content: Build organism database with trait vectors for fun lookup feature
    status: completed
    dependencies:
      - core-data
  - id: balance-sim
    content: Create Python simulator to test game balance and deck sizes
    status: completed
    dependencies:
      - core-data
      - era-decks
---

# Damn Nature You Scary - Evolution Lineage Builder

## Game Identity

A strategic lineage-building game where players evolve organisms through geological time by drafting traits from era-specific decks, competing for hexagonal biome tiles, and surviving extinction events. Victory = Population x Genetic Complexity.**Core Philosophy:** Every rule has a scientific basis explained in the companion book. Strategy comes from reading opponents' deck colors, planning multi-era trait chains, and timing tile claims.---

## 1. Components Overview

### Per Player

- 1 Personal Lineage Board (phylogenetic tree for laying traits)
- 12 Creature Markers (for tile occupation/competition)
- Allele tokens (for tracking currency)

### Shared

- Central Era Board (era track, event slots, scientific facts)
- 12 Era Trait Decks (color-coded backs, 10 cards per player per era)
- Hexagonal Biome Tiles (shared play area)
- Event Cards (1 per era, predetermined)
- 2d6 dice

---

## 2. Era System

### 2.1 Era Progression (12 Eras)

| Era | Period | MYA | Deck Color | Event Type ||-----|--------|-----|------------|------------|| 0 | Cambrian | 540-485 | Deep Blue | Oxygen Rise || 1 | Ordovician | 485-444 | Teal | END-ORDOVICIAN || 2 | Silurian | 444-419 | Sea Green | Ozone Formation || 3 | Devonian | 419-359 | Forest Green | LATE DEVONIAN || 4 | Carboniferous | 359-299 | Dark Green | Oxygen Spike || 5 | Permian | 299-252 | Brown | END-PERMIAN || 6 | Triassic | 252-201 | Orange | END-TRIASSIC || 7 | Jurassic | 201-145 | Red | Continental Split || 8 | Cretaceous | 145-66 | Purple | K-PG EXTINCTION || 9 | Paleogene | 66-23 | Pink | Mammal Radiation || 10 | Neogene | 23-2.6 | Yellow | Grassland Spread || 11 | Quaternary | 2.6-0 | White | ICE AGES |

### 2.2 Era Structure

Each era follows this sequence:

1. **Allele Roll** - All players roll 2d6, add fecundity bonuses
2. **Draw Phase** - Draw from current era deck until exhausted
3. **Evolution Phase** - Play any number of affordable traits to lineage board
4. **Populate Phase** - Place/move creature markers on tiles (must have valid traits)
5. **Tile Competition** - Resolve tile control, displacement if applicable
6. **Tile Flip** - Roll d6, flip qualifying tiles
7. **Event Resolution** - Reveal and resolve the era's event card
8. **Advance** - Move to next era

---

## 3. Allele Economy

### 3.1 Income (Per Era)

```javascript
Base Alleles = 2d6 roll result

Modifiers:
+ Population tier bonus (1-3 pop: +0, 4-6: +1, 7+: +2)
+ Tile control bonus (+1 per controlled tile)
+ Fecundity trait bonuses (see below)
```

**Scientific Basis:** Alleles represent genetic variation available for selection. Larger populations have more variation (Hardy-Weinberg principle). Dice represent random mutation rates.

### 3.2 Fecundity and Offspring Traits

Some traits provide ongoing allele income bonuses:| Trait | Allele Bonus | Scientific Basis ||-------|--------------|------------------|| R-Strategy Reproduction | +2/era | High offspring = more mutations || Egg Laying | +1/era | External development, more offspring || Live Birth | +0/era but +1 population/era | Fewer offspring, higher survival || Broadcast Spawning | +3/era | Massive offspring numbers || Parental Care | -1/era but population protected | Investment in fewer offspring || Eusocial Colony | +2/era if population 5+ | Colony reproduction bonus |**Trade-off:** High fecundity traits give more alleles but often come with extinction vulnerabilities (R-strategists are boom/bust).

### 3.3 Trait Costs and Prerequisites

Traits have two types of prerequisites:**HARD Prerequisites (Required)**

- Cannot purchase trait without these
- Marked with solid line on card
- Example: Flight REQUIRES Hollow Bones (can't fly without them)

**SOFT Prerequisites (Cost Reducers)**

- Make the trait cheaper but aren't required
- Marked with dashed line on card
- Example: Feathers make Flight -2 alleles cheaper (but aren't required - see bat wings)

| Situation | Effect ||-----------|--------|| Missing HARD prereq | Cannot purchase || Have all HARD prereqs | Can purchase at base cost || Have 1 SOFT prereq | -1 allele || Have 2+ SOFT prereqs | -2 alleles || Have all SOFT prereqs | -3 alleles |**Example - Flight (Cost: 6):**

- HARD: Hollow Bones (required for weight)
- SOFT: Feathers (-1), Warm-Blooded (-1), Keen Vision (-1)
- With just Hollow Bones: 6 alleles
- With Hollow Bones + Feathers + Warm-Blooded: 4 alleles
- Without Hollow Bones: Cannot purchase

---

## 4. Trait Card System

### 4.1 Card Anatomy

```javascript
+----------------------------------+
| ERA WINDOW: 3-8                  |
| (Devonian to Cretaceous)         |
+----------------------------------+
| TRAIT: Tetrapod Limbs            |
+----------------------------------+
| COST: 4 Alleles                  |
| PREREQS: Lungs, Lobed Fins       |
+----------------------------------+
| COMPLEXITY: +3                   |
| TAGS: [Terrestrial] [Mobile]     |
+----------------------------------+
| GRANTS: Claim land tiles         |
| COMPETITION: +2 vs aquatic       |
+----------------------------------+
| [Clade: Tetrapoda]               |
+----------------------------------+
```

**Card Back:** Colored by era (visible to opponents for strategic reads)

### 4.2 Era Windows (Min-Max)

Traits have historically accurate availability windows:| Trait | Min Era | Max Era | Scientific Reason ||-------|---------|---------|-------------------|| Trilobite Eyes | 0 | 5 | Extinct after Permian || Gills | 0 | 11 | Still exists || Feathers | 7 | 11 | First appear Jurassic || Flowering Symbiosis | 8 | 11 | Angiosperms in Cretaceous || Placental Birth | 8 | 11 | Modern mammals |

- **Below Min Era:** Cannot play (hasn't evolved yet)
- **Above Max Era:** Cannot play (trait lineage extinct)

### 4.3 Era Deck Composition

Each era deck contains 10 cards per player:

- 4-5 New traits (first appear this era)
- 3-4 Continuing traits (available from previous eras)
- 1-2 Rare/powerful traits

**Duplicates are fine** - represents multiple organisms evolving same trait (convergent evolution).

### 4.4 Keeping Old Cards

Players may retain unplayed cards between eras. This allows:

- Saving alleles for expensive traits
- Building toward multi-era combos
- Waiting for prerequisite traits

---

## 5. Personal Lineage Board

Each player has a board representing their organism's phylogenetic tree.

### 5.1 Board Layout

```javascript
+------------------------------------------+
|              YOUR LINEAGE                |
+------------------------------------------+
|                                          |
|  [Base Metazoan] ─┬─ [Trait 1]           |
|                   │                      |
|                   ├─ [Trait 2] ─ [Trait 4]|
|                   │                      |
|                   └─ [Trait 3]           |
|                                          |
+------------------------------------------+
| MARKERS: 12 total (track on tiles)       |
| ALLELES: ●●●●○○○○○○ (current currency)   |
+------------------------------------------+
| ACTIVE TAGS: [Aquatic] [Small] [Gills]   |
+------------------------------------------+
| FECUNDITY BONUS: +2/era (R-Strategy)     |
+------------------------------------------+
```

**Population = Markers on Board:** Your creature markers placed on hex tiles represent your population. Population is not tracked separately - count your markers.

### 5.2 Laying Traits

- Traits connect to show evolutionary relationships
- Some traits branch (alternative paths)
- Prerequisites must be visually connected
- All current tags are summed for extinction checks

---

## 6. Hexagonal Tile System (Simplified)

### 6.1 Tile Front

```javascript
      _____
     /     \
    / REEF  \
   /  ~~~~~~ \
  | Era: 1+   |
  | [d6: 5-6] |
   \         /
    \_______/
```



- **Biome Type:** Ocean, Reef, Coast, Swamp, Forest, Grassland, Desert, Mountain
- **Era Lock:** Minimum era this biome appears (printed on FRONT)
- **Flip Number:** Roll this or higher on d6 at era start to flip

### 6.2 Tile Flipping (Simplified)

At the start of each era:

1. Roll 1d6 for the tile grid
2. Any tile showing that number or higher AND meeting era requirements flips
3. New tile drawn from stack, placed same location
4. ~15-20% of tiles flip per era

**Era Lock on Front:** Players can see which tiles are stable vs volatile.

### 6.3 Tile Competition (Marker Creatures)

Competition is purely tile-based using creature markers.**Creature Markers:**

- Each player has a pool of creature markers (plastic tokens or meeples)
- Markers represent populations on specific tiles
- You can only place markers on tiles where your traits allow survival

**Placement Rules:**

1. During Evolution Phase, you may place/move markers to tiles
2. Must have relevant traits to occupy a biome (e.g., [Aquatic] for Ocean)
3. Multiple players can occupy the same tile

**Competition Resolution (per tile):**

1. Count each player's markers on the tile
2. Compare relevant trait tags to biome type
3. Winner = Most markers + Most matching tags (tags break ties)
4. Winner controls tile (gets allele bonus next era)
5. Ties: Split control (both get +0.5 rounded down)

**Example - Forest Tile:**

- Player A: 3 markers, has [Arboreal] [Terrestrial] (2 tags)
- Player B: 4 markers, has [Terrestrial] only (1 tag)
- Player B has more markers but Player A has more tags
- Tie-breaker: Tags win → Player A controls

**Displacement:**

- If you have 2+ more markers AND 2+ more relevant tags, you can displace opponent markers
- Displaced markers return to owner's supply (population loss)

---

## 7. Event Cards (One Per Era)

### 7.1 Predetermined Events

Each era has exactly ONE event card, revealed at era end.| Era | Event | Type ||-----|-------|------|| 0 | Great Oxygenation | Positive || 1 | End-Ordovician Ice Age | EXTINCTION || 2 | Ozone Layer Forms | Positive || 3 | Late Devonian Crisis | EXTINCTION || 4 | Carboniferous O2 Spike | Positive || 5 | The Great Dying | EXTINCTION (Hardest) || 6 | End-Triassic Volcanism | EXTINCTION || 7 | Pangaea Breakup | Neutral || 8 | K-Pg Asteroid Impact | EXTINCTION || 9 | Mammalian Radiation | Positive || 10 | Grassland Expansion | Neutral || 11 | Pleistocene Ice Ages | EXTINCTION |

### 7.2 Binary Extinction Resolution

**Resolution Order:**

1. Check SAFE tags → Survive
2. Check DOOMED tags → Lose half population
3. Neither → Roll d6, 4+ survives

**Example Card:**

```javascript
+----------------------------------+
| *** EXTINCTION EVENT ***         |
| K-PG ASTEROID IMPACT             |
+----------------------------------+
| SAFE (survive automatically):    |
|   [Burrowing] [Small] [Aquatic]  |
|   [Nocturnal] [Avian]            |
|                                  |
| DOOMED (lose half population):   |
|   [Large] [Terrestrial-Only]     |
|   [Dinosauria] (non-avian)       |
|                                  |
| NEUTRAL: Roll d6, need 4+        |
+----------------------------------+
```

---

## 8. Central Era Board

### 8.1 Board Layout

```javascript
+----------------------------------------------------------+
|                    PHANEROZOIC EON                        |
|                   540 MYA → Present                       |
+----------------------------------------------------------+
|                                                          |
| ERA 0: CAMBRIAN              EVENT: [Oxygenation Card]   |
| "Explosion of animal body    +-----------------------+   |
|  plans - eyes, shells,       |                       |   |
|  bilateral symmetry appear"  |    (event card slot)  |   |
|                              |                       |   |
| First: Trilobites, Anomalo-  +-----------------------+   |
|        caris, Hallucigenia                               |
|                                                          |
+----------------------------------------------------------+
| ERA 1: ORDOVICIAN            EVENT: [Extinction Card]    |
| "Marine life diversifies,    +-----------------------+   |
|  first land plants,          |                       |   |
|  massive ice age ends era"   |    (event card slot)  |   |
|                              |                       |   |
| First: Jawless fish,         +-----------------------+   |
|        early coral reefs                                 |
+----------------------------------------------------------+
| ... (continues for all 12 eras) ...                      |
+----------------------------------------------------------+
```



### 8.2 Scientific Facts on Board

Each era section includes:

- Accurate date range
- Key evolutionary innovations
- Notable first appearances
- Climate/atmosphere conditions
- Mass extinction data (if applicable)

---

## 9. Strategic Depth

### 9.1 Reading Opponent Deck Colors

Card backs are color-coded by era. When opponents draw:

- Lots of Jurassic (red) cards? Probably building toward flight
- Hoarding Carboniferous (dark green)? Insect or amphibian strategy
- This creates bluffing and counter-play opportunities

### 9.2 Multi-Era Planning

Traits have prerequisites and era windows. Strategic players must:

- Draft prerequisite traits early
- Save cards across eras for combos
- Time expensive traits with high allele rolls
- Position on tiles before biome shifts

### 9.3 Risk vs Stability

| Strategy | Risk | Reward ||----------|------|--------|| Specialize for one biome | Tile flip = disaster | Dominate while stable || Stay generalist | Slow trait accumulation | Survive anything || Chase complexity | Extinction vulnerable | High endgame score || Crocodile strategy | Low complexity score | Maximum survival |---

## 10. Victory Scoring

```javascript
FINAL SCORE = Population x Complexity + Tile Bonus

Population = Current creature markers on board
Complexity = Sum of trait complexity values  
Tile Bonus = 3 points per controlled tile at game end
```

**Rationale:** Everyone experiences the same extinctions, so survival bonus doesn't differentiate. Instead, reward:

- **Population:** How many creatures you have left (marker count)
- **Complexity:** How evolved your lineage is (trait depth)
- **Territory:** How much of the world you control (tiles)

**Alternative Scoring Variants:***Purist Mode:* `Score = Population x Complexity` (no tile bonus)*Dominance Mode:* `Score = (Population + Tiles x 5) x Complexity`*Living Fossil Mode:* Bonus points for traits unchanged for 3+ eras (crocodile strategy)---

## 11. Companion Book

A separate booklet explaining the science behind every rule:

### Contents

1. Why era windows exist (fossil record data)
2. Why these specific extinctions (paleontological evidence)
3. Why traits have these prerequisites (actual evolutionary relationships)
4. Why alleles work this way (population genetics basics)
5. Why tile biomes change (plate tectonics, climate science)
6. Organism profiles for all trait combinations
7. Further reading and citations

---

## 12. File Structure

```javascript
damn_nature_you_scary/
├── docs/
│   ├── RULEBOOK.md
│   ├── COMPANION_BOOK.md        # Scientific explanations
│   └── QUICK_REFERENCE.md
├── data/
│   ├── traits.json              # With min/max era windows
│   ├── events.json
│   ├── tiles.json
│   ├── organisms.json
│   └── phylogeny.json
├── assets/
│   ├── cards/
│   │   ├── trait_template.svg
│   │   └── era_deck_backs/      # 12 colored backs
│   ├── tiles/
│   │   └── hex_template.svg
│   └── boards/
│       ├── lineage_board.svg    # Personal player board
│       └── era_board.svg        # Central board with facts
├── tools/
│   ├── card_generator.py
│   ├── organism_matcher.py
│   └── balance_simulator.py
└── CLAUDE.md
```

---

## 13. Implementation Phases

### Phase 1: Core Data

- Trait list with era windows, prerequisites, costs, tags
- Event cards with SAFE/DOOMED tags
- Phylogeny structure

### Phase 2: Board Design

- Personal lineage board layout
- Central era board with scientific facts
- Hexagonal tile set

### Phase 3: Era Decks

- 12 color-coded decks (10 cards per player each)
- Card templates with all required fields

### Phase 4: Companion Book

- Scientific explanations for all mechanics