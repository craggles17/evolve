// Main entry point for Damn Nature You Scary web game

import { GameState, PHASES } from './state.js';
import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { $, $$, createElement, PLAYER_COLORS, delay } from './utils.js';
import { MultiplayerHost, MultiplayerClient, checkForRoomInURL, getShareLink } from './multiplayer.js';

const MODE = {
    LOCAL: 'local',
    HOST: 'host',
    CLIENT: 'client',
    SPECTATOR: 'spectator'
};

class Game {
    constructor() {
        this.state = new GameState();
        this.renderer = new Renderer();
        this.engine = null;
        
        this.currentPlayerRolled = false;
        
        this.mode = MODE.LOCAL;
        this.mpHost = null;
        this.mpClient = null;
        this.mySlotIndex = -1;
    }
    
    async init() {
        console.log('Loading game data...');
        await this.state.loadGameData();
        console.log('Game data loaded!');
        
        this.engine = new GameEngine(this.state, this.renderer);
        this.setupEventListeners();
        this.renderer.setupPlayerCountButtons();
        
        const roomCode = checkForRoomInURL();
        if (roomCode) {
            this.showJoinWithCode(roomCode);
        } else {
            this.renderer.showScreen('setup-screen');
        }
    }
    
    setupEventListeners() {
        // Mode selection
        $$('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleModeSelect(btn.dataset.mode));
        });
        
        // Back buttons
        $('#back-to-mode')?.addEventListener('click', () => this.showModeSelect());
        $('#back-to-mode-host')?.addEventListener('click', () => this.showModeSelect());
        $('#back-to-mode-join')?.addEventListener('click', () => this.showModeSelect());
        
        // Local setup
        $('#start-game').addEventListener('click', () => this.startLocalGame());
        
        // Host setup
        $('#create-room')?.addEventListener('click', () => this.createRoom());
        $('#start-online-game')?.addEventListener('click', () => this.startOnlineGame());
        $('#copy-link')?.addEventListener('click', () => this.copyShareLink());
        this.setupHostPlayerCount();
        
        // Join setup
        $('#join-room')?.addEventListener('click', () => this.joinRoom());
        $('#join-code')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Spectate button
        $('#spectate-btn')?.addEventListener('click', () => this.spectate());
        
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
            this.cleanup();
            this.renderer.hideModals();
            this.showModeSelect();
        });
        
        // Tile legend toggle
        const legendToggle = document.querySelector('.legend-toggle');
        const legendContent = document.querySelector('.legend-content');
        if (legendToggle && legendContent) {
            legendToggle.addEventListener('click', () => {
                legendContent.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.tile-legend')) {
                    legendContent.classList.add('hidden');
                }
            });
        }
        
        // Zoom controls
        $('#btn-zoom-in')?.addEventListener('click', () => this.renderer.zoomIn());
        $('#btn-zoom-out')?.addEventListener('click', () => this.renderer.zoomOut());
        $('#btn-zoom-reset')?.addEventListener('click', () => this.renderer.resetZoom());
        
        // Chat
        $('#chat-send')?.addEventListener('click', () => this.sendChat());
        $('#chat-input')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
        $('#chat-toggle')?.addEventListener('click', () => this.toggleChat());
        
        // Renderer callbacks
        this.renderer.callbacks.onTileClick = (tile) => this.handleTileClick(tile);
        this.renderer.callbacks.onCardClick = (trait, canBuy) => this.handleCardClick(trait, canBuy);
        this.renderer.callbacks.onTraitSlotClick = (traitId) => this.handleTraitSlotClick(traitId);
        this.renderer.callbacks.onMarkerDrop = (tileId) => this.handleMarkerDrop(tileId);
        
        // Drag and drop for markers
        this.setupDragAndDrop();
    }
    
    setupDragAndDrop() {
        const dragMarker = $('#drag-marker');
        if (!dragMarker) return;
        
        // Store valid tiles during drag
        this.validDragTiles = new Set();
        
        dragMarker.addEventListener('dragstart', (e) => {
            if (!this.isMyTurn() || this.state.currentPhase !== PHASES.POPULATE) {
                e.preventDefault();
                return;
            }
            
            const player = this.state.getCurrentPlayer();
            if (player.markersOnBoard >= player.markers) {
                e.preventDefault();
                return;
            }
            
            // Get valid tiles and store their IDs
            const validTiles = this.engine.getValidTiles(player);
            this.validDragTiles = new Set(validTiles.map(t => t.id));
            
            // Highlight valid tiles
            this.renderer.highlightValidTiles(validTiles, this.state);
            
            // Set drag data
            e.dataTransfer.setData('text/plain', 'marker');
            e.dataTransfer.effectAllowed = 'move';
            dragMarker.classList.add('dragging');
        });
        
        dragMarker.addEventListener('dragend', () => {
            dragMarker.classList.remove('dragging');
            this.validDragTiles.clear();
            // Clear highlights
            this.renderer.clearTileHighlights();
        });
    }
    
    handleMarkerDrop(tileId) {
        if (!this.isMyTurn()) return;
        if (this.state.currentPhase !== PHASES.POPULATE) return;
        
        const player = this.state.getCurrentPlayer();
        
        // Validate tile is in valid set
        if (!this.validDragTiles.has(tileId)) {
            console.log('Cannot place marker: invalid tile');
            return;
        }
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'place_marker', tileId });
            return;
        }
        
        const result = this.engine.placeMarker(player, tileId);
        
        if (result.success) {
            console.log(`${player.name} placed marker on tile`);
            
            if (this.mode === MODE.HOST && this.mpHost) {
                this.mpHost.broadcastState(this.state);
            }
            
            this.updateUI();
        } else {
            console.log(`Cannot place marker: ${result.reason}`);
        }
    }
    
    setupHostPlayerCount() {
        const buttons = $$('#host-player-count .count-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    
    // Mode Selection
    handleModeSelect(mode) {
        $('#mode-select').classList.add('hidden');
        
        if (mode === 'local') {
            $('#local-setup').classList.remove('hidden');
        } else if (mode === 'host') {
            $('#host-setup').classList.remove('hidden');
        } else if (mode === 'join') {
            $('#join-setup').classList.remove('hidden');
        }
    }
    
    showModeSelect() {
        $$('.setup-form').forEach(f => f.classList.add('hidden'));
        $('#mode-select').classList.remove('hidden');
        this.renderer.showScreen('setup-screen');
    }
    
    showJoinWithCode(code) {
        this.renderer.showScreen('setup-screen');
        $$('.setup-form').forEach(f => f.classList.add('hidden'));
        $('#join-setup').classList.remove('hidden');
        $('#join-code').value = code;
    }
    
    // Local Game
    startLocalGame() {
        this.mode = MODE.LOCAL;
        const names = this.renderer.getPlayerNames();
        this.state.initializeGame(names);
        
        this.renderer.showScreen('game-screen');
        this.renderer.initBoardInteractions?.();
        this.updateUI();
        
        console.log('Local game started with players:', names);
    }
    
    // Host Game
    async createRoom() {
        const hostName = $('#host-name').value.trim() || 'Host';
        const playerCount = parseInt($('#host-player-count .count-btn.active').dataset.count);
        
        this.mpHost = new MultiplayerHost({
            onPlayerConnect: (peerId) => this.onPlayerConnect(peerId),
            onPlayerDisconnect: (peerId) => this.onPlayerDisconnect(peerId),
            onSlotClaim: (slot, name, peerId) => this.onSlotClaim(slot, name, peerId),
            onSlotsChange: (slots) => this.renderLobbySlots(slots),
            onAction: (peerId, action) => this.handleRemoteAction(peerId, action),
            onChat: (msg) => this.displayChatMessage(msg)
        });
        
        const code = await this.mpHost.initialize(playerCount, hostName);
        
        $('#host-setup').classList.add('hidden');
        $('#room-lobby').classList.remove('hidden');
        $('#room-code').textContent = code;
        $('#share-link').value = this.mpHost.getShareLink();
        
        this.renderLobbySlots(this.mpHost.playerSlots);
        this.updateStartButton();
        
        console.log('Room created:', code);
    }
    
    renderLobbySlots(slots) {
        const container = $('#lobby-slots');
        if (!container) return;
        
        container.innerHTML = '';
        
        slots.forEach((slot, i) => {
            const slotEl = createElement('div', 'lobby-slot');
            if (slot?.connected) {
                slotEl.classList.add(slot.peerId === 'host' ? 'you' : 'taken');
            } else if (slot && !slot.connected) {
                slotEl.classList.add('disconnected');
            }
            
            slotEl.innerHTML = `
                <span class="slot-color" style="background: ${PLAYER_COLORS[i]}"></span>
                <div class="slot-info">
                    <span class="slot-label">Player ${i + 1}</span>
                    <span class="slot-status ${slot?.connected ? 'connected' : ''}">${
                        slot ? (slot.connected ? slot.name : `${slot.name} (disconnected)`) : 'Open'
                    }</span>
                </div>
            `;
            
            container.appendChild(slotEl);
        });
        
        this.updateStartButton();
    }
    
    updateStartButton() {
        const btn = $('#start-online-game');
        if (!btn || !this.mpHost) return;
        
        const ready = this.mpHost.allSlotsReady();
        btn.disabled = !ready;
        $('#lobby-status').textContent = ready 
            ? 'All players ready!' 
            : 'Waiting for players...';
    }
    
    copyShareLink() {
        const link = $('#share-link').value;
        navigator.clipboard.writeText(link);
        $('#copy-link').textContent = 'Copied!';
        setTimeout(() => $('#copy-link').textContent = 'Copy Link', 2000);
    }
    
    startOnlineGame() {
        this.mode = MODE.HOST;
        this.mySlotIndex = 0;
        
        const names = this.mpHost.getPlayerNames();
        this.state.initializeGame(names);
        
        this.mpHost.broadcastState(this.state);
        
        this.renderer.showScreen('game-screen');
        this.renderer.initBoardInteractions?.();
        this.showMultiplayerUI();
        this.updateUI();
        
        console.log('Online game started with players:', names);
    }
    
    // Join Game
    async joinRoom() {
        const code = $('#join-code').value.trim().toUpperCase();
        if (code.length !== 6) {
            this.showJoinError('Enter a 6-character room code');
            return;
        }
        
        this.mpClient = new MultiplayerClient({
            onWelcome: (data) => this.onWelcome(data),
            onStateUpdate: (data) => this.onStateUpdate(data),
            onSlotsChange: (slots, mySlot) => this.onClientSlotsChange(slots, mySlot),
            onChat: (msg) => this.displayChatMessage(msg),
            onError: (msg) => this.showJoinError(msg),
            onDisconnect: () => this.onDisconnect(),
            onShowEvent: (event, results) => this.onShowEvent(event, results)
        });
        
        try {
            await this.mpClient.connect(code);
        } catch (err) {
            this.showJoinError(err.message || 'Failed to connect');
        }
    }
    
    showJoinError(msg) {
        const el = $('#join-error');
        el.textContent = msg;
        el.classList.remove('hidden');
    }
    
    onWelcome(data) {
        console.log('Connected to room:', data.roomCode);
        
        $('#join-setup').classList.add('hidden');
        $('#slot-select').classList.remove('hidden');
        
        this.renderClientSlots(data.slots);
        
        if (data.gameState) {
            this.state.loadFromJSON(data.gameState);
        }
        
        data.chatHistory.forEach(msg => this.displayChatMessage(msg, false));
    }
    
    renderClientSlots(slots) {
        const container = $('#available-slots');
        if (!container) return;
        
        container.innerHTML = '';
        
        slots.forEach((slot, i) => {
            const slotEl = createElement('div', 'lobby-slot');
            const isTaken = slot && slot.connected;
            const isMe = slot?.peerId === this.mpClient?.peer?.id;
            
            if (isTaken && !isMe) slotEl.classList.add('taken');
            if (isMe) slotEl.classList.add('you');
            
            slotEl.innerHTML = `
                <span class="slot-color" style="background: ${PLAYER_COLORS[i]}"></span>
                <div class="slot-info">
                    <span class="slot-label">Player ${i + 1}</span>
                    <span class="slot-status ${isTaken ? 'connected' : ''}">${
                        slot ? (slot.connected ? slot.name : 'Disconnected - claim to rejoin') : 'Available'
                    }</span>
                </div>
            `;
            
            if (!isTaken || !slot?.connected) {
                slotEl.addEventListener('click', () => this.claimSlot(i));
            }
            
            container.appendChild(slotEl);
        });
    }
    
    claimSlot(slotIndex) {
        const name = $('#client-name').value.trim();
        if (!name) {
            alert('Enter your name first');
            return;
        }
        
        this.mpClient.claimSlot(slotIndex, name);
    }
    
    onClientSlotsChange(slots, mySlot) {
        this.mySlotIndex = mySlot;
        
        if (this.state.gameStarted) {
            this.updateUI();
            return;
        }
        
        this.renderClientSlots(slots);
        
        if (mySlot >= 0) {
            this.mode = MODE.CLIENT;
            console.log('Claimed slot:', mySlot);
        }
    }
    
    onStateUpdate(data) {
        const wasStarted = this.state.gameStarted;
        this.state.loadFromJSON(data);
        
        // Reset roll flag when receiving new state in allele_roll phase
        if (data.currentPhase === 'allele_roll') {
            this.currentPlayerRolled = false;
        }
        
        if (!wasStarted && this.state.gameStarted) {
            this.renderer.showScreen('game-screen');
            this.renderer.initBoardInteractions?.();
            this.showMultiplayerUI();
        }
        
        this.updateUI();
    }
    
    async onShowEvent(event, results) {
        const displayResults = results.map(r => ({
            player: { id: r.playerId, name: r.playerName, color: r.playerColor },
            status: r.status,
            message: r.message,
            lostMarkers: r.lostMarkers,
            tileResults: r.tileResults || []
        }));
        await this.renderer.showEvent(event, displayResults);
    }
    
    spectate() {
        this.mode = MODE.SPECTATOR;
        this.mySlotIndex = -1;
        
        if (this.state.gameStarted) {
            this.renderer.showScreen('game-screen');
            this.showMultiplayerUI();
            this.updateUI();
        } else {
            $('#slot-select').innerHTML = `
                <h2>Spectating</h2>
                <p class="lobby-status">Waiting for game to start...</p>
            `;
        }
    }
    
    onDisconnect() {
        this.showConnectionStatus(false);
        console.log('Disconnected from host');
    }
    
    showMultiplayerUI() {
        $('#chat-panel')?.classList.remove('hidden');
        $('#connection-status')?.classList.remove('hidden');
        this.showConnectionStatus(true);
    }
    
    showConnectionStatus(connected) {
        const el = $('#connection-status');
        if (!el) return;
        
        $('#connection-icon').textContent = connected ? '🟢' : '🔴';
        $('#connection-text').textContent = connected ? 'Connected' : 'Disconnected';
        el.classList.toggle('disconnected', !connected);
    }
    
    // Remote Actions (Host receives from clients)
    async handleRemoteAction(peerId, action) {
        const slotIndex = this.mpHost.playerSlots.findIndex(s => s?.peerId === peerId);
        if (slotIndex === -1) return;
        
        if (slotIndex !== this.state.currentPlayerIndex) {
            console.log('Not this player\'s turn');
            return;
        }
        
        await this.executeAction(action);
        this.mpHost.broadcastState(this.state);
    }
    
    async executeAction(action) {
        const player = this.state.getCurrentPlayer();
        
        switch (action.type) {
            case 'roll_alleles':
                this.engine.rollAllelesWithValues(player, action.dice);
                this.currentPlayerRolled = true;
                break;
                
            case 'end_phase':
                await this.processEndPhase();
                break;
                
            case 'end_turn':
                this.processEndTurn();
                break;
                
            case 'place_marker':
                this.engine.placeMarker(player, action.tileId);
                break;
                
            case 'buy_trait':
                this.engine.buyTrait(player, action.traitId);
                break;
        }
        
        this.updateUI();
    }
    
    onPlayerConnect(peerId) {
        console.log('Player connected:', peerId);
        this.addSystemMessage(`A player connected`);
    }
    
    onPlayerDisconnect(peerId) {
        console.log('Player disconnected:', peerId);
        this.addSystemMessage(`A player disconnected`);
    }
    
    onSlotClaim(slot, name, peerId) {
        console.log(`${name} claimed slot ${slot}`);
        this.addSystemMessage(`${name} joined as Player ${slot + 1}`);
    }
    
    // Chat
    sendChat() {
        const input = $('#chat-input');
        const text = input.value.trim();
        if (!text) return;
        
        if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.sendChat(text);
        } else if ((this.mode === MODE.CLIENT || this.mode === MODE.SPECTATOR) && this.mpClient) {
            this.mpClient.sendChat(text);
        }
        
        input.value = '';
    }
    
    displayChatMessage(msg, scroll = true) {
        const container = $('#chat-messages');
        if (!container) return;
        
        const el = createElement('div', 'chat-message');
        el.innerHTML = `<span class="chat-message-sender">${msg.from}:</span> <span class="chat-message-text">${msg.text}</span>`;
        container.appendChild(el);
        
        if (scroll) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    addSystemMessage(text) {
        const container = $('#chat-messages');
        if (!container) return;
        
        const el = createElement('div', 'chat-message chat-message-system');
        el.textContent = text;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    }
    
    toggleChat() {
        const panel = $('#chat-panel');
        const btn = $('#chat-toggle');
        panel.classList.toggle('minimized');
        btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    }
    
    // Turn Control
    isMyTurn() {
        if (this.mode === MODE.LOCAL) return true;
        if (this.mode === MODE.SPECTATOR) return false;
        return this.mySlotIndex === this.state.currentPlayerIndex;
    }
    
    // Game Actions
    updateUI() {
        const player = this.state.getCurrentPlayer();
        const organisms = this.state.organismsData?.organisms || [];
        
        this.renderer.updateHeader(this.state);
        this.renderer.renderBoard(this.state);
        
        // Highlight valid tiles during Populate phase
        if (this.state.currentPhase === PHASES.POPULATE && this.isMyTurn()) {
            const validTiles = this.engine.getValidTiles(player);
            this.renderer.highlightValidTiles(validTiles, this.state);
        }
        
        this.renderer.renderLineageBoard(player, this.state.traitDb);
        this.renderer.updatePlayerStats(player, this.state.traitDb, this.state.currentPhase, this.isMyTurn());
        this.renderer.updateEventDeck(this.state);
        this.renderer.renderPlayersBar(this.state.players, this.state.currentPlayerIndex, this.state.traitDb, this.state.currentEra, organisms);
        this.renderer.renderOrganismMatch(player, this.state.currentEra, organisms);
        
        const playable = this.engine.getPlayableTraits(player);
        this.renderer.renderHand(player, playable);
        
        const canAct = this.isMyTurn();
        this.renderer.updateActionButtons(this.state.currentPhase, this.currentPlayerRolled, canAct);
        
        if (this.mode === MODE.SPECTATOR) {
            this.showSpectatorBanner();
        }
    }
    
    showSpectatorBanner() {
        if (!$('#spectator-banner')) {
            const banner = createElement('div', 'spectator-banner', 'Watching as spectator');
            banner.id = 'spectator-banner';
            $('#game-header')?.after(banner);
        }
    }
    
    async handleAlleleRoll() {
        if (!this.isMyTurn()) return;
        
        const player = this.state.getCurrentPlayer();
        
        const result = await this.renderer.showDiceRoll(
            `${player.name}: Reproductive Cycle`,
            () => this.engine.rollAlleles(player)
        );
        
        this.currentPlayerRolled = true;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'roll_alleles', dice: result.dice });
        } else if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.broadcastState(this.state);
        }
        
        this.updateUI();
    }
    
    async handleEndPhase() {
        if (!this.isMyTurn() && this.mode !== MODE.LOCAL) return;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'end_phase' });
            return;
        }
        
        await this.processEndPhase();
        
        if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.broadcastState(this.state);
        }
    }
    
    async processEndPhase() {
        const phase = this.state.currentPhase;
        
        switch (phase) {
            case PHASES.ALLELE_ROLL:
                if (!this.state.advancePlayer()) {
                    this.engine.dealCards();
                    this.state.advancePhase();
                }
                this.currentPlayerRolled = false;
                break;
                
            case PHASES.DRAW:
                this.state.advancePhase();
                break;
                
            case PHASES.COMPETITION:
                await this.handleCompetitionPhase();
                break;
                
            case PHASES.TILE_FLIP:
                await this.handleTileFlipPhase();
                break;
                
            case PHASES.EVENT:
                await this.handleEventPhase();
                
                if (!this.state.advanceEra()) {
                    this.handleGameOver();
                    return;
                }
                
                this.engine.growPopulation();
                this.currentPlayerRolled = false;
                break;
                
            default:
                this.state.advancePhase();
        }
        
        this.updateUI();
    }
    
    handleEndTurn() {
        if (!this.isMyTurn() && this.mode !== MODE.LOCAL) return;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'end_turn' });
            return;
        }
        
        this.processEndTurn();
        
        if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.broadcastState(this.state);
        }
    }
    
    processEndTurn() {
        if (!this.state.advancePlayer()) {
            this.state.advancePhase();
            this.state.currentPlayerIndex = 0;
        }
        this.updateUI();
    }
    
    handleTileClick(tile) {
        // Show tile info modal on click (marker placement is now drag-and-drop)
        this.renderer.showTileInfo(tile, this.state);
    }
    
    handleCardClick(trait, canBuy) {
        const player = this.state.getCurrentPlayer();
        const isEvolutionPhase = this.state.currentPhase === PHASES.EVOLUTION;
        const canAct = this.isMyTurn() && canBuy;
        
        this.renderer.showCardDetail(
            trait,
            player,
            this.state.traitDb,
            canAct,
            isEvolutionPhase && this.isMyTurn(),
            (t) => this.handleBuyTrait(t)
        );
    }
    
    handleBuyTrait(trait) {
        if (!this.isMyTurn()) return;
        
        const player = this.state.getCurrentPlayer();
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'buy_trait', traitId: trait.id });
            return;
        }
        
        const result = this.engine.buyTrait(player, trait.id);
        
        if (result.success) {
            console.log(`${player.name} evolved ${trait.name} for ${result.cost} alleles`);
            
            if (this.mode === MODE.HOST && this.mpHost) {
                this.mpHost.broadcastState(this.state);
            }
            
            this.updateUI();
        } else {
            console.log(`Cannot evolve: ${result.reason}`);
        }
    }
    
    handleTraitSlotClick(traitId) {
        const trait = this.state.traitDb[traitId];
        if (trait) {
            const player = this.state.getCurrentPlayer();
            this.renderer.showCardDetail(trait, player, this.state.traitDb, false, false, () => {});
        }
    }
    
    async handleCompetitionPhase() {
        const results = this.engine.resolveCompetition();
        
        // Only show visuals if there are contested tiles
        const contestedResults = results.filter(r => r.contested);
        
        if (contestedResults.length > 0) {
            // Show dice rolls and combat results
            this.renderer.showCompetitionResults(contestedResults, this.state);
            
            // Mark markers that will die with skulls
            this.renderer.markDyingMarkers(contestedResults, this.state);
            
            // Wait for players to observe the results
            await delay(2500);
            
            // Clear all competition visuals
            this.renderer.clearCompetitionVisuals();
        }
        
        this.state.advancePhase();
    }
    
    async handleTileFlipPhase() {
        // Get tiles that are at risk of flipping (not era-locked)
        const atRiskTiles = this.state.boardTiles.filter(tile => 
            this.state.currentEra >= tile.eraLock
        );
        
        // Roll the dice first to determine flip threshold
        const roll = Math.floor(Math.random() * 6) + 1;
        
        // Show the indicator with roll and highlight at-risk tiles
        this.renderer.showTileFlipIndicator(roll, atRiskTiles);
        
        // Wait for players to see the roll
        await delay(1200);
        
        // Now execute the flip logic with the pre-rolled value
        const flipped = [];
        for (const tile of this.state.boardTiles) {
            if (roll >= tile.flipNumber && this.state.currentEra >= tile.eraLock) {
                const transitions = this.state.tilesData.flip_transitions?.[tile.biome];
                const validTransitions = transitions || Object.keys(this.state.tilesData.biome_types);
                const newBiome = validTransitions[Math.floor(Math.random() * validTransitions.length)];
                
                const oldBiome = tile.biome;
                tile.biome = newBiome;
                tile.biomeData = this.state.tilesData.biome_types[newBiome];
                tile.flipNumber = Math.floor(Math.random() * 6) + 1;
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
                            this.state.tileMarkers[tile.id][playerId] = 0;
                            player.markersOnBoard -= count;
                        }
                    }
                }
            }
        }
        
        // Show which tiles flipped
        this.renderer.animateFlippedTiles(flipped);
        
        if (flipped.length > 0) {
            console.log(`Tiles flipped (roll ${roll}):`, flipped);
        }
        
        // Wait for animation
        await delay(1800);
        
        // Clear visuals
        this.renderer.clearTileFlipIndicator();
        
        this.state.advancePhase();
    }
    
    async handleEventPhase() {
        const event = this.state.drawEvent();
        if (!event) return;
        
        const results = this.engine.resolveEvent(event);
        
        if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.broadcastEvent(event, results);
        }
        
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
    
    cleanup() {
        if (this.mpHost) {
            this.mpHost.destroy();
            this.mpHost = null;
        }
        if (this.mpClient) {
            this.mpClient.destroy();
            this.mpClient = null;
        }
        
        this.mode = MODE.LOCAL;
        this.mySlotIndex = -1;
        this.state = new GameState();
        this.state.loadGameData();
        
        $('#chat-panel')?.classList.add('hidden');
        $('#connection-status')?.classList.add('hidden');
        $('#chat-messages').innerHTML = '';
        
        const url = new URL(window.location);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url);
    }
}

// Initialize game on page load
const game = new Game();
game.init().catch(console.error);
