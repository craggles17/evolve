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
    [PHASES.ALLELE_ROLL]: 'Phase 1: Replication',
    [PHASES.DRAW]: 'Phase 2: Genetic Drift',
    [PHASES.EVOLUTION]: 'Phase 3: Natural Selection',
    [PHASES.POPULATE]: 'Phase 4: Dispersal',
    [PHASES.COMPETITION]: 'Phase 5: Niche Competition',
    [PHASES.TILE_FLIP]: 'Phase 6: Biome Turnover',
    [PHASES.EVENT]: 'Phase 7: Selection Pressure'
};

export const PHASE_HINTS = {
    [PHASES.ALLELE_ROLL]: 'Generate alleles through reproductive success',
    [PHASES.DRAW]: 'Random mutations enter the gene pool',
    [PHASES.EVOLUTION]: 'Spend alleles to acquire advantageous traits',
    [PHASES.POPULATE]: 'Expand your range - place markers on viable habitats',
    [PHASES.COMPETITION]: 'Contest tile control based on markers and adaptation',
    [PHASES.TILE_FLIP]: 'Habitats transform as environments change',
    [PHASES.EVENT]: 'Resolve environmental pressures - extinction or opportunity'
};

export const GAME_MODES = {
    LOCAL: 'local',
    HOST: 'host',
    CLIENT: 'client',
    SOLO: 'solo'
};

export const DIFFICULTY = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    BRUTAL: 'brutal'
};

export const DIFFICULTY_SETTINGS = {
    [DIFFICULTY.EASY]: { 
        alleleRetention: Infinity, 
        label: 'Easy', 
        desc: 'Keep all alleles',
        rivalSpawnRate: 0.5,
        rivalSpreadRate: 0.2,
        rivalCap: 15,
        rivalEraBonus: false
    },
    [DIFFICULTY.NORMAL]: { 
        alleleRetention: 10, 
        label: 'Normal', 
        desc: 'Keep up to 10',
        rivalSpawnRate: 0.75,
        rivalSpreadRate: 0.3,
        rivalCap: 25,
        rivalEraBonus: true
    },
    [DIFFICULTY.HARD]: { 
        alleleRetention: 5, 
        label: 'Hard', 
        desc: 'Keep up to 5',
        rivalSpawnRate: 1.0,
        rivalSpreadRate: 0.4,
        rivalCap: 40,
        rivalEraBonus: true
    },
    [DIFFICULTY.BRUTAL]: { 
        alleleRetention: 0, 
        label: 'Brutal', 
        desc: 'Lose all',
        rivalSpawnRate: 1.2,
        rivalSpreadRate: 0.5,
        rivalCap: 60,
        rivalEraBonus: true
    }
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
        
        // Game mode
        this.gameMode = GAME_MODES.LOCAL;
        
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
        
        // Solo mode: rival organisms
        this.rivalMarkers = {};     // { tileId: count } - AI-controlled rival markers
        this.totalRivals = 0;       // Track total rival markers on board
        
        // Flags
        this.gameStarted = false;
        this.gameEnded = false;
        this.allPlayersRolled = false;
        this.soloExtinct = false;   // True if player went extinct in solo mode
        
        // Hand limit (experimental - disabled by default)
        this.handLimitEnabled = false;
        this.handLimit = 10;
        
        // Allele decay (experimental - disabled by default)
        this.alleleDecayEnabled = false;
        this.difficulty = DIFFICULTY.NORMAL;
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
        
        // Players start with no traits - must draft from Era 0 deck
        for (const player of this.players) {
            player.traits = [];
            player.traitsByEra = {};
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
    
    initializeSoloGame(playerName) {
        this.gameMode = GAME_MODES.SOLO;
        
        // Create single player
        this.players = [new Player(0, playerName)];
        this.players[0].traits = [];
        this.players[0].traitsByEra = {};
        
        // Shuffle event deck
        this.eventDeck = shuffle([...this.eventsData.events]);
        
        // Turn order is just the solo player
        this.turnOrder = [0];
        
        // Initialize board
        this.initializeBoard();
        
        // Initialize rival markers tracking
        this.rivalMarkers = {};
        for (const tile of this.boardTiles) {
            this.rivalMarkers[tile.id] = 0;
        }
        
        // Spawn initial rival organisms (2-3 in early marine tiles)
        this.spawnInitialRivals();
        
        this.gameStarted = true;
        this.currentEra = 0;
        this.currentPhase = PHASES.ALLELE_ROLL;
        this.currentPlayerIndex = 0;
        this.soloExtinct = false;
    }
    
    spawnInitialRivals() {
        // Spawn 2-3 rival markers on equatorial marine tiles (same area as player starts)
        const equatorialMarineTiles = this.boardTiles.filter(t =>
            t.climateBand === 'equatorial' &&
            (t.biome === 'shallow_marine' || t.biome === 'ocean' || t.biome === 'reef')
        );
        
        // Pick tiles that don't have player markers
        const availableTiles = equatorialMarineTiles.filter(t => {
            const playerMarkers = this.tileMarkers[t.id][0] || 0;
            return playerMarkers === 0;
        });
        
        const initialRivalCount = 2 + Math.floor(Math.random() * 2); // 2-3 rivals
        for (let i = 0; i < initialRivalCount && i < availableTiles.length; i++) {
            const tile = availableTiles[i];
            this.rivalMarkers[tile.id] = 1;
            this.totalRivals++;
        }
    }
    
    isSoloMode() {
        return this.gameMode === GAME_MODES.SOLO;
    }
    
    checkSoloExtinction() {
        if (!this.isSoloMode()) return false;
        
        const player = this.players[0];
        if (player.markersOnBoard <= 0) {
            this.soloExtinct = true;
            this.gameEnded = true;
            return true;
        }
        return false;
    }
    
    initializeBoard() {
        // Load pre-designed tiles from tiles.json (7 rows x 10 cols = 70 tiles)
        this.boardTiles = this.tilesData.tiles.map(tile => ({
            id: `tile_${tile.id}`,
            q: tile.col,
            r: tile.row,
            biome: tile.biome,
            biomeData: this.tilesData.biome_types[tile.biome],
            climateBand: tile.climate_zone,
            flipNumber: tile.flip_number,
            eraLock: tile.era_lock,
            stable: tile.stable
        }));
        
        // Initialize markers tracking
        for (const tile of this.boardTiles) {
            this.tileMarkers[tile.id] = {};
        }
        
        // Place starting markers on equatorial marine tiles (row 3)
        const equatorialTiles = this.boardTiles.filter(t => 
            t.climateBand === 'equatorial' && 
            (t.biome === 'shallow_marine' || t.biome === 'ocean' || t.biome === 'reef')
        );
        
        // Randomly select 2-3 tiles as starting cluster to maximize early competition
        const shuffled = [...equatorialTiles].sort(() => Math.random() - 0.5);
        const clusterSize = 2 + Math.floor(Math.random() * 2); // 2 or 3 tiles
        const startingTiles = shuffled.slice(0, clusterSize);
        
        for (const player of this.players) {
            // Place 3 markers randomly across the clustered starting tiles
            for (let i = 0; i < 3; i++) {
                const tile = startingTiles[Math.floor(Math.random() * startingTiles.length)];
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
        
        // Check for solo extinction before advancing
        if (this.isSoloMode() && this.checkSoloExtinction()) {
            return false;
        }
        
        if (this.currentEra >= 12) {
            this.gameEnded = true;
            return false;
        }
        
        this.currentPhase = PHASES.ALLELE_ROLL;
        this.currentPlayerIndex = 0;
        this.allPlayersRolled = false;
        
        // Rotate turn order (skip in solo mode - only one player)
        if (!this.isSoloMode()) {
            this.turnOrder.push(this.turnOrder.shift());
        }
        
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
    
    // Calculate final scores with comprehensive stats
    getFinalScores() {
        return this.players.map(player => {
            const genomeLength = player.getGenomeLength(this.traitDb);
            const codingDNA = player.getCodingDNA(this.traitDb);
            const teBloat = player.teBloat;
            const tePercent = genomeLength > 0 ? Math.round((teBloat / genomeLength) * 100) : 0;
            
            return {
                player,
                complexity: player.getComplexity(this.traitDb),
                markers: player.markersOnBoard,
                tiles: player.tilesControlled,
                score: player.calculateScore(this.traitDb),
                // Extended stats
                traitCount: player.traits.length,
                genomeLength,
                codingDNA,
                teBloat,
                tePercent,
                extinctionsSurvived: player.extinctionsSurvived,
                tags: [...player.getTags(this.traitDb)]
            };
        }).sort((a, b) => b.score - a.score);
    }
    
    // Find closest organism for a player
    findClosestOrganism(player) {
        const playerTags = player.getTags(this.traitDb);
        let bestMatch = null;
        let bestScore = -1;
        let bestSharedTraits = [];
        
        for (const org of this.organismsData.organisms) {
            const orgTags = new Set(org.traits);
            const shared = [...playerTags].filter(t => orgTags.has(t));
            const union = new Set([...playerTags, ...orgTags]).size;
            const similarity = union > 0 ? shared.length / union : 0;
            
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = org;
                bestSharedTraits = shared;
            }
        }
        
        return { 
            organism: bestMatch, 
            similarity: bestScore,
            sharedTraits: bestSharedTraits,
            playerTraitCount: playerTags.size
        };
    }
    
    // Serialization for save/load
    toJSON() {
        return {
            gameMode: this.gameMode,
            players: this.players.map(p => p.toJSON()),
            currentEra: this.currentEra,
            currentPhase: this.currentPhase,
            currentPlayerIndex: this.currentPlayerIndex,
            turnOrder: this.turnOrder,
            eventDeck: this.eventDeck.map(e => e.id),
            discardedEvents: this.discardedEvents.map(e => e.id),
            boardTiles: this.boardTiles,
            tileMarkers: this.tileMarkers,
            rivalMarkers: this.rivalMarkers,
            totalRivals: this.totalRivals,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded,
            soloExtinct: this.soloExtinct,
            handLimitEnabled: this.handLimitEnabled,
            handLimit: this.handLimit,
            alleleDecayEnabled: this.alleleDecayEnabled,
            difficulty: this.difficulty
        };
    }
    
    loadFromJSON(data) {
        this.gameMode = data.gameMode || GAME_MODES.LOCAL;
        this.currentEra = data.currentEra;
        this.currentPhase = data.currentPhase;
        this.currentPlayerIndex = data.currentPlayerIndex;
        this.turnOrder = data.turnOrder;
        this.boardTiles = data.boardTiles;
        this.tileMarkers = data.tileMarkers;
        this.rivalMarkers = data.rivalMarkers || {};
        this.totalRivals = data.totalRivals || 0;
        this.gameStarted = data.gameStarted;
        this.gameEnded = data.gameEnded;
        this.soloExtinct = data.soloExtinct || false;
        this.handLimitEnabled = data.handLimitEnabled || false;
        this.handLimit = data.handLimit || 10;
        this.alleleDecayEnabled = data.alleleDecayEnabled || false;
        this.difficulty = data.difficulty || DIFFICULTY.NORMAL;
        
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

