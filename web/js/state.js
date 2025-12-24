// GameState - Central game state management

import { Player } from './player.js';
import { shuffle, ERA_NAMES } from './utils.js';

export const PHASES = {
    ALLELE_ROLL: 'allele_roll',
    DRAW: 'draw',
    EVOLUTION: 'evolution',
    POPULATE: 'populate',
    COMPETITION: 'competition',
    TILE_FLIP: 'tile_flip',
    EVENT: 'event'
};

export const PHASE_NAMES = {
    [PHASES.ALLELE_ROLL]: 'Phase 1: Reproductive Cycle',
    [PHASES.DRAW]: 'Phase 2: Genetic Drift',
    [PHASES.EVOLUTION]: 'Phase 3: Natural Selection',
    [PHASES.POPULATE]: 'Phase 4: Population Expansion',
    [PHASES.COMPETITION]: 'Phase 5: Competition',
    [PHASES.TILE_FLIP]: 'Phase 6: Environmental Shift',
    [PHASES.EVENT]: 'Phase 7: Extinction Event'
};

export const PHASE_HINTS = {
    [PHASES.ALLELE_ROLL]: 'Roll dice to generate genetic currency for this era',
    [PHASES.DRAW]: 'Cards are dealt from the era deck',
    [PHASES.EVOLUTION]: 'Spend alleles to acquire traits from your hand',
    [PHASES.POPULATE]: 'Click tiles to place markers - expand your territory',
    [PHASES.COMPETITION]: 'Tile control is resolved based on markers and tags',
    [PHASES.TILE_FLIP]: 'Environmental changes may alter biomes',
    [PHASES.EVENT]: "Resolve the era's extinction or climate event"
};

export class GameState {
    constructor() {
        // Game data (loaded from JSON)
        this.traitsData = null;
        this.eventsData = null;
        this.tilesData = null;
        this.organismsData = null;
        
        // Trait lookup by ID
        this.traitDb = {};
        
        // Game state
        this.players = [];
        this.currentEra = 0;
        this.currentPhase = PHASES.ALLELE_ROLL;
        this.currentPlayerIndex = 0;
        this.turnOrder = [];
        
        // Decks and pools
        this.eventDeck = [];        // Shuffled events
        this.currentEraDeck = [];   // Current era's trait cards
        this.discardedEvents = [];
        
        // Board state
        this.boardTiles = [];       // Hex tiles on the board
        this.tileMarkers = {};      // { tileId: { playerId: count } }
        
        // Flags
        this.gameStarted = false;
        this.gameEnded = false;
        this.allPlayersRolled = false;
    }
    
    async loadGameData() {
        const basePath = './data/';
        
        const [traits, events, tiles, organisms] = await Promise.all([
            fetch(basePath + 'traits.json').then(r => r.json()),
            fetch(basePath + 'events.json').then(r => r.json()),
            fetch(basePath + 'tiles.json').then(r => r.json()),
            fetch(basePath + 'organisms.json').then(r => r.json())
        ]);
        
        this.traitsData = traits;
        this.eventsData = events;
        this.tilesData = tiles;
        this.organismsData = organisms;
        
        // Build trait lookup
        for (const trait of traits.traits) {
            this.traitDb[trait.id] = trait;
        }
        
        return true;
    }
    
    initializeGame(playerNames) {
        // Create players
        this.players = playerNames.map((name, i) => new Player(i, name));
        
        // Give each player starting trait
        for (const player of this.players) {
            player.traits = ['bilateral_symmetry'];
            player.traitsByEra = { 0: ['bilateral_symmetry'] };
        }
        
        // Shuffle event deck
        this.eventDeck = shuffle([...this.eventsData.events]);
        
        // Set up turn order
        this.turnOrder = this.players.map(p => p.id);
        
        // Initialize board with starting tiles
        this.initializeBoard();
        
        this.gameStarted = true;
        this.currentEra = 0;
        this.currentPhase = PHASES.ALLELE_ROLL;
        this.currentPlayerIndex = 0;
    }
    
    initializeBoard() {
        // Create rectangular hex grid with climate bands
        // 10 columns x 11 rows = 110 hexes organized by latitude
        const COLS = 10;
        const ROWS = 11;
        
        // Climate bands by row (symmetric around equator at row 5)
        const getClimateBand = (row) => {
            if (row === 0 || row === 10) return 'polar';
            if (row === 1 || row === 2 || row === 8 || row === 9) return 'temperate';
            if (row === 3 || row === 4 || row === 6 || row === 7) return 'tropical';
            return 'equatorial'; // row 5
        };
        
        // Biome pools per climate band
        const biomePools = {
            polar: ['ice', 'mountain', 'mountain'],
            temperate: ['forest', 'grassland', 'desert', 'mountain', 'forest', 'grassland'],
            tropical: ['swamp', 'forest', 'coast', 'freshwater', 'swamp', 'forest'],
            equatorial: ['shallow_marine', 'reef', 'ocean', 'shallow_marine', 'reef', 'ocean', 'coast']
        };
        
        // Era locks by climate (polar unlocks late, equatorial available early)
        const eraLockRanges = {
            polar: [8, 11],      // Era 8-11
            temperate: [4, 8],   // Era 4-8
            tropical: [2, 5],    // Era 2-5
            equatorial: [0, 2]   // Era 0-2
        };
        
        const startingLayout = [];
        
        for (let row = 0; row < ROWS; row++) {
            const band = getClimateBand(row);
            const pool = biomePools[band];
            const [minEra, maxEra] = eraLockRanges[band];
            
            for (let col = 0; col < COLS; col++) {
                // Pick biome from pool (cycle through with some variation)
                const biomeIndex = (col + row) % pool.length;
                const biome = pool[biomeIndex];
                
                // Era lock within the band's range
                const eraLock = minEra + Math.floor(Math.random() * (maxEra - minEra + 1));
                
                startingLayout.push({
                    q: col,
                    r: row,
                    biome: biome,
                    climateBand: band,
                    eraLock: eraLock
                });
            }
        }
        
        this.boardTiles = startingLayout.map((tile, i) => ({
            id: `tile_${i}`,
            q: tile.q,
            r: tile.r,
            biome: tile.biome,
            biomeData: this.tilesData.biome_types[tile.biome],
            climateBand: tile.climateBand,
            flipNumber: Math.floor(Math.random() * 6) + 1,
            eraLock: tile.eraLock
        }));
        
        // Initialize markers tracking
        for (const tile of this.boardTiles) {
            this.tileMarkers[tile.id] = {};
        }
        
        // Place starting markers on equatorial marine tiles (row 5)
        const equatorialTiles = this.boardTiles.filter(t => 
            t.climateBand === 'equatorial' && 
            (t.biome === 'shallow_marine' || t.biome === 'ocean' || t.biome === 'reef')
        );
        
        for (const player of this.players) {
            // Distribute 3 markers across equatorial aquatic tiles
            for (let i = 0; i < 3; i++) {
                const tile = equatorialTiles[(player.id + i) % equatorialTiles.length];
                if (!this.tileMarkers[tile.id][player.id]) {
                    this.tileMarkers[tile.id][player.id] = 0;
                }
                this.tileMarkers[tile.id][player.id]++;
                player.markersOnBoard++;
            }
        }
    }
    
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }
    
    getNextEvent() {
        if (this.eventDeck.length === 0) return null;
        return this.eventDeck[0];
    }
    
    getNextEventType() {
        const next = this.getNextEvent();
        return next ? next.type : null;
    }
    
    drawEvent() {
        if (this.eventDeck.length === 0) return null;
        const event = this.eventDeck.shift();
        this.discardedEvents.push(event);
        return event;
    }
    
    getEraTraits(era) {
        // Get all traits available in this era
        return this.traitsData.traits.filter(t => 
            era >= t.era_min && era <= t.era_max
        );
    }
    
    dealEraDeck(era) {
        const eraTraits = this.getEraTraits(era);
        const deck = [];
        
        // Create deck with copies based on player count
        // Each trait appears once per every 2 players (rounded up)
        const copies = Math.ceil(this.players.length / 2);
        for (const trait of eraTraits) {
            for (let i = 0; i < copies; i++) {
                deck.push({ ...trait });
            }
        }
        
        return shuffle(deck);
    }
    
    advancePhase() {
        const phases = Object.values(PHASES);
        const currentIndex = phases.indexOf(this.currentPhase);
        
        if (currentIndex === phases.length - 1) {
            // End of era
            return this.advanceEra();
        }
        
        this.currentPhase = phases[currentIndex + 1];
        this.currentPlayerIndex = 0;
        return true;
    }
    
    advanceEra() {
        this.currentEra++;
        
        if (this.currentEra >= 12) {
            this.gameEnded = true;
            return false;
        }
        
        this.currentPhase = PHASES.ALLELE_ROLL;
        this.currentPlayerIndex = 0;
        this.allPlayersRolled = false;
        
        // Rotate turn order
        this.turnOrder.push(this.turnOrder.shift());
        
        return true;
    }
    
    advancePlayer() {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
            return false; // All players have acted
        }
        return true;
    }
    
    getEraName() {
        return ERA_NAMES[this.currentEra] || 'Unknown';
    }
    
    getPhaseName() {
        return PHASE_NAMES[this.currentPhase] || 'Unknown Phase';
    }
    
    // Calculate final scores
    getFinalScores() {
        return this.players.map(player => ({
            player,
            complexity: player.getComplexity(this.traitDb),
            markers: player.markersOnBoard,
            tiles: player.tilesControlled,
            score: player.calculateScore(this.traitDb)
        })).sort((a, b) => b.score - a.score);
    }
    
    // Find closest organism for a player
    findClosestOrganism(player) {
        const playerTags = player.getTags(this.traitDb);
        let bestMatch = null;
        let bestScore = -1;
        
        for (const org of this.organismsData.organisms) {
            const orgTags = new Set(org.tags);
            const intersection = [...playerTags].filter(t => orgTags.has(t)).length;
            const union = new Set([...playerTags, ...orgTags]).size;
            const similarity = union > 0 ? intersection / union : 0;
            
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = org;
            }
        }
        
        return { organism: bestMatch, similarity: bestScore };
    }
    
    // Serialization for save/load
    toJSON() {
        return {
            players: this.players.map(p => p.toJSON()),
            currentEra: this.currentEra,
            currentPhase: this.currentPhase,
            currentPlayerIndex: this.currentPlayerIndex,
            turnOrder: this.turnOrder,
            eventDeck: this.eventDeck.map(e => e.id),
            discardedEvents: this.discardedEvents.map(e => e.id),
            boardTiles: this.boardTiles,
            tileMarkers: this.tileMarkers,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded
        };
    }
    
    loadFromJSON(data) {
        this.currentEra = data.currentEra;
        this.currentPhase = data.currentPhase;
        this.currentPlayerIndex = data.currentPlayerIndex;
        this.turnOrder = data.turnOrder;
        this.boardTiles = data.boardTiles;
        this.tileMarkers = data.tileMarkers;
        this.gameStarted = data.gameStarted;
        this.gameEnded = data.gameEnded;
        
        // Reconstruct players
        this.players = data.players.map(p => Player.fromJSON(p, this.traitDb));
        
        // Reconstruct event deck
        const eventById = {};
        for (const e of this.eventsData.events) {
            eventById[e.id] = e;
        }
        this.eventDeck = data.eventDeck.map(id => eventById[id]).filter(Boolean);
        this.discardedEvents = data.discardedEvents.map(id => eventById[id]).filter(Boolean);
    }
}

