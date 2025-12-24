// GameEngine - Handles game logic and phase progression

import { PHASES } from './state.js';
import { roll2D6, rollD6, getHexNeighbors } from './utils.js';

export class GameEngine {
    constructor(gameState, renderer) {
        this.state = gameState;
        this.renderer = renderer;
        this.callbacks = {};
    }
    
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }
    
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data));
        }
    }
    
    // Phase 1: Allele Roll
    rollAlleles(player) {
        const [die1, die2] = roll2D6();
        return this.rollAllelesWithValues(player, [die1, die2]);
    }
    
    // Roll with specific dice values (for multiplayer sync)
    rollAllelesWithValues(player, dice) {
        const [die1, die2] = dice;
        const base = die1 + die2;
        
        const popBonus = player.getPopulationTier();
        const tileBonus = player.tilesControlled;
        const fecundity = player.getFecundityBonus(this.state.traitDb);
        
        const total = base + popBonus + tileBonus + fecundity;
        player.alleles += total;
        
        return {
            dice: [die1, die2],
            base,
            popBonus,
            tileBonus,
            fecundity,
            total
        };
    }
    
    // Phase 2: Draw Cards
    dealCards() {
        const era = this.state.currentEra;
        const deck = this.state.dealEraDeck(era);
        
        let cardIndex = 0;
        while (cardIndex < deck.length) {
            for (const player of this.state.players) {
                if (cardIndex < deck.length) {
                    player.addToHand(deck[cardIndex]);
                    cardIndex++;
                }
            }
        }
        
        this.emit('cardsDealt', { era, cardsPerPlayer: Math.floor(deck.length / this.state.players.length) });
    }
    
    // Phase 3: Evolution - Buy a trait
    buyTrait(player, traitId) {
        const trait = this.state.traitDb[traitId];
        if (!trait) return { success: false, reason: 'Trait not found' };
        
        const { canAcquire, reason } = player.canAcquireTrait(trait, this.state.currentEra, this.state.traitDb);
        if (!canAcquire) return { success: false, reason };
        
        const cost = player.getTraitCost(trait);
        if (player.alleles < cost) {
            return { success: false, reason: `Not enough alleles (need ${cost}, have ${player.alleles})` };
        }
        
        // Handle dynamic specialization for niche_specialist
        let specialization = null;
        if (traitId === 'niche_specialist') {
            const specResult = this.applyEcologicalSpecialist(player);
            if (!specResult.success) return specResult;
            specialization = specResult.specialization;
        }
        
        const acquired = player.acquireTrait(trait, this.state.currentEra);
        if (acquired) {
            this.emit('traitAcquired', { player, trait, cost, specialization });
            return { success: true, cost, specialization };
        }
        
        return { success: false, reason: 'Failed to acquire trait' };
    }
    
    // Apply dynamic specialization when acquiring niche_specialist
    applyEcologicalSpecialist(player) {
        const occupiedTiles = this.getPlayerOccupiedTiles(player);
        if (occupiedTiles.length === 0) {
            return { success: false, reason: 'No occupied tiles to specialize in' };
        }
        
        // Pick a random occupied tile
        const tile = occupiedTiles[Math.floor(Math.random() * occupiedTiles.length)];
        const biome = tile.biome;
        const bonusTags = tile.biomeData.bonus_tags || [];
        
        if (bonusTags.length === 0) {
            // Biome has no bonus tags - still grant the specialization but no extra tag
            player.specializations.niche_specialist = { biome, tag: null };
            return { 
                success: true, 
                specialization: { biome, tag: null, biomeName: tile.biomeData.name }
            };
        }
        
        // Pick a random bonus tag from the biome
        const tag = bonusTags[Math.floor(Math.random() * bonusTags.length)];
        player.specializations.niche_specialist = { biome, tag };
        
        return { 
            success: true, 
            specialization: { biome, tag, biomeName: tile.biomeData.name }
        };
    }
    
    // Phase 4: Populate - Place markers
    placeMarker(player, tileId) {
        const tile = this.state.boardTiles.find(t => t.id === tileId);
        if (!tile) return { success: false, reason: 'Tile not found' };
        
        // Check if player can occupy this tile
        const playerTags = player.getTags(this.state.traitDb);
        const requiredTags = tile.biomeData.required_tags || [];
        
        for (const req of requiredTags) {
            if (!playerTags.has(req)) {
                return { success: false, reason: `Missing required tag: ${req}` };
            }
        }
        
        // Check adjacency to existing markers
        if (!this.isAdjacentToPlayerMarkers(player, tile)) {
            return { success: false, reason: 'Must place adjacent to existing creatures' };
        }
        
        // Check if player has available markers
        if (player.markersOnBoard >= player.markers) {
            return { success: false, reason: 'No markers available' };
        }
        
        // Place marker
        if (!this.state.tileMarkers[tileId][player.id]) {
            this.state.tileMarkers[tileId][player.id] = 0;
        }
        this.state.tileMarkers[tileId][player.id]++;
        player.markersOnBoard++;
        
        this.emit('markerPlaced', { player, tile });
        return { success: true };
    }
    
    // Phase 5: Competition - Resolve tile control with dice rolls
    resolveCompetition() {
        const results = [];
        
        for (const tile of this.state.boardTiles) {
            const markers = this.state.tileMarkers[tile.id];
            const competitors = Object.entries(markers).filter(([_, count]) => count > 0);
            
            if (competitors.length <= 1) {
                // Single or no controller - no contest
                if (competitors.length === 1) {
                    const [playerId, _] = competitors[0];
                    const player = this.state.players[parseInt(playerId)];
                    if (player) player.tilesControlled++;
                }
                continue;
            }
            
            // Contested tile - roll dice and calculate strength for each player
            const strengths = competitors.map(([playerId, count]) => {
                const player = this.state.players[parseInt(playerId)];
                const tags = player.getTags(this.state.traitDb);
                const bonusTags = tile.biomeData.bonus_tags || [];
                const tagBonus = bonusTags.filter(t => tags.has(t)).length;
                const diceRoll = rollD6();
                
                // Check for ecological specialist bonus
                let specializationBonus = 0;
                const spec = player.specializations?.niche_specialist;
                if (spec && tile.biome === spec.biome) {
                    specializationBonus = 3;
                }
                
                return {
                    player,
                    playerId: parseInt(playerId),
                    markers: count,
                    tagBonus,
                    specializationBonus,
                    diceRoll,
                    total: count + tagBonus + specializationBonus + diceRoll
                };
            }).sort((a, b) => b.total - a.total);
            
            // Winner takes control
            const winner = strengths[0];
            winner.player.tilesControlled++;
            
            // Build result for this contested tile
            const tileResult = {
                tile,
                contested: true,
                combatants: strengths.map(s => ({
                    player: s.player,
                    playerId: s.playerId,
                    markers: s.markers,
                    tagBonus: s.tagBonus,
                    specializationBonus: s.specializationBonus,
                    diceRoll: s.diceRoll,
                    total: s.total
                })),
                winner: winner.player,
                displaced: null
            };
            
            // Check for displacement - loser with significantly lower strength loses markers
            if (strengths.length > 1) {
                const second = strengths[1];
                const totalDiff = winner.total - second.total;
                
                // Displacement occurs when winner beats loser by 3+ points
                if (totalDiff >= 3) {
                    const displacedCount = this.state.tileMarkers[tile.id][second.player.id];
                    this.state.tileMarkers[tile.id][second.player.id] = 0;
                    second.player.markersOnBoard -= displacedCount;
                    
                    tileResult.displaced = {
                        player: second.player,
                        playerId: second.playerId,
                        count: displacedCount
                    };
                }
            }
            
            results.push(tileResult);
        }
        
        this.emit('competitionResolved', { results });
        return results;
    }
    
    // Phase 6: Tile Flip
    flipTiles() {
        const roll = rollD6();
        const flipped = [];
        
        for (const tile of this.state.boardTiles) {
        if (roll >= tile.flipNumber && this.state.currentEra >= tile.eraLock) {
            // Use ecological transitions for realistic biome changes
            const transitions = this.state.tilesData.flip_transitions?.[tile.biome];
            const allTransitions = transitions || Object.keys(this.state.tilesData.biome_types);
            
            // Filter transitions by climate zone (map 'tropical' to 'temperate')
            const climateZone = tile.climateBand === 'tropical' ? 'temperate' : tile.climateBand;
            const validTransitions = allTransitions.filter(biome => {
                const biomeData = this.state.tilesData.biome_types[biome];
                return biomeData && biomeData.climate_zones && biomeData.climate_zones.includes(climateZone);
            });
            
            // Fallback to original biome if no valid transitions
            const newBiome = validTransitions.length > 0
                ? validTransitions[Math.floor(Math.random() * validTransitions.length)]
                : tile.biome;
                
                const oldBiome = tile.biome;
                tile.biome = newBiome;
                tile.biomeData = this.state.tilesData.biome_types[newBiome];
                tile.flipNumber = rollD6();
                tile.eraLock = this.state.currentEra + Math.floor(Math.random() * 3);
                
                flipped.push({ tile, oldBiome, newBiome });
                
                // Check if markers are still valid
                const markers = this.state.tileMarkers[tile.id];
                const requiredTags = tile.biomeData.required_tags || [];
                
                for (const [playerId, count] of Object.entries(markers)) {
                    if (count > 0) {
                        const player = this.state.players[parseInt(playerId)];
                        const tags = player.getTags(this.state.traitDb);
                        const canStay = requiredTags.every(t => tags.has(t));
                        
                        if (!canStay) {
                            // Markers are displaced
                            this.state.tileMarkers[tile.id][playerId] = 0;
                            player.markersOnBoard -= count;
                        }
                    }
                }
            }
        }
        
        this.emit('tilesFlipped', { roll, flipped });
        return { roll, flipped };
    }
    
    // Phase 7: Event Resolution
    resolveEvent(event) {
        const results = [];
        
        if (event.type === 'extinction') {
            for (const player of this.state.players) {
                const result = this.resolveExtinction(player, event);
                results.push(result);
            }
        } else if (event.type === 'positive') {
            // Apply positive effects
            for (const player of this.state.players) {
                results.push({
                    player,
                    status: 'benefited',
                    message: event.effect,
                    lostMarkers: 0
                });
            }
        } else if (event.type === 'neutral') {
            // Dispatch neutral events by ID
            if (event.id === 'continental_drift') {
                return this.resolveContinentalDrift(event);
            }
            // Fallback for unimplemented neutral events
            for (const player of this.state.players) {
                results.push({
                    player,
                    status: 'neutral',
                    message: event.effect,
                    lostMarkers: 0
                });
            }
        } else {
            // Unknown event type fallback
            for (const player of this.state.players) {
                results.push({
                    player,
                    status: 'neutral',
                    message: event.effect,
                    lostMarkers: 0
                });
            }
        }
        
        this.emit('eventResolved', { event, results });
        return results;
    }
    
    // Continental Drift: shuffle 3 adjacent tiles, move 2 markers per player
    resolveContinentalDrift(event) {
        const results = [];
        const shuffledTiles = [];
        
        // Pick 3 adjacent tiles to shuffle
        const selected = this.pickAdjacentTiles(3);
        if (selected.length < 3) {
            // Fallback: not enough adjacent tiles, skip the shuffle
            for (const player of this.state.players) {
                results.push({
                    player,
                    status: 'neutral',
                    message: 'Continental drift had no effect.',
                    lostMarkers: 0
                });
            }
            return results;
        }
        
        // Rotate biomes cyclically: A->B, B->C, C->A
        if (selected.length === 3) {
            const biomes = selected.map(t => ({ biome: t.biome, biomeData: t.biomeData }));
            selected[0].biome = biomes[2].biome;
            selected[0].biomeData = biomes[2].biomeData;
            selected[1].biome = biomes[0].biome;
            selected[1].biomeData = biomes[0].biomeData;
            selected[2].biome = biomes[1].biome;
            selected[2].biomeData = biomes[1].biomeData;
            
            shuffledTiles.push(
                { tile: selected[0], oldBiome: biomes[0].biome, newBiome: biomes[2].biome },
                { tile: selected[1], oldBiome: biomes[1].biome, newBiome: biomes[0].biome },
                { tile: selected[2], oldBiome: biomes[2].biome, newBiome: biomes[1].biome }
            );
        }
        
        // Check if markers on shuffled tiles can stay
        for (const { tile } of shuffledTiles) {
            const markers = this.state.tileMarkers[tile.id];
            const requiredTags = tile.biomeData.required_tags || [];
            
            for (const [playerId, count] of Object.entries(markers)) {
                if (count > 0) {
                    const player = this.state.players[parseInt(playerId)];
                    const tags = player.getTags(this.state.traitDb);
                    const canStay = requiredTags.every(t => tags.has(t));
                    
                    if (!canStay) {
                        this.state.tileMarkers[tile.id][playerId] = 0;
                        player.markersOnBoard -= count;
                    }
                }
            }
        }
        
        // Auto-relocate up to 2 markers per player
        for (const player of this.state.players) {
            let moved = 0;
            const tags = player.getTags(this.state.traitDb);
            
            for (const tile of this.state.boardTiles) {
                if (moved >= 2) break;
                
                const markerCount = this.state.tileMarkers[tile.id][player.id] || 0;
                if (markerCount === 0) continue;
                
                // Find valid adjacent tile to move to
                const neighbors = getHexNeighbors(tile.q, tile.r);
                for (const n of neighbors) {
                    if (moved >= 2) break;
                    
                    const destTile = this.state.boardTiles.find(t => t.q === n.q && t.r === n.r);
                    if (!destTile) continue;
                    
                    const destReqs = destTile.biomeData.required_tags || [];
                    const canMove = destReqs.every(t => tags.has(t));
                    
                    if (canMove) {
                        // Move one marker
                        this.state.tileMarkers[tile.id][player.id]--;
                        if (!this.state.tileMarkers[destTile.id][player.id]) {
                            this.state.tileMarkers[destTile.id][player.id] = 0;
                        }
                        this.state.tileMarkers[destTile.id][player.id]++;
                        moved++;
                    }
                }
            }
            
            const tileNames = shuffledTiles.map(s => `${s.oldBiome}→${s.newBiome}`).join(', ');
            results.push({
                player,
                status: 'neutral',
                message: `Tiles shifted: ${tileNames}. Moved ${moved} marker${moved !== 1 ? 's' : ''}.`,
                lostMarkers: 0
            });
        }
        
        this.emit('eventResolved', { event: { id: 'continental_drift', type: 'neutral' }, results });
        return results;
    }
    
    resolveExtinction(player, event) {
        const playerTags = player.getTags(this.state.traitDb);
        const eventSafeTags = new Set(event.safe_tags || []);
        const doomedTags = new Set(event.doomed_tags || []);
        
        // Player's safe tags = intersection of player tags and event safe tags
        const playerSafeTags = new Set([...playerTags].filter(t => eventSafeTags.has(t)));
        
        const tileResults = [];
        let totalLost = 0;
        const neutralTiles = [];
        
        // Per-tile evaluation
        for (const tile of this.state.boardTiles) {
            const markerCount = this.state.tileMarkers[tile.id][player.id] || 0;
            if (markerCount === 0) continue;
            
            const tileTags = tile.biomeData.bonus_tags || [];
            const isDoomed = tileTags.some(t => doomedTags.has(t));
            const isSaved = tileTags.some(t => playerSafeTags.has(t));
            
            if (isDoomed && !isSaved) {
                // Doomed tile - remove all markers
                this.state.tileMarkers[tile.id][player.id] = 0;
                player.markersOnBoard -= markerCount;
                totalLost += markerCount;
                tileResults.push({
                    tile,
                    status: 'doomed',
                    markersLost: markerCount,
                    doomedTag: tileTags.find(t => doomedTags.has(t))
                });
            } else if (isSaved) {
                // Saved tile - keep markers
                tileResults.push({
                    tile,
                    status: 'saved',
                    markersLost: 0,
                    savedTag: tileTags.find(t => playerSafeTags.has(t))
                });
            } else {
                // Neutral tile - subject to roll
                neutralTiles.push({ tile, markerCount });
                tileResults.push({
                    tile,
                    status: 'neutral',
                    markersLost: 0
                });
            }
        }
        
        // Handle neutral tiles with a roll
        let roll = null;
        const threshold = event.neutral_roll || 4;
        
        if (neutralTiles.length > 0) {
            roll = rollD6();
            if (roll < threshold) {
                // Failed roll - lose half markers from neutral tiles
                const neutralMarkers = neutralTiles.reduce((sum, n) => sum + n.markerCount, 0);
                const losses = Math.ceil(neutralMarkers / 2);
                let remaining = losses;
                
                for (const { tile, markerCount } of neutralTiles) {
                    if (remaining <= 0) break;
                    const toLose = Math.min(markerCount, remaining);
                    this.state.tileMarkers[tile.id][player.id] -= toLose;
                    player.markersOnBoard -= toLose;
                    totalLost += toLose;
                    remaining -= toLose;
                    
                    // Update tile result
                    const result = tileResults.find(r => r.tile.id === tile.id);
                    if (result) {
                        result.markersLost = toLose;
                        result.status = 'failed_roll';
                    }
                }
            }
        }
        
        // Ensure at least 1 marker survives
        if (player.markersOnBoard < 1 && totalLost > 0) {
            // Restore one marker to a random tile
            const anyTile = this.state.boardTiles.find(t => 
                (this.state.tileMarkers[t.id][player.id] || 0) === 0
            ) || this.state.boardTiles[0];
            this.state.tileMarkers[anyTile.id][player.id] = 1;
            player.markersOnBoard = 1;
            totalLost -= 1;
        }
        
        player.extinctionsSurvived++;
        
        // Determine overall status
        let status = 'survived';
        let message = 'Survived the extinction event';
        
        const doomedCount = tileResults.filter(r => r.status === 'doomed').length;
        const savedCount = tileResults.filter(r => r.status === 'saved').length;
        const failedCount = tileResults.filter(r => r.status === 'failed_roll').length;
        
        if (doomedCount > 0 && savedCount > 0) {
            status = 'partial';
            message = `Saved ${savedCount} tile(s), lost markers on ${doomedCount} doomed tile(s)`;
        } else if (doomedCount > 0) {
            status = 'doomed';
            message = `Lost markers on ${doomedCount} doomed tile(s)`;
        } else if (savedCount > 0) {
            status = 'safe';
            message = `All ${savedCount} tile(s) protected by safe tags`;
        } else if (failedCount > 0) {
            status = 'failed';
            message = `Rolled ${roll} (needed ${threshold}+) - lost markers on ${failedCount} tile(s)`;
        } else if (roll !== null) {
            message = `Rolled ${roll} (needed ${threshold}+) - survived`;
        }
        
        return {
            player,
            status,
            message,
            roll,
            tileResults,
            lostMarkers: totalLost
        };
    }
    
    removeRandomMarkers(player, count) {
        let removed = 0;
        for (const tile of this.state.boardTiles) {
            const markers = this.state.tileMarkers[tile.id][player.id] || 0;
            if (markers > 0 && removed < count) {
                const toRemove = Math.min(markers, count - removed);
                this.state.tileMarkers[tile.id][player.id] -= toRemove;
                removed += toRemove;
            }
        }
    }
    
    // Population growth at era end
    growPopulation() {
        for (const player of this.state.players) {
            // Each player gains 1 marker per era (max 12)
            player.markers = Math.min(12, player.markers + 1);
        }
    }
    
    // Full phase execution
    async executePhase() {
        const phase = this.state.currentPhase;
        
        switch (phase) {
            case PHASES.DRAW:
                this.dealCards();
                break;
                
            case PHASES.COMPETITION:
                this.resolveCompetition();
                break;
                
            case PHASES.TILE_FLIP:
                this.flipTiles();
                break;
        }
    }
    
    // Get playable traits for current player
    getPlayableTraits(player) {
        return player.hand.map(trait => {
            const { canAcquire, reason } = player.canAcquireTrait(trait, this.state.currentEra, this.state.traitDb);
            const cost = player.getTraitCost(trait);
            const canAfford = player.alleles >= cost;
            
            return {
                trait,
                canAcquire,
                canAfford,
                cost,
                reason: canAcquire ? (canAfford ? null : `Need ${cost} alleles`) : reason
            };
        });
    }
    
    // Get tiles where player has markers
    getPlayerOccupiedTiles(player) {
        return this.state.boardTiles.filter(tile => {
            const markers = this.state.tileMarkers[tile.id][player.id] || 0;
            return markers > 0;
        });
    }
    
    // Check if tile is adjacent to any of player's occupied tiles
    isAdjacentToPlayerMarkers(player, tile) {
        const occupied = this.getPlayerOccupiedTiles(player);
        const neighbors = getHexNeighbors(tile.q, tile.r);
        return occupied.some(occ => 
            neighbors.some(n => n.q === occ.q && n.r === occ.r)
        );
    }
    
    // Get valid tiles for marker placement
    getValidTiles(player) {
        const tags = player.getTags(this.state.traitDb);
        
        return this.state.boardTiles.filter(tile => {
            const requiredTags = tile.biomeData.required_tags || [];
            const hasRequiredTags = requiredTags.every(t => tags.has(t));
            const isAdjacent = this.isAdjacentToPlayerMarkers(player, tile);
            const alreadyOccupied = (this.state.tileMarkers[tile.id][player.id] || 0) > 0;
            return hasRequiredTags && (isAdjacent || alreadyOccupied);
        });
    }
    
    // Pick N adjacent tiles in same climate zone for continental drift
    pickAdjacentTiles(count) {
        const tiles = this.state.boardTiles;
        if (tiles.length < count) return [];
        
        // Try multiple times to find a valid cluster
        for (let attempt = 0; attempt < 30; attempt++) {
            const startIdx = Math.floor(Math.random() * tiles.length);
            const start = tiles[startIdx];
            const climateBand = start.climateBand;
            const selected = [start];
            
            // Only consider tiles in same climate zone
            const candidates = new Set(
                tiles.filter(t => t.id !== start.id && t.climateBand === climateBand)
            );
            
            // Grow cluster by adding adjacent tiles in same zone
            while (selected.length < count && candidates.size > 0) {
                const adjacent = [];
                for (const tile of selected) {
                    const neighbors = getHexNeighbors(tile.q, tile.r);
                    for (const n of neighbors) {
                        const match = [...candidates].find(t => t.q === n.q && t.r === n.r);
                        if (match) adjacent.push(match);
                    }
                }
                
                if (adjacent.length === 0) break;
                
                // Pick random adjacent tile
                const next = adjacent[Math.floor(Math.random() * adjacent.length)];
                selected.push(next);
                candidates.delete(next);
            }
            
            if (selected.length === count) return selected;
        }
        
        return [];
    }
}

