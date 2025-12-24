// Multiplayer module using PeerJS for P2P WebRTC connections
// Host owns game state, clients send actions and receive state updates

const MESSAGE_TYPES = {
    STATE_UPDATE: 'state',
    ACTION: 'action',
    CHAT: 'chat',
    PLAYER_JOIN: 'player_join',
    PLAYER_LEAVE: 'player_leave',
    SLOT_CLAIM: 'slot_claim',
    SLOT_UPDATE: 'slot_update',
    WELCOME: 'welcome',
    ERROR: 'error',
    SHOW_EVENT: 'show_event'
};

// Generate a short room code from peer ID
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Convert room code to PeerJS ID format
function roomCodeToPeerId(code) {
    return `dnys_${code.toUpperCase()}`;
}

// Extract room code from URL
function getRoomCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.toUpperCase() || null;
}

// Set room code in URL without reload
function setRoomCodeInURL(code) {
    const url = new URL(window.location);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url);
}

// Get shareable link
function getShareLink(code) {
    const url = new URL(window.location);
    url.searchParams.set('room', code);
    return url.toString();
}


export class MultiplayerHost {
    constructor(callbacks = {}) {
        this.peer = null;
        this.connections = new Map();
        this.roomCode = null;
        this.playerSlots = [];
        this.spectators = new Set();
        this.chatHistory = [];
        this.callbacks = callbacks;
        this.gameState = null;
    }

    async initialize(playerCount, hostName) {
        return new Promise((resolve, reject) => {
            this.roomCode = generateRoomCode();
            const peerId = roomCodeToPeerId(this.roomCode);

            this.peer = new Peer(peerId);

            this.peer.on('open', () => {
                console.log(`[Host] Room created: ${this.roomCode}`);
                setRoomCodeInURL(this.roomCode);
                
                this.playerSlots = Array(playerCount).fill(null);
                this.playerSlots[0] = {
                    name: hostName,
                    peerId: 'host',
                    connected: true
                };
                
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => this.handleConnection(conn));

            this.peer.on('error', (err) => {
                console.error('[Host] Peer error:', err);
                if (err.type === 'unavailable-id') {
                    reject(new Error('Room code already in use. Try again.'));
                } else {
                    reject(err);
                }
            });
        });
    }

    handleConnection(conn) {
        console.log(`[Host] New connection from ${conn.peer}`);
        
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            
            conn.send({
                type: MESSAGE_TYPES.WELCOME,
                roomCode: this.roomCode,
                slots: this.playerSlots,
                gameState: this.gameState?.toJSON() || null,
                chatHistory: this.chatHistory.slice(-50)
            });
            
            if (this.callbacks.onPlayerConnect) {
                this.callbacks.onPlayerConnect(conn.peer);
            }
        });

        conn.on('data', (data) => this.handleMessage(conn.peer, data));

        conn.on('close', () => {
            console.log(`[Host] Connection closed: ${conn.peer}`);
            this.handleDisconnect(conn.peer);
        });

        conn.on('error', (err) => {
            console.error(`[Host] Connection error for ${conn.peer}:`, err);
        });
    }

    handleMessage(peerId, data) {
        switch (data.type) {
            case MESSAGE_TYPES.SLOT_CLAIM:
                this.handleSlotClaim(peerId, data.slotIndex, data.name);
                break;
                
            case MESSAGE_TYPES.ACTION:
                if (this.callbacks.onAction) {
                    this.callbacks.onAction(peerId, data.action);
                }
                break;
                
            case MESSAGE_TYPES.CHAT:
                this.handleChat(peerId, data.text);
                break;
        }
    }

    handleSlotClaim(peerId, slotIndex, name) {
        if (slotIndex < 0 || slotIndex >= this.playerSlots.length) {
            this.sendToPeer(peerId, { 
                type: MESSAGE_TYPES.ERROR, 
                message: 'Invalid slot' 
            });
            return;
        }

        const existingSlot = this.playerSlots[slotIndex];
        if (existingSlot && existingSlot.connected && existingSlot.peerId !== peerId) {
            this.sendToPeer(peerId, { 
                type: MESSAGE_TYPES.ERROR, 
                message: 'Slot already taken' 
            });
            return;
        }

        for (let i = 0; i < this.playerSlots.length; i++) {
            if (this.playerSlots[i]?.peerId === peerId) {
                this.playerSlots[i] = null;
            }
        }

        this.spectators.delete(peerId);

        this.playerSlots[slotIndex] = {
            name: name,
            peerId: peerId,
            connected: true
        };

        this.broadcastSlotUpdate();
        
        if (this.callbacks.onSlotClaim) {
            this.callbacks.onSlotClaim(slotIndex, name, peerId);
        }
    }

    handleDisconnect(peerId) {
        this.connections.delete(peerId);
        this.spectators.delete(peerId);

        for (let i = 0; i < this.playerSlots.length; i++) {
            if (this.playerSlots[i]?.peerId === peerId) {
                this.playerSlots[i].connected = false;
            }
        }

        this.broadcastSlotUpdate();
        
        if (this.callbacks.onPlayerDisconnect) {
            this.callbacks.onPlayerDisconnect(peerId);
        }
    }

    handleChat(peerId, text) {
        const slot = this.playerSlots.find(s => s?.peerId === peerId);
        const senderName = slot?.name || 'Spectator';
        
        const message = {
            from: senderName,
            text: text,
            timestamp: Date.now()
        };
        
        this.chatHistory.push(message);
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
        
        this.broadcast({ type: MESSAGE_TYPES.CHAT, ...message });
        
        if (this.callbacks.onChat) {
            this.callbacks.onChat(message);
        }
    }

    joinAsSpectator(peerId) {
        for (let i = 0; i < this.playerSlots.length; i++) {
            if (this.playerSlots[i]?.peerId === peerId) {
                this.playerSlots[i] = null;
            }
        }
        
        this.spectators.add(peerId);
        this.broadcastSlotUpdate();
    }

    broadcastState(gameState) {
        this.gameState = gameState;
        this.broadcast({
            type: MESSAGE_TYPES.STATE_UPDATE,
            data: gameState.toJSON()
        });
    }

    broadcastEvent(event, results) {
        this.broadcast({
            type: MESSAGE_TYPES.SHOW_EVENT,
            event: event,
            results: results.map(r => ({
                playerId: r.player.id,
                playerName: r.player.name,
                playerColor: r.player.color,
                status: r.status,
                message: r.message,
                lostMarkers: r.lostMarkers || 0
            }))
        });
    }

    broadcastSlotUpdate() {
        this.broadcast({
            type: MESSAGE_TYPES.SLOT_UPDATE,
            slots: this.playerSlots
        });
        
        if (this.callbacks.onSlotsChange) {
            this.callbacks.onSlotsChange(this.playerSlots);
        }
    }

    broadcast(message) {
        for (const conn of this.connections.values()) {
            conn.send(message);
        }
    }

    sendToPeer(peerId, message) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.send(message);
        }
    }

    sendChat(text) {
        const message = {
            from: this.playerSlots[0]?.name || 'Host',
            text: text,
            timestamp: Date.now()
        };
        
        this.chatHistory.push(message);
        this.broadcast({ type: MESSAGE_TYPES.CHAT, ...message });
        
        if (this.callbacks.onChat) {
            this.callbacks.onChat(message);
        }
    }

    getPlayerNames() {
        return this.playerSlots.map((slot, i) => 
            slot?.name || `Player ${i + 1}`
        );
    }

    allSlotsReady() {
        return this.playerSlots.every(slot => slot !== null && slot.connected);
    }

    getShareLink() {
        return getShareLink(this.roomCode);
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
        }
    }
}


export class MultiplayerClient {
    constructor(callbacks = {}) {
        this.peer = null;
        this.hostConnection = null;
        this.roomCode = null;
        this.playerSlots = [];
        this.mySlotIndex = -1;
        this.chatHistory = [];
        this.callbacks = callbacks;
        this.reconnecting = false;
    }

    async connect(roomCode) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode.toUpperCase();
            const hostPeerId = roomCodeToPeerId(this.roomCode);

            this.peer = new Peer();

            this.peer.on('open', () => {
                console.log(`[Client] Connecting to room ${this.roomCode}...`);
                
                this.hostConnection = this.peer.connect(hostPeerId, {
                    reliable: true
                });

                this.hostConnection.on('open', () => {
                    console.log('[Client] Connected to host');
                    setRoomCodeInURL(this.roomCode);
                });

                this.hostConnection.on('data', (data) => this.handleMessage(data));

                this.hostConnection.on('close', () => {
                    console.log('[Client] Disconnected from host');
                    if (this.callbacks.onDisconnect) {
                        this.callbacks.onDisconnect();
                    }
                });

                this.hostConnection.on('error', (err) => {
                    console.error('[Client] Connection error:', err);
                    reject(err);
                });

                setTimeout(() => {
                    if (!this.hostConnection.open) {
                        reject(new Error('Connection timeout - room may not exist'));
                    }
                }, 10000);
            });

            this.peer.on('error', (err) => {
                console.error('[Client] Peer error:', err);
                reject(err);
            });

            this.once('welcome', () => resolve(this.roomCode));
        });
    }

    once(eventType, callback) {
        const handler = (data) => {
            if (data.type === MESSAGE_TYPES.WELCOME) {
                callback(data);
            }
        };
        this._onceHandlers = this._onceHandlers || [];
        this._onceHandlers.push({ type: eventType, handler });
    }

    handleMessage(data) {
        if (this._onceHandlers) {
            this._onceHandlers = this._onceHandlers.filter(h => {
                if (h.type === 'welcome' && data.type === MESSAGE_TYPES.WELCOME) {
                    h.handler(data);
                    return false;
                }
                return true;
            });
        }

        switch (data.type) {
            case MESSAGE_TYPES.WELCOME:
                this.playerSlots = data.slots;
                this.chatHistory = data.chatHistory || [];
                
                if (this.callbacks.onWelcome) {
                    this.callbacks.onWelcome(data);
                }
                break;

            case MESSAGE_TYPES.STATE_UPDATE:
                if (this.callbacks.onStateUpdate) {
                    this.callbacks.onStateUpdate(data.data);
                }
                break;

            case MESSAGE_TYPES.SLOT_UPDATE:
                this.playerSlots = data.slots;
                this.mySlotIndex = this.playerSlots.findIndex(
                    s => s?.peerId === this.peer.id
                );
                
                if (this.callbacks.onSlotsChange) {
                    this.callbacks.onSlotsChange(this.playerSlots, this.mySlotIndex);
                }
                break;

            case MESSAGE_TYPES.CHAT:
                const message = {
                    from: data.from,
                    text: data.text,
                    timestamp: data.timestamp
                };
                this.chatHistory.push(message);
                
                if (this.callbacks.onChat) {
                    this.callbacks.onChat(message);
                }
                break;

            case MESSAGE_TYPES.ERROR:
                if (this.callbacks.onError) {
                    this.callbacks.onError(data.message);
                }
                break;

            case MESSAGE_TYPES.SHOW_EVENT:
                if (this.callbacks.onShowEvent) {
                    this.callbacks.onShowEvent(data.event, data.results);
                }
                break;
        }
    }

    claimSlot(slotIndex, name) {
        this.send({
            type: MESSAGE_TYPES.SLOT_CLAIM,
            slotIndex: slotIndex,
            name: name
        });
    }

    sendAction(action) {
        this.send({
            type: MESSAGE_TYPES.ACTION,
            action: action
        });
    }

    sendChat(text) {
        this.send({
            type: MESSAGE_TYPES.CHAT,
            text: text
        });
    }

    send(message) {
        if (this.hostConnection?.open) {
            this.hostConnection.send(message);
        }
    }

    isMyTurn(currentPlayerIndex) {
        return this.mySlotIndex === currentPlayerIndex;
    }

    isSpectator() {
        return this.mySlotIndex === -1;
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
        }
    }
}


export function checkForRoomInURL() {
    return getRoomCodeFromURL();
}

export { getShareLink };

