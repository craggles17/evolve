// Card utilities and display helpers

import { ERA_NAMES, ERA_COLORS } from './utils.js';

// Generate SVG for a trait card (for print or display)
export function generateTraitCardSVG(trait, traitDb) {
    const width = 180;
    const height = 252;
    const eraColor = ERA_COLORS[trait.era_min] || '#666';
    
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#21262d"/>
                    <stop offset="100%" style="stop-color:#161b22"/>
                </linearGradient>
            </defs>
            
            <!-- Card background -->
            <rect width="${width}" height="${height}" rx="8" fill="url(#cardBg)" stroke="${eraColor}" stroke-width="2"/>
            
            <!-- Era banner -->
            <rect x="0" y="0" width="${width}" height="24" rx="8" fill="${eraColor}"/>
            <rect x="0" y="16" width="${width}" height="8" fill="${eraColor}"/>
            <text x="${width/2}" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold">
                Era ${trait.era_min}${trait.era_max !== trait.era_min ? `-${trait.era_max}` : ''}
            </text>
            
            <!-- Card name -->
            <text x="${width/2}" y="45" text-anchor="middle" fill="#d4a574" font-size="13" font-weight="bold">
                ${trait.name}
            </text>
            
            <!-- Cost -->
            <circle cx="25" cy="65" r="15" fill="#e5a84b"/>
            <text x="25" y="70" text-anchor="middle" fill="#0d1117" font-size="14" font-weight="bold">
                ${trait.cost}
            </text>
            
            <!-- Complexity -->
            <text x="${width - 25}" y="70" text-anchor="middle" fill="#58a6ff" font-size="12">
                ★${trait.complexity}
            </text>
            
            <!-- Tags -->
            <text x="${width/2}" y="85" text-anchor="middle" fill="#8b949e" font-size="9">
                ${trait.tags.slice(0, 3).join(' • ')}
            </text>
            
            <!-- Prerequisites -->
            ${trait.hard_prereqs.length > 0 ? `
            <text x="10" y="105" fill="#f85149" font-size="9">
                ━ ${trait.hard_prereqs.map(p => traitDb[p]?.name || p).join(', ')}
            </text>
            ` : ''}
            
            ${trait.soft_prereqs.length > 0 ? `
            <text x="10" y="120" fill="#3fb950" font-size="9">
                ┅ ${trait.soft_prereqs.map(p => traitDb[p]?.name || p).join(', ')}
            </text>
            ` : ''}
            
            <!-- Grants text (wrapped) -->
            <foreignObject x="10" y="130" width="${width - 20}" height="80">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 8px; color: #e6edf3; line-height: 1.3;">
                    ${trait.grants}
                </div>
            </foreignObject>
            
            <!-- Science note -->
            <foreignObject x="10" y="210" width="${width - 20}" height="35">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 7px; color: #8b949e; font-style: italic; line-height: 1.2;">
                    ${trait.science}
                </div>
            </foreignObject>
        </svg>
    `;
}

// Generate SVG for an event card
export function generateEventCardSVG(event) {
    const width = 180;
    const height = 252;
    const isExtinction = event.type === 'extinction';
    const bgColor = isExtinction ? '#5a0000' : '#1a3a17';
    const borderColor = isExtinction ? '#f85149' : '#3fb950';
    
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="eventBg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${bgColor}"/>
                    <stop offset="100%" style="stop-color:#0d1117"/>
                </linearGradient>
            </defs>
            
            <!-- Card background -->
            <rect width="${width}" height="${height}" rx="8" fill="url(#eventBg)" stroke="${borderColor}" stroke-width="2"/>
            
            <!-- Type banner -->
            <text x="${width/2}" y="20" text-anchor="middle" fill="${borderColor}" font-size="10" font-weight="bold">
                ${event.type.toUpperCase()}
            </text>
            
            <!-- Event name -->
            <text x="${width/2}" y="45" text-anchor="middle" fill="#d4a574" font-size="14" font-weight="bold">
                ${event.name}
            </text>
            
            ${isExtinction ? `
            <!-- Skull icon -->
            <text x="${width/2}" y="70" text-anchor="middle" font-size="24">☠</text>
            ` : `
            <text x="${width/2}" y="70" text-anchor="middle" font-size="24">🌿</text>
            `}
            
            <!-- Description -->
            <foreignObject x="10" y="80" width="${width - 20}" height="50">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 9px; color: #e6edf3; line-height: 1.3; text-align: center;">
                    ${event.description}
                </div>
            </foreignObject>
            
            ${isExtinction ? `
            <!-- SAFE tags -->
            <text x="10" y="145" fill="#3fb950" font-size="8" font-weight="bold">SAFE:</text>
            <text x="10" y="157" fill="#8b949e" font-size="7">
                ${(event.safe_tags || []).slice(0, 4).join(', ')}
            </text>
            
            <!-- DOOMED tags -->
            <text x="10" y="175" fill="#f85149" font-size="8" font-weight="bold">DOOMED:</text>
            <text x="10" y="187" fill="#8b949e" font-size="7">
                ${(event.doomed_tags || []).slice(0, 4).join(', ')}
            </text>
            ` : `
            <!-- Effect -->
            <foreignObject x="10" y="140" width="${width - 20}" height="50">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 10px; color: #3fb950; text-align: center;">
                    ${event.effect}
                </div>
            </foreignObject>
            `}
            
            <!-- Real examples -->
            <foreignObject x="10" y="200" width="${width - 20}" height="45">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 7px; color: #8b949e; font-style: italic; line-height: 1.2;">
                    ${(event.real_examples || []).slice(0, 2).join(' | ')}
                </div>
            </foreignObject>
        </svg>
    `;
}

// Create a compact card representation for hand display
export function createHandCard(trait, canPlay, cost, reason) {
    return {
        id: trait.id,
        name: trait.name,
        cost,
        eraMin: trait.era_min,
        eraMax: trait.era_max,
        tags: trait.tags,
        canPlay,
        reason
    };
}

// Get prerequisite status
export function getPrereqStatus(trait, playerTraits, traitDb) {
    const hardMet = trait.hard_prereqs.every(p => playerTraits.includes(p));
    const softMet = trait.soft_prereqs.filter(p => playerTraits.includes(p));
    const discount = Math.min(softMet.length, 3);
    
    return {
        hardMet,
        softMet,
        discount,
        hardPrereqs: trait.hard_prereqs.map(p => ({
            id: p,
            name: traitDb[p]?.name || p,
            met: playerTraits.includes(p)
        })),
        softPrereqs: trait.soft_prereqs.map(p => ({
            id: p,
            name: traitDb[p]?.name || p,
            met: playerTraits.includes(p)
        }))
    };
}

