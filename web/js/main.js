// Main entry point for Damn Nature You Scary web game

import { GameState, PHASES, DIFFICULTY } from './state.js';
import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { $, $$, createElement, PLAYER_COLORS, delay, ERA_MYA } from './utils.js';
import { MultiplayerHost, MultiplayerClient, checkForRoomInURL, getShareLink } from './multiplayer.js';

const MODE = {
    LOCAL: 'local',
    HOST: 'host',
    CLIENT: 'client',
    SPECTATOR: 'spectator',
    SOLO: 'solo'
};

class Game {
    constructor() {
        this.state = new GameState();
        this.renderer = new Renderer();
        this.engine = null;
        
        this.currentPlayerRolled = false;
        
        // Tech tree zoom/scroll state
        this.ttEraWidth = 140; // Must match renderer.js ERA_WIDTH
        this.ttZoom = 1;
        this.ttVisibleEras = 5; // Target eras visible at default zoom
        
        this.mode = MODE.LOCAL;
        this.mpHost = null;
        this.mpClient = null;
        this.mySlotIndex = -1;
        
        // Touch-based marker placement mode (for mobile)
        this.markerPlacementMode = false;
        
        // Prevent rapid clicks from triggering multiple phase transitions
        this.isProcessing = false;
    }
    
    async init() {
        console.log('Loading game data...');
        await this.state.loadGameData();
        console.log('Game data loaded!');
        
        // Pass phylogeny clades to renderer for tech tree layout
        if (this.state.phylogenyData?.clades_flat) {
            this.renderer.phylogenyClades = this.state.phylogenyData.clades_flat;
        }
        
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
        $('#back-to-mode-solo')?.addEventListener('click', () => this.showModeSelect());
        
        // Solo setup
        $('#start-solo-game')?.addEventListener('click', () => this.startSoloGame());
        
        // Local setup
        $('#start-game').addEventListener('click', () => this.startLocalGame());
        
        // Host setup
        $('#create-room')?.addEventListener('click', () => this.createRoom());
        $('#start-online-game')?.addEventListener('click', () => this.startOnlineGame());
        $('#copy-link')?.addEventListener('click', () => this.copyShareLink());
        this.setupHostPlayerCount();
        this.setupExperimentalOptions();
        
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
        
        // Tech tree zoom controls
        $('#tt-zoom-in')?.addEventListener('click', () => this.techTreeZoom(0.15));
        $('#tt-zoom-out')?.addEventListener('click', () => this.techTreeZoom(-0.15));
        $('#tt-fullscreen')?.addEventListener('click', () => this.toggleTechTreeFullscreen());
        $('#tech-tree-scroll')?.addEventListener('scroll', () => this.updateTTVisibleRange());
        
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
        this.renderer.callbacks.onTechTreeClick = (trait, state) => this.handleTechTreeClick(trait, state);
        this.renderer.callbacks.onGenomeTraitClick = (trait) => this.handleGenomeTraitClick(trait);
        this.renderer.callbacks.onEventMarkerClick = (event, era) => this.handleEventMarkerClick(event, era);
        
        // Trait modal buttons
        $('#btn-trait-play')?.addEventListener('click', () => this.playTraitFromModal());
        $('#btn-trait-close')?.addEventListener('click', () => this.closeTraitModal());
        
        // Drag and drop for markers
        this.setupDragAndDrop();
    }
    
    setupDragAndDrop() {
        const dragMarker = $('#drag-marker');
        if (!dragMarker) return;
        
        // Store valid tiles during drag/placement mode
        this.validDragTiles = new Set();
        
        // Desktop drag-and-drop
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
            
            const validTiles = this.engine.getValidTiles(player);
            this.validDragTiles = new Set(validTiles.map(t => t.id));
            this.renderer.highlightValidTiles(validTiles, this.state);
            
            e.dataTransfer.setData('text/plain', 'marker');
            e.dataTransfer.effectAllowed = 'move';
            dragMarker.classList.add('dragging');
        });
        
        dragMarker.addEventListener('dragend', () => {
            dragMarker.classList.remove('dragging');
            this.validDragTiles.clear();
            this.renderer.clearTileHighlights();
        });
        
        // Touch/click-based placement mode for mobile
        dragMarker.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMarkerPlacementMode();
        });
        
        // Also handle touchend for mobile (click may not fire reliably)
        dragMarker.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMarkerPlacementMode();
        });
    }
    
    toggleMarkerPlacementMode() {
        if (!this.isMyTurn() || this.state.currentPhase !== PHASES.POPULATE) {
            return;
        }
        
        const player = this.state.getCurrentPlayer();
        if (player.markersOnBoard >= player.markers) {
            return;
        }
        
        if (this.markerPlacementMode) {
            this.exitMarkerPlacementMode();
        } else {
            this.enterMarkerPlacementMode();
        }
    }
    
    enterMarkerPlacementMode() {
        this.markerPlacementMode = true;
        const player = this.state.getCurrentPlayer();
        const validTiles = this.engine.getValidTiles(player);
        this.validDragTiles = new Set(validTiles.map(t => t.id));
        
        this.renderer.highlightValidTiles(validTiles, this.state);
        this.renderer.setMarkerPlacementActive(true);
        
        // Add click-outside handler to cancel
        document.addEventListener('click', this.handlePlacementOutsideClick);
    }
    
    exitMarkerPlacementMode() {
        this.markerPlacementMode = false;
        this.validDragTiles.clear();
        this.renderer.clearTileHighlights();
        this.renderer.setMarkerPlacementActive(false);
        
        document.removeEventListener('click', this.handlePlacementOutsideClick);
    }
    
    handlePlacementOutsideClick = (e) => {
        // If click is not on a tile or the marker button, exit placement mode
        if (!e.target.closest('.hex-tile') && !e.target.closest('#drag-marker')) {
            this.exitMarkerPlacementMode();
        }
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
    
    setupExperimentalOptions() {
        // Setup for both solo and local modes
        ['solo', 'local'].forEach(mode => {
            const toggle = $(`#${mode}-experimental-toggle`);
            const content = $(`#${mode}-experimental-content`);
            const checkbox = $(`#${mode}-allele-decay`);
            const difficultySelector = $(`#${mode}-difficulty-selector`);
            const difficultyButtons = $$(`#${mode}-difficulty-selector .difficulty-btn`);
            
            // Toggle expand/collapse
            toggle?.addEventListener('click', () => {
                content.classList.toggle('hidden');
                const icon = toggle.querySelector('.toggle-icon');
                icon.textContent = content.classList.contains('hidden') ? '▶' : '▼';
            });
            
            // Checkbox toggles difficulty selector visibility
            checkbox?.addEventListener('change', () => {
                if (checkbox.checked) {
                    difficultySelector.classList.remove('hidden');
                } else {
                    difficultySelector.classList.add('hidden');
                }
            });
            
            // Difficulty button selection
            difficultyButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    difficultyButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    }
    
    getExperimentalSettings(mode) {
        const checkbox = $(`#${mode}-allele-decay`);
        const activeBtn = $(`#${mode}-difficulty-selector .difficulty-btn.active`);
        
        return {
            alleleDecayEnabled: checkbox?.checked || false,
            difficulty: activeBtn?.dataset.difficulty || DIFFICULTY.NORMAL
        };
    }
    
    // Mode Selection
    handleModeSelect(mode) {
        $('#mode-select').classList.add('hidden');
        
        if (mode === 'solo') {
            $('#solo-setup').classList.remove('hidden');
        } else if (mode === 'local') {
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
        
        // Apply experimental settings
        const settings = this.getExperimentalSettings('local');
        this.state.alleleDecayEnabled = settings.alleleDecayEnabled;
        this.state.difficulty = settings.difficulty;
        
        this.renderer.showScreen('game-screen');
        this.renderer.initBoardInteractions?.();
        this.initTechTreeZoom();
        this.updateUI();
        
        console.log('Local game started with players:', names);
    }
    
    // Solo Survival Game
    startSoloGame() {
        this.mode = MODE.SOLO;
        const name = $('#solo-player-name')?.value?.trim() || 'Survivor';
        this.state.initializeSoloGame(name);
        
        // Apply experimental settings
        const settings = this.getExperimentalSettings('solo');
        this.state.alleleDecayEnabled = settings.alleleDecayEnabled;
        this.state.difficulty = settings.difficulty;
        
        this.renderer.showScreen('game-screen');
        this.renderer.initBoardInteractions?.();
        this.initTechTreeZoom();
        
        // Show the threat indicator for solo mode
        $('#threat-indicator')?.classList.remove('hidden');
        
        this.updateUI();
        
        console.log('Solo survival game started:', name);
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
        this.initTechTreeZoom();
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
            this.initTechTreeZoom();
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
            this.initTechTreeZoom();
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
                this.engine.rollAllelesWithValue(player, action.die);
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
    
    // Tech tree zoom - dynamically calculate based on container width
    initTechTreeZoom() {
        const container = $('#tech-tree-scroll');
        if (!container) return;
        
        // Calculate zoom to show exactly 5 eras
        const containerWidth = container.clientWidth;
        this.ttZoom = containerWidth / (this.ttVisibleEras * this.ttEraWidth);
        this.ttZoom = Math.max(0.5, Math.min(2, this.ttZoom));
        
        this.applyTTZoom();
    }
    
    techTreeZoom(delta) {
        this.ttZoom = (this.ttZoom || 1) + delta;
        this.ttZoom = Math.max(0.5, Math.min(2, this.ttZoom));
        this.applyTTZoom();
    }
    
    toggleTechTreeFullscreen() {
        const panel = $('#tech-tree-panel');
        const btn = $('#tt-fullscreen');
        if (!panel) return;
        
        panel.classList.toggle('fullscreen');
        const isFullscreen = panel.classList.contains('fullscreen');
        btn.textContent = isFullscreen ? '⤡' : '⤢';
        btn.title = isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen';
        
        // Re-init zoom to fit new container size after transition
        setTimeout(() => this.initTechTreeZoom(), 300);
    }
    
    applyTTZoom() {
        const svg = $('#tech-tree-svg');
        if (svg) {
            svg.style.transform = `scale(${this.ttZoom})`;
            svg.style.transformOrigin = 'top left';
        }
        this.updateTTVisibleRange();
    }
    
    updateTTVisibleRange() {
        const container = $('#tech-tree-scroll');
        const label = $('#tt-zoom-level');
        if (!container || !label) return;
        
        // Sync lane header overlay vertical scroll with content
        const laneOverlay = $('#lane-header-overlay');
        if (laneOverlay) {
            laneOverlay.style.transform = `translateY(-${container.scrollTop}px)`;
        }
        
        // Calculate which eras are visible based on scroll + zoom
        const scrollLeft = container.scrollLeft;
        const visibleWidth = container.clientWidth;
        const scaledEraWidth = this.ttEraWidth * this.ttZoom;
        
        // First visible era (0-indexed)
        const firstEra = Math.floor(scrollLeft / scaledEraWidth);
        // Last visible era
        const lastEra = Math.min(11, Math.floor((scrollLeft + visibleWidth) / scaledEraWidth));
        
        // Get MYA values (ERA_MYA goes from 540 to 2.6)
        const startMYA = ERA_MYA[firstEra] || 540;
        const endMYA = ERA_MYA[Math.min(11, lastEra + 1)] || 0;
        
        // Format the range
        const formatMYA = (mya) => mya >= 1 ? Math.round(mya) : mya.toFixed(1);
        label.textContent = `${formatMYA(startMYA)}–${formatMYA(endMYA)} MYA`;
    }
    
    // Turn Control
    isMyTurn() {
        if (this.mode === MODE.LOCAL) return true;
        if (this.mode === MODE.SOLO) return true;
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
        this.renderer.renderGenomeBar(player, this.state.traitDb);
        this.renderer.renderTechTree(player, this.state.currentEra, this.state.traitDb, this.state.discardedEvents, this.state.eventDeck);
        this.renderer.updatePlayerStats(player, this.state.traitDb, this.state.currentPhase, this.isMyTurn());
        this.renderer.updateEventDeck(this.state);
        this.renderer.renderPlayersBar(this.state.players, this.state.currentPlayerIndex, this.state.traitDb, this.state.currentEra, organisms);
        this.renderer.renderOrganismMatch(player, this.state.currentEra, organisms);
        
        const playable = this.engine.getPlayableTraits(player);
        this.renderer.renderHand(player, playable);
        
        const canAct = this.isMyTurn() && !this.isProcessing;
        this.renderer.updateActionButtons(this.state.currentPhase, this.currentPlayerRolled, canAct);
        
        if (this.mode === MODE.SPECTATOR) {
            this.showSpectatorBanner();
        }
        
        // Update threat indicator for solo mode
        if (this.mode === MODE.SOLO) {
            this.updateThreatIndicator();
        }
    }
    
    updateThreatIndicator() {
        const threatLevel = this.engine.getThreatLevel();
        const totalRivals = this.state.totalRivals;
        
        const fill = $('#threat-fill');
        const label = $('#threat-label');
        const status = $('#threat-status');
        
        if (fill) {
            fill.style.width = `${threatLevel}%`;
            
            // Color based on threat level
            if (threatLevel < 25) {
                fill.className = 'threat-fill threat-low';
            } else if (threatLevel < 50) {
                fill.className = 'threat-fill threat-medium';
            } else if (threatLevel < 75) {
                fill.className = 'threat-fill threat-high';
            } else {
                fill.className = 'threat-fill threat-critical';
            }
        }
        
        if (label) {
            label.textContent = `${totalRivals} rival${totalRivals !== 1 ? 's' : ''}`;
        }
        
        if (status) {
            if (threatLevel < 25) {
                status.textContent = 'Threat: Low';
            } else if (threatLevel < 50) {
                status.textContent = 'Threat: Medium';
            } else if (threatLevel < 75) {
                status.textContent = 'Threat: High';
            } else {
                status.textContent = 'Threat: Critical!';
            }
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
        if (this.isProcessing) return;
        if (!this.isMyTurn()) return;
        if (this.currentPlayerRolled) return;
        
        this.isProcessing = true;
        
        const player = this.state.getCurrentPlayer();
        
        const result = await this.renderer.showDiceRoll(
            `${player.name}: Reproductive Cycle`,
            () => this.engine.rollAlleles(player)
        );
        
        this.currentPlayerRolled = true;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'roll_alleles', die: result.die });
        } else if (this.mode === MODE.HOST && this.mpHost) {
            this.mpHost.broadcastState(this.state);
        }
        
        this.isProcessing = false;
        this.updateUI();
    }
    
    async handleEndPhase() {
        if (this.isProcessing) return;
        if (!this.isMyTurn() && this.mode !== MODE.LOCAL) return;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'end_phase' });
            return;
        }
        
        this.isProcessing = true;
        await this.processEndPhase();
        this.isProcessing = false;
        
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
                    
                    // In solo mode, spawn new rivals at the start of each era (after draw)
                    if (this.mode === MODE.SOLO && this.state.currentEra > 0) {
                        this.engine.spawnRivals();
                    }
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
                
                // Check if player went extinct in solo mode
                if (this.mode === MODE.SOLO && this.state.soloExtinct) {
                    this.handleGameOver();
                    return;
                }
                
                // Enforce hand limits at end of era (if enabled)
                this.engine.enforceHandLimits();
                
                // Apply TE proliferation penalty for isolated tiles (lack of selection pressure)
                const teResults = this.engine.applyTEProliferation();
                if (teResults.length > 0) {
                    await this.showTEProliferationResults(teResults);
                }
                
                // Apply allele decay at end of era (if enabled)
                const decayResults = this.engine.applyAlleleDecay();
                if (decayResults.length > 0) {
                    await this.showAlleleDecayResults(decayResults);
                }
                
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
        if (this.isProcessing) return;
        if (!this.isMyTurn() && this.mode !== MODE.LOCAL) return;
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'end_turn' });
            return;
        }
        
        this.isProcessing = true;
        this.processEndTurn();
        this.isProcessing = false;
        
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
        // If in marker placement mode, try to place marker
        if (this.markerPlacementMode && this.validDragTiles.has(tile.id)) {
            this.handleMarkerPlacement(tile.id);
            return;
        }
        
        // Otherwise show tile info modal
        this.renderer.showTileInfo(tile, this.state);
    }
    
    handleMarkerPlacement(tileId) {
        if (!this.isMyTurn()) return;
        if (this.state.currentPhase !== PHASES.POPULATE) return;
        
        const player = this.state.getCurrentPlayer();
        
        if (this.mode === MODE.CLIENT && this.mpClient) {
            this.mpClient.sendAction({ type: 'place_marker', tileId });
            this.exitMarkerPlacementMode();
            return;
        }
        
        const result = this.engine.placeMarker(player, tileId);
        
        if (result.success) {
            console.log(`${player.name} placed marker on tile`);
            
            if (this.mode === MODE.HOST && this.mpHost) {
                this.mpHost.broadcastState(this.state);
            }
            
            this.exitMarkerPlacementMode();
            this.updateUI();
        } else {
            console.log(`Cannot place marker: ${result.reason}`);
        }
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
    
    handleGenomeTraitClick(trait) {
        // Show trait detail for genome bar clicks (read-only, already owned)
        const player = this.state.getCurrentPlayer();
        this.renderer.showCardDetail(
            trait,
            player,
            this.state.traitDb,
            false,  // canBuy = false (already owned)
            false,  // isEvolutionPhase irrelevant for owned traits
            () => {}
        );
    }
    
    handleEventMarkerClick(event, era) {
        // Show the event card for a past event from the timeline
        // Use showEvent with empty results since this is just viewing history
        this.renderer.showEvent(event, []);
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
    
    // Tech tree trait click - show details modal
    handleTechTreeClick(trait, traitState) {
        const player = this.state.getCurrentPlayer();
        const isEvolutionPhase = this.state.currentPhase === PHASES.EVOLUTION;
        const cost = player.getTraitCost(trait, this.state.traitDb);
        const ownedTraits = new Set(player.traits);
        const missingPrereqs = (trait.hard_prereqs || []).filter(p => !ownedTraits.has(p));
        const eraValid = this.state.currentEra >= trait.era_min && this.state.currentEra <= trait.era_max;
        const canAfford = player.alleles >= cost;
        const canPlay = this.isMyTurn() && isEvolutionPhase && traitState === 'available';
        
        // Store the trait for potential play action
        this.selectedTechTreeTrait = trait;
        
        // Highlight prerequisite path in tech tree
        this.renderer.highlightTechPath(trait.id, this.state.traitDb);
        
        // Populate modal
        $('#trait-modal-name').textContent = trait.name;
        $('#trait-modal-cost').textContent = `Cost: ${player.getTraitCost(trait, this.state.traitDb)}`;
        $('#trait-modal-era').textContent = `Era ${trait.era_min}-${trait.era_max}`;
        $('#trait-modal-grants').textContent = trait.grants;
        
        // Tags
        const tagsContainer = $('#trait-modal-tags');
        tagsContainer.innerHTML = '';
        for (const tag of (trait.tags || [])) {
            const tagEl = document.createElement('span');
            tagEl.className = 'trait-tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        }
        
        // Prerequisites
        const prereqsContainer = $('#trait-modal-prereqs');
        prereqsContainer.innerHTML = '';
        
        const hasPrereqs = (trait.hard_prereqs?.length || 0) + (trait.soft_prereqs?.length || 0) + (trait.alt_prereqs?.length || 0) > 0;
        
        if (hasPrereqs) {
            const h4 = document.createElement('h4');
            h4.textContent = 'Prerequisites';
            prereqsContainer.appendChild(h4);
            
            const list = document.createElement('div');
            list.className = 'prereq-list';
            
            // Hard prereqs
            for (const prereqId of (trait.hard_prereqs || [])) {
                const prereq = this.state.traitDb[prereqId];
                const item = document.createElement('div');
                item.className = 'prereq-item hard';
                if (ownedTraits.has(prereqId)) item.classList.add('met');
                item.textContent = prereq ? prereq.name : prereqId;
                list.appendChild(item);
            }
            
            // Soft prereqs
            for (const prereqId of (trait.soft_prereqs || [])) {
                const prereq = this.state.traitDb[prereqId];
                const item = document.createElement('div');
                item.className = 'prereq-item soft';
                if (ownedTraits.has(prereqId)) item.classList.add('met');
                item.textContent = `${prereq ? prereq.name : prereqId} (optional)`;
                list.appendChild(item);
            }
            
            // Alt prereqs
            for (const altGroup of (trait.alt_prereqs || [])) {
                const names = altGroup.map(id => {
                    const p = this.state.traitDb[id];
                    return p ? p.name : id;
                }).join(' OR ');
                const item = document.createElement('div');
                item.className = 'prereq-item alt';
                const anyMet = altGroup.some(id => ownedTraits.has(id));
                if (anyMet) item.classList.add('met');
                item.textContent = `${names} (alternate)`;
                list.appendChild(item);
            }
            
            prereqsContainer.appendChild(list);
        }
        
        // Configure evolve button with informative state
        const playBtn = $('#btn-trait-play');
        playBtn.classList.remove('hidden');
        
        if (traitState === 'owned') {
            playBtn.textContent = 'Already Evolved';
            playBtn.disabled = true;
        } else if (!isEvolutionPhase) {
            playBtn.textContent = 'Evolution Phase Only';
            playBtn.disabled = true;
        } else if (!eraValid) {
            playBtn.textContent = `Available Era ${trait.era_min}-${trait.era_max}`;
            playBtn.disabled = true;
        } else if (missingPrereqs.length > 0) {
            const prereqName = this.state.traitDb[missingPrereqs[0]]?.name || missingPrereqs[0];
            playBtn.textContent = `Requires: ${prereqName}`;
            playBtn.disabled = true;
        } else if (!canAfford) {
            playBtn.textContent = `Need ${cost} Alleles`;
            playBtn.disabled = true;
        } else if (canPlay) {
            playBtn.textContent = `Evolve (${cost} Alleles)`;
            playBtn.disabled = false;
        } else {
            playBtn.textContent = 'Cannot Evolve';
            playBtn.disabled = true;
        }
        
        // Show modal
        $('#modal-overlay').classList.remove('hidden');
        $('#trait-modal').classList.remove('hidden');
    }
    
    playTraitFromModal() {
        if (this.selectedTechTreeTrait) {
            this.handleBuyTrait(this.selectedTechTreeTrait);
            this.closeTraitModal();
        }
    }
    
    closeTraitModal() {
        $('#modal-overlay').classList.add('hidden');
        $('#trait-modal').classList.add('hidden');
        this.selectedTechTreeTrait = null;
        this.renderer.clearTechPathHighlight();
    }
    
    async handleCompetitionPhase() {
        // Use solo competition if in solo mode
        if (this.mode === MODE.SOLO) {
            await this.handleSoloCompetitionPhase();
            return;
        }
        
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
    
    async handleSoloCompetitionPhase() {
        const results = this.engine.resolveSoloCompetition();
        
        // Only show visuals if there are contested tiles
        const contestedResults = results.filter(r => r.contested);
        
        if (contestedResults.length > 0) {
            // Show solo competition results
            this.renderer.showSoloCompetitionResults(contestedResults, this.state);
            
            // Wait for player to observe the results
            await delay(2500);
            
            // Clear all competition visuals
            this.renderer.clearCompetitionVisuals();
        }
        
        // Check if player went extinct
        if (this.state.soloExtinct) {
            this.handleGameOver();
            return;
        }
        
        // Spread rivals after competition
        this.engine.spreadRivals();
        
        this.state.advancePhase();
    }
    
    async handleTileFlipPhase() {
        // Get tiles that are at risk of flipping (not era-locked)
        const atRiskTiles = this.state.boardTiles.filter(tile => 
            this.state.currentEra >= tile.eraLock
        );
        
        // Use engine's flipTiles which respects climate zones
        const { roll, flipped } = this.engine.flipTiles();
        
        // Show the indicator with roll and highlight at-risk tiles
        this.renderer.showTileFlipIndicator(roll, atRiskTiles);
        
        // Wait for players to see the roll
        await delay(1200);
        
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
    
    async showAlleleDecayResults(results) {
        const messages = results.map(r => 
            `${r.player.name} lost ${r.lost} allele${r.lost !== 1 ? 's' : ''} (${r.before} → ${r.after})`
        );
        
        await this.renderer.showNotification('Allele Decay', messages.join('\n'), 2000);
    }
    
    async showTEProliferationResults(results) {
        const messages = results.map(r => {
            const penalty = Math.floor(r.totalTeBloat / 500);
            return `${r.player.name}: ${r.isolatedTiles} isolated tile${r.isolatedTiles !== 1 ? 's' : ''} → +${r.teGained}kb TE bloat${penalty > 0 ? ` (+${penalty} complexity)` : ''}`;
        });
        
        await this.renderer.showNotification('TE Proliferation', messages.join('\n'), 2500);
    }
    
    handleGameOver() {
        const scores = this.state.getFinalScores();
        
        const organisms = this.state.players.map(player => ({
            player,
            ...this.state.findClosestOrganism(player)
        }));
        
        // Handle solo mode game over differently
        if (this.mode === MODE.SOLO) {
            this.renderer.showSoloGameOver(
                this.state.soloExtinct,
                this.state.currentEra,
                scores[0],
                organisms[0]
            );
        } else {
            this.renderer.showGameOver(scores, organisms);
        }
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
        $('#threat-indicator')?.classList.add('hidden');
        $('#chat-messages').innerHTML = '';
        
        const url = new URL(window.location);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url);
    }
}

// Initialize game on page load
const game = new Game();
game.init().catch(console.error);
