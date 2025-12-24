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
            onMarkerDrop: null,
            onGenomeTraitClick: null,
            onEventMarkerClick: null
        };
        
        // Pan/zoom state
        this.viewTransform = { x: 0, y: 0, scale: 1 };
        this.panOffset = { x: 0, y: 0 };  // Separate pan tracking from zoom focal point
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.minScale = 1.0;  // Can't zoom out past full frame
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
            
            const zoomFactor = e.deltaY > 0 ? 0.98 : 1.02;
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
            
            this.panOffset.x += dx * scaleX;
            this.panOffset.y += dy * scaleY;
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
                
                this.panOffset.x += dx * scaleX;
                this.panOffset.y += dy * scaleY;
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
        const { x: panX, y: panY } = this.panOffset;
        // Combine pan offset with zoom-to-point transform
        const zoomOffsetX = -x * (scale - 1);
        const zoomOffsetY = -y * (scale - 1);
        this.boardContent.setAttribute('transform', 
            `translate(${panX + zoomOffsetX}, ${panY + zoomOffsetY}) scale(${scale})`);
    }
    
    resetZoom() {
        this.viewTransform = { x: 0, y: 0, scale: 1 };
        this.panOffset = { x: 0, y: 0 };
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
        // Climate zones with full-coverage background bands (old-world map aesthetic)
        // Row layout: 0=polar, 1-2=temperate, 3=equatorial, 4-5=temperate, 6=polar
        const boardWidth = BOARD_COLS * HEX_WIDTH + HEX_WIDTH / 2 + BOARD_PADDING * 2;
        const totalHeight = BOARD_ROWS * HEX_VERT_SPACING + HEX_SIZE + BOARD_PADDING * 2;
        const rowHeight = HEX_VERT_SPACING;
        const baseY = BOARD_PADDING + HEX_SIZE - rowHeight / 2;
        
        // Extended zones to cover full board height (no black gaps)
        const zones = [
            { startY: 0, endRow: 1, label: 'Here Be Ice', color: '#b0e0e6', bgAlpha: 0.25 },
            { startRow: 1, rowSpan: 2, label: 'Temperate Seas', color: '#9acd32', bgAlpha: 0.2 },
            { startRow: 3, rowSpan: 1, label: 'Equatorial Waters', color: '#3498db', bgAlpha: 0.25 },
            { startRow: 4, rowSpan: 2, label: 'Temperate Seas', color: '#9acd32', bgAlpha: 0.2 },
            { startRow: 6, endY: totalHeight, label: 'Here Be Ice', color: '#b0e0e6', bgAlpha: 0.25 }
        ];
        
        // Render full-coverage background bands
        for (const zone of zones) {
            let y, height;
            
            if (zone.startY !== undefined) {
                // Top zone: extends from 0 to row boundary
                y = zone.startY;
                height = baseY + zone.endRow * rowHeight - y;
            } else if (zone.endY !== undefined) {
                // Bottom zone: extends from row to totalHeight
                y = baseY + zone.startRow * rowHeight;
                height = zone.endY - y;
            } else {
                // Middle zones: normal row-based positioning
                y = baseY + zone.startRow * rowHeight;
                height = zone.rowSpan * rowHeight;
            }
            
            const rect = createSVGElement('rect');
            rect.setAttribute('x', 0);
            rect.setAttribute('y', y);
            rect.setAttribute('width', boardWidth);
            rect.setAttribute('height', height);
            rect.setAttribute('fill', zone.color);
            rect.setAttribute('opacity', zone.bgAlpha);
            rect.classList.add('climate-band-bg');
            this.boardContent.appendChild(rect);
        }
        
        // Render latitude lines (equator and tropics) - within play area only
        const playAreaLeft = BOARD_PADDING + 10;
        const playAreaRight = boardWidth - BOARD_PADDING - 10;
        
        const latitudeLines = [
            { row: 3, label: 'Tropic of Cancer', color: '#c9a227', dash: '8,4', width: 1.5 },
            { row: 3.5, label: 'The Equator', color: '#d35400', dash: null, width: 2.5 },
            { row: 4, label: 'Tropic of Capricorn', color: '#c9a227', dash: '8,4', width: 1.5 }
        ];
        
        for (const lat of latitudeLines) {
            const y = baseY + lat.row * rowHeight;
            
            const line = createSVGElement('line');
            line.setAttribute('x1', playAreaLeft);
            line.setAttribute('y1', y);
            line.setAttribute('x2', playAreaRight);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', lat.color);
            line.setAttribute('stroke-width', lat.width);
            line.setAttribute('opacity', '0.6');
            if (lat.dash) {
                line.setAttribute('stroke-dasharray', lat.dash);
            }
            line.classList.add('latitude-line');
            this.boardContent.appendChild(line);
        }
        
        // Render cartographic zone labels in margins (Pirata One font)
        const labelMargin = 6;
        const uniqueLabels = [
            { y: baseY + 0.5 * rowHeight, label: 'Here Be Ice', color: '#7fb3c4' },
            { y: baseY + 2 * rowHeight, label: 'Temperate Seas', color: '#7aab32' },
            { y: baseY + 3.5 * rowHeight, label: 'Equatorial Waters', color: '#2980b9' },
            { y: baseY + 5 * rowHeight, label: 'Temperate Seas', color: '#7aab32' },
            { y: baseY + 6.5 * rowHeight, label: 'Here Be Ice', color: '#7fb3c4' }
        ];
        
        for (const zone of uniqueLabels) {
            // Left label (rotated vertically)
            const leftLabel = createSVGElement('text');
            leftLabel.setAttribute('x', labelMargin);
            leftLabel.setAttribute('y', zone.y);
            leftLabel.setAttribute('font-size', '14');
            leftLabel.setAttribute('font-family', "'Pirata One', cursive");
            leftLabel.setAttribute('fill', zone.color);
            leftLabel.setAttribute('opacity', '0.9');
            leftLabel.setAttribute('writing-mode', 'vertical-rl');
            leftLabel.setAttribute('text-anchor', 'middle');
            leftLabel.textContent = zone.label;
            this.boardContent.appendChild(leftLabel);
            
            // Right label (rotated vertically)
            const rightLabel = createSVGElement('text');
            rightLabel.setAttribute('x', boardWidth - labelMargin);
            rightLabel.setAttribute('y', zone.y);
            rightLabel.setAttribute('font-size', '14');
            rightLabel.setAttribute('font-family', "'Pirata One', cursive");
            rightLabel.setAttribute('fill', zone.color);
            rightLabel.setAttribute('opacity', '0.9');
            rightLabel.setAttribute('writing-mode', 'vertical-lr');
            rightLabel.setAttribute('text-anchor', 'middle');
            rightLabel.textContent = zone.label;
            this.boardContent.appendChild(rightLabel);
        }
        
        // Latitude line labels in bottom margin
        const latLabelY = totalHeight - 8;
        const latLabels = [
            { x: playAreaLeft + 60, label: '23.5°N', color: '#c9a227' },
            { x: boardWidth / 2, label: '0° Equator', color: '#d35400' },
            { x: playAreaRight - 60, label: '23.5°S', color: '#c9a227' }
        ];
        
        for (const lat of latLabels) {
            const label = createSVGElement('text');
            label.setAttribute('x', lat.x);
            label.setAttribute('y', latLabelY);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '11');
            label.setAttribute('font-family', "'Pirata One', cursive");
            label.setAttribute('fill', lat.color);
            label.setAttribute('opacity', '0.85');
            label.textContent = lat.label;
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
    
    // Marker placement mode visual feedback (for mobile tap-to-place)
    setMarkerPlacementActive(active) {
        const dragMarker = $('#drag-marker');
        if (!dragMarker) return;
        
        if (active) {
            dragMarker.classList.add('placement-active');
            // Add pulsing instruction to board
            const boardContainer = $('#board-container');
            if (boardContainer && !$('#placement-hint')) {
                const hint = createElement('div', 'placement-hint');
                hint.id = 'placement-hint';
                hint.textContent = 'Tap a highlighted tile to place marker';
                boardContainer.appendChild(hint);
            }
        } else {
            dragMarker.classList.remove('placement-active');
            $('#placement-hint')?.remove();
        }
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
        
        // Update mobile stats bar (only visible on mobile)
        this.updateMobileStats(player, traitDb, currentPhase, canDrag);
    }
    
    // Mobile floating stats bar
    updateMobileStats(player, traitDb, currentPhase, canDrag) {
        const boardContainer = $('#board-container');
        if (!boardContainer) return;
        
        // Only show on mobile (check via CSS visibility would be cleaner, but this works)
        let statsBar = $('#mobile-stats-bar');
        
        // Create if doesn't exist
        if (!statsBar) {
            statsBar = createElement('div', 'mobile-stats-bar');
            statsBar.id = 'mobile-stats-bar';
            boardContainer.appendChild(statsBar);
        }
        
        const hasAvailableMarkers = player.markersOnBoard < player.markers;
        const isPopulatePhase = currentPhase === 'populate';
        const canPlace = canDrag && isPopulatePhase && hasAvailableMarkers;
        
        statsBar.innerHTML = `
            <div class="mobile-stat">
                <span class="mobile-stat-icon">🧬</span>
                <span class="mobile-stat-value">${player.alleles}</span>
            </div>
            <div class="mobile-stat">
                <span class="mobile-stat-icon">🦎</span>
                <span class="mobile-stat-value">${player.markersOnBoard}/${player.markers}</span>
            </div>
            <div class="mobile-stat">
                <span class="mobile-stat-icon">🔷</span>
                <span class="mobile-stat-value">${player.tilesControlled}</span>
            </div>
            <div class="mobile-stat">
                <span class="mobile-stat-icon">🧩</span>
                <span class="mobile-stat-value">${player.traits.length}</span>
            </div>
            ${canPlace ? `<button class="mobile-place-marker" id="mobile-place-btn">📍 Place</button>` : ''}
        `;
        
        // Add handler for place button
        const placeBtn = $('#mobile-place-btn');
        if (placeBtn) {
            placeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Trigger the same toggle as the drag marker
                const dragMarker = $('#drag-marker');
                if (dragMarker) {
                    dragMarker.click();
                }
            });
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
            
            // Get the era when this trait was acquired
            const acquisitionEra = player.traitAcquisitions[traitId] ?? 0;
            
            // Trait block (fixed width, colored by acquisition era)
            const traitBlock = this.createGenomeBlock('trait', trait.base_pairs || 100, trait.name, acquisitionEra);
            
            // Make trait blocks clickable
            traitBlock.addEventListener('click', () => {
                if (this.callbacks.onGenomeTraitClick) {
                    this.callbacks.onGenomeTraitClick(trait);
                }
            });
            
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
    // For traits: acquisitionEra is the era number (0-11) when the trait was acquired
    createGenomeBlock(type, size, label, acquisitionEra = null) {
        const block = createElement('div', `genome-block ${type}`);
        
        // Fixed width for traits, smaller for TEs
        if (type === 'trait') {
            block.style.width = '10px';
        } else if (type === 'te') {
            block.style.width = '4px';
        } else {
            block.style.flex = '1'; // empty state fills
        }
        
        // Color based on acquisition era (using ERA_COLORS palette)
        if (type === 'trait') {
            const color = ERA_COLORS[acquisitionEra] || ERA_COLORS[0];
            block.style.backgroundColor = color;
        }
        
        // Tooltip with era info for traits
        if (type === 'trait') {
            const eraName = ERA_NAMES[acquisitionEra] || 'Unknown';
            block.title = `${label} (${size}kb) - Acquired: ${eraName}`;
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
                
                // Animate die
                const die1 = $('#die-1');
                die1.classList.add('rolling');
                
                // Roll animation
                for (let i = 0; i < 10; i++) {
                    die1.textContent = Math.floor(Math.random() * 6) + 1;
                    await new Promise(r => setTimeout(r, 50));
                }
                
                die1.classList.remove('rolling');
                
                const result = onRoll();
                die1.textContent = result.die;
                
                const genomeLabel = result.genomeMod > 0 ? `+${result.genomeMod}` : result.genomeMod;
                $('#dice-result').innerHTML = `
                    <div class="dice-breakdown">
                        Offspring: ${result.base} + Population: ${result.popBonus} + Territory: ${result.tileBonus} + Fecundity: ${result.fecundity} + Genome: ${genomeLabel}
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
        $('#gameover-title').textContent = 'The Phanerozoic Ends';
        
        scoresDiv.innerHTML = '';
        for (let i = 0; i < scores.length; i++) {
            const s = scores[i];
            const row = createElement('div', `score-row ${i === 0 ? 'winner' : ''}`);
            row.innerHTML = `
                <div class="score-name">
                    <span class="player-dot" style="background: ${s.player.color}"></span>
                    <span>${s.player.name}</span>
                    ${i === 0 ? '<span class="winner-badge">👑</span>' : ''}
                </div>
                <div class="score-breakdown">
                    <span class="score-formula">${s.markers} pop × ${s.complexity} cpx + ${s.tiles * 3} tiles</span>
                </div>
                <div class="score-value">${s.score}</div>
            `;
            scoresDiv.appendChild(row);
            
            // Add detailed stats row
            const statsRow = createElement('div', 'score-stats');
            statsRow.innerHTML = `
                <span title="Traits acquired">🧬 ${s.traitCount} traits</span>
                <span title="Genome size">📏 ${s.genomeLength} kb</span>
                <span title="Extinctions survived">💀 ${s.extinctionsSurvived} survived</span>
                ${s.tePercent > 0 ? `<span title="TE bloat">🦠 ${s.tePercent}% junk DNA</span>` : ''}
            `;
            scoresDiv.appendChild(statsRow);
        }
        
        winnerDiv.innerHTML = `
            <div class="winner-text">${scores[0].player.name} wins!</div>
            <div class="winner-subtitle">After 540 million years of evolution</div>
        `;
        
        organismsDiv.innerHTML = '<h3 class="organism-header">Your Lineage Most Resembles...</h3>';
        for (const { player, organism, similarity, sharedTraits } of organisms) {
            const match = createElement('div', 'organism-match');
            if (organism) {
                const sharedCount = sharedTraits?.length || 0;
                match.innerHTML = `
                    <div class="organism-match-player" style="color: ${player.color}">${player.name}</div>
                    <div class="organism-name-large">${organism.name}</div>
                    <div class="organism-scientific">${organism.scientific_name}</div>
                    <div class="organism-similarity">
                        <div class="similarity-bar-container">
                            <div class="similarity-bar" style="width: ${(similarity * 100).toFixed(0)}%"></div>
                        </div>
                        <span class="similarity-percent">${(similarity * 100).toFixed(0)}% match</span>
                    </div>
                    <div class="organism-shared">${sharedCount} shared traits</div>
                    <div class="organism-fact">"${organism.fun_fact}"</div>
                `;
            } else {
                match.innerHTML = `
                    <div class="organism-match-player" style="color: ${player.color}">${player.name}</div>
                    <div class="organism-name-large">Unknown Lifeform</div>
                    <div class="organism-scientific">No close match in the fossil record</div>
                `;
            }
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
        
        // Calculate survival rating
        const survivalRating = this.getSurvivalRating(erasSurvived, extinct);
        
        if (extinct) {
            title.textContent = 'Extinction!';
            $('#solo-result-icon').textContent = '💀';
            $('#solo-result-text').innerHTML = `Your lineage has ended.<br><span class="survival-rating">${survivalRating.label}</span>`;
            $('#solo-result-text').style.color = '#f85149';
        } else {
            title.textContent = 'Survival Complete!';
            $('#solo-result-icon').textContent = '🏆';
            $('#solo-result-text').innerHTML = `Your lineage endures!<br><span class="survival-rating">${survivalRating.label}</span>`;
            $('#solo-result-text').style.color = '#3fb950';
        }
        
        $('#solo-eras-survived').textContent = `Eras survived: ${erasSurvived} / 12`;
        
        // Show score with extended stats
        scoresDiv.innerHTML = '';
        const row = createElement('div', 'score-row winner');
        row.innerHTML = `
            <div class="score-name">
                <span class="player-dot" style="background: ${score.player.color}"></span>
                <span>${score.player.name}</span>
            </div>
            <div class="score-breakdown">
                <span class="score-formula">${score.markers} pop × ${score.complexity} cpx + ${score.tiles * 3} tiles</span>
            </div>
            <div class="score-value">${score.score}</div>
        `;
        scoresDiv.appendChild(row);
        
        // Add detailed stats
        const statsRow = createElement('div', 'solo-stats-grid');
        statsRow.innerHTML = `
            <div class="solo-stat">
                <span class="solo-stat-icon">🧬</span>
                <span class="solo-stat-value">${score.traitCount}</span>
                <span class="solo-stat-label">Traits</span>
            </div>
            <div class="solo-stat">
                <span class="solo-stat-icon">📏</span>
                <span class="solo-stat-value">${score.genomeLength}</span>
                <span class="solo-stat-label">Genome (kb)</span>
            </div>
            <div class="solo-stat">
                <span class="solo-stat-icon">💀</span>
                <span class="solo-stat-value">${score.extinctionsSurvived}</span>
                <span class="solo-stat-label">Extinctions</span>
            </div>
            <div class="solo-stat">
                <span class="solo-stat-icon">🦠</span>
                <span class="solo-stat-value">${score.tePercent}%</span>
                <span class="solo-stat-label">Junk DNA</span>
            </div>
        `;
        scoresDiv.appendChild(statsRow);
        
        // Hide winner display for solo
        winnerDiv.innerHTML = '';
        
        // Show organism match
        organismsDiv.innerHTML = '<h3 class="organism-header">Your Lineage Most Resembles...</h3>';
        if (organismMatch.organism) {
            const sharedCount = organismMatch.sharedTraits?.length || 0;
            const match = createElement('div', 'organism-match organism-match-featured');
            match.innerHTML = `
                <div class="organism-name-large">${organismMatch.organism.name}</div>
                <div class="organism-scientific">${organismMatch.organism.scientific_name}</div>
                <div class="organism-similarity">
                    <div class="similarity-bar-container">
                        <div class="similarity-bar" style="width: ${(organismMatch.similarity * 100).toFixed(0)}%"></div>
                    </div>
                    <span class="similarity-percent">${(organismMatch.similarity * 100).toFixed(0)}% genetic match</span>
                </div>
                <div class="organism-shared">${sharedCount} shared traits with your lineage</div>
                <div class="organism-fact">"${organismMatch.organism.fun_fact}"</div>
            `;
            organismsDiv.appendChild(match);
        } else {
            const match = createElement('div', 'organism-match organism-match-featured');
            match.innerHTML = `
                <div class="organism-name-large">Unknown Lifeform</div>
                <div class="organism-scientific">A unique branch on the tree of life</div>
                <div class="organism-fact">"Your lineage defies classification - truly something new under the sun."</div>
            `;
            organismsDiv.appendChild(match);
        }
        
        this.showModal('gameover-modal');
    }
    
    // Calculate survival rating based on eras survived
    getSurvivalRating(erasSurvived, extinct) {
        if (!extinct && erasSurvived >= 12) {
            return { label: 'Living Fossil', tier: 5 };
        }
        if (erasSurvived >= 10) {
            return { label: 'Apex Survivor', tier: 4 };
        }
        if (erasSurvived >= 7) {
            return { label: 'Tenacious', tier: 3 };
        }
        if (erasSurvived >= 4) {
            return { label: 'Brief Flame', tier: 2 };
        }
        return { label: 'Evolutionary Dead End', tier: 1 };
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
    computeTechTreeLayout(traitDb, containerWidth = 1200, player = null) {
        const traits = Object.values(traitDb);
        const positions = {};
        
        // Layout constants
        const NODE_WIDTH = 75;
        const NODE_HEIGHT = 20;
        const V_GAP = 4;
        const MYA_HEADER_HEIGHT = 42;
        const PADDING = 6;
        const NUM_ERAS = 12;
        const CHANNEL_WIDTH = 40;  // Routing corridor on left side of each era column
        const NODE_LEFT_MARGIN = 50;  // Space for routing channel before trait boxes
        
        // Fixed era width - includes routing channel + node area
        const ERA_WIDTH = NODE_LEFT_MARGIN + NODE_WIDTH + 30;
        
        // Phylogenetic clades - loaded from phylogeny.json at game init
        const CLADES = this.phylogenyClades || {
            "Bilateria": { "parent": null, "era_split": 0, "row": 0, "color": "#8b949e" },
            "Arthropoda": { "parent": "Bilateria", "era_split": 0, "row": 1, "color": "#f97316" },
            "Hexapoda": { "parent": "Arthropoda", "era_split": 3, "row": 2, "color": "#fb923c" },
            "Mollusca": { "parent": "Bilateria", "era_split": 0, "row": 3, "color": "#a855f7" },
            "Cephalopoda": { "parent": "Mollusca", "era_split": 1, "row": 4, "color": "#c084fc" },
            "Chordata": { "parent": "Bilateria", "era_split": 0, "row": 5, "color": "#3b82f6" },
            "Chondrichthyes": { "parent": "Chordata", "era_split": 1, "row": 6, "color": "#60a5fa" },
            "Actinopterygii": { "parent": "Chordata", "era_split": 1, "row": 7, "color": "#38bdf8" },
            "Sarcopterygii": { "parent": "Chordata", "era_split": 2, "row": 8, "color": "#22d3ee" },
            "Amphibia": { "parent": "Sarcopterygii", "era_split": 3, "row": 9, "color": "#34d399" },
            "Amniota": { "parent": "Sarcopterygii", "era_split": 4, "row": 10, "color": "#4ade80" },
            "Synapsida": { "parent": "Amniota", "era_split": 4, "row": 11, "color": "#facc15" },
            "Mammalia": { "parent": "Synapsida", "era_split": 6, "row": 12, "color": "#fbbf24" },
            "Sauropsida": { "parent": "Amniota", "era_split": 4, "row": 13, "color": "#ef4444" },
            "Archosauria": { "parent": "Sauropsida", "era_split": 5, "row": 14, "color": "#f87171" },
            "Crocodilia": { "parent": "Archosauria", "era_split": 6, "row": 15, "color": "#84cc16" },
            "Aves": { "parent": "Archosauria", "era_split": 7, "row": 16, "color": "#f472b6" }
        };
        
        // Build child lookup for clades
        const cladeChildren = {};  // parent -> [children]
        for (const [cladeName, cladeData] of Object.entries(CLADES)) {
            const parent = cladeData.parent;
            if (parent) {
                if (!cladeChildren[parent]) cladeChildren[parent] = [];
                cladeChildren[parent].push(cladeName);
            }
        }
        
        // Get all descendant clades (recursive)
        const getDescendants = (cladeName) => {
            const descendants = [];
            const children = cladeChildren[cladeName] || [];
            for (const child of children) {
                descendants.push(child);
                descendants.push(...getDescendants(child));
            }
            return descendants;
        };
        
        // Player ownership data for acquisition-based positioning (needed early for Y range calculation)
        const ownedIds = new Set(player?.traits || []);
        const acquisitions = player?.traitAcquisitions || {};
        
        // Compute which clades are "active" (visible as lanes) at each era
        // A clade is active from its split era until it splits into children
        const activeCladesByEra = {};
        for (let era = 0; era < NUM_ERAS; era++) {
            activeCladesByEra[era] = [];
            for (const [cladeName, cladeData] of Object.entries(CLADES)) {
                const splitEra = cladeData.era_split || 0;
                // Clade becomes visible at its split era
                if (era >= splitEra) {
                    // Check if this clade has children that have split by this era
                    const children = cladeChildren[cladeName] || [];
                    const activeChildren = children.filter(c => (CLADES[c]?.era_split || 0) <= era);
                    // If no children have split yet, this clade is a leaf at this era
                    if (activeChildren.length === 0) {
                        activeCladesByEra[era].push(cladeName);
                    }
                }
            }
            // Sort by row order
            activeCladesByEra[era].sort((a, b) => (CLADES[a]?.row || 0) - (CLADES[b]?.row || 0));
        }
        
        // Get clade color
        const getCladeColor = (clade) => {
            return CLADES[clade]?.color || '#8b949e';
        };
        
        // Find the active clade for a trait at a given era
        // (trait's clade or nearest ancestor that's active)
        const getActiveClade = (traitClade, era) => {
            let clade = traitClade;
            while (clade) {
                if (activeCladesByEra[era]?.includes(clade)) return clade;
                clade = CLADES[clade]?.parent;
            }
            return activeCladesByEra[era]?.[0] || 'Bilateria';
        };
        
        // Passthrough region height for arrow routing within each lane
        const PASSTHROUGH_HEIGHT = 14;
        // Clade header height - space for clade label at top of each lane
        const CLADE_HEADER_HEIGHT = 16;
        
        // Compute Y ranges for each clade at each era
        // Count traits that will actually be PLACED in each lane (using getActiveClade logic)
        const cladeYRanges = {};  // era -> cladeName -> { startY, endY, passthroughY, traitsStartY }
        
        for (let era = 0; era < NUM_ERAS; era++) {
            cladeYRanges[era] = {};
            const activeClades = activeCladesByEra[era];
            
            // Count how many traits will be placed in each active clade lane
            const laneTraitCounts = {};
            for (const cladeName of activeClades) {
                laneTraitCounts[cladeName] = 0;
            }
            
            // For each trait at this era, find which active lane it maps to
            for (const trait of traits) {
                const tEra = ownedIds.has(trait.id) ? (acquisitions[trait.id] ?? trait.era_min) : trait.era_min;
                if (tEra !== era) continue;
                
                const activeClade = getActiveClade(trait.clade, era);
                if (laneTraitCounts[activeClade] !== undefined) {
                    laneTraitCounts[activeClade]++;
                }
            }
            
            // Assign Y ranges based on: header + traits + passthrough
            let currentY = MYA_HEADER_HEIGHT + PADDING;
            for (const cladeName of activeClades) {
                const traitCount = Math.max(1, laneTraitCounts[cladeName]);
                const traitsHeight = traitCount * (NODE_HEIGHT + V_GAP);
                const laneHeight = CLADE_HEADER_HEIGHT + traitsHeight + PASSTHROUGH_HEIGHT;
                
                cladeYRanges[era][cladeName] = {
                    startY: currentY,
                    endY: currentY + laneHeight,
                    height: laneHeight,
                    traitsStartY: currentY + CLADE_HEADER_HEIGHT,  // Where traits start (after header)
                    traitsEndY: currentY + CLADE_HEADER_HEIGHT + traitsHeight,  // Where traits end
                    passthroughY: currentY + CLADE_HEADER_HEIGHT + traitsHeight + PASSTHROUGH_HEIGHT / 2  // Center of passthrough
                };
                currentY += laneHeight + 4;  // Gap between lanes
            }
        }
        
        // Find terminal clades (clades with no children in CLADES)
        const terminalClades = Object.keys(CLADES).filter(c => !cladeChildren[c] || cladeChildren[c].length === 0);
        
        // Build dependents map: for each trait, which traits depend on it (reverse of hard_prereqs)
        const dependents = {};  // traitId -> [dependent trait ids]
        for (const trait of traits) {
            for (const prereqId of (trait.hard_prereqs || [])) {
                if (!dependents[prereqId]) dependents[prereqId] = [];
                dependents[prereqId].push(trait.id);
            }
        }
        
        // Compute which terminal clades each trait can reach through its dependents
        const traitLineages = {};  // traitId -> Set of terminal clade names
        const computeReachableClades = (traitId, visited = new Set()) => {
            if (traitLineages[traitId]) return traitLineages[traitId];
            if (visited.has(traitId)) return new Set();
            visited.add(traitId);
            
            const trait = traitDb[traitId];
            if (!trait) return new Set();
            
            const reachable = new Set();
            
            // Add trait's own clade if it's terminal
            if (terminalClades.includes(trait.clade)) {
                reachable.add(trait.clade);
            }
            
            // Add clades reachable through dependents
            const deps = dependents[traitId] || [];
            for (const depId of deps) {
                const depClades = computeReachableClades(depId, new Set(visited));
                for (const c of depClades) reachable.add(c);
            }
            
            // If no terminal clades found, use the trait's own clade
            if (reachable.size === 0) {
                reachable.add(trait.clade);
            }
            
            traitLineages[traitId] = reachable;
            return reachable;
        };
        
        // Compute lineages for all traits
        for (const trait of traits) {
            computeReachableClades(trait.id);
        }
        
        // Group traits by display era - DUPLICATE traits across clades they can reach
        const eraGroups = {};
        for (let i = 0; i < NUM_ERAS; i++) {
            eraGroups[i] = [];
        }
        
        // Build same-era children lookup (for intra-era clade duplication)
        const sameEraChildrenByEra = {};  // era -> traitId -> [childIds in that era]
        for (const trait of traits) {
            const displayEra = ownedIds.has(trait.id)
                ? (acquisitions[trait.id] ?? trait.era_min)
                : trait.era_min;
            for (const prereqId of (trait.hard_prereqs || [])) {
                const prereqTrait = traitDb[prereqId];
                if (!prereqTrait) continue;
                const prereqEra = ownedIds.has(prereqId)
                    ? (acquisitions[prereqId] ?? prereqTrait.era_min)
                    : prereqTrait.era_min;
                if (prereqEra === displayEra) {
                    if (!sameEraChildrenByEra[displayEra]) sameEraChildrenByEra[displayEra] = {};
                    if (!sameEraChildrenByEra[displayEra][prereqId]) sameEraChildrenByEra[displayEra][prereqId] = [];
                    sameEraChildrenByEra[displayEra][prereqId].push(trait.id);
                }
            }
        }
        
        // Track virtual trait mappings: virtualId -> realId
        const virtualToReal = {};
        let virtualCounter = 0;
        
        for (const trait of traits) {
            const displayEra = ownedIds.has(trait.id)
                ? (acquisitions[trait.id] ?? trait.era_min)
                : trait.era_min;
            if (displayEra < 0 || displayEra >= NUM_ERAS) continue;
            
            // Filter orphan traits: no prereqs AND no dependents AND not owned
            // Foundation traits (have dependents) are kept
            // Owned traits are always shown
            const hasPrereqs = (trait.hard_prereqs?.length > 0) || (trait.soft_prereqs?.length > 0);
            const hasDependents = (dependents[trait.id]?.length > 0);
            const isOwned = ownedIds.has(trait.id);
            
            if (!hasPrereqs && !hasDependents && !isOwned) {
                continue;  // Skip orphan traits
            }
            
            const activeAtEra = activeCladesByEra[displayEra] || [];
            
            // Compute clades this trait should appear in:
            // 1. Its own reachable clades (from lineage computation)
            // 2. Clades of same-era children (for intra-era duplication)
            const relevantClades = new Set();
            
            // Add clades from lineage computation
            const reachableClades = traitLineages[trait.id] || new Set([trait.clade]);
            for (const rc of reachableClades) {
                // Find the active clade at this era for this reachable clade
                let current = rc;
                while (current) {
                    if (activeAtEra.includes(current)) {
                        relevantClades.add(current);
                        break;
                    }
                    current = CLADES[current]?.parent;
                }
            }
            
            // Also check same-era children's clades
            const sameEraChildren = sameEraChildrenByEra[displayEra]?.[trait.id] || [];
            for (const childId of sameEraChildren) {
                const childTrait = traitDb[childId];
                if (!childTrait) continue;
                const childActiveClade = getActiveClade(childTrait.clade, displayEra);
                if (childActiveClade) relevantClades.add(childActiveClade);
            }
            
            // If no relevant clades found, use the trait's own clade
            if (relevantClades.size === 0) {
                relevantClades.add(getActiveClade(trait.clade, displayEra));
            }
            
            // Filter to only active clades at this era
            const relevantActiveClades = [...relevantClades].filter(c => activeAtEra.includes(c));
            
            // If only one relevant clade, add trait normally
            if (relevantActiveClades.length <= 1) {
                eraGroups[displayEra].push(trait);
            } else {
                // Duplicate trait for each relevant active clade
                for (const activeClade of relevantActiveClades) {
                    const virtualId = `${trait.id}__${activeClade}__${virtualCounter++}`;
                    const virtualTrait = {
                        ...trait,
                        virtualId,
                        realId: trait.id,
                        assignedClade: activeClade,
                        isVirtual: true
                    };
                    virtualToReal[virtualId] = trait.id;
                    eraGroups[displayEra].push(virtualTrait);
                }
            }
        }
        
        // Compute prereq chain depth for each trait (foundation traits = 0, dependents = higher)
        const prereqDepth = {};
        const computeDepth = (traitId, visited = new Set()) => {
            if (prereqDepth[traitId] !== undefined) return prereqDepth[traitId];
            if (visited.has(traitId)) return 0; // Avoid cycles
            visited.add(traitId);
            
            const trait = traitDb[traitId];
            if (!trait || !trait.hard_prereqs || trait.hard_prereqs.length === 0) {
                prereqDepth[traitId] = 0;
                return 0;
            }
            
            let maxParentDepth = 0;
            for (const prereqId of trait.hard_prereqs) {
                maxParentDepth = Math.max(maxParentDepth, computeDepth(prereqId, visited) + 1);
            }
            prereqDepth[traitId] = maxParentDepth;
            return maxParentDepth;
        };
        
        for (const trait of traits) {
            computeDepth(trait.id);
        }
        
        // Build same-era prereq lookup for grouping
        const sameEraPrereq = {};  // traitId -> prereqId (if prereq is in same era)
        for (const trait of traits) {
            const displayEra = ownedIds.has(trait.id)
                ? (acquisitions[trait.id] ?? trait.era_min)
                : trait.era_min;
            for (const prereqId of (trait.hard_prereqs || [])) {
                const prereqTrait = traitDb[prereqId];
                if (!prereqTrait) continue;
                const prereqEra = ownedIds.has(prereqId)
                    ? (acquisitions[prereqId] ?? prereqTrait.era_min)
                    : prereqTrait.era_min;
                if (prereqEra === displayEra) {
                    sameEraPrereq[trait.id] = prereqId;
                    break;  // Only track first same-era prereq
                }
            }
        }
        
        // Compute same-era chain depth (0 = root, 1 = first dependent, etc.)
        const sameEraChainDepth = {};
        const computeChainDepth = (traitId) => {
            if (sameEraChainDepth[traitId] !== undefined) return sameEraChainDepth[traitId];
            const prereq = sameEraPrereq[traitId];
            if (!prereq) {
                sameEraChainDepth[traitId] = 0;
                return 0;
            }
            const depth = computeChainDepth(prereq) + 1;
            sameEraChainDepth[traitId] = depth;
            return depth;
        };
        for (const trait of traits) {
            computeChainDepth(trait.id);
        }
        
        // Build same-era children lookup (reverse of sameEraPrereq)
        const sameEraChildren = {};  // parentId -> [childIds]
        for (const [childId, parentId] of Object.entries(sameEraPrereq)) {
            if (!sameEraChildren[parentId]) sameEraChildren[parentId] = [];
            sameEraChildren[parentId].push(childId);
        }
        
        // Depth-first traversal to order traits (parent directly above all its children)
        const depthFirstOrder = (traitId, result, traitMap) => {
            const trait = traitMap[traitId];
            if (!trait) return;
            result.push(trait);
            const children = sameEraChildren[traitId] || [];
            // Sort children by cost for consistent ordering
            children.sort((a, b) => (traitMap[a]?.cost || 0) - (traitMap[b]?.cost || 0));
            for (const childId of children) {
                depthFirstOrder(childId, result, traitMap);
            }
        };
        
        // Sort each era using depth-first tree traversal
        // This ensures parents are always directly above their children
        for (const era in eraGroups) {
            const eraInt = parseInt(era);
            
            // Build trait map for quick lookup - use virtualId for virtual traits
            const traitMap = {};
            for (const trait of eraGroups[era]) {
                const key = trait.virtualId || trait.id;
                traitMap[key] = trait;
            }
            
            // Helper to get the effective clade for a trait (assigned clade for virtual, computed otherwise)
            const getEffectiveClade = (trait) => {
                if (trait.assignedClade) return trait.assignedClade;
                return getActiveClade(trait.clade, eraInt);
            };
            
            // Find root traits (no same-era parent, or parent not in this era's group)
            const roots = eraGroups[era].filter(t => {
                const realId = t.realId || t.id;
                const parentId = sameEraPrereq[realId];
                if (!parentId) return true;
                // Check if parent exists in this group (could be virtual)
                return !Object.values(traitMap).some(m => (m.realId || m.id) === parentId);
            });
            
            // Sort roots by: clade row, then owned status, then cost
            roots.sort((a, b) => {
                const aActiveClade = getEffectiveClade(a);
                const bActiveClade = getEffectiveClade(b);
                const aRow = CLADES[aActiveClade]?.row ?? 0;
                const bRow = CLADES[bActiveClade]?.row ?? 0;
                if (aRow !== bRow) return aRow - bRow;
                
                const aRealId = a.realId || a.id;
                const bRealId = b.realId || b.id;
                const aOwned = ownedIds.has(aRealId) ? 0 : 1;
                const bOwned = ownedIds.has(bRealId) ? 0 : 1;
                if (aOwned !== bOwned) return aOwned - bOwned;
                
                return a.cost - b.cost;
            });
            
            // Depth-first for virtual traits - use virtualId as key
            const depthFirstOrderVirtual = (traitKey, result, tMap) => {
                const trait = tMap[traitKey];
                if (!trait) return;
                result.push(trait);
                const realId = trait.realId || trait.id;
                const childRealIds = sameEraChildren[realId] || [];
                // Find virtual traits in this map that match child real IDs
                for (const childRealId of childRealIds) {
                    const childTraits = Object.values(tMap).filter(t => (t.realId || t.id) === childRealId);
                    for (const child of childTraits) {
                        const childKey = child.virtualId || child.id;
                        if (tMap[childKey]) {
                            depthFirstOrderVirtual(childKey, result, tMap);
                        }
                    }
                }
            };
            
            // Build final order via depth-first traversal from each root
            const ordered = [];
            for (const root of roots) {
                const rootKey = root.virtualId || root.id;
                depthFirstOrderVirtual(rootKey, ordered, traitMap);
            }
            
            eraGroups[era] = ordered;
        }
        
        // RECALCULATE clade Y ranges based on ACTUAL trait counts after depth-first sorting
        for (let era = 0; era < NUM_ERAS; era++) {
            const activeClades = activeCladesByEra[era];
            
            // Count actual traits per clade from eraGroups (after sorting may have dropped some)
            const actualCounts = {};
            for (const cladeName of activeClades) {
                actualCounts[cladeName] = 0;
            }
            
            for (const trait of eraGroups[era]) {
                const activeClade = trait.assignedClade || getActiveClade(trait.clade, era);
                if (actualCounts[activeClade] !== undefined) {
                    actualCounts[activeClade]++;
                }
            }
            
            // Reassign Y ranges with actual counts
            let currentY = MYA_HEADER_HEIGHT + PADDING;
            for (const cladeName of activeClades) {
                const traitCount = Math.max(1, actualCounts[cladeName]);
                const traitsHeight = traitCount * (NODE_HEIGHT + V_GAP);
                const laneHeight = CLADE_HEADER_HEIGHT + traitsHeight + PASSTHROUGH_HEIGHT;
                
                cladeYRanges[era][cladeName] = {
                    startY: currentY,
                    endY: currentY + laneHeight,
                    height: laneHeight,
                    traitsStartY: currentY + CLADE_HEADER_HEIGHT,
                    traitsEndY: currentY + CLADE_HEADER_HEIGHT + traitsHeight,
                    passthroughY: currentY + CLADE_HEADER_HEIGHT + traitsHeight + PASSTHROUGH_HEIGHT / 2
                };
                currentY += laneHeight + 4;
            }
        }
        
        // Track Y position within each clade lane per era
        const cladeYOffsets = {};  // era -> cladeName -> currentY offset
        for (let era = 0; era < NUM_ERAS; era++) {
            cladeYOffsets[era] = {};
            for (const cladeName of activeCladesByEra[era]) {
                cladeYOffsets[era][cladeName] = 0;
            }
        }
        
        // Indent amount for same-era child traits
        const INDENT_PER_LEVEL = 12;
        
        // Assign positions - traits positioned within their clade's Y range
        // Traits with same-era prereqs are indented beneath their parent
        const assignPositions = () => {
            for (let era = 0; era < NUM_ERAS; era++) {
                const group = eraGroups[era];
                const eraX = PADDING + era * ERA_WIDTH;
                const nodeStartX = eraX + NODE_LEFT_MARGIN;  // Leave room for routing channel
                
                for (const trait of group) {
                    // Use assigned clade for virtual traits, computed for regular
                    const activeClade = trait.assignedClade || getActiveClade(trait.clade, era);
                    const range = cladeYRanges[era]?.[activeClade];
                    const offset = cladeYOffsets[era]?.[activeClade] || 0;
                    
                    // Calculate indent - ONLY indent if same-era parent is in SAME active clade
                    const realId = trait.realId || trait.id;
                    const parentRealId = sameEraPrereq[realId];
                    let indent = 0;
                    let effectiveChainDepth = 0;
                    
                    if (parentRealId) {
                        // Find parent's position to check if it's in the same clade
                        const parentPos = Object.values(positions).find(p => 
                            (p.realId === parentRealId || p.realId === undefined) && 
                            positions[parentRealId]?.era === era
                        ) || positions[parentRealId];
                        
                        // Only indent if parent is in the same active clade
                        if (parentPos && parentPos.activeClade === activeClade) {
                            effectiveChainDepth = sameEraChainDepth[realId] || 0;
                            indent = effectiveChainDepth * INDENT_PER_LEVEL;
                        }
                    }
                    
                    // Use traitsStartY to position after clade header
                    const y = (range?.traitsStartY || MYA_HEADER_HEIGHT + PADDING) + offset;
                    
                    // Use virtualId as position key for virtual traits
                    const posKey = trait.virtualId || trait.id;
                    
                    positions[posKey] = { 
                        x: nodeStartX + indent, 
                        y, 
                        era, 
                        eraX, 
                        slot: offset / (NODE_HEIGHT + V_GAP),
                        clade: trait.clade,
                        activeClade,
                        cladeColor: getCladeColor(trait.clade),
                        chainDepth: effectiveChainDepth,
                        sameEraParent: parentRealId && indent > 0 ? parentRealId : null,  // Only set if actually indenting
                        realId,
                        isVirtual: trait.isVirtual || false
                    };
                    
                    // Increment offset for next trait in this clade
                    if (cladeYOffsets[era][activeClade] !== undefined) {
                        cladeYOffsets[era][activeClade] += NODE_HEIGHT + V_GAP;
                    }
                }
            }
        };
        assignPositions();
        
        // Barycentric ordering: position traits near the average Y of their prerequisites
        // Run multiple passes to settle the layout
        for (let pass = 0; pass < 3; pass++) {
            for (let era = 1; era < NUM_ERAS; era++) {
                const group = eraGroups[era];
                
                // Compute barycenter for each trait (avg Y of prereqs)
                const barycenters = {};
                for (const trait of group) {
                    const posKey = trait.virtualId || trait.id;
                    const prereqs = trait.hard_prereqs || [];
                    if (prereqs.length === 0) {
                        barycenters[posKey] = positions[posKey]?.y ?? 0;
                        continue;
                    }
                    let sum = 0, count = 0;
                    for (const prereqId of prereqs) {
                        // Look for prereq in any position (could be virtual)
                        const prereqPos = positions[prereqId] || 
                            Object.values(positions).find(p => p.realId === prereqId);
                        if (prereqPos) {
                            sum += prereqPos.y + NODE_HEIGHT / 2;
                            count++;
                        }
                    }
                    barycenters[posKey] = count > 0 ? sum / count : (positions[posKey]?.y ?? 0);
                }
                
                // Sort by barycenter within active clade
                group.sort((a, b) => {
                    // Active clade rows first (use assigned clade for virtual)
                    const aActiveClade = a.assignedClade || getActiveClade(a.clade, era);
                    const bActiveClade = b.assignedClade || getActiveClade(b.clade, era);
                    const aRow = CLADES[aActiveClade]?.row ?? 0;
                    const bRow = CLADES[bActiveClade]?.row ?? 0;
                    if (aRow !== bRow) return aRow - bRow;
                    
                    // Within clade, owned first (use realId for ownership check)
                    const aRealId = a.realId || a.id;
                    const bRealId = b.realId || b.id;
                    const aOwned = ownedIds.has(aRealId) ? 0 : 1;
                    const bOwned = ownedIds.has(bRealId) ? 0 : 1;
                    if (aOwned !== bOwned) return aOwned - bOwned;
                    
                    const aPosKey = a.virtualId || a.id;
                    const bPosKey = b.virtualId || b.id;
                    return (barycenters[aPosKey] || 0) - (barycenters[bPosKey] || 0);
                });
            }
            
            // Reset offsets and reassign positions
            for (let era = 0; era < NUM_ERAS; era++) {
                for (const cladeName of activeCladesByEra[era]) {
                    cladeYOffsets[era][cladeName] = 0;
                }
            }
            assignPositions();
        }
        
        // Compute total height from clade ranges
        let maxY = MYA_HEADER_HEIGHT + PADDING;
        for (let era = 0; era < NUM_ERAS; era++) {
            for (const cladeName in cladeYRanges[era]) {
                const range = cladeYRanges[era][cladeName];
                maxY = Math.max(maxY, range.endY);
            }
        }
        
        const totalWidth = PADDING * 2 + NUM_ERAS * ERA_WIDTH;
        const totalHeight = maxY + PADDING;
        
        // Build branch split points for rendering
        // A split point occurs when a parent clade has children that split at this era
        const branchSplits = [];  // { era, parentClade, childClades, parentY, childYs }
        for (let era = 0; era < NUM_ERAS; era++) {
            for (const [cladeName, cladeData] of Object.entries(CLADES)) {
                const children = cladeChildren[cladeName] || [];
                // Find children that split at exactly this era
                const splittingChildren = children.filter(c => (CLADES[c]?.era_split || 0) === era);
                if (splittingChildren.length > 0) {
                    // Parent's Y range at previous era
                    const prevEra = Math.max(0, era - 1);
                    const parentRange = cladeYRanges[prevEra]?.[cladeName];
                    const parentMidY = parentRange 
                        ? (parentRange.startY + parentRange.endY) / 2 
                        : MYA_HEADER_HEIGHT + PADDING;
                    
                    // Children's Y ranges at this era
                    const childYs = splittingChildren.map(c => {
                        const range = cladeYRanges[era]?.[c];
                        return range ? (range.startY + range.endY) / 2 : parentMidY;
                    });
                    
                    branchSplits.push({
                        era,
                        parentClade: cladeName,
                        childClades: splittingChildren,
                        parentY: parentMidY,
                        childYs,
                        color: cladeData.color
                    });
                }
            }
        }
        
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
            NUM_ERAS,
            CHANNEL_WIDTH,
            NODE_LEFT_MARGIN,
            INDENT_PER_LEVEL,
            CLADES,
            activeCladesByEra,
            cladeYRanges,
            branchSplits,
            sameEraPrereq,
            virtualToReal,
            traitLineages
        };
    }
    
    // Fixed width for all tech tree nodes (cleaner, no overlap)
    getTraitNodeWidth(trait, eraWidth, padding) {
        // All nodes same width - ignores era span for cleaner layout
        return 75;
    }
    
    // Compute orthogonal path that routes through clade HEADER area (above traits)
    // Arrows use header for horizontal routing, left channel for vertical
    computeOrthogonalPath(from, to, obstacles, usedChannels, layout) {
        const { NODE_WIDTH, NODE_HEIGHT, ERA_WIDTH, PADDING, NODE_LEFT_MARGIN, cladeYRanges } = layout;
        
        const startX = from.x + NODE_WIDTH;  // Exit from right side of source trait
        const startY = from.y + NODE_HEIGHT / 2;
        const endX = to.x;  // Enter left side of target trait
        const endY = to.y + NODE_HEIGHT / 2;
        
        const fromEra = from.era;
        const toEra = to.era;
        
        // Get the target clade's range for routing
        const targetClade = to.activeClade || to.clade;
        const targetRange = cladeYRanges?.[toEra]?.[targetClade];
        
        // Route through HEADER area (above traits) - use startY of the clade range
        const headerY = targetRange?.startY ? targetRange.startY + 8 : startY;
        
        // Also get passthrough Y (bottom of clade) for alternative routing
        const passthroughY = targetRange?.passthroughY || (startY + endY) / 2;
        
        // Track channel usage for parallel edge offset
        const channelKey = `${targetClade}-${toEra}`;
        if (!usedChannels[channelKey]) usedChannels[channelKey] = 0;
        const slotOffset = usedChannels[channelKey] * 2;
        usedChannels[channelKey]++;
        
        // Route Y is in the header area (top of clade) with slot offset
        const routeY = headerY + slotOffset;
        
        // Entry channel is in the LEFT margin of target era (before trait boxes)
        const entryChannelX = PADDING + toEra * ERA_WIDTH + NODE_LEFT_MARGIN / 2 - slotOffset;
        
        // Same-era connections: route through passthrough at bottom (within same clade)
        if (fromEra === toEra) {
            // Go right past the era, down to passthrough, back left through channel
            const jogX = PADDING + (fromEra + 1) * ERA_WIDTH - 5;
            return `M ${startX} ${startY} L ${jogX} ${startY} L ${jogX} ${passthroughY} L ${entryChannelX} ${passthroughY} L ${entryChannelX} ${endY} L ${endX} ${endY}`;
        }
        
        // Adjacent eras: exit right, go to header Y, then down to target
        if (toEra === fromEra + 1) {
            // Route through header for cleaner cross-era connections
            return `M ${startX} ${startY} L ${entryChannelX} ${startY} L ${entryChannelX} ${routeY} L ${entryChannelX} ${endY} L ${endX} ${endY}`;
        }
        
        // Multi-era span: route through passthrough horizontally, then up through target's left channel
        // Exit via right side of source era
        const exitX = PADDING + (fromEra + 1) * ERA_WIDTH - 5;
        
        // Path: exit source → down to passthrough → horizontal to entry channel → vertical to target
        return `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${routeY} L ${entryChannelX} ${routeY} L ${entryChannelX} ${endY} L ${endX} ${endY}`;
    }
    
    // Render the full tech tree with MYA timeline header
    renderTechTree(player, currentEra, traitDb, discardedEvents = [], eventDeck = []) {
        const svg = $('#tech-tree-svg');
        if (!svg) return;
        
        svg.innerHTML = '';
        
        // Get container width for responsive layout
        const container = $('#tech-tree-scroll');
        const containerWidth = container ? container.clientWidth : 1200;
        
        // Compute layout (pass player for acquisition-based positioning)
        const layout = this.computeTechTreeLayout(traitDb, containerWidth, player);
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
            
            // Check for conflicts with owned traits first
            const hasConflict = (trait.incompatible_with || []).some(i => ownedIds.has(i));
            if (hasConflict) return 'conflicted';
            
            const inHand = handIds.has(trait.id);
            const prereqsMet = (trait.hard_prereqs || []).every(p => ownedIds.has(p));
            const eraValid = currentEra >= trait.era_min && currentEra <= trait.era_max;
            
            if (inHand && prereqsMet && eraValid) return 'available';
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
        
        // Highlighted arrow marker for path highlighting
        const markerHighlight = createSVGElement('marker');
        markerHighlight.setAttribute('id', 'tech-arrow-highlight');
        markerHighlight.setAttribute('markerWidth', '6');
        markerHighlight.setAttribute('markerHeight', '6');
        markerHighlight.setAttribute('refX', '5');
        markerHighlight.setAttribute('refY', '3');
        markerHighlight.setAttribute('orient', 'auto');
        const arrowPathHighlight = createSVGElement('polygon');
        arrowPathHighlight.setAttribute('points', '0 0, 6 3, 0 6');
        arrowPathHighlight.setAttribute('fill', '#fbbf24');
        markerHighlight.appendChild(arrowPathHighlight);
        defs.appendChild(markerHighlight);
        
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
            
            // Event marker for past eras (discardedEvents[era] = event that occurred in that era)
            const eraEvent = discardedEvents[era];
            if (eraEvent) {
                const eventGroup = createSVGElement('g');
                eventGroup.classList.add('tech-tree-event-marker');
                eventGroup.style.cursor = 'pointer';
                
                // Event type determines color
                const eventType = eraEvent.type || 'neutral';
                eventGroup.classList.add(`tech-tree-event-${eventType}`);
                
                // Small icon/badge
                const iconSize = 10;
                const iconX = eraX + ERA_WIDTH / 2 - iconSize / 2;
                const iconY = 28;
                
                const iconRect = createSVGElement('rect');
                iconRect.setAttribute('x', iconX);
                iconRect.setAttribute('y', iconY);
                iconRect.setAttribute('width', iconSize);
                iconRect.setAttribute('height', iconSize);
                iconRect.setAttribute('rx', '2');
                eventGroup.appendChild(iconRect);
                
                // Icon symbol (skull for extinction, star for positive, circle for neutral)
                const iconText = createSVGElement('text');
                iconText.setAttribute('x', iconX + iconSize / 2);
                iconText.setAttribute('y', iconY + iconSize - 2);
                iconText.setAttribute('text-anchor', 'middle');
                iconText.setAttribute('font-size', '7');
                iconText.classList.add('event-icon-symbol');
                if (eventType === 'extinction') {
                    iconText.textContent = '☠';
                } else if (eventType === 'positive') {
                    iconText.textContent = '★';
                } else {
                    iconText.textContent = '◆';
                }
                eventGroup.appendChild(iconText);
                
                // Tooltip with event name
                const tooltip = createSVGElement('title');
                tooltip.textContent = `${eraEvent.name} (click to view)`;
                eventGroup.appendChild(tooltip);
                
                // Click handler to show event card
                eventGroup.addEventListener('click', () => {
                    if (this.callbacks.onEventMarkerClick) {
                        this.callbacks.onEventMarkerClick(eraEvent, era);
                    }
                });
                
                headerLayer.appendChild(eventGroup);
            }
            
            // Event card back for upcoming eras (shows extinction vs other type)
            if (era >= currentEra && !discardedEvents[era]) {
                const deckIndex = era - currentEra;
                const upcomingEvent = eventDeck[deckIndex];
                if (upcomingEvent) {
                    const eventGroup = createSVGElement('g');
                    eventGroup.classList.add('tech-tree-event-upcoming');
                    
                    const isExtinction = upcomingEvent.type === 'extinction';
                    eventGroup.classList.add(isExtinction ? 'tech-tree-event-upcoming-extinction' : 'tech-tree-event-upcoming-other');
                    
                    if (isCurrentEra) {
                        eventGroup.classList.add('tech-tree-event-upcoming-current');
                    }
                    
                    // Card back indicator
                    const iconSize = 10;
                    const iconX = eraX + ERA_WIDTH / 2 - iconSize / 2;
                    const iconY = 28;
                    
                    const iconRect = createSVGElement('rect');
                    iconRect.setAttribute('x', iconX);
                    iconRect.setAttribute('y', iconY);
                    iconRect.setAttribute('width', iconSize);
                    iconRect.setAttribute('height', iconSize);
                    iconRect.setAttribute('rx', '2');
                    eventGroup.appendChild(iconRect);
                    
                    // Symbol (skull outline for extinction, ? for other)
                    const iconText = createSVGElement('text');
                    iconText.setAttribute('x', iconX + iconSize / 2);
                    iconText.setAttribute('y', iconY + iconSize - 2);
                    iconText.setAttribute('text-anchor', 'middle');
                    iconText.setAttribute('font-size', '7');
                    iconText.classList.add('event-upcoming-symbol');
                    iconText.textContent = isExtinction ? '☠' : '?';
                    eventGroup.appendChild(iconText);
                    
                    // Tooltip
                    const tooltip = createSVGElement('title');
                    tooltip.textContent = isExtinction ? 'Extinction Event Incoming' : 'Event Incoming (Positive/Neutral)';
                    eventGroup.appendChild(tooltip);
                    
                    headerLayer.appendChild(eventGroup);
                }
            }
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
        
        // Draw phylogenetic branch lines (clade splits)
        const branchLayer = createSVGElement('g');
        branchLayer.classList.add('phylo-branch-layer');
        
        const { branchSplits, cladeYRanges, activeCladesByEra, CLADES } = layout;
        
        // Draw lane backgrounds for each active clade at each era
        // Also add clade labels at era 0
        for (let era = 0; era < NUM_ERAS; era++) {
            const eraX = PADDING + era * ERA_WIDTH;
            const activeClades = activeCladesByEra[era] || [];
            
            for (const cladeName of activeClades) {
                const range = cladeYRanges[era]?.[cladeName];
                if (!range) continue;
                
                const cladeColor = CLADES[cladeName]?.color || '#8b949e';
                
                // Draw a subtle lane background
                const laneBg = createSVGElement('rect');
                laneBg.setAttribute('x', eraX);
                laneBg.setAttribute('y', range.startY - 2);
                laneBg.setAttribute('width', ERA_WIDTH);
                laneBg.setAttribute('height', range.height + 4);
                laneBg.setAttribute('fill', cladeColor);
                laneBg.setAttribute('opacity', '0.05');
                branchLayer.appendChild(laneBg);
                
                // Left edge lane indicator (vertical line)
                const laneEdge = createSVGElement('line');
                laneEdge.setAttribute('x1', eraX + 2);
                laneEdge.setAttribute('y1', range.startY - 2);
                laneEdge.setAttribute('x2', eraX + 2);
                laneEdge.setAttribute('y2', range.startY + range.height + 2);
                laneEdge.setAttribute('stroke', cladeColor);
                laneEdge.setAttribute('stroke-width', '2');
                laneEdge.setAttribute('opacity', '0.4');
                branchLayer.appendChild(laneEdge);
                
                // Clade label in the header area (show at split era, abbreviated elsewhere)
                const cladeSplitEra = CLADES[cladeName]?.era_split || 0;
                const cladeLabel = createSVGElement('text');
                cladeLabel.setAttribute('x', eraX + 6);
                cladeLabel.setAttribute('y', range.startY + 12);  // In header area
                cladeLabel.setAttribute('font-size', era === cladeSplitEra ? '10' : '8');
                cladeLabel.setAttribute('font-weight', era === cladeSplitEra ? 'bold' : 'normal');
                cladeLabel.setAttribute('fill', cladeColor);
                cladeLabel.setAttribute('opacity', era === cladeSplitEra ? '0.9' : '0.5');
                // Full name at split era, abbreviated otherwise
                cladeLabel.textContent = era === cladeSplitEra ? cladeName : cladeName.substring(0, 4);
                branchLayer.appendChild(cladeLabel);
                
                // Header separator line (below header, above traits)
                if (range.traitsStartY) {
                    const headerLine = createSVGElement('line');
                    headerLine.setAttribute('x1', eraX);
                    headerLine.setAttribute('y1', range.traitsStartY - 2);
                    headerLine.setAttribute('x2', eraX + ERA_WIDTH);
                    headerLine.setAttribute('y2', range.traitsStartY - 2);
                    headerLine.setAttribute('stroke', cladeColor);
                    headerLine.setAttribute('stroke-width', '1');
                    headerLine.setAttribute('opacity', '0.15');
                    branchLayer.appendChild(headerLine);
                }
                
                // Passthrough region indicator (subtle dashed line at traitsEndY)
                if (range.traitsEndY) {
                    const passthroughLine = createSVGElement('line');
                    passthroughLine.setAttribute('x1', eraX);
                    passthroughLine.setAttribute('y1', range.traitsEndY);
                    passthroughLine.setAttribute('x2', eraX + ERA_WIDTH);
                    passthroughLine.setAttribute('y2', range.traitsEndY);
                    passthroughLine.setAttribute('stroke', cladeColor);
                    passthroughLine.setAttribute('stroke-width', '1');
                    passthroughLine.setAttribute('stroke-dasharray', '2,2');
                    passthroughLine.setAttribute('opacity', '0.2');
                    branchLayer.appendChild(passthroughLine);
                }
            }
        }
        
        // Draw branch split lines where clades fork
        for (const split of branchSplits) {
            const { era, parentClade, childClades, parentY, childYs, color } = split;
            
            // X position: in the left routing channel of this era
            const splitX = PADDING + era * ERA_WIDTH + layout.NODE_LEFT_MARGIN / 2;
            
            // Vertical connector from parentY to the range of childYs
            const minChildY = Math.min(...childYs);
            const maxChildY = Math.max(...childYs);
            
            // Vertical trunk line
            const trunk = createSVGElement('line');
            trunk.setAttribute('x1', splitX);
            trunk.setAttribute('y1', minChildY);
            trunk.setAttribute('x2', splitX);
            trunk.setAttribute('y2', maxChildY);
            trunk.setAttribute('stroke', color);
            trunk.setAttribute('stroke-width', '2');
            trunk.setAttribute('opacity', '0.6');
            branchLayer.appendChild(trunk);
            
            // Horizontal branches to each child
            for (let i = 0; i < childClades.length; i++) {
                const childY = childYs[i];
                const childClade = childClades[i];
                const childColor = CLADES[childClade]?.color || color;
                
                const branch = createSVGElement('line');
                branch.setAttribute('x1', splitX);
                branch.setAttribute('y1', childY);
                branch.setAttribute('x2', splitX + 10);
                branch.setAttribute('y2', childY);
                branch.setAttribute('stroke', childColor);
                branch.setAttribute('stroke-width', '2');
                branch.setAttribute('opacity', '0.6');
                branchLayer.appendChild(branch);
                
                // Clade label at split point
                const label = createSVGElement('text');
                label.setAttribute('x', splitX + 12);
                label.setAttribute('y', childY + 3);
                label.setAttribute('font-size', '8');
                label.setAttribute('fill', childColor);
                label.setAttribute('opacity', '0.8');
                label.textContent = childClade.substring(0, 6);
                branchLayer.appendChild(label);
            }
        }
        
        svg.appendChild(branchLayer);
        
        // Build obstacles list from all positioned nodes
        const obstacles = Object.entries(positions).map(([id, pos]) => ({
            id,
            x: pos.x,
            y: pos.y,
            era: pos.era
        }));
        
        // Track used routing channels for parallel edge offset
        const usedChannels = {};
        
        // Helper: check if fromClade is an ancestor of toClade (or same clade)
        const isCladeAncestor = (fromClade, toClade) => {
            let current = toClade;
            while (current) {
                if (current === fromClade) return true;
                current = CLADES[current]?.parent;
            }
            return false;
        };
        
        // Draw edges (prerequisite arrows) with obstacle-aware routing
        // For virtual traits, connect to prereqs with matching clade
        const edgeLayer = createSVGElement('g');
        edgeLayer.classList.add('tech-tree-edges');
        
        const { virtualToReal } = layout;
        
        // Iterate over all positions (including virtual traits)
        for (const [posKey, toPos] of Object.entries(positions)) {
            const realTraitId = toPos.realId || posKey;
            const trait = traitDb[realTraitId];
            if (!trait) continue;
            
            for (const prereqId of (trait.hard_prereqs || [])) {
                // Find a prereq position - prefer one in same or ancestor clade
                let fromPos = positions[prereqId];
                
                // If no direct match, look for a virtual prereq in a compatible clade
                if (!fromPos) {
                    const compatiblePrereqs = Object.entries(positions).filter(([k, p]) => 
                        p.realId === prereqId && isCladeAncestor(p.activeClade, toPos.activeClade)
                    );
                    if (compatiblePrereqs.length > 0) {
                        fromPos = compatiblePrereqs[0][1];
                    }
                }
                
                if (!fromPos) continue;
                
                // Only draw arrow if clades are in same lineage
                const fromActiveClade = fromPos.activeClade || fromPos.clade;
                const toActiveClade = toPos.activeClade || toPos.clade;
                if (!isCladeAncestor(fromActiveClade, toActiveClade) && 
                    !isCladeAncestor(toActiveClade, fromActiveClade)) {
                    continue;
                }
                
                let d;
                const isSameEra = fromPos.era === toPos.era;
                const fromRealId = fromPos.realId || prereqId;
                
                if (isSameEra && toPos.sameEraParent === fromRealId) {
                    // Same-era parent-child: draw an L-shaped connector (down then right)
                    const startX = fromPos.x + 8;
                    const startY = fromPos.y + NODE_HEIGHT;
                    const endX = toPos.x;
                    const endY = toPos.y + NODE_HEIGHT / 2;
                    const turnY = endY;
                    d = `M ${startX} ${startY} L ${startX} ${turnY} L ${endX} ${endY}`;
                } else {
                    // Cross-era or non-direct: use normal routing
                    d = this.computeOrthogonalPath(
                        { ...fromPos, id: prereqId },
                        { ...toPos, id: trait.id },
                        obstacles,
                        usedChannels,
                        layout
                    );
                }
                
                const path = createSVGElement('path');
                path.setAttribute('d', d);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', toPos.cladeColor || '#484f58');
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
        
        // Iterate over positions (includes virtual traits)
        for (const [posKey, pos] of Object.entries(positions)) {
            const realTraitId = pos.realId || posKey;
            const trait = traitDb[realTraitId];
            if (!trait) continue;
            
            const state = getTraitState(trait);
            const nodeWidth = this.getTraitNodeWidth(trait, ERA_WIDTH, PADDING);
            
            const group = createSVGElement('g');
            group.classList.add('tech-node', `tech-node-${state}`);
            if (pos.isVirtual) group.classList.add('tech-node-virtual');
            group.dataset.traitId = realTraitId;
            group.dataset.posKey = posKey;
            group.dataset.clade = pos.clade;
            
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
            
            // Clade color indicator
            if (pos.cladeColor) {
                const cladeIndicator = createSVGElement('rect');
                cladeIndicator.setAttribute('x', pos.x);
                cladeIndicator.setAttribute('y', pos.y);
                cladeIndicator.setAttribute('width', '3');
                cladeIndicator.setAttribute('height', NODE_HEIGHT);
                cladeIndicator.setAttribute('fill', pos.cladeColor);
                cladeIndicator.setAttribute('rx', '1');
                group.insertBefore(cladeIndicator, group.firstChild);
            }
            
            // Tooltip
            const title = createSVGElement('title');
            let tooltipText = `${trait.name}\nCost: ${trait.cost} | Era ${trait.era_min}-${trait.era_max}\n${trait.grants}`;
            if (state === 'owned' && acquisitionEras[trait.id] !== undefined) {
                tooltipText += `\nAcquired: Era ${acquisitionEras[trait.id]} (${ERA_NAMES[acquisitionEras[trait.id]]})`;
            }
            tooltipText += `\nClade: ${pos.clade}`;
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
    
    // Build the complete prerequisite chain for a trait (all ancestors)
    getPrerequisitePath(traitId, traitDb) {
        const path = new Set();
        const queue = [traitId];
        
        while (queue.length > 0) {
            const current = queue.shift();
            const trait = traitDb[current];
            if (!trait) continue;
            
            for (const prereq of (trait.hard_prereqs || [])) {
                if (!path.has(prereq)) {
                    path.add(prereq);
                    queue.push(prereq);
                }
            }
        }
        return path;
    }
    
    // Highlight a trait and its prerequisite path in the tech tree
    highlightTechPath(traitId, traitDb) {
        this.clearTechPathHighlight();
        
        const prereqs = this.getPrerequisitePath(traitId, traitDb);
        prereqs.add(traitId);
        
        // Highlight nodes on the path
        for (const id of prereqs) {
            const node = document.querySelector(`[data-trait-id="${id}"]`);
            if (node) node.classList.add('tech-path-highlight');
        }
        
        // Highlight edges that connect traits on the path
        document.querySelectorAll('.tech-edge').forEach(edge => {
            const from = edge.dataset.from;
            const to = edge.dataset.to;
            if (prereqs.has(from) && prereqs.has(to)) {
                edge.classList.add('tech-path-highlight');
                edge.setAttribute('marker-end', 'url(#tech-arrow-highlight)');
            }
        });
        
        this.highlightedTraitId = traitId;
    }
    
    // Clear all tech tree path highlighting
    clearTechPathHighlight() {
        document.querySelectorAll('.tech-path-highlight').forEach(el => {
            el.classList.remove('tech-path-highlight');
            if (el.classList.contains('tech-edge')) {
                el.setAttribute('marker-end', 'url(#tech-arrow)');
            }
        });
        this.highlightedTraitId = null;
    }
}

