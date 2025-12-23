#!/usr/bin/env python3
"""
Organism Matcher - Find the closest real organism to a player's traits.

Uses Jaccard similarity to compare trait vectors between the player's
current traits and known organisms in the database.
"""

import json
from pathlib import Path
from typing import Optional


def load_data() -> tuple[dict, dict]:
    """Load organisms and traits databases."""
    data_dir = Path(__file__).parent.parent / "data"
    
    with open(data_dir / "organisms.json") as f:
        organisms_data = json.load(f)
    
    with open(data_dir / "traits.json") as f:
        traits_data = json.load(f)
    
    return organisms_data, traits_data


def jaccard_similarity(set1: set, set2: set) -> float:
    """Calculate Jaccard similarity between two sets."""
    if not set1 and not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0


def find_closest_organisms(
    player_traits: list[str],
    current_era: int = 11,
    top_n: int = 3
) -> list[dict]:
    """
    Find the closest organisms to the player's current trait set.
    
    Args:
        player_traits: List of trait IDs the player has
        current_era: Current game era (filters organisms that existed)
        top_n: Number of top matches to return
    
    Returns:
        List of organism matches with similarity scores
    """
    organisms_data, _ = load_data()
    player_set = set(player_traits)
    
    matches = []
    for organism in organisms_data["organisms"]:
        era_min, era_max = organism["era_range"]
        if not (era_min <= current_era <= era_max):
            continue
        
        organism_set = set(organism["traits"])
        similarity = jaccard_similarity(player_set, organism_set)
        
        shared_traits = player_set & organism_set
        missing_traits = organism_set - player_set
        extra_traits = player_set - organism_set
        
        matches.append({
            "organism": organism,
            "similarity": similarity,
            "shared_traits": list(shared_traits),
            "missing_for_exact": list(missing_traits),
            "extra_traits": list(extra_traits)
        })
    
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return matches[:top_n]


def display_match(match: dict, rank: int) -> None:
    """Pretty print an organism match."""
    org = match["organism"]
    sim = match["similarity"]
    
    print(f"\n{'='*50}")
    print(f"#{rank} MATCH: {org['name']} ({org['scientific_name']})")
    print(f"{'='*50}")
    print(f"Similarity: {sim:.1%}")
    print(f"Complexity: {org['complexity']}")
    print(f"Era Range: {org['era_range'][0]}-{org['era_range'][1]}")
    print(f"\nFun Fact: {org['fun_fact']}")
    
    print(f"\nShared Traits ({len(match['shared_traits'])}):")
    for trait in match['shared_traits']:
        print(f"  ✓ {trait}")
    
    if match['missing_for_exact']:
        print(f"\nMissing for exact match ({len(match['missing_for_exact'])}):")
        for trait in match['missing_for_exact'][:5]:
            print(f"  ✗ {trait}")
        if len(match['missing_for_exact']) > 5:
            print(f"  ... and {len(match['missing_for_exact']) - 5} more")
    
    if match['extra_traits']:
        print(f"\nExtra traits you have ({len(match['extra_traits'])}):")
        for trait in match['extra_traits'][:5]:
            print(f"  + {trait}")
        if len(match['extra_traits']) > 5:
            print(f"  ... and {len(match['extra_traits']) - 5} more")


def interactive_mode() -> None:
    """Run interactive organism matching session."""
    _, traits_data = load_data()
    all_traits = {t["id"]: t["name"] for t in traits_data["traits"]}
    
    print("\n" + "="*60)
    print("  ORGANISM MATCHER - Find Your Closest Living Relative!")
    print("="*60)
    
    print("\nAvailable traits:")
    for i, (tid, tname) in enumerate(sorted(all_traits.items())):
        print(f"  {tid:25} ({tname})")
    
    print("\nEnter your traits (comma-separated trait IDs):")
    print("Example: bilateral_symmetry, gills, jaws, bony_skeleton")
    
    user_input = input("\nYour traits: ").strip()
    if not user_input:
        print("No traits entered. Using example set...")
        user_input = "bilateral_symmetry, vertebral_column, jaws, bony_skeleton, tetrapod_limbs, lungs, fur, mammary_glands, endothermy"
    
    player_traits = [t.strip() for t in user_input.split(",")]
    
    era_input = input("\nCurrent era (0-11, default 11): ").strip()
    current_era = int(era_input) if era_input.isdigit() else 11
    
    print(f"\nSearching for matches with {len(player_traits)} traits in era {current_era}...")
    
    matches = find_closest_organisms(player_traits, current_era)
    
    if not matches:
        print("\nNo organisms found for this era and trait combination!")
        return
    
    print(f"\n{'*'*60}")
    print(f"  TOP {len(matches)} ORGANISM MATCHES")
    print(f"{'*'*60}")
    
    for i, match in enumerate(matches, 1):
        display_match(match, i)


def example_matches() -> None:
    """Show example matches for common game strategies."""
    print("\n" + "="*60)
    print("  EXAMPLE ORGANISM MATCHES")
    print("="*60)
    
    examples = [
        {
            "name": "Crocodile Strategy",
            "traits": ["bilateral_symmetry", "vertebral_column", "jaws", 
                      "bony_skeleton", "tetrapod_limbs", "lungs", "amniotic_egg",
                      "diapsid_skull", "archosaur_posture", "crocodilian_form",
                      "burrowing", "freshwater"]
        },
        {
            "name": "Bird Strategy", 
            "traits": ["bilateral_symmetry", "vertebral_column", "jaws",
                      "bony_skeleton", "tetrapod_limbs", "lungs", "amniotic_egg",
                      "diapsid_skull", "archosaur_posture", "hollow_bones",
                      "feathers", "flight", "endothermy"]
        },
        {
            "name": "Mammal Strategy",
            "traits": ["bilateral_symmetry", "vertebral_column", "jaws",
                      "bony_skeleton", "tetrapod_limbs", "lungs", "amniotic_egg",
                      "synapsid_skull", "fur", "mammary_glands", "live_birth",
                      "placenta", "endothermy", "large_brain"]
        },
        {
            "name": "Insect Strategy",
            "traits": ["bilateral_symmetry", "segmentation", "exoskeleton",
                      "compound_eyes", "six_legs", "insect_flight", 
                      "metamorphosis", "eusocial", "pollination"]
        }
    ]
    
    for example in examples:
        print(f"\n{'='*60}")
        print(f"Strategy: {example['name']}")
        print(f"Traits: {len(example['traits'])}")
        
        matches = find_closest_organisms(example['traits'])
        if matches:
            best = matches[0]
            print(f"\nClosest Match: {best['organism']['name']}")
            print(f"Similarity: {best['similarity']:.1%}")
            print(f"Fun Fact: {best['organism']['fun_fact']}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--examples":
        example_matches()
    else:
        interactive_mode()

