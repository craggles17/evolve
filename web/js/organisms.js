// Organism Matcher - Find closest real organism to player's traits
// Ported from tools/organism_matcher.py

/**
 * Calculate Jaccard similarity between two sets
 * @param {Set} set1 
 * @param {Set} set2 
 * @returns {number} Similarity score 0-1
 */
function jaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0) return 0;
    
    let intersection = 0;
    for (const item of set1) {
        if (set2.has(item)) intersection++;
    }
    
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
}

/**
 * Find the closest organisms to a player's current trait set
 * @param {string[]} playerTraits - Array of trait IDs the player has
 * @param {number} currentEra - Current game era (filters organisms that existed)
 * @param {Object[]} organisms - Array of organism objects from organisms.json
 * @param {number} topN - Number of top matches to return
 * @returns {Object[]} Array of organism matches with similarity scores
 */
export function findClosestOrganisms(playerTraits, currentEra, organisms, topN = 3) {
    const playerSet = new Set(playerTraits);
    const matches = [];
    
    for (const organism of organisms) {
        const [eraMin, eraMax] = organism.era_range;
        
        // Only match organisms that exist in the current era
        if (currentEra < eraMin || currentEra > eraMax) continue;
        
        const organismSet = new Set(organism.traits);
        const similarity = jaccardSimilarity(playerSet, organismSet);
        
        // Calculate shared/missing/extra traits for display
        const sharedTraits = [...playerSet].filter(t => organismSet.has(t));
        const missingTraits = [...organismSet].filter(t => !playerSet.has(t));
        const extraTraits = [...playerSet].filter(t => !organismSet.has(t));
        
        matches.push({
            organism,
            similarity,
            sharedTraits,
            missingTraits,
            extraTraits
        });
    }
    
    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);
    
    return matches.slice(0, topN);
}

/**
 * Get the single best organism match for a player
 * @param {string[]} playerTraits 
 * @param {number} currentEra 
 * @param {Object[]} organisms 
 * @returns {Object|null} Best match or null if no matches
 */
export function findBestOrganism(playerTraits, currentEra, organisms) {
    const matches = findClosestOrganisms(playerTraits, currentEra, organisms, 1);
    return matches.length > 0 ? matches[0] : null;
}

/**
 * Format similarity as percentage string
 * @param {number} similarity 
 * @returns {string}
 */
export function formatSimilarity(similarity) {
    return `${Math.round(similarity * 100)}%`;
}

