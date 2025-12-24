# Sanity Check Prompt for Damn Nature You Scary

Run a comprehensive validation of this evolution board game repository. Check all data files, cross-references, game balance, and scientific accuracy.

---

## Instructions

Read and analyze the following files systematically. Report any issues found with specific file paths, line numbers, and suggested fixes.

### Files to Examine

- `data/traits.json` - 63 trait definitions
- `data/events.json` - 28 event cards
- `data/era_decks.json` - 12 era deck compositions
- `data/tiles.json` - 70 hex tile definitions
- `data/phylogeny.json` - evolutionary tree structure
- `data/organisms.json` - organism matching database
- `docs/RULEBOOK.md` - game rules
- `docs/QUICK_REFERENCE.md` - player aid
- `web/js/*.js` - game engine code

---

## Validation Checklist

### 1. Data Structure Validation

For each JSON file, verify:

- [ ] File parses as valid JSON
- [ ] `meta.version` field exists
- [ ] All required fields present on each object

**traits.json required fields per trait:**
```
id, name, era_min, era_max, cost, complexity, tags[], 
hard_prereqs[], soft_prereqs[], grants, fecundity_bonus, clade, science
```

**events.json required fields per event:**
```
id, name, type (extinction|positive|neutral), description, effect,
safe_tags[], doomed_tags[], neutral_roll (number or null), science, real_examples[]
```

**tiles.json required fields per tile:**
```
id, biome, climate_zone, row, col, era_lock, flip_number, stable
```

---

### 2. Cross-Reference Integrity

**2a. Era Decks → Traits**
- [ ] Every `trait_id` in `era_decks.json` exists in `traits.json`
- [ ] No typos or missing trait references

**2b. Trait Prerequisites**
- [ ] Every ID in `hard_prereqs[]` exists as a trait
- [ ] Every ID in `soft_prereqs[]` exists as a trait
- [ ] Every ID in `incompatible_with[]` exists as a trait

**2c. Event Tags → Trait Tags**
For each event's `safe_tags` and `doomed_tags`:
- [ ] Verify each tag appears in at least one trait's `tags[]` array
- [ ] Flag any orphan tags that no trait grants

**2d. Tiles → Biome Types**
- [ ] Every tile's `biome` field matches a key in `biome_types`
- [ ] Every tile's `climate_zone` matches a key in `climate_zones`

**2e. Phylogeny → Traits**
- [ ] Every `required_traits[]` in phylogeny nodes exists in traits.json

---

### 3. Era Window Consistency

**3a. Trait Era Bounds**
- [ ] All `era_min` values are 0-11
- [ ] All `era_max` values are 0-11
- [ ] `era_min <= era_max` for every trait

**3b. Era Deck Composition**
For each era deck (0-11):
- [ ] Era number exists as a deck key
- [ ] Every trait in that deck has `era_min <= deck_era <= era_max`

**3c. Prerequisite Era Ordering**
For each trait with hard prerequisites:
- [ ] Prerequisite trait's `era_max >= this trait's era_min`
- [ ] It's possible to acquire prereqs before the dependent trait

**3d. Tile Era Locks**
- [ ] All `era_lock` values are 0-11
- [ ] Biomes that require late-game traits have appropriate era locks

---

### 4. Prerequisite Chain Validation

**4a. Circular Dependency Check**
- [ ] No trait can be its own prerequisite (direct or transitive)
- [ ] Build dependency graph and verify it's a DAG (directed acyclic graph)

**4b. Phylogenetic Consistency**
- [ ] Traits in phylogeny's `required_traits` form valid acquisition chains
- [ ] Era origins in phylogeny align with trait era windows

**4c. Incompatibility Symmetry**
- [ ] If trait A lists B in `incompatible_with`, verify B lists A (or flag asymmetry)

---

### 5. Game Balance Checks

**5a. Counts Match Documentation**
- [ ] traits.json contains exactly 63 traits
- [ ] events.json contains exactly 18 events
- [ ] tiles.json contains exactly 70 tiles
- [ ] era_decks.json defines all 12 eras (0-11)

**5b. Event Type Distribution**
- [ ] 7 events with `type: "extinction"`
- [ ] 6 events with `type: "positive"`
- [ ] 5 events with `type: "neutral"`

**5c. Trait Cost/Complexity Sanity**
- [ ] All costs are non-negative integers
- [ ] All complexity values are 0-6
- [ ] High-complexity traits (5-6) require significant prerequisites

**5d. Fecundity Balance**
- [ ] `fecundity_bonus` values are reasonable (-2 to +3)
- [ ] R-strategy and K-strategy traits have opposite signs

---

### 6. Scientific Plausibility

**6a. Era Naming**
Verify `era_decks.json` era names match standard geological periods:
```
0: Cambrian (540-485 MYA)
1: Ordovician (485-444 MYA)
2: Silurian (444-419 MYA)
3: Devonian (419-359 MYA)
4: Carboniferous (359-299 MYA)
5: Permian (299-252 MYA)
6: Triassic (252-201 MYA)
7: Jurassic (201-145 MYA)
8: Cretaceous (145-66 MYA)
9: Paleogene (66-23 MYA)
10: Neogene (23-2.6 MYA)
11: Quaternary (2.6-0 MYA)
```

**6b. Evolutionary Sequence**
- [ ] Bilateral symmetry available from era 0
- [ ] Jaws appear era 1+ (after vertebrates)
- [ ] Tetrapod limbs appear era 3+ (Devonian)
- [ ] Amniotic egg appears era 4+ (Carboniferous)
- [ ] Endothermy appears era 5+
- [ ] Flight appears era 7+ for birds
- [ ] Placental mammals appear era 8+

**6c. Extinction Event Accuracy**
- [ ] Ice Age safe tags include cold-resistant traits
- [ ] Asteroid impact safe tags include burrowing/small
- [ ] Ocean anoxia dooms marine-only organisms
- [ ] Real examples on each event are historically accurate

---

### 7. Rulebook Alignment

**7a. Rules vs Data**
- [ ] Scoring formula in RULEBOOK.md matches what code would calculate
- [ ] Phase descriptions match game engine logic
- [ ] Extinction resolution matches event card structure

**7b. Component Counts**
- [ ] Rulebook component list matches data file counts
- [ ] 12 era decks mentioned
- [ ] 28 event cards mentioned
- [ ] Hex tile counts align

---

### 8. Asset Verification

**8a. Generated Cards**
- [ ] `generated_cards/traits/` has one SVG per trait (63 files)
- [ ] `generated_cards/events/` has one SVG per event (18 files)
- [ ] `generated_cards/event_backs/` has 2 back designs

**8b. Templates**
- [ ] `assets/cards/trait_template.svg` exists
- [ ] `assets/cards/event_template.svg` exists
- [ ] `assets/cards/event_back_extinction.svg` exists
- [ ] `assets/cards/event_back_other.svg` exists
- [ ] `assets/boards/lineage_board.svg` exists
- [ ] `assets/boards/era_board.svg` exists

---

## Output Format

Report findings in this structure:

```markdown
## Validation Results

### PASSED
- [x] All JSON files parse correctly
- [x] 63 traits found (expected 63)
...

### WARNINGS (non-critical)
- `data/traits.json:45` - Tag "Tropical" in safe_tags but no trait grants it
...

### ERRORS (must fix)
- `data/era_decks.json:127` - trait_id "flght" not found (typo for "flight"?)
- `data/traits.json:89` - era_min (5) > era_max (3) for trait "example"
...

### SUGGESTIONS (optional improvements)
- Consider adding [Tropical] tag to a trait for Ice Age event relevance
...
```

---

## Quick Commands

To run specific checks only, use these section headers:

- `@sanity-check data` - JSON structure and cross-references only
- `@sanity-check balance` - Game balance checks only  
- `@sanity-check science` - Scientific accuracy only
- `@sanity-check assets` - File existence checks only
- `@sanity-check full` - Complete validation (default)
