// Player class for Damn Nature You Scary

import { PLAYER_COLORS } from './utils.js';

export class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.color = PLAYER_COLORS[id];
        
        // Game state
        this.traits = [];           // Array of trait IDs acquired
        this.traitsByEra = {};      // { era: [traitIds] } for lineage board
        this.hand = [];             // Array of trait objects in hand
        this.alleles = 0;
        this.markers = 6;           // Start with 6 markers (3 pre-placed, 3 available)
        this.markersOnBoard = 0;    // Markers placed on tiles
        this.tilesControlled = 0;
        this.extinctionsSurvived = 0;
    }
    
    getTags(traitDb) {
        const tags = new Set();
        for (const traitId of this.traits) {
            const trait = traitDb[traitId];
            if (trait && trait.tags) {
                trait.tags.forEach(tag => tags.add(tag));
            }
        }
        return tags;
    }
    
    getComplexity(traitDb) {
        return this.traits.reduce((sum, traitId) => {
            const trait = traitDb[traitId];
            return sum + (trait ? trait.complexity : 0);
        }, 0);
    }
    
    getFecundityBonus(traitDb) {
        return this.traits.reduce((sum, traitId) => {
            const trait = traitDb[traitId];
            return sum + (trait ? trait.fecundity_bonus : 0);
        }, 0);
    }
    
    canAcquireTrait(trait, currentEra, traitDb = {}) {
        // Check era window
        if (currentEra < trait.era_min || currentEra > trait.era_max) {
            return { canAcquire: false, reason: `Era ${currentEra} outside window (${trait.era_min}-${trait.era_max})` };
        }
        
        // Check hard prerequisites
        for (const prereqId of trait.hard_prereqs) {
            if (!this.traits.includes(prereqId)) {
                return { canAcquire: false, reason: `Missing prerequisite: ${prereqId}` };
            }
        }
        
        // Check trait incompatibilities
        for (const incompatId of (trait.incompatible_with || [])) {
            if (this.traits.includes(incompatId)) {
                const blocker = traitDb[incompatId];
                return { canAcquire: false, reason: `Incompatible with ${blocker?.name || incompatId}` };
            }
        }
        
        // Check if already owned
        if (this.traits.includes(trait.id)) {
            return { canAcquire: false, reason: 'Already acquired' };
        }
        
        return { canAcquire: true, reason: null };
    }
    
    getTraitCost(trait) {
        // Count soft prerequisites met
        const softCount = trait.soft_prereqs.filter(p => this.traits.includes(p)).length;
        const discount = Math.min(softCount, 3);
        return Math.max(0, trait.cost - discount);
    }
    
    acquireTrait(trait, currentEra) {
        const cost = this.getTraitCost(trait);
        if (this.alleles < cost) {
            return false;
        }
        
        this.alleles -= cost;
        this.traits.push(trait.id);
        
        // Track by era for lineage board
        if (!this.traitsByEra[currentEra]) {
            this.traitsByEra[currentEra] = [];
        }
        this.traitsByEra[currentEra].push(trait.id);
        
        // Remove from hand
        const handIndex = this.hand.findIndex(h => h.id === trait.id);
        if (handIndex >= 0) {
            this.hand.splice(handIndex, 1);
        }
        
        return true;
    }
    
    addToHand(trait) {
        this.hand.push(trait);
    }
    
    getPopulationTier() {
        const total = this.markersOnBoard;
        if (total >= 10) return 3;
        if (total >= 7) return 2;
        if (total >= 4) return 1;
        return 0;
    }
    
    calculateScore(traitDb) {
        const complexity = this.getComplexity(traitDb);
        const tileBonus = this.tilesControlled * 3;
        return this.markersOnBoard * complexity + tileBonus;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            traits: this.traits,
            traitsByEra: this.traitsByEra,
            hand: this.hand.map(t => t.id),
            alleles: this.alleles,
            markers: this.markers,
            markersOnBoard: this.markersOnBoard,
            tilesControlled: this.tilesControlled,
            extinctionsSurvived: this.extinctionsSurvived
        };
    }
    
    static fromJSON(data, traitDb) {
        const player = new Player(data.id, data.name);
        player.traits = data.traits;
        player.traitsByEra = data.traitsByEra;
        player.hand = data.hand.map(id => traitDb[id]).filter(Boolean);
        player.alleles = data.alleles;
        player.markers = data.markers;
        player.markersOnBoard = data.markersOnBoard;
        player.tilesControlled = data.tilesControlled;
        player.extinctionsSurvived = data.extinctionsSurvived;
        return player;
    }
}

