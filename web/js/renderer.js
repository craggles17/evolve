// Renderer - DOM updates and SVG rendering

import { 
    $, $$, createElement, createSVGElement,
    offsetToPixel, getHexCorners, cornersToPoints,
    ERA_NAMES, ERA_COLORS, ERA_TEXT_COLORS, ERA_MYA, PLAYER_COLORS, STABILITY_INFO, TAG_EMOJI,
    HEX_SIZE, HEX_WIDTH, HEX_VERT_SPACING
} from './utils.js';
import { PHASE_NAMES, PHASE_HINTS } from './state.js';
import { findBestOrganism, formatSimilarity } from './organisms.js';

// Board layout constants (matches tiles.json: 7 rows x 10 cols)
const BOARD_COLS = 10;
const BOARD_ROWS = 7;
const BOARD_PADDING = 50;

export class Renderer {
    constructor() {
        this.hexBoard = $('#hex-board');
        this.boardContent = null;  // SVG group for pan/zoom transforms
        this.callbacks = {
            onTileClick: null,
            onCardClick: null,
            onTraitSlotClick: null,
            onMarkerDrop: null
        };
        
        // Pan/zoom state
        this.viewTransform = { x: 0, y: 0, scale: 1 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.minScale = 0.5;
        this.maxScale = 3;
    }
    
    // Initialize board pan/zoom interactions
    initBoardInteractions() {
        const container = $('#board-container');
        
        // Mouse wheel zoom
        this.hexBoard.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.hexBoard.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
            this.zoomAt(mouseX, mouseY, zoomFactor);
        }, { passive: false });
        
        // Mouse pan
        this.hexBoard.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
                this.hexBoard.style.cursor = 'grabbing';
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.panStart = { x: e.clientX, y: e.clientY };
            
            // Convert screen delta to SVG coordinates
            const rect = this.hexBoard.getBoundingClientRect();
            const viewBox = this.hexBoard.viewBox.baseVal;
            const scaleX = viewBox.width / rect.width;
            const scaleY = viewBox.height / rect.height;
            
            const panDampening = 0.7;
            this.viewTransform.x -= dx * scaleX / this.viewTransform.scale * panDampening;
            this.viewTransform.y -= dy * scaleY / this.viewTransform.scale * panDampening;
            this.applyTransform();
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.hexBoard.style.cursor = 'grab';
            }
        });
        
        // Touch support for mobile
        let lastTouchDist = 0;
        let lastTouchCenter = { x: 0, y: 0 };
        
        this.hexBoard.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isPanning = true;
                this.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                this.isPanning = false;
                lastTouchDist = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                lastTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            }
        }, { passive: true });
        
        this.hexBoard.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.isPanning) {
                const dx = e.touches[0].clientX - this.panStart.x;
                const dy = e.touches[0].clientY - this.panStart.y;
                this.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                
                const rect = this.hexBoard.getBoundingClientRect();
                const viewBox = this.hexBoard.viewBox.baseVal;
                const scaleX = viewBox.width / rect.width;
                const scaleY = viewBox.height / rect.height;
                
                const panDampening = 0.7;
                this.viewTransform.x -= dx * scaleX / this.viewTransform.scale * panDampening;
                this.viewTransform.y -= dy * scaleY / this.viewTransform.scale * panDampening;
                this.applyTransform();
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                const center = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                
                if (lastTouchDist > 0) {
                    const zoomFactor = 1 + (dist / lastTouchDist - 1) * 0.5;
                    const rect = this.hexBoard.getBoundingClientRect();
                    this.zoomAt(center.x - rect.left, center.y - rect.top, zoomFactor);
                }
                
                lastTouchDist = dist;
                lastTouchCenter = center;
            }
        }, { passive: false });
        
        this.hexBoard.addEventListener('touchend', () => {
            this.isPanning = false;
            lastTouchDist = 0;
        }, { passive: true });
        
        // Set initial cursor
        this.hexBoard.style.cursor = 'grab';
    }
    
    zoomAt(screenX, screenY, factor) {
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.viewTransform.scale * factor));
        if (newScale === this.viewTransform.scale) return;
        
        // Get SVG point under cursor
        const rect = this.hexBoard.getBoundingClientRect();
        const viewBox = this.hexBoard.viewBox.baseVal;
        const svgX = (screenX / rect.width) * viewBox.width;
        const svgY = (screenY / rect.height) * viewBox.height;
        
        // Adjust transform to keep point under cursor stationary
        const scaleDiff = newScale / this.viewTransform.scale;
        this.viewTransform.x = svgX - (svgX - this.viewTransform.x) / scaleDiff;
        this.viewTransform.y = svgY - (svgY - this.viewTransform.y) / scaleDiff;
        this.viewTransform.scale = newScale;
        
        this.applyTransform();
    }
    
    applyTransform() {
        if (!this.boardContent) return;
        const { x, y, scale } = this.viewTransform;
        this.boardContent.setAttribute('transform', `translate(${-x * (scale - 1)}, ${-y * (scale - 1)}) scale(${scale})`);
    }
    
    resetZoom() {
        this.viewTransform = { x: 0, y: 0, scale: 1 };
        this.applyTransform();
    }
    
    zoomIn() {
        const rect = this.hexBoard.getBoundingClientRect();
        this.zoomAt(rect.width / 2, rect.height / 2, 1.25);
    }
    
    zoomOut() {
        const rect = this.hexBoard.getBoundingClientRect();
        this.zoomAt(rect.width / 2, rect.height / 2, 0.8);
    }
    
    // Setup screen
    setupPlayerCountButtons() {
        const buttons = $$('.count-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updatePlayerInputs(parseInt(btn.dataset.count));
            });
        });
    }
    
    updatePlayerInputs(count) {
        const inputs = $$('#player-names .player-input');
        inputs.forEach((input, i) => {
            if (i < count) {
                input.classList.remove('hidden');
            } else {
                input.classList.add('hidden');
            }
        });
    }
    
    getPlayerNames() {
        const count = parseInt($('.count-btn.active').dataset.count);
        const names = [];
        for (let i = 0; i < count; i++) {
            const input = $(`.player-input[data-player="${i}"] input`);
            names.push(input.value || `Player ${i + 1}`);
        }
        return names;
    }
    
    // Screen transitions
    showScreen(screenId) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#${screenId}`).classList.add('active');
    }
    
    // Header updates
    updateHeader(state) {
        $('#current-era').textContent = state.currentEra;
        $('#era-name').textContent = ERA_NAMES[state.currentEra];
        $('#current-phase').textContent = PHASE_NAMES[state.currentPhase];
        $('#phase-hint').textContent = PHASE_HINTS[state.currentPhase] || '';
        
        const player = state.getCurrentPlayer();
        $('#current-player-name').textContent = player.name;
        $('#current-player-indicator').style.background = player.color;
    }
    
    // Hex Board
    renderBoard(state) {
        this.hexBoard.innerHTML = '';
        
        // Calculate proper viewBox based on grid size
        const totalWidth = BOARD_COLS * HEX_WIDTH + HEX_WIDTH / 2 + BOARD_PADDING * 2;
        const totalHeight = BOARD_ROWS * HEX_VERT_SPACING + HEX_SIZE + BOARD_PADDING * 2;
        this.hexBoard.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        
        // Create content group for pan/zoom transforms
        this.boardContent = createSVGElement('g');
        this.boardContent.classList.add('board-content');
        this.hexBoard.appendChild(this.boardContent);
        
        // Add climate band labels
        this.renderClimateBandLabels();
        
        // Render all tiles
        for (const tile of state.boardTiles) {
            this.renderTile(tile, state);
        }
        
        // Restore pan/zoom transform after re-rendering
        this.applyTransform();
    }
    
    renderClimateBandLabels() {
        // Climate bands based on row positions (7 rows matching tiles.json)
        // Row 0, 6 = polar; Row 1, 2, 4, 5 = temperate; Row 3 = equatorial
        const bands = [
            { row: 0, label: 'POLAR', color: '#b0e0e6' },
            { row: 1.5, label: 'TEMPERATE', color: '#9acd32' },
            { row: 3, label: 'EQUATORIAL', color: '#3498db' },
            { row: 4.5, label: 'TEMPERATE', color: '#9acd32' },
            { row: 6, label: 'POLAR', color: '#b0e0e6' }
        ];
        
        for (const band of bands) {
            const y = BOARD_PADDING + HEX_SIZE + band.row * HEX_VERT_SPACING;
            const label = createSVGElement('text');
            label.setAttribute('x', 8);
            label.setAttribute('y', y);
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', band.color);
            label.setAttribute('opacity', '0.6');
            label.textContent = band.label;
            this.boardContent.appendChild(label);
        }
    }
    
    renderTile(tile, state) {
        // Use offset coordinates (col=q, row=r) with proper padding
        const { x, y } = offsetToPixel(tile.q, tile.r, BOARD_PADDING + HEX_WIDTH / 2, BOARD_PADDING + HEX_SIZE);
        const corners = getHexCorners(x, y, HEX_SIZE);
        
        const group = createSVGElement('g');
        group.classList.add('hex-tile');
        group.dataset.tileId = tile.id;
        
        // Hex polygon
        const polygon = createSVGElement('polygon');
        polygon.setAttribute('points', cornersToPoints(corners));
        polygon.setAttribute('fill', tile.biomeData.color);
        group.appendChild(polygon);
        
        // Biome label
        const label = createSVGElement('text');
        label.setAttribute('x', x);
        label.setAttribute('y', y - 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '8');
        label.textContent = tile.biomeData.name;
        group.appendChild(label);
        
        // Bonus tag emoji indicators
        const bonusTags = tile.biomeData.bonus_tags || [];
        if (bonusTags.length > 0) {
            const tagEmoji = createSVGElement('text');
            tagEmoji.setAttribute('x', x);
            tagEmoji.setAttribute('y', y + 10);
            tagEmoji.setAttribute('text-anchor', 'middle');
            tagEmoji.setAttribute('font-size', '8');
            tagEmoji.classList.add('tile-tag-emoji');
            const emojiStr = bonusTags.map(t => TAG_EMOJI[t] || '').filter(Boolean).join('');
            tagEmoji.textContent = emojiStr;
            group.appendChild(tagEmoji);
        }
        
        // Stability indicator (flip probability)
        const stability = STABILITY_INFO[tile.flipNumber];
        const flipText = createSVGElement('text');
        flipText.setAttribute('x', x);
        flipText.setAttribute('y', y + 25);
        flipText.setAttribute('text-anchor', 'middle');
        flipText.setAttribute('font-size', '9');
        flipText.setAttribute('fill', stability.color);
        flipText.textContent = `${stability.percent}% ▽`;
        group.appendChild(flipText);
        
        // Era lock indicator - colored corner triangle
        if (tile.eraLock > state.currentEra) {
            const eraColor = ERA_COLORS[tile.eraLock] || '#666';
            const textColor = ERA_TEXT_COLORS[tile.eraLock] || '#fff';
            
            // Corner triangle in top-right of hex
            const triSize = 14;
            const triX = x + 18;
            const triY = y - 22;
            const triangle = createSVGElement('polygon');
            triangle.setAttribute('points', `${triX},${triY} ${triX + triSize},${triY} ${triX + triSize},${triY + triSize}`);
            triangle.setAttribute('fill', eraColor);
            triangle.setAttribute('stroke', '#000');
            triangle.setAttribute('stroke-width', '0.5');
            group.appendChild(triangle);
            
            // Era number inside triangle
            const eraNum = createSVGElement('text');
            eraNum.setAttribute('x', triX + triSize - 4);
            eraNum.setAttribute('y', triY + 9);
            eraNum.setAttribute('text-anchor', 'middle');
            eraNum.setAttribute('font-size', '7');
            eraNum.setAttribute('font-weight', 'bold');
            eraNum.setAttribute('fill', textColor);
            eraNum.textContent = tile.eraLock;
            group.appendChild(eraNum);
        }
        
        // Render markers
        const markers = state.tileMarkers[tile.id];
        let markerOffset = 0;
        for (const [playerId, count] of Object.entries(markers)) {
            if (count > 0) {
                const player = state.players[parseInt(playerId)];
                this.renderMarkers(group, x, y, player, count, markerOffset);
                markerOffset++;
            }
        }
        
        // Render rival markers for solo mode
        if (state.isSoloMode && state.isSoloMode() && state.rivalMarkers) {
            const rivalCount = state.rivalMarkers[tile.id] || 0;
            if (rivalCount > 0) {
                this.renderRivalMarkers(group, x, y, rivalCount, markerOffset);
            }
        }
        
        // Click handler
        group.addEventListener('click', () => {
            if (this.callbacks.onTileClick) {
                this.callbacks.onTileClick(tile);
            }
        });
        
        // Drag and drop handlers for marker placement
        group.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (group.classList.contains('valid-target')) {
                e.dataTransfer.dropEffect = 'move';
                group.classList.add('drag-over');
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        });
        
        group.addEventListener('dragleave', () => {
            group.classList.remove('drag-over');
        });
        
        group.addEventListener('drop', (e) => {
            e.preventDefault();
            group.classList.remove('drag-over');
            if (this.callbacks.onMarkerDrop && group.classList.contains('valid-target')) {
                this.callbacks.onMarkerDrop(tile.id);
            }
        });
        
        this.boardContent.appendChild(group);
    }
    
    renderMarkers(group, cx, cy, player, count, offset) {
        const startX = cx - 15 + (offset * 12);
        const startY = cy + 8;
        
        for (let i = 0; i < Math.min(count, 3); i++) {
            const marker = createSVGElement('circle');
            marker.classList.add('hex-marker');
            marker.setAttribute('cx', startX + (i * 8));
            marker.setAttribute('cy', startY);
            marker.setAttribute('r', 4);
            marker.setAttribute('fill', player.color);
            group.appendChild(marker);
        }
        
        if (count > 3) {
            const moreText = createSVGElement('text');
            moreText.setAttribute('x', startX + 24);
            moreText.setAttribute('y', startY + 3);
            moreText.setAttribute('font-size', '8');
            moreText.setAttribute('fill', player.color);
            moreText.textContent = `+${count - 3}`;
            group.appendChild(moreText);
        }
    }
    
    renderRivalMarkers(group, cx, cy, count, offset) {
        const startX = cx - 15 + (offset * 12);
        const startY = cy + 8;
        const rivalColor = '#e85d04'; // Orange-red for rivals
        
        for (let i = 0; i < Math.min(count, 3); i++) {
            const marker = createSVGElement('circle');
            marker.classList.add('hex-marker', 'rival-marker');
            marker.setAttribute('cx', startX + (i * 8));
            marker.setAttribute('cy', startY);
            marker.setAttribute('r', 4);
            marker.setAttribute('fill', rivalColor);
            marker.setAttribute('stroke', '#fff');
            marker.setAttribute('stroke-width', '0.5');
            group.appendChild(marker);
        }
        
        if (count > 3) {
            const moreText = createSVGElement('text');
            moreText.setAttribute('x', startX + 24);
            moreText.setAttribute('y', startY + 3);
            moreText.setAttribute('font-size', '8');
            moreText.setAttribute('fill', rivalColor);
            moreText.textContent = `+${count - 3}`;
            group.appendChild(moreText);
        }
    }
    
    highlightValidTiles(tiles, state) {
        // Reset all tiles
        $$('.hex-tile').forEach(group => {
            group.classList.remove('valid-target', 'invalid-target');
            const polygon = group.querySelector('polygon:not(.locked)');
            if (polygon) {
                polygon.style.strokeWidth = '2';
                polygon.style.stroke = '#30363d';
            }
        });
        
        // Mark non-valid tiles as invalid
        $$('.hex-tile').forEach(group => {
            const tileId = parseInt(group.dataset.tileId);
            const isValid = tiles.some(t => t.id === tileId);
            if (!isValid) {
                group.classList.add('invalid-target');
            }
        });
        
        // Highlight valid ones with pulsing effect
        for (const tile of tiles) {
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (group) {
                group.classList.add('valid-target');
                const polygon = group.querySelector('polygon:not(.locked)');
                if (polygon) {
                    polygon.style.strokeWidth = '4';
                    polygon.style.stroke = '#3fb950';
                    polygon.style.filter = 'drop-shadow(0 0 6px rgba(63, 185, 80, 0.6))';
                }
            }
        }
    }
    
    clearTileHighlights() {
        $$('.hex-tile').forEach(group => {
            group.classList.remove('valid-target', 'invalid-target', 'drag-over');
            const polygon = group.querySelector('polygon:not(.locked)');
            if (polygon) {
                polygon.style.strokeWidth = '2';
                polygon.style.stroke = '#30363d';
                polygon.style.filter = '';
            }
        });
    }
    
    // Competition Phase Visualization
    showCompetitionResults(results, state) {
        // For each contested tile, show dice rolls floating above markers
        for (const result of results) {
            const tile = result.tile;
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (!group) continue;
            
            // Get tile center from polygon bounds
            const polygon = group.querySelector('polygon');
            if (!polygon) continue;
            
            const bbox = polygon.getBBox();
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            
            // Add dice popups for each combatant
            result.combatants.forEach((combatant, idx) => {
                const diceGroup = createSVGElement('g');
                diceGroup.classList.add('competition-dice');
                diceGroup.dataset.playerId = combatant.playerId;
                
                // Position dice above the tile, offset per player
                const offsetX = (idx - (result.combatants.length - 1) / 2) * 28;
                const diceX = cx + offsetX;
                const diceY = cy - 30;
                
                // Dice background
                const diceRect = createSVGElement('rect');
                diceRect.setAttribute('x', diceX - 10);
                diceRect.setAttribute('y', diceY - 10);
                diceRect.setAttribute('width', 20);
                diceRect.setAttribute('height', 20);
                diceRect.setAttribute('rx', 3);
                diceRect.setAttribute('fill', combatant.player.color);
                diceRect.setAttribute('stroke', '#fff');
                diceRect.setAttribute('stroke-width', '1.5');
                diceGroup.appendChild(diceRect);
                
                // Dice value
                const diceText = createSVGElement('text');
                diceText.setAttribute('x', diceX);
                diceText.setAttribute('y', diceY + 4);
                diceText.setAttribute('text-anchor', 'middle');
                diceText.setAttribute('font-size', '14');
                diceText.setAttribute('font-weight', 'bold');
                diceText.setAttribute('fill', '#000');
                diceText.textContent = combatant.diceRoll;
                diceGroup.appendChild(diceText);
                
                // Total strength below dice
                const totalText = createSVGElement('text');
                totalText.setAttribute('x', diceX);
                totalText.setAttribute('y', diceY + 22);
                totalText.setAttribute('text-anchor', 'middle');
                totalText.setAttribute('font-size', '9');
                totalText.setAttribute('fill', combatant.player.color);
                totalText.textContent = `=${combatant.total}`;
                diceGroup.appendChild(totalText);
                
                this.boardContent.appendChild(diceGroup);
            });
            
            // Highlight contested tile with combat border
            polygon.classList.add('contested');
            polygon.style.stroke = '#ff6';
            polygon.style.strokeWidth = '3';
            polygon.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 102, 0.6))';
        }
    }
    
    markDyingMarkers(results, state) {
        // Add skull overlays on markers that will be displaced
        for (const result of results) {
            if (!result.displaced) continue;
            
            const tile = result.tile;
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (!group) continue;
            
            // Find markers belonging to the displaced player
            const markers = group.querySelectorAll('.hex-marker');
            let markersFound = 0;
            
            markers.forEach(marker => {
                const markerColor = marker.getAttribute('fill');
                if (markerColor === result.displaced.player.color && markersFound < result.displaced.count) {
                    // Add dying class
                    marker.classList.add('marker-dying');
                    
                    // Add skull overlay at marker position
                    const skullGroup = createSVGElement('g');
                    skullGroup.classList.add('marker-skull');
                    
                    const mcx = parseFloat(marker.getAttribute('cx'));
                    const mcy = parseFloat(marker.getAttribute('cy'));
                    
                    // Skull emoji text
                    const skull = createSVGElement('text');
                    skull.setAttribute('x', mcx);
                    skull.setAttribute('y', mcy + 3);
                    skull.setAttribute('text-anchor', 'middle');
                    skull.setAttribute('font-size', '12');
                    skull.textContent = '💀';
                    skullGroup.appendChild(skull);
                    
                    this.boardContent.appendChild(skullGroup);
                    markersFound++;
                }
            });
        }
    }
    
    clearCompetitionVisuals() {
        // Remove all dice popups
        $$('.competition-dice').forEach(el => el.remove());
        
        // Remove all skull overlays
        $$('.marker-skull').forEach(el => el.remove());
        
        // Remove dying state from markers
        $$('.marker-dying').forEach(el => el.classList.remove('marker-dying'));
        
        // Reset contested tile styling
        $$('.hex-tile polygon.contested').forEach(polygon => {
            polygon.classList.remove('contested');
            polygon.style.stroke = '#30363d';
            polygon.style.strokeWidth = '2';
            polygon.style.filter = '';
        });
    }
    
    // Lineage Board - SVG-based with dependency arrows
    renderLineageBoard(player, traitDb) {
        const board = $('#lineage-board');
        board.innerHTML = '';
        
        // SVG dimensions
        const SLOT_WIDTH = 32;
        const SLOT_HEIGHT = 18;
        const HEADER_HEIGHT = 16;
        const SLOT_GAP = 3;
        const COL_GAP = 4;
        const PADDING = 4;
        const NUM_ERAS = 12;
        const SLOTS_PER_ERA = 3;
        
        const svgWidth = NUM_ERAS * (SLOT_WIDTH + COL_GAP) - COL_GAP + PADDING * 2;
        const svgHeight = HEADER_HEIGHT + SLOTS_PER_ERA * (SLOT_HEIGHT + SLOT_GAP) - SLOT_GAP + PADDING * 2;
        
        const svg = createSVGElement('svg');
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('class', 'lineage-svg');
        
        // Defs for arrow markers
        const defs = createSVGElement('defs');
        
        // Hard prereq arrow (green)
        const markerHard = createSVGElement('marker');
        markerHard.setAttribute('id', 'arrow-hard');
        markerHard.setAttribute('markerWidth', '8');
        markerHard.setAttribute('markerHeight', '6');
        markerHard.setAttribute('refX', '7');
        markerHard.setAttribute('refY', '3');
        markerHard.setAttribute('orient', 'auto');
        const arrowHard = createSVGElement('polygon');
        arrowHard.setAttribute('points', '0 0, 8 3, 0 6');
        arrowHard.setAttribute('fill', '#3fb950');
        markerHard.appendChild(arrowHard);
        defs.appendChild(markerHard);
        
        // Soft prereq arrow (blue)
        const markerSoft = createSVGElement('marker');
        markerSoft.setAttribute('id', 'arrow-soft');
        markerSoft.setAttribute('markerWidth', '8');
        markerSoft.setAttribute('markerHeight', '6');
        markerSoft.setAttribute('refX', '7');
        markerSoft.setAttribute('refY', '3');
        markerSoft.setAttribute('orient', 'auto');
        const arrowSoft = createSVGElement('polygon');
        arrowSoft.setAttribute('points', '0 0, 8 3, 0 6');
        arrowSoft.setAttribute('fill', '#58a6ff');
        markerSoft.appendChild(arrowSoft);
        defs.appendChild(markerSoft);
        
        // Dependent arrow (gold)
        const markerDep = createSVGElement('marker');
        markerDep.setAttribute('id', 'arrow-dep');
        markerDep.setAttribute('markerWidth', '8');
        markerDep.setAttribute('markerHeight', '6');
        markerDep.setAttribute('refX', '7');
        markerDep.setAttribute('refY', '3');
        markerDep.setAttribute('orient', 'auto');
        const arrowDep = createSVGElement('polygon');
        arrowDep.setAttribute('points', '0 0, 8 3, 0 6');
        arrowDep.setAttribute('fill', '#d4a574');
        markerDep.appendChild(arrowDep);
        defs.appendChild(markerDep);
        
        svg.appendChild(defs);
        
        // Layer for arrows (behind slots)
        const arrowLayer = createSVGElement('g');
        arrowLayer.setAttribute('class', 'arrow-layer');
        svg.appendChild(arrowLayer);
        
        // Build position map for traits
        this.traitPositions = {};
        
        // Render era columns and slots
        for (let era = 0; era < NUM_ERAS; era++) {
            const x = PADDING + era * (SLOT_WIDTH + COL_GAP);
            
            // Era header
            const header = createSVGElement('rect');
            header.setAttribute('x', x);
            header.setAttribute('y', PADDING);
            header.setAttribute('width', SLOT_WIDTH);
            header.setAttribute('height', HEADER_HEIGHT - 2);
            header.setAttribute('fill', ERA_COLORS[era]);
            header.setAttribute('rx', '2');
            svg.appendChild(header);
            
            const headerText = createSVGElement('text');
            headerText.setAttribute('x', x + SLOT_WIDTH / 2);
            headerText.setAttribute('y', PADDING + HEADER_HEIGHT - 5);
            headerText.setAttribute('text-anchor', 'middle');
            headerText.setAttribute('font-size', '7');
            headerText.setAttribute('fill', '#fff');
            headerText.setAttribute('class', 'era-header-text');
            headerText.textContent = ERA_NAMES[era].substring(0, 3);
            svg.appendChild(headerText);
            
            // Trait slots
            const traits = player.traitsByEra[era] || [];
            for (let slot = 0; slot < SLOTS_PER_ERA; slot++) {
                const slotY = PADDING + HEADER_HEIGHT + slot * (SLOT_HEIGHT + SLOT_GAP);
                const slotGroup = createSVGElement('g');
                slotGroup.setAttribute('class', 'trait-slot-group');
                
                const rect = createSVGElement('rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', slotY);
                rect.setAttribute('width', SLOT_WIDTH);
                rect.setAttribute('height', SLOT_HEIGHT);
                rect.setAttribute('rx', '2');
                
                const traitId = traits[slot];
                if (traitId) {
                    rect.setAttribute('class', 'trait-slot-rect filled');
                    rect.setAttribute('data-trait-id', traitId);
                    
                    // Store position (center of rect)
                    this.traitPositions[traitId] = {
                        x: x + SLOT_WIDTH / 2,
                        y: slotY + SLOT_HEIGHT / 2,
                        era: era
                    };
                    
                    // Trait name abbreviation
                    const traitData = traitDb[traitId];
                    const abbrev = traitData ? traitData.name.substring(0, 4) : traitId.substring(0, 4);
                    const label = createSVGElement('text');
                    label.setAttribute('x', x + SLOT_WIDTH / 2);
                    label.setAttribute('y', slotY + SLOT_HEIGHT / 2 + 3);
                    label.setAttribute('text-anchor', 'middle');
                    label.setAttribute('font-size', '6');
                    label.setAttribute('fill', '#1a1a1a');
                    label.setAttribute('class', 'trait-label');
                    label.setAttribute('pointer-events', 'none');
                    label.textContent = abbrev;
                    slotGroup.appendChild(label);
                    
                    // Hover handlers for arrows
                    rect.addEventListener('mouseenter', () => {
                        this.showDependencyArrows(traitId, player, traitDb, arrowLayer);
                    });
                    rect.addEventListener('mouseleave', () => {
                        this.clearDependencyArrows(arrowLayer);
                    });
                    
                    // Click handler
                    rect.addEventListener('click', () => {
                        if (this.callbacks.onTraitSlotClick) {
                            this.callbacks.onTraitSlotClick(traitId);
                        }
                    });
                    
                    // Title for tooltip
                    const title = createSVGElement('title');
                    title.textContent = traitData?.name || traitId;
                    rect.appendChild(title);
                } else {
                    rect.setAttribute('class', 'trait-slot-rect empty');
                }
                
                slotGroup.appendChild(rect);
                svg.appendChild(slotGroup);
            }
        }
        
        board.appendChild(svg);
    }
    
    // Draw dependency arrows for a hovered trait
    showDependencyArrows(traitId, player, traitDb, arrowLayer) {
        this.clearDependencyArrows(arrowLayer);
        
        const traitData = traitDb[traitId];
        if (!traitData) return;
        
        const targetPos = this.traitPositions[traitId];
        if (!targetPos) return;
        
        // Draw arrows FROM prerequisites TO this trait
        // Hard prerequisites (solid green)
        for (const prereqId of traitData.hard_prereqs || []) {
            const prereqPos = this.traitPositions[prereqId];
            if (prereqPos) {
                this.drawArrow(arrowLayer, prereqPos, targetPos, 'hard');
            }
        }
        
        // Soft prerequisites (dashed blue)
        for (const prereqId of traitData.soft_prereqs || []) {
            const prereqPos = this.traitPositions[prereqId];
            if (prereqPos) {
                this.drawArrow(arrowLayer, prereqPos, targetPos, 'soft');
            }
        }
        
        // Draw arrows FROM this trait TO dependents (gold)
        for (const [otherTraitId, otherData] of Object.entries(traitDb)) {
            if (!this.traitPositions[otherTraitId]) continue;
            
            const isHardDep = (otherData.hard_prereqs || []).includes(traitId);
            const isSoftDep = (otherData.soft_prereqs || []).includes(traitId);
            
            if (isHardDep || isSoftDep) {
                const depPos = this.traitPositions[otherTraitId];
                this.drawArrow(arrowLayer, targetPos, depPos, 'dep');
            }
        }
        
        // Highlight the hovered trait
        const rect = arrowLayer.parentElement.querySelector(`rect[data-trait-id="${traitId}"]`);
        if (rect) rect.classList.add('hovered');
    }
    
    // Draw a curved arrow between two points
    drawArrow(layer, from, to, type) {
        const path = createSVGElement('path');
        
        // Calculate control point for bezier curve
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        // Curve upward for visual clarity
        const curvature = Math.abs(dx) > 50 ? -15 : -8;
        const cx = midX;
        const cy = midY + curvature;
        
        // Shorten the path slightly so arrow doesn't overlap with rect
        const offsetEnd = 8;
        const angle = Math.atan2(to.y - cy, to.x - cx);
        const endX = to.x - Math.cos(angle) * offsetEnd;
        const endY = to.y - Math.sin(angle) * offsetEnd;
        
        const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${endX} ${endY}`;
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        
        if (type === 'hard') {
            path.setAttribute('stroke', '#3fb950');
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('marker-end', 'url(#arrow-hard)');
            path.setAttribute('class', 'dep-arrow hard');
        } else if (type === 'soft') {
            path.setAttribute('stroke', '#58a6ff');
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('stroke-dasharray', '3,2');
            path.setAttribute('marker-end', 'url(#arrow-soft)');
            path.setAttribute('class', 'dep-arrow soft');
        } else {
            path.setAttribute('stroke', '#d4a574');
            path.setAttribute('stroke-width', '1');
            path.setAttribute('marker-end', 'url(#arrow-dep)');
            path.setAttribute('class', 'dep-arrow dependent');
        }
        
        layer.appendChild(path);
    }
    
    // Clear all arrows
    clearDependencyArrows(layer) {
        layer.innerHTML = '';
        // Remove hovered class from all rects
        const svg = layer.parentElement;
        if (svg) {
            svg.querySelectorAll('.trait-slot-rect.hovered').forEach(r => r.classList.remove('hovered'));
        }
    }
    
    // Player Stats
    updatePlayerStats(player, traitDb, currentPhase, canDrag = false) {
        $('#stat-alleles').textContent = player.alleles;
        $('#stat-markers').textContent = `${player.markersOnBoard}/${player.markers}`;
        $('#stat-complexity').textContent = player.getComplexity(traitDb);
        $('#stat-tiles').textContent = player.tilesControlled;
        
        // Update drag marker state
        const dragMarker = $('#drag-marker');
        if (dragMarker) {
            const hasAvailableMarkers = player.markersOnBoard < player.markers;
            const isPopulatePhase = currentPhase === 'populate';
            const canDragMarker = canDrag && isPopulatePhase && hasAvailableMarkers;
            
            dragMarker.style.backgroundColor = player.color;
            dragMarker.classList.toggle('active', canDragMarker);
            dragMarker.classList.toggle('disabled', !canDragMarker);
            dragMarker.setAttribute('draggable', canDragMarker ? 'true' : 'false');
        }
        
        // Update tags
        const tagsList = $('#tags-list');
        tagsList.innerHTML = '';
        const tags = player.getTags(traitDb);
        for (const tag of tags) {
            const tagEl = createElement('span', 'tag', tag);
            tagsList.appendChild(tagEl);
        }
    }
    
    // Genome Bar - visualizes genome length with trait blocks and TE insertions
    renderGenomeBar(player, traitDb) {
        const container = $('#genome-segments');
        const lengthLabel = $('#genome-length');
        if (!container) return;
        
        container.innerHTML = '';
        
        const codingDNA = player.getCodingDNA(traitDb);
        const teBloat = player.teBloat;
        const totalLength = codingDNA + teBloat;
        
        // Update length display (always show, even if 0)
        if (totalLength >= 1000) {
            lengthLabel.textContent = `${(totalLength / 1000).toFixed(1)} Mb`;
        } else {
            lengthLabel.textContent = `${totalLength} kb`;
        }
        
        // Always show bar structure - even when empty
        if (player.traits.length === 0 && teBloat === 0) {
            // Show empty placeholder block
            const emptyBlock = createElement('div', 'genome-block empty');
            emptyBlock.title = 'Evolve traits to add coding DNA';
            container.appendChild(emptyBlock);
            return;
        }
        
        // Calculate total TE width (proportional to trait count)
        const teBlockCount = Math.ceil(teBloat / 100); // One TE block per ~100kb
        let teRemaining = teBlockCount;
        
        // Add trait blocks with TE insertions scattered between them
        for (let i = 0; i < player.traits.length; i++) {
            const traitId = player.traits[i];
            const trait = traitDb[traitId];
            if (!trait) continue;
            
            // Trait block (fixed width)
            const traitBlock = this.createGenomeBlock('trait', trait.base_pairs || 100, trait.name, trait.clade);
            container.appendChild(traitBlock);
            
            // Scatter TE blocks between traits
            if (teRemaining > 0 && i < player.traits.length - 1) {
                const teCount = Math.min(Math.ceil(teRemaining / (player.traits.length - i)), 3);
                for (let t = 0; t < teCount && teRemaining > 0; t++) {
                    const teBlock = this.createGenomeBlock('te', 100, 'TE');
                    container.appendChild(teBlock);
                    teRemaining--;
                }
            }
        }
        
        // Trailing TE blocks (remaining at end)
        while (teRemaining > 0) {
            const teBlock = this.createGenomeBlock('te', 100, 'TE bloat');
            container.appendChild(teBlock);
            teRemaining--;
        }
    }
    
    // Create a genome segment block (fixed width for traits, small for TEs)
    createGenomeBlock(type, size, label, clade = null) {
        const block = createElement('div', `genome-block ${type}`);
        
        // Fixed width for traits, smaller for TEs
        if (type === 'trait') {
            block.style.width = '10px';
        } else if (type === 'te') {
            block.style.width = '4px';
        } else {
            block.style.flex = '1'; // empty state fills
        }
        
        // Color based on type and clade
        if (type === 'trait') {
            const cladeColors = {
                'Bilateria': '#4a9eff',
                'Chordata': '#5ab5ff',
                'Vertebrata': '#6bc5ff',
                'Arthropoda': '#ff9844',
                'Hexapoda': '#ffaa55',
                'Mollusca': '#aa77dd',
                'Cephalopoda': '#bb88ee',
                'Mammalia': '#ff6b9d',
                'Aves': '#77dd77',
                'Reptilia': '#8bc34a',
                'Amphibia': '#26c6da',
                'Various': '#888',
                'Default': '#666'
            };
            const color = cladeColors[clade] || '#58a6ff';
            block.style.backgroundColor = color;
        }
        
        // Tooltip
        if (type === 'trait') {
            block.title = `${label} (${size}kb)`;
        } else if (type === 'te') {
            block.title = `Transposable Element (~100kb junk DNA)`;
        }
        
        return block;
    }
    
    // Hand Display
    renderHand(player, playableTraits) {
        const container = $('#hand-cards');
        container.innerHTML = '';
        $('#hand-count').textContent = player.hand.length;
        
        for (const { trait, canAcquire, canAfford, cost, reason } of playableTraits) {
            const card = createElement('div', 'hand-card');
            if (!canAcquire || !canAfford) {
                card.classList.add('unplayable');
            }
            
            const name = createElement('div', 'hand-card-name', trait.name);
            const costEl = createElement('div', 'hand-card-cost', `Cost: ${cost} alleles`);
            const era = createElement('div', 'hand-card-era', 
                `Era ${trait.era_min}-${trait.era_max}`);
            
            card.appendChild(name);
            card.appendChild(costEl);
            card.appendChild(era);
            
            if (reason) {
                const reasonEl = createElement('div', 'hand-card-era', reason);
                reasonEl.style.color = '#f85149';
                card.appendChild(reasonEl);
            }
            
            card.addEventListener('click', () => {
                if (this.callbacks.onCardClick) {
                    this.callbacks.onCardClick(trait, canAcquire && canAfford);
                }
            });
            
            container.appendChild(card);
        }
    }
    
    // Event Deck Display
    updateEventDeck(state) {
        const eventBack = $('#next-event-back');
        const remaining = $('#events-remaining');
        
        if (state.eventDeck.length > 0) {
            const nextType = state.getNextEventType();
            eventBack.className = 'event-back ' + (nextType === 'extinction' ? 'extinction' : 'other');
            remaining.textContent = `${state.eventDeck.length} remaining`;
        } else {
            eventBack.className = 'event-back';
            eventBack.textContent = '∅';
            remaining.textContent = 'No events left';
        }
    }
    
    // Organism Match Display (Lineage Panel - detailed view)
    renderOrganismMatch(player, currentEra, organisms) {
        const display = $('#organism-display');
        if (!display) return;
        
        const match = findBestOrganism(player.traits, currentEra, organisms);
        
        if (!match || player.traits.length === 0) {
            display.innerHTML = `
                <div class="organism-name">---</div>
                <div class="organism-scientific">Evolve traits to find your match</div>
                <div class="organism-similarity-bar">
                    <div class="similarity-fill" style="width: 0%"></div>
                    <span class="similarity-label">0%</span>
                </div>
                <div class="organism-shared">0 shared traits</div>
                <div class="organism-fact"></div>
            `;
            return;
        }
        
        const { organism, similarity, sharedTraits } = match;
        const pct = Math.round(similarity * 100);
        
        display.innerHTML = `
            <div class="organism-name">${organism.name}</div>
            <div class="organism-scientific">${organism.scientific_name}</div>
            <div class="organism-similarity-bar">
                <div class="similarity-fill" style="width: ${pct}%"></div>
                <span class="similarity-label">${pct}%</span>
            </div>
            <div class="organism-shared">${sharedTraits.length} shared traits</div>
            <div class="organism-fact">${organism.fun_fact}</div>
        `;
    }
    
    // Players Bar (with organism badges)
    renderPlayersBar(players, currentPlayerIndex, traitDb, currentEra = 0, organisms = []) {
        const container = $('#players-overview');
        container.innerHTML = '';
        
        for (const player of players) {
            const summary = createElement('div', 'player-summary');
            if (player.id === currentPlayerIndex) {
                summary.classList.add('active');
            }
            
            const color = createElement('div', 'player-summary-color');
            color.style.background = player.color;
            
            const info = createElement('div', 'player-summary-info');
            const name = createElement('div', 'player-summary-name', player.name);
            
            const stats = createElement('div', 'player-summary-stats');
            
            // Get organism match for this player
            const match = findBestOrganism(player.traits, currentEra, organisms);
            const organismBadge = match && player.traits.length > 0
                ? `<span class="organism-badge" title="${match.organism.name}: ${match.organism.fun_fact}">${match.organism.name} ${formatSimilarity(match.similarity)}</span>`
                : '';
            
            stats.innerHTML = `
                <span title="Alleles - genetic currency for evolving traits">💎 ${player.alleles}</span>
                <span title="Population markers placed on tiles">🦎 ${player.markersOnBoard}</span>
                <span title="Complexity - sum of all trait costs">🧬 ${player.getComplexity(traitDb)}</span>
                <span title="Tiles controlled with majority population">🗺️ ${player.tilesControlled}</span>
                ${organismBadge}
            `;
            
            info.appendChild(name);
            info.appendChild(stats);
            summary.appendChild(color);
            summary.appendChild(info);
            container.appendChild(summary);
        }
    }
    
    // Action Buttons
    updateActionButtons(phase, playerActed, canAct = true) {
        const rollBtn = $('#btn-roll-alleles');
        const endPhaseBtn = $('#btn-end-phase');
        const endTurnBtn = $('#btn-end-turn');
        
        rollBtn.classList.add('hidden');
        endPhaseBtn.classList.add('hidden');
        endTurnBtn.classList.add('hidden');
        
        switch (phase) {
            case 'allele_roll':
                if (!playerActed) {
                    rollBtn.classList.remove('hidden');
                    rollBtn.disabled = !canAct;
                } else {
                    endPhaseBtn.classList.remove('hidden');
                    endPhaseBtn.disabled = !canAct;
                }
                break;
            case 'draw':
            case 'competition':
            case 'tile_flip':
                endPhaseBtn.classList.remove('hidden');
                endPhaseBtn.disabled = !canAct;
                break;
            case 'evolution':
            case 'populate':
                endTurnBtn.classList.remove('hidden');
                endTurnBtn.disabled = !canAct;
                break;
            case 'event':
                endPhaseBtn.classList.remove('hidden');
                endPhaseBtn.disabled = !canAct;
                break;
        }
        
        // Show waiting message when not your turn
        if (!canAct) {
            const waitingEl = $('#waiting-indicator');
            if (!waitingEl) {
                const indicator = createElement('div', 'waiting-indicator', 'Waiting for other player...');
                indicator.id = 'waiting-indicator';
                $('#action-buttons')?.appendChild(indicator);
            }
        } else {
            $('#waiting-indicator')?.remove();
        }
    }
    
    // Modals
    showModal(modalId) {
        $('#modal-overlay').classList.remove('hidden');
        $$('.modal').forEach(m => m.classList.add('hidden'));
        $(`#${modalId}`).classList.remove('hidden');
    }
    
    hideModals() {
        $('#modal-overlay').classList.add('hidden');
        $$('.modal').forEach(m => m.classList.add('hidden'));
    }
    
    // Toast notification
    showNotification(title, message, duration = 2000) {
        return new Promise(resolve => {
            let toast = $('#toast-notification');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toast-notification';
                toast.className = 'toast-notification';
                document.body.appendChild(toast);
            }
            
            toast.innerHTML = `
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message.replace(/\n/g, '<br>')}</div>
            `;
            toast.classList.add('visible');
            
            setTimeout(() => {
                toast.classList.remove('visible');
                resolve();
            }, duration);
        });
    }
    
    // Card Detail Modal
    showCardDetail(trait, player, traitDb, canBuy, isEvolutionPhase, onBuy) {
        const detail = $('#card-detail');
        const actions = $('#card-actions');
        
        const softCount = trait.soft_prereqs.filter(p => player.traits.includes(p)).length;
        const discount = Math.min(softCount, 3);
        const finalCost = Math.max(0, trait.cost - discount);
        const canAfford = player.alleles >= finalCost;
        
        detail.innerHTML = `
            <div class="card-detail-header">
                <div class="card-detail-name">${trait.name}</div>
                <div class="card-detail-cost">
                    ${discount > 0 ? `<s>${trait.cost}</s> ` : ''}${finalCost} Alleles
                </div>
            </div>
            
            <div class="card-detail-section">
                <h4>Era Window</h4>
                <p>${ERA_NAMES[trait.era_min]} to ${ERA_NAMES[trait.era_max]}</p>
            </div>
            
            ${trait.hard_prereqs.length > 0 ? `
            <div class="card-detail-section">
                <h4>Prerequisites (Required)</h4>
                <div class="card-detail-prereqs">
                    ${trait.hard_prereqs.map(p => {
                        const met = player.traits.includes(p);
                        const prereqTrait = traitDb[p];
                        return `<span class="prereq hard ${met ? 'met' : ''}">${prereqTrait?.name || p}</span>`;
                    }).join('')}
                </div>
            </div>
            ` : ''}
            
            ${trait.soft_prereqs.length > 0 ? `
            <div class="card-detail-section">
                <h4>Soft Prerequisites (Cost Reduction)</h4>
                <div class="card-detail-prereqs">
                    ${trait.soft_prereqs.map(p => {
                        const met = player.traits.includes(p);
                        const prereqTrait = traitDb[p];
                        return `<span class="prereq soft ${met ? 'met' : ''}">${prereqTrait?.name || p} ${met ? '(-1)' : ''}</span>`;
                    }).join('')}
                </div>
            </div>
            ` : ''}
            
            ${(trait.incompatible_with?.length > 0) ? `
            <div class="card-detail-section">
                <h4>Incompatible With</h4>
                <div class="card-detail-prereqs">
                    ${trait.incompatible_with.map(p => {
                        const blocked = player.traits.includes(p);
                        const incompTrait = traitDb[p];
                        return `<span class="prereq incompatible ${blocked ? 'blocked' : ''}">${incompTrait?.name || p}</span>`;
                    }).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="card-detail-section">
                <h4>Grants</h4>
                <div class="card-detail-grants">${trait.grants}</div>
            </div>
            
            <div class="card-detail-section">
                <h4>Tags</h4>
                <div id="card-tags" style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${trait.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
            </div>
            
            <div class="card-detail-section">
                <p class="card-detail-science">${trait.science}</p>
            </div>
        `;
        
        actions.innerHTML = '';
        
        // Always show evolve button with appropriate state
        const buyBtn = createElement('button', 'btn-primary', `Evolve (${finalCost} Alleles)`);
        
        if (!isEvolutionPhase) {
            buyBtn.disabled = true;
            buyBtn.title = 'Wait for Natural Selection phase';
            buyBtn.textContent = 'Wait for Natural Selection phase';
            buyBtn.classList.add('btn-disabled');
        } else if (!canBuy) {
            buyBtn.disabled = true;
            buyBtn.title = canAfford ? 'Prerequisites not met' : 'Not enough alleles';
            buyBtn.textContent = canAfford ? 'Prerequisites not met' : `Need ${finalCost} alleles`;
            buyBtn.classList.add('btn-disabled');
        } else {
            buyBtn.addEventListener('click', () => {
                this.hideModals();
                onBuy(trait);
            });
        }
        actions.appendChild(buyBtn);
        
        const closeBtn = createElement('button', 'btn-action', 'Close');
        closeBtn.addEventListener('click', () => this.hideModals());
        actions.appendChild(closeBtn);
        
        this.showModal('card-modal');
    }
    
    // Tile Info Modal
    showTileInfo(tile, state) {
        const detail = $('#card-detail');
        const actions = $('#card-actions');
        
        // Gather markers on this tile
        const markers = state.tileMarkers[tile.id] || {};
        const markerInfo = Object.entries(markers)
            .filter(([_, count]) => count > 0)
            .map(([playerId, count]) => {
                const player = state.players[parseInt(playerId)];
                return `<span style="color: ${player.color}">● ${player.name}: ${count}</span>`;
            })
            .join(' &nbsp; ');
        
        const requiredTags = tile.biomeData.required_tags || [];
        const bonusTags = tile.biomeData.bonus_tags || [];
        
        const isLocked = tile.eraLock > state.currentEra;
        
        detail.innerHTML = `
            <div class="card-detail-header">
                <div class="card-detail-name" style="display: flex; align-items: center; gap: 10px;">
                    <span class="tile-color-swatch" style="background: ${tile.biomeData.color}; width: 24px; height: 24px; border-radius: 4px;"></span>
                    ${tile.biomeData.name}
                </div>
                <div class="card-detail-cost">${tile.climateBand || 'Unknown'} zone</div>
            </div>
            
            <div class="card-detail-section">
                <h4>Description</h4>
                <p>${tile.biomeData.description || 'No description available.'}</p>
            </div>
            
            <div class="card-detail-section">
                <h4>Requirements to Occupy</h4>
                <div class="card-detail-prereqs">
                    ${requiredTags.length > 0 
                        ? requiredTags.map(t => `<span class="tag required">${t}</span>`).join(' ')
                        : '<span class="no-reqs">None - any organism can occupy</span>'}
                </div>
            </div>
            
            ${bonusTags.length > 0 ? `
            <div class="card-detail-section">
                <h4>Bonus for Tags</h4>
                <div class="card-detail-prereqs">
                    ${bonusTags.map(t => `<span class="tag bonus">${t}</span>`).join(' ')}
                </div>
            </div>
            ` : ''}
            
            <div class="card-detail-section">
                <h4>Environmental Stability</h4>
                ${(() => {
                    const stability = STABILITY_INFO[tile.flipNumber];
                    const transitions = state.tilesData?.flip_transitions?.[tile.biome] || [];
                    const transitionNames = transitions
                        .filter(b => b !== tile.biome)
                        .map(b => state.tilesData.biome_types[b]?.name || b)
                        .join(', ');
                    return `
                        <p style="color: ${stability.color}; font-weight: bold;">
                            ${stability.label} (${stability.percent}% chance to shift)
                        </p>
                        <p style="opacity: 0.8; font-size: 0.9em;">
                            Roll d6 each era: biome shifts on ${tile.flipNumber}+
                        </p>
                        ${transitionNames ? `
                        <p style="margin-top: 8px;">
                            <strong>Possible transitions:</strong> ${transitionNames}
                        </p>
                        ` : ''}
                    `;
                })()}
            </div>
            
            ${isLocked ? `
            <div class="card-detail-section">
                <h4>Era Lock</h4>
                <p style="color: #ff6;">🔒 Locked until Era ${tile.eraLock} (${ERA_NAMES[tile.eraLock] || 'Future'})</p>
            </div>
            ` : ''}
            
            <div class="card-detail-section">
                <h4>Current Occupants</h4>
                <div class="tile-markers-info">
                    ${markerInfo || '<span style="opacity: 0.6">No markers placed</span>'}
                </div>
            </div>
        `;
        
        actions.innerHTML = '';
        
        const closeBtn = createElement('button', 'btn-action', 'Close');
        closeBtn.addEventListener('click', () => this.hideModals());
        actions.appendChild(closeBtn);
        
        this.showModal('card-modal');
    }
    
    // Dice Modal
    showDiceRoll(title, onRoll) {
        $('#dice-title').textContent = title;
        $('#die-1').textContent = '?';
        $('#die-2').textContent = '?';
        $('#dice-result').innerHTML = '';
        
        const rollBtn = $('#btn-roll-dice');
        const acceptBtn = $('#btn-accept-roll');
        
        // Reset button states for new roll
        rollBtn.disabled = false;
        rollBtn.classList.remove('hidden');
        acceptBtn.classList.add('hidden');
        
        this.showModal('dice-modal');
        return new Promise(resolve => {
            const handleRoll = async () => {
                rollBtn.disabled = true;
                
                // Animate dice
                const die1 = $('#die-1');
                const die2 = $('#die-2');
                die1.classList.add('rolling');
                die2.classList.add('rolling');
                
                // Roll animation
                for (let i = 0; i < 10; i++) {
                    die1.textContent = Math.floor(Math.random() * 6) + 1;
                    die2.textContent = Math.floor(Math.random() * 6) + 1;
                    await new Promise(r => setTimeout(r, 50));
                }
                
                die1.classList.remove('rolling');
                die2.classList.remove('rolling');
                
                const result = onRoll();
                die1.textContent = result.dice[0];
                die2.textContent = result.dice[1];
                
                $('#dice-result').innerHTML = `
                    <div class="dice-breakdown">
                        Offspring: ${result.base} + Population: ${result.popBonus} + Territory: ${result.tileBonus} + Fecundity: ${result.fecundity}
                    </div>
                    <div class="dice-total">= ${result.total} Genetic Currency</div>
                `;
                
                rollBtn.classList.add('hidden');
                acceptBtn.classList.remove('hidden');
                
                acceptBtn.onclick = () => {
                    this.hideModals();
                    resolve(result);
                };
            };
            
            rollBtn.onclick = handleRoll;
        });
    }
    
    // Event Modal
    showEvent(event, results) {
        const display = $('#event-card-display');
        const resolution = $('#event-resolution');
        
        display.innerHTML = `
            <div class="event-card ${event.type}">
                <div class="event-card-type ${event.type}">${event.type.toUpperCase()}</div>
                <div class="event-card-name">${event.name}</div>
                <div class="event-card-description">${event.description}</div>
                
                ${event.type === 'extinction' ? `
                <div class="event-card-tags">
                    <div class="event-tag-group safe">
                        <h5>SAFE</h5>
                        <div class="event-tag-list">
                            ${(event.safe_tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                        </div>
                    </div>
                    <div class="event-tag-group doomed">
                        <h5>DOOMED</h5>
                        <div class="event-tag-list">
                            ${(event.doomed_tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-top: 1rem; font-size: 0.85rem; color: #8b949e;">
                    <strong>Real Examples:</strong><br>
                    ${(event.real_examples || []).join('<br>')}
                </div>
            </div>
        `;
        
        resolution.innerHTML = '';
        for (const r of results) {
            const row = createElement('div', `resolution-player ${r.status}`);
            
            // Build tile breakdown if available
            let tileBreakdown = '';
            if (r.tileResults && r.tileResults.length > 0) {
                const tileItems = r.tileResults
                    .filter(tr => tr.markersLost > 0 || tr.status === 'saved')
                    .map(tr => {
                        const tileName = tr.tile.biomeData?.name || tr.tile.biome;
                        if (tr.status === 'doomed') {
                            return `<span class="tile-result doomed">☠ ${tileName} (-${tr.markersLost})</span>`;
                        } else if (tr.status === 'saved') {
                            return `<span class="tile-result saved">✓ ${tileName}</span>`;
                        } else if (tr.status === 'failed_roll') {
                            return `<span class="tile-result failed">✗ ${tileName} (-${tr.markersLost})</span>`;
                        }
                        return '';
                    })
                    .filter(Boolean);
                
                if (tileItems.length > 0) {
                    tileBreakdown = `<div class="tile-breakdown">${tileItems.join('')}</div>`;
                }
            }
            
            row.innerHTML = `
                <div class="resolution-header">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${r.player.color}"></span>
                        ${r.player.name}
                    </span>
                    <span>${r.message}${r.lostMarkers > 0 ? ` (-${r.lostMarkers} markers)` : ''}</span>
                </div>
                ${tileBreakdown}
            `;
            resolution.appendChild(row);
        }
        
        this.showModal('event-modal');
        return new Promise(resolve => {
            $('#btn-continue-event').onclick = () => {
                this.hideModals();
                resolve();
            };
        });
    }
    
    // Game Over Modal
    showGameOver(scores, organisms) {
        const scoresDiv = $('#final-scores');
        const winnerDiv = $('#winner-display');
        const organismsDiv = $('#organism-matches');
        
        // Hide solo result section for multiplayer
        $('#solo-result')?.classList.add('hidden');
        $('#gameover-title').textContent = 'Evolution Complete!';
        
        scoresDiv.innerHTML = '';
        for (let i = 0; i < scores.length; i++) {
            const s = scores[i];
            const row = createElement('div', `score-row ${i === 0 ? 'winner' : ''}`);
            row.innerHTML = `
                <div class="score-name">
                    <span style="width: 16px; height: 16px; border-radius: 50%; background: ${s.player.color}"></span>
                    <span>${s.player.name}</span>
                </div>
                <div style="color: #8b949e;">
                    ${s.markers} markers × ${s.complexity} complexity + ${s.tiles * 3} tile bonus
                </div>
                <div class="score-value">${s.score}</div>
            `;
            scoresDiv.appendChild(row);
        }
        
        winnerDiv.innerHTML = `<div class="winner-text">${scores[0].player.name} wins!</div>`;
        
        organismsDiv.innerHTML = '<h3 style="margin-bottom: 0.5rem;">Closest Real Organisms</h3>';
        for (const { player, organism, similarity } of organisms) {
            const match = createElement('div', 'organism-match');
            match.innerHTML = `
                <div class="organism-match-player" style="color: ${player.color}">${player.name}</div>
                <div class="organism-match-result">
                    ${organism ? `${organism.name} (${(similarity * 100).toFixed(0)}% match)` : 'No match found'}
                </div>
            `;
            organismsDiv.appendChild(match);
        }
        
        this.showModal('gameover-modal');
    }
    
    // Solo Game Over Modal
    showSoloGameOver(extinct, erasSurvived, score, organismMatch) {
        const title = $('#gameover-title');
        const soloResult = $('#solo-result');
        const scoresDiv = $('#final-scores');
        const winnerDiv = $('#winner-display');
        const organismsDiv = $('#organism-matches');
        
        // Show solo result section
        soloResult.classList.remove('hidden');
        
        if (extinct) {
            title.textContent = 'Extinction!';
            $('#solo-result-icon').textContent = '💀';
            $('#solo-result-text').textContent = 'Your lineage has ended.';
            $('#solo-result-text').style.color = '#f85149';
        } else {
            title.textContent = 'Survival Complete!';
            $('#solo-result-icon').textContent = '🏆';
            $('#solo-result-text').textContent = 'Your lineage endures!';
            $('#solo-result-text').style.color = '#3fb950';
        }
        
        $('#solo-eras-survived').textContent = `Eras survived: ${erasSurvived} / 12`;
        
        // Show score
        scoresDiv.innerHTML = '';
        const row = createElement('div', 'score-row winner');
        row.innerHTML = `
            <div class="score-name">
                <span style="width: 16px; height: 16px; border-radius: 50%; background: ${score.player.color}"></span>
                <span>${score.player.name}</span>
            </div>
            <div style="color: #8b949e;">
                ${score.markers} markers × ${score.complexity} complexity + ${score.tiles * 3} tile bonus
            </div>
            <div class="score-value">${score.score}</div>
        `;
        scoresDiv.appendChild(row);
        
        // Hide winner display for solo
        winnerDiv.innerHTML = '';
        
        // Show organism match
        organismsDiv.innerHTML = '<h3 style="margin-bottom: 0.5rem;">Your Lineage Resembles</h3>';
        if (organismMatch.organism) {
            const match = createElement('div', 'organism-match');
            match.innerHTML = `
                <div class="organism-match-result" style="font-size: 1.2rem;">
                    ${organismMatch.organism.name}
                </div>
                <div style="color: #8b949e;">
                    ${organismMatch.organism.scientific_name}
                </div>
                <div style="margin-top: 0.5rem; color: #58a6ff;">
                    ${(organismMatch.similarity * 100).toFixed(0)}% genetic similarity
                </div>
                <div style="margin-top: 0.5rem; font-style: italic; color: #8b949e;">
                    "${organismMatch.organism.fun_fact}"
                </div>
            `;
            organismsDiv.appendChild(match);
        }
        
        this.showModal('gameover-modal');
    }
    
    // Solo Competition Results Visualization
    showSoloCompetitionResults(results, state) {
        const rivalColor = '#e85d04';
        const player = state.players[0];
        
        for (const result of results) {
            const tile = result.tile;
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (!group) continue;
            
            const polygon = group.querySelector('polygon');
            if (!polygon) continue;
            
            const bbox = polygon.getBBox();
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            
            // Player dice on the left
            const playerDiceGroup = createSVGElement('g');
            playerDiceGroup.classList.add('competition-dice');
            
            const playerDiceX = cx - 20;
            const playerDiceY = cy - 30;
            
            const playerRect = createSVGElement('rect');
            playerRect.setAttribute('x', playerDiceX - 10);
            playerRect.setAttribute('y', playerDiceY - 10);
            playerRect.setAttribute('width', 20);
            playerRect.setAttribute('height', 20);
            playerRect.setAttribute('rx', 3);
            playerRect.setAttribute('fill', player.color);
            playerRect.setAttribute('stroke', '#fff');
            playerRect.setAttribute('stroke-width', '1.5');
            playerDiceGroup.appendChild(playerRect);
            
            const playerDiceText = createSVGElement('text');
            playerDiceText.setAttribute('x', playerDiceX);
            playerDiceText.setAttribute('y', playerDiceY + 4);
            playerDiceText.setAttribute('text-anchor', 'middle');
            playerDiceText.setAttribute('font-size', '14');
            playerDiceText.setAttribute('font-weight', 'bold');
            playerDiceText.setAttribute('fill', '#000');
            playerDiceText.textContent = result.playerRoll;
            playerDiceGroup.appendChild(playerDiceText);
            
            const playerTotal = createSVGElement('text');
            playerTotal.setAttribute('x', playerDiceX);
            playerTotal.setAttribute('y', playerDiceY + 22);
            playerTotal.setAttribute('text-anchor', 'middle');
            playerTotal.setAttribute('font-size', '9');
            playerTotal.setAttribute('fill', player.color);
            playerTotal.textContent = `=${result.playerTotal}`;
            playerDiceGroup.appendChild(playerTotal);
            
            this.boardContent.appendChild(playerDiceGroup);
            
            // Rival dice on the right
            const rivalDiceGroup = createSVGElement('g');
            rivalDiceGroup.classList.add('competition-dice');
            
            const rivalDiceX = cx + 20;
            const rivalDiceY = cy - 30;
            
            const rivalRect = createSVGElement('rect');
            rivalRect.setAttribute('x', rivalDiceX - 10);
            rivalRect.setAttribute('y', rivalDiceY - 10);
            rivalRect.setAttribute('width', 20);
            rivalRect.setAttribute('height', 20);
            rivalRect.setAttribute('rx', 3);
            rivalRect.setAttribute('fill', rivalColor);
            rivalRect.setAttribute('stroke', '#fff');
            rivalRect.setAttribute('stroke-width', '1.5');
            rivalDiceGroup.appendChild(rivalRect);
            
            const rivalDiceText = createSVGElement('text');
            rivalDiceText.setAttribute('x', rivalDiceX);
            rivalDiceText.setAttribute('y', rivalDiceY + 4);
            rivalDiceText.setAttribute('text-anchor', 'middle');
            rivalDiceText.setAttribute('font-size', '14');
            rivalDiceText.setAttribute('font-weight', 'bold');
            rivalDiceText.setAttribute('fill', '#fff');
            rivalDiceText.textContent = result.rivalRoll;
            rivalDiceGroup.appendChild(rivalDiceText);
            
            const rivalTotal = createSVGElement('text');
            rivalTotal.setAttribute('x', rivalDiceX);
            rivalTotal.setAttribute('y', rivalDiceY + 22);
            rivalTotal.setAttribute('text-anchor', 'middle');
            rivalTotal.setAttribute('font-size', '9');
            rivalTotal.setAttribute('fill', rivalColor);
            rivalTotal.textContent = `=${result.rivalTotal}`;
            rivalDiceGroup.appendChild(rivalTotal);
            
            this.boardContent.appendChild(rivalDiceGroup);
            
            // Winner indicator
            const winnerText = createSVGElement('text');
            winnerText.classList.add('competition-dice');
            winnerText.setAttribute('x', cx);
            winnerText.setAttribute('y', cy - 45);
            winnerText.setAttribute('text-anchor', 'middle');
            winnerText.setAttribute('font-size', '12');
            winnerText.setAttribute('font-weight', 'bold');
            
            if (result.winner === 'player') {
                winnerText.setAttribute('fill', '#3fb950');
                winnerText.textContent = '✓ WIN';
            } else {
                winnerText.setAttribute('fill', '#f85149');
                winnerText.textContent = '✗ LOSE';
            }
            this.boardContent.appendChild(winnerText);
            
            // Highlight contested tile
            polygon.classList.add('contested');
            polygon.style.stroke = result.winner === 'player' ? '#3fb950' : '#f85149';
            polygon.style.strokeWidth = '3';
        }
    }
    
    // Tile Flip Phase Visualization
    showTileFlipIndicator(roll, atRiskTiles) {
        // Create banner overlay
        const banner = createElement('div', 'tile-flip-banner');
        banner.id = 'tile-flip-banner';
        banner.innerHTML = `
            <div class="flip-banner-content">
                <span class="flip-banner-icon">🌍</span>
                <span class="flip-banner-title">Environmental Shift</span>
                <span class="flip-banner-dice">
                    <span class="flip-die">${roll}</span>
                </span>
                <span class="flip-banner-desc">Tiles flip on ${roll}+</span>
            </div>
        `;
        
        const boardContainer = $('#board-container');
        boardContainer.appendChild(banner);
        
        // Highlight at-risk tiles
        for (const tile of atRiskTiles) {
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (group) {
                group.classList.add('tile-at-risk');
            }
        }
    }
    
    animateFlippedTiles(flipped) {
        // Clear at-risk highlights
        $$('.hex-tile.tile-at-risk').forEach(el => el.classList.remove('tile-at-risk'));
        
        // Animate tiles that actually flipped
        for (const { tile, oldBiome, newBiome } of flipped) {
            const group = $(`.hex-tile[data-tile-id="${tile.id}"]`);
            if (!group) continue;
            
            group.classList.add('tile-flipping');
            
            // Add transition label
            const polygon = group.querySelector('polygon');
            if (polygon) {
                const bbox = polygon.getBBox();
                const cx = bbox.x + bbox.width / 2;
                const cy = bbox.y + bbox.height / 2;
                
                const transitionLabel = createSVGElement('text');
                transitionLabel.classList.add('flip-transition-label');
                transitionLabel.setAttribute('x', cx);
                transitionLabel.setAttribute('y', cy);
                transitionLabel.setAttribute('text-anchor', 'middle');
                transitionLabel.setAttribute('font-size', '9');
                transitionLabel.setAttribute('fill', '#fff');
                transitionLabel.textContent = `${oldBiome} → ${newBiome}`;
                
                this.boardContent.appendChild(transitionLabel);
            }
        }
        
        // Update banner to show results
        const banner = $('#tile-flip-banner');
        if (banner) {
            const desc = banner.querySelector('.flip-banner-desc');
            if (desc) {
                desc.textContent = flipped.length > 0 
                    ? `${flipped.length} tile${flipped.length !== 1 ? 's' : ''} shifted!`
                    : 'Environment stable';
                desc.classList.add(flipped.length > 0 ? 'flip-changed' : 'flip-stable');
            }
        }
    }
    
    clearTileFlipIndicator() {
        // Remove banner
        $('#tile-flip-banner')?.remove();
        
        // Clear tile animations
        $$('.hex-tile.tile-at-risk').forEach(el => el.classList.remove('tile-at-risk'));
        $$('.hex-tile.tile-flipping').forEach(el => el.classList.remove('tile-flipping'));
        
        // Remove transition labels
        $$('.flip-transition-label').forEach(el => el.remove());
    }
    
    // ==================== TECH TREE ====================
    
    // Compute MYA timeline layout for all traits (horizontal timeline, vertical stacking)
    computeTechTreeLayout(traitDb, containerWidth = 1200) {
        const traits = Object.values(traitDb);
        const positions = {};
        
        // Layout constants
        const NODE_WIDTH = 75;
        const NODE_HEIGHT = 20;
        const V_GAP = 4;
        const MYA_HEADER_HEIGHT = 28;
        const PADDING = 6;
        const NUM_ERAS = 12;
        
        // Fixed era width for ~5 era visibility with scrolling (ignore container width)
        const ERA_WIDTH = 140;
        
        // Group traits by era_min
        const eraGroups = {};
        for (let i = 0; i < NUM_ERAS; i++) {
            eraGroups[i] = [];
        }
        
        for (const trait of traits) {
            const era = trait.era_min;
            if (era >= 0 && era < NUM_ERAS) {
                eraGroups[era].push(trait);
            }
        }
        
        // Sort traits within each era to minimize arrow crossings
        // Priority: 1) prereq count, 2) clade grouping, 3) cost
        const cladeOrder = [
            'Bilateria', 'Chordata', 'Vertebrata', 'Gnathostomata', 'Osteichthyes',
            'Sarcopterygii', 'Tetrapoda', 'Amniota', 'Synapsida', 'Mammalia',
            'Diapsida', 'Archosauria', 'Aves', 'Reptilia', 'Crocodilia',
            'Arthropoda', 'Hexapoda', 'Trilobita',
            'Mollusca', 'Cephalopoda',
            'Amphibia', 'Various', 'Default'
        ];
        
        for (const era in eraGroups) {
            eraGroups[era].sort((a, b) => {
                // First: fewer prerequisites at top (foundation traits)
                const aPrereqs = (a.hard_prereqs || []).length;
                const bPrereqs = (b.hard_prereqs || []).length;
                if (aPrereqs !== bPrereqs) return aPrereqs - bPrereqs;
                
                // Second: group by clade (keeps related traits together)
                const aCladeIdx = cladeOrder.indexOf(a.clade) ?? 99;
                const bCladeIdx = cladeOrder.indexOf(b.clade) ?? 99;
                if (aCladeIdx !== bCladeIdx) return aCladeIdx - bCladeIdx;
                
                // Third: lower cost first
                return a.cost - b.cost;
            });
        }
        
        // Find the max traits in any era (for height calculation)
        let maxTraitsInEra = 0;
        for (const era in eraGroups) {
            maxTraitsInEra = Math.max(maxTraitsInEra, eraGroups[era].length);
        }
        
        // Compute positions - horizontal timeline with vertical stacking
        for (let era = 0; era < NUM_ERAS; era++) {
            const group = eraGroups[era];
            const eraX = PADDING + era * ERA_WIDTH;
            const nodeStartX = eraX + (ERA_WIDTH - NODE_WIDTH) / 2;
            
            for (let i = 0; i < group.length; i++) {
                const y = MYA_HEADER_HEIGHT + PADDING + i * (NODE_HEIGHT + V_GAP);
                positions[group[i].id] = { 
                    x: nodeStartX, 
                    y, 
                    era,
                    eraX
                };
            }
        }
        
        const totalWidth = PADDING * 2 + NUM_ERAS * ERA_WIDTH;
        const totalHeight = MYA_HEADER_HEIGHT + PADDING * 2 + maxTraitsInEra * (NODE_HEIGHT + V_GAP);
        
        return { 
            positions, 
            eraGroups,
            totalWidth, 
            totalHeight, 
            NODE_WIDTH, 
            NODE_HEIGHT,
            ERA_WIDTH,
            MYA_HEADER_HEIGHT,
            PADDING,
            NUM_ERAS
        };
    }
    
    // Fixed width for all tech tree nodes (cleaner, no overlap)
    getTraitNodeWidth(trait, eraWidth, padding) {
        // All nodes same width - ignores era span for cleaner layout
        return 75;
    }
    
    // Render the full tech tree with MYA timeline header
    renderTechTree(player, currentEra, traitDb) {
        const svg = $('#tech-tree-svg');
        if (!svg) return;
        
        svg.innerHTML = '';
        
        // Get container width for responsive layout
        const container = $('#tech-tree-scroll');
        const containerWidth = container ? container.clientWidth : 1200;
        
        // Compute layout
        const layout = this.computeTechTreeLayout(traitDb, containerWidth);
        const { positions, totalWidth, totalHeight, NODE_WIDTH, NODE_HEIGHT, ERA_WIDTH, MYA_HEADER_HEIGHT, PADDING, NUM_ERAS } = layout;
        
        // Set viewBox and dimensions - full width, scrollable height
        svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        svg.style.width = '100%';
        svg.style.height = `${totalHeight}px`;
        
        // Build acquisition era lookup from player data
        const acquisitionEras = player.traitAcquisitions || {};
        
        // Determine trait states
        const handIds = new Set(player.hand.map(t => t.id));
        const ownedIds = new Set(player.traits);
        
        const getTraitState = (trait) => {
            if (ownedIds.has(trait.id)) return 'owned';
            
            const inHand = handIds.has(trait.id);
            const prereqsMet = (trait.hard_prereqs || []).every(p => ownedIds.has(p));
            const eraValid = currentEra >= trait.era_min && currentEra <= trait.era_max;
            const noIncompat = !(trait.incompatible_with || []).some(i => ownedIds.has(i));
            
            if (inHand && prereqsMet && eraValid && noIncompat) return 'available';
            if (inHand) return 'inhand';
            return 'locked';
        };
        
        // Create defs for markers
        const defs = createSVGElement('defs');
        
        // Arrow marker for edges
        const marker = createSVGElement('marker');
        marker.setAttribute('id', 'tech-arrow');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('refX', '5');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const arrowPath = createSVGElement('polygon');
        arrowPath.setAttribute('points', '0 0, 6 3, 0 6');
        arrowPath.setAttribute('fill', '#484f58');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        
        svg.appendChild(defs);
        
        // Draw MYA timeline header bar
        const headerLayer = createSVGElement('g');
        headerLayer.classList.add('mya-header-bar');
        
        // Header background
        const headerBg = createSVGElement('rect');
        headerBg.setAttribute('x', 0);
        headerBg.setAttribute('y', 0);
        headerBg.setAttribute('width', totalWidth);
        headerBg.setAttribute('height', MYA_HEADER_HEIGHT);
        headerBg.classList.add('mya-header-bg');
        headerLayer.appendChild(headerBg);
        
        // Draw era columns with MYA markers
        for (let era = 0; era < NUM_ERAS; era++) {
            const eraX = PADDING + era * ERA_WIDTH;
            const eraColor = ERA_COLORS[era] || '#666';
            const mya = ERA_MYA[era];
            const isCurrentEra = era === currentEra;
            
            // Era background band (below header)
            const band = createSVGElement('rect');
            band.setAttribute('x', eraX);
            band.setAttribute('y', MYA_HEADER_HEIGHT);
            band.setAttribute('width', ERA_WIDTH);
            band.setAttribute('height', totalHeight - MYA_HEADER_HEIGHT);
            band.setAttribute('fill', eraColor);
            band.setAttribute('opacity', '0.08');
            headerLayer.appendChild(band);
            
            // Divider line
            if (era > 0) {
                const divider = createSVGElement('line');
                divider.setAttribute('x1', eraX);
                divider.setAttribute('y1', 0);
                divider.setAttribute('x2', eraX);
                divider.setAttribute('y2', totalHeight);
                divider.classList.add('mya-divider');
                headerLayer.appendChild(divider);
            }
            
            // MYA text in header
            const myaText = createSVGElement('text');
            myaText.setAttribute('x', eraX + ERA_WIDTH / 2);
            myaText.setAttribute('y', 11);
            myaText.setAttribute('text-anchor', 'middle');
            myaText.classList.add('mya-header-text');
            if (isCurrentEra) myaText.classList.add('mya-current-era');
            myaText.textContent = `${mya} MYA`;
            headerLayer.appendChild(myaText);
            
            // Era name below MYA
            const eraText = createSVGElement('text');
            eraText.setAttribute('x', eraX + ERA_WIDTH / 2);
            eraText.setAttribute('y', 22);
            eraText.setAttribute('text-anchor', 'middle');
            eraText.classList.add('mya-header-era');
            if (isCurrentEra) eraText.classList.add('mya-current-era');
            eraText.textContent = ERA_NAMES[era].substring(0, 4);
            headerLayer.appendChild(eraText);
        }
        
        // Bottom border for header
        const headerBorder = createSVGElement('line');
        headerBorder.setAttribute('x1', 0);
        headerBorder.setAttribute('y1', MYA_HEADER_HEIGHT);
        headerBorder.setAttribute('x2', totalWidth);
        headerBorder.setAttribute('y2', MYA_HEADER_HEIGHT);
        headerBorder.setAttribute('stroke', '#484f58');
        headerBorder.setAttribute('stroke-width', '1');
        headerLayer.appendChild(headerBorder);
        
        svg.appendChild(headerLayer);
        
        // Draw edges (prerequisite arrows)
        const edgeLayer = createSVGElement('g');
        edgeLayer.classList.add('tech-tree-edges');
        
        for (const trait of Object.values(traitDb)) {
            const toPos = positions[trait.id];
            if (!toPos) continue;
            
            for (const prereqId of (trait.hard_prereqs || [])) {
                const fromPos = positions[prereqId];
                if (!fromPos) continue;
                
                const path = createSVGElement('path');
                const startX = fromPos.x + NODE_WIDTH;
                const startY = fromPos.y + NODE_HEIGHT / 2;
                const endX = toPos.x;
                const endY = toPos.y + NODE_HEIGHT / 2;
                
                // Bezier curve for smooth edges
                const ctrlOffset = Math.min(40, Math.abs(endX - startX) / 2);
                const d = `M ${startX} ${startY} C ${startX + ctrlOffset} ${startY}, ${endX - ctrlOffset} ${endY}, ${endX} ${endY}`;
                
                path.setAttribute('d', d);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', '#484f58');
                path.setAttribute('stroke-width', '1');
                path.setAttribute('marker-end', 'url(#tech-arrow)');
                path.classList.add('tech-edge');
                
                edgeLayer.appendChild(path);
            }
        }
        svg.appendChild(edgeLayer);
        
        // Draw nodes
        const nodeLayer = createSVGElement('g');
        nodeLayer.classList.add('tech-tree-nodes');
        
        for (const trait of Object.values(traitDb)) {
            const pos = positions[trait.id];
            if (!pos) continue;
            
            const state = getTraitState(trait);
            const nodeWidth = this.getTraitNodeWidth(trait, ERA_WIDTH, PADDING);
            
            const group = createSVGElement('g');
            group.classList.add('tech-node', `tech-node-${state}`);
            group.dataset.traitId = trait.id;
            
            // Node background - width based on era window
            const rect = createSVGElement('rect');
            rect.setAttribute('x', pos.x);
            rect.setAttribute('y', pos.y);
            rect.setAttribute('width', nodeWidth);
            rect.setAttribute('height', NODE_HEIGHT);
            rect.setAttribute('rx', '3');
            group.appendChild(rect);
            
            // Trait name (truncated to fit node width)
            const text = createSVGElement('text');
            text.setAttribute('x', pos.x + nodeWidth / 2);
            text.setAttribute('y', pos.y + NODE_HEIGHT / 2 + 3);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '7');
            text.setAttribute('pointer-events', 'none');
            
            // Truncate name based on available width
            const charsPerPixel = 0.15;
            const maxChars = Math.max(6, Math.floor(nodeWidth * charsPerPixel));
            const displayName = trait.name.length > maxChars ? trait.name.substring(0, maxChars - 1) + '…' : trait.name;
            text.textContent = displayName;
            group.appendChild(text);
            
            // Era acquisition badge for owned traits
            if (state === 'owned' && acquisitionEras[trait.id] !== undefined) {
                const acqEra = acquisitionEras[trait.id];
                const badgeX = pos.x + nodeWidth - 12;
                const badgeY = pos.y - 4;
                
                // Badge background circle
                const badgeBg = createSVGElement('circle');
                badgeBg.setAttribute('cx', badgeX + 6);
                badgeBg.setAttribute('cy', badgeY + 6);
                badgeBg.setAttribute('r', '7');
                badgeBg.classList.add('era-badge-bg');
                group.appendChild(badgeBg);
                
                // Badge text
                const badgeText = createSVGElement('text');
                badgeText.setAttribute('x', badgeX + 6);
                badgeText.setAttribute('y', badgeY + 9);
                badgeText.setAttribute('text-anchor', 'middle');
                badgeText.setAttribute('font-size', '7');
                badgeText.classList.add('era-badge-text');
                badgeText.textContent = `E${acqEra}`;
                group.appendChild(badgeText);
            }
            
            // Tooltip
            const title = createSVGElement('title');
            let tooltipText = `${trait.name}\nCost: ${trait.cost} | Era ${trait.era_min}-${trait.era_max}\n${trait.grants}`;
            if (state === 'owned' && acquisitionEras[trait.id] !== undefined) {
                tooltipText += `\nAcquired: Era ${acquisitionEras[trait.id]} (${ERA_NAMES[acquisitionEras[trait.id]]})`;
            }
            title.textContent = tooltipText;
            group.appendChild(title);
            
            // Click handler - show trait details modal for all traits
            group.style.cursor = 'pointer';
            group.addEventListener('click', () => {
                if (this.callbacks.onTechTreeClick) {
                    this.callbacks.onTechTreeClick(trait, state);
                }
            });
            
            nodeLayer.appendChild(group);
        }
        svg.appendChild(nodeLayer);
    }
}

