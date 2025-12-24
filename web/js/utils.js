// Utility functions for Damn Nature You Scary

export const ERA_NAMES = [
    'Cambrian', 'Ordovician', 'Silurian', 'Devonian',
    'Carboniferous', 'Permian', 'Triassic', 'Jurassic',
    'Cretaceous', 'Paleogene', 'Neogene', 'Quaternary'
];

export const ERA_COLORS = [
    '#4a6741', '#5d7a5d', '#7a9a7a', '#8b6914',
    '#2d4a3e', '#8b4513', '#6b4423', '#2e5a4c',
    '#4a7c59', '#7a6b5a', '#8a7a6a', '#5a6a7a'
];

export const PLAYER_COLORS = ['#58a6ff', '#f0883e', '#a371f7', '#3fb950'];

export function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

export function roll2D6() {
    return [rollD6(), rollD6()];
}

export function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}

export function createElement(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content) el.textContent = content;
    return el;
}

export function createSVGElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

// Hex grid utilities
export const HEX_SIZE = 40;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;  // ~69.28 for pointy-top
export const HEX_HEIGHT = HEX_SIZE * 2;             // 80 for pointy-top
export const HEX_VERT_SPACING = HEX_SIZE * 1.5;     // 60 - vertical distance between row centers

// Convert offset coordinates (col, row) to pixel position
// Uses odd-r offset: odd rows are shifted right by half a hex width
export function offsetToPixel(col, row, offsetX = 0, offsetY = 0) {
    const x = col * HEX_WIDTH + (row % 2) * (HEX_WIDTH / 2);
    const y = row * HEX_VERT_SPACING;
    return { x: x + offsetX, y: y + offsetY };
}

// Legacy alias for compatibility
export function hexToPixel(q, r, offsetX = 0, offsetY = 0) {
    return offsetToPixel(q, r, offsetX, offsetY);
}

export function getHexCorners(cx, cy, size = HEX_SIZE) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        corners.push({
            x: cx + size * Math.cos(angle),
            y: cy + size * Math.sin(angle)
        });
    }
    return corners;
}

export function cornersToPoints(corners) {
    return corners.map(c => `${c.x},${c.y}`).join(' ');
}

export function getHexNeighbors(q, r) {
    return [
        { q: q + 1, r: r },
        { q: q + 1, r: r - 1 },
        { q: q, r: r - 1 },
        { q: q - 1, r: r },
        { q: q - 1, r: r + 1 },
        { q: q, r: r + 1 }
    ];
}

// Calculate Jaccard similarity for organism matching
export function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

// Format number with sign
export function formatBonus(n) {
    return n >= 0 ? `+${n}` : `${n}`;
}

// Save/load game state to localStorage
export function saveGame(state) {
    localStorage.setItem('dnys_save', JSON.stringify(state));
}

export function loadGame() {
    const saved = localStorage.getItem('dnys_save');
    return saved ? JSON.parse(saved) : null;
}

export function clearSave() {
    localStorage.removeItem('dnys_save');
}

