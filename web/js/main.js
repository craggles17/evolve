// Main entry point for Damn Nature You Scary web game

import { GameState, PHASES } from './state.js';
import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { $ } from './utils.js';

class Game {
    constructor() {
        this.state = new GameState();
        this.renderer = new Renderer();
        this.engine = null;
        
        // Track per-phase state
        this.currentPlayerRolled = false;
    }
    
    async init() {
        console.log('Loading game data...');
        await this.state.loadGameData();
        console.log('Game data loaded!');
        
        this.engine = new GameEngine(this.state, this.renderer);
        this.setupEventListeners();
        this.renderer.setupPlayerCountButtons();
        
        // Transition from loading to setup screen
        this.renderer.showScreen('setup-screen');
    }
    
    setupEventListeners() {
        // Setup screen
        $('#start-game').addEventListener('click', () => this.startGame());
        
        // Game controls
        $('#btn-roll-alleles').addEventListener('click', () => this.handleAlleleRoll());
        $('#btn-end-phase').addEventListener('click', () => this.handleEndPhase());
        $('#btn-end-turn').addEventListener('click', () => this.handleEndTurn());
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.renderer.hideModals());
        });
        
        // New game button
        $('#btn-new-game').addEventListener('click', () => {
            this.renderer.hideModals();
            this.renderer.showScreen('setup-screen');
        });
        
        // Tile legend toggle
        const legendToggle = document.querySelector('.legend-toggle');
        const legendContent = document.querySelector('.legend-content');
        if (legendToggle && legendContent) {
            legendToggle.addEventListener('click', () => {
                legendContent.classList.toggle('hidden');
            });
            // Close legend when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.tile-legend')) {
                    legendContent.classList.add('hidden');
                }
            });
        }
        
        // Renderer callbacks
        this.renderer.callbacks.onTileClick = (tile) => this.handleTileClick(tile);
        this.renderer.callbacks.onCardClick = (trait, canBuy) => this.handleCardClick(trait, canBuy);
        this.renderer.callbacks.onTraitSlotClick = (traitId) => this.handleTraitSlotClick(traitId);
    }
    
    startGame() {
        const names = this.renderer.getPlayerNames();
        this.state.initializeGame(names);
        
        this.renderer.showScreen('game-screen');
        this.updateUI();
        
        console.log('Game started with players:', names);
    }
    
    updateUI() {
        const player = this.state.getCurrentPlayer();
        
        this.renderer.updateHeader(this.state);
        this.renderer.renderBoard(this.state);
        this.renderer.renderLineageBoard(player, this.state.traitDb);
        this.renderer.updatePlayerStats(player, this.state.traitDb);
        this.renderer.updateEventDeck(this.state);
        this.renderer.renderPlayersBar(this.state.players, this.state.currentPlayerIndex, this.state.traitDb);
        
        // Update hand with playability info
        const playable = this.engine.getPlayableTraits(player);
        this.renderer.renderHand(player, playable);
        
        // Update action buttons
        this.renderer.updateActionButtons(this.state.currentPhase, this.currentPlayerRolled);
    }
    
    async handleAlleleRoll() {
        const player = this.state.getCurrentPlayer();
        
        const result = await this.renderer.showDiceRoll(
            `${player.name}: Reproductive Cycle`,
            () => this.engine.rollAlleles(player)
        );
        
        this.currentPlayerRolled = true;
        this.updateUI();
    }
    
    async handleEndPhase() {
        const phase = this.state.currentPhase;
        
        switch (phase) {
            case PHASES.ALLELE_ROLL:
                // All players need to roll
                if (!this.state.advancePlayer()) {
                    // All players rolled, move to draw
                    this.engine.dealCards();
                    this.state.advancePhase();
                }
                this.currentPlayerRolled = false;
                break;
                
            case PHASES.DRAW:
                this.state.advancePhase();
                break;
                
            case PHASES.COMPETITION:
                this.engine.resolveCompetition();
                this.state.advancePhase();
                break;
                
            case PHASES.TILE_FLIP:
                const flipResult = this.engine.flipTiles();
                if (flipResult.flipped.length > 0) {
                    console.log(`Tiles flipped (roll ${flipResult.roll}):`, flipResult.flipped);
                }
                this.state.advancePhase();
                break;
                
            case PHASES.EVENT:
                await this.handleEventPhase();
                
                // Check for game end
                if (!this.state.advanceEra()) {
                    this.handleGameOver();
                    return;
                }
                
                // Grow population for new era
                this.engine.growPopulation();
                this.currentPlayerRolled = false;
                break;
                
            default:
                this.state.advancePhase();
        }
        
        this.updateUI();
    }
    
    handleEndTurn() {
        if (!this.state.advancePlayer()) {
            // All players have acted, move to next phase
            this.state.advancePhase();
            this.state.currentPlayerIndex = 0;
        }
        this.updateUI();
    }
    
    handleTileClick(tile) {
        if (this.state.currentPhase !== PHASES.POPULATE) {
            console.log('Can only place markers during Populate phase');
            return;
        }
        
        const player = this.state.getCurrentPlayer();
        const result = this.engine.placeMarker(player, tile.id);
        
        if (result.success) {
            console.log(`${player.name} placed marker on ${tile.biomeData.name}`);
            this.updateUI();
        } else {
            console.log(`Cannot place marker: ${result.reason}`);
        }
    }
    
    handleCardClick(trait, canBuy) {
        const player = this.state.getCurrentPlayer();
        const isEvolutionPhase = this.state.currentPhase === PHASES.EVOLUTION;
        
        this.renderer.showCardDetail(
            trait,
            player,
            this.state.traitDb,
            canBuy,
            isEvolutionPhase,
            (t) => this.handleBuyTrait(t)
        );
    }
    
    handleBuyTrait(trait) {
        const player = this.state.getCurrentPlayer();
        const result = this.engine.buyTrait(player, trait.id);
        
        if (result.success) {
            console.log(`${player.name} evolved ${trait.name} for ${result.cost} alleles`);
            this.updateUI();
        } else {
            console.log(`Cannot evolve: ${result.reason}`);
        }
    }
    
    handleTraitSlotClick(traitId) {
        const trait = this.state.traitDb[traitId];
        if (trait) {
            const player = this.state.getCurrentPlayer();
            // Already owned trait - show as info only
            this.renderer.showCardDetail(trait, player, this.state.traitDb, false, false, () => {});
        }
    }
    
    async handleEventPhase() {
        const event = this.state.drawEvent();
        if (!event) return;
        
        const results = this.engine.resolveEvent(event);
        await this.renderer.showEvent(event, results);
    }
    
    handleGameOver() {
        const scores = this.state.getFinalScores();
        
        const organisms = this.state.players.map(player => ({
            player,
            ...this.state.findClosestOrganism(player)
        }));
        
        this.renderer.showGameOver(scores, organisms);
    }
}

// Initialize game on page load
const game = new Game();
game.init().catch(console.error);

