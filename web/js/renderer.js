// Renderer - DOM updates and SVG rendering

import { 
    $, $$, createElement, createSVGElement,
    hexToPixel, getHexCorners, cornersToPoints,
    ERA_NAMES, ERA_COLORS, PLAYER_COLORS, HEX_SIZE
} from './utils.js';
import { PHASE_NAMES, PHASE_HINTS } from './state.js';

export class Renderer {
    constructor() {
        this.hexBoard = $('#hex-board');
        this.callbacks = {
            onTileClick: null,
            onCardClick: null,
            onTraitSlotClick: null
        };
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
        const inputs = $$('.player-input');
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
        
        // Add climate band labels
        this.renderClimateBandLabels();
        
        for (const tile of state.boardTiles) {
            this.renderTile(tile, state);
        }
    }
    
    renderClimateBandLabels() {
        const bands = [
            { row: 0, label: 'POLAR', color: '#b0e0e6' },
            { row: 1.5, label: 'TEMPERATE', color: '#9acd32' },
            { row: 3.5, label: 'TROPICAL', color: '#228b22' },
            { row: 5, label: 'EQUATORIAL', color: '#3498db' },
            { row: 6.5, label: 'TROPICAL', color: '#228b22' },
            { row: 8.5, label: 'TEMPERATE', color: '#9acd32' },
            { row: 10, label: 'POLAR', color: '#b0e0e6' }
        ];
        
        for (const band of bands) {
            const y = 60 + band.row * (Math.sqrt(3) * HEX_SIZE);
            const label = createSVGElement('text');
            label.setAttribute('x', 10);
            label.setAttribute('y', y);
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', band.color);
            label.setAttribute('opacity', '0.6');
            label.textContent = band.label;
            this.hexBoard.appendChild(label);
        }
    }
    
    renderTile(tile, state) {
        // Use offset coordinates for rectangular grid
        const { x, y } = hexToPixel(tile.q, tile.r, 80, 60);
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
        
        // Flip number indicator
        const flipText = createSVGElement('text');
        flipText.setAttribute('x', x);
        flipText.setAttribute('y', y + 25);
        flipText.setAttribute('text-anchor', 'middle');
        flipText.setAttribute('font-size', '10');
        flipText.setAttribute('fill', '#888');
        flipText.textContent = `⚀${tile.flipNumber}`;
        group.appendChild(flipText);
        
        // Era lock indicator
        if (tile.eraLock > state.currentEra) {
            const lockText = createSVGElement('text');
            lockText.setAttribute('x', x + 20);
            lockText.setAttribute('y', y - 20);
            lockText.setAttribute('text-anchor', 'middle');
            lockText.setAttribute('font-size', '10');
            lockText.setAttribute('fill', '#ff6');
            lockText.textContent = `🔒${tile.eraLock}`;
            group.appendChild(lockText);
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
        
        // Click handler
        group.addEventListener('click', () => {
            if (this.callbacks.onTileClick) {
                this.callbacks.onTileClick(tile);
            }
        });
        
        this.hexBoard.appendChild(group);
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
    
    // Lineage Board
    renderLineageBoard(player, traitDb) {
        const board = $('#lineage-board');
        board.innerHTML = '';
        
        // Show 6 eras at a time (first half or second half)
        const startEra = 0;
        const endEra = 12;
        
        for (let era = startEra; era < endEra; era++) {
            const column = createElement('div', 'era-column');
            
            const header = createElement('div', 'era-column-header');
            header.textContent = ERA_NAMES[era].substring(0, 3);
            header.style.background = ERA_COLORS[era];
            column.appendChild(header);
            
            // 3 trait slots per era
            const traits = player.traitsByEra[era] || [];
            for (let slot = 0; slot < 3; slot++) {
                const slotEl = createElement('div', 'trait-slot');
                if (traits[slot]) {
                    slotEl.classList.add('filled');
                    slotEl.title = traitDb[traits[slot]]?.name || traits[slot];
                    slotEl.addEventListener('click', () => {
                        if (this.callbacks.onTraitSlotClick) {
                            this.callbacks.onTraitSlotClick(traits[slot]);
                        }
                    });
                }
                column.appendChild(slotEl);
            }
            
            board.appendChild(column);
        }
    }
    
    // Player Stats
    updatePlayerStats(player, traitDb) {
        $('#stat-alleles').textContent = player.alleles;
        $('#stat-markers').textContent = `${player.markersOnBoard}/${player.markers}`;
        $('#stat-complexity').textContent = player.getComplexity(traitDb);
        $('#stat-tiles').textContent = player.tilesControlled;
        
        // Update tags
        const tagsList = $('#tags-list');
        tagsList.innerHTML = '';
        const tags = player.getTags(traitDb);
        for (const tag of tags) {
            const tagEl = createElement('span', 'tag', tag);
            tagsList.appendChild(tagEl);
        }
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
    
    // Players Bar
    renderPlayersBar(players, currentPlayerIndex, traitDb) {
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
            stats.innerHTML = `
                <span>💎 ${player.alleles}</span>
                <span>🦎 ${player.markersOnBoard}</span>
                <span>🧬 ${player.getComplexity(traitDb)}</span>
                <span>🗺️ ${player.tilesControlled}</span>
            `;
            
            info.appendChild(name);
            info.appendChild(stats);
            summary.appendChild(color);
            summary.appendChild(info);
            container.appendChild(summary);
        }
    }
    
    // Action Buttons
    updateActionButtons(phase, playerActed) {
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
                } else {
                    endPhaseBtn.classList.remove('hidden');
                }
                break;
            case 'draw':
            case 'competition':
            case 'tile_flip':
                endPhaseBtn.classList.remove('hidden');
                break;
            case 'evolution':
            case 'populate':
                endTurnBtn.classList.remove('hidden');
                break;
            case 'event':
                endPhaseBtn.classList.remove('hidden');
                break;
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
            row.innerHTML = `
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: ${r.player.color}"></span>
                    ${r.player.name}
                </span>
                <span>${r.message}${r.lostMarkers > 0 ? ` (-${r.lostMarkers} markers)` : ''}</span>
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
}

