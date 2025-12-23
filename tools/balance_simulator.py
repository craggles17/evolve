#!/usr/bin/env python3
"""
Balance Simulator - Test game balance through Monte Carlo simulation.

Simulates games with different strategies and player counts to identify:
- Overpowered/underpowered traits
- Extinction survival rates
- Allele economy balance
- Optimal strategies
"""

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from collections import defaultdict


@dataclass
class Trait:
    id: str
    name: str
    era_min: int
    era_max: int
    cost: int
    complexity: int
    tags: list[str]
    hard_prereqs: list[str]
    soft_prereqs: list[str]
    fecundity_bonus: int


@dataclass 
class Event:
    name: str
    event_type: str
    safe_tags: list[str]
    doomed_tags: list[str]
    neutral_roll: Optional[int]


@dataclass
class Player:
    name: str
    traits: list[str] = field(default_factory=list)
    markers: int = 3
    alleles: int = 0
    tiles_controlled: int = 0
    extinctions_survived: int = 0
    strategy: str = "generalist"
    
    def get_tags(self, trait_db: dict[str, Trait]) -> set[str]:
        tags = set()
        for tid in self.traits:
            if tid in trait_db:
                tags.update(trait_db[tid].tags)
        return tags
    
    def get_complexity(self, trait_db: dict[str, Trait]) -> int:
        return sum(trait_db[tid].complexity for tid in self.traits if tid in trait_db)
    
    def get_fecundity_bonus(self, trait_db: dict[str, Trait]) -> int:
        return sum(trait_db[tid].fecundity_bonus for tid in self.traits if tid in trait_db)
    
    def can_acquire(self, trait: Trait, current_era: int) -> bool:
        if current_era < trait.era_min or current_era > trait.era_max:
            return False
        for prereq in trait.hard_prereqs:
            if prereq not in self.traits:
                return False
        return True
    
    def get_cost(self, trait: Trait) -> int:
        soft_count = sum(1 for p in trait.soft_prereqs if p in self.traits)
        discount = min(soft_count, 3)
        return max(0, trait.cost - discount)
    
    def score(self, trait_db: dict[str, Trait]) -> int:
        complexity = self.get_complexity(trait_db)
        tile_bonus = self.tiles_controlled * 3
        return self.markers * complexity + tile_bonus


def load_game_data() -> tuple[dict[str, Trait], list[Event]]:
    """Load traits and events from JSON files."""
    data_dir = Path(__file__).parent.parent / "data"
    
    with open(data_dir / "traits.json") as f:
        traits_data = json.load(f)
    
    with open(data_dir / "events.json") as f:
        events_data = json.load(f)
    
    traits = {}
    for t in traits_data["traits"]:
        traits[t["id"]] = Trait(
            id=t["id"],
            name=t["name"],
            era_min=t["era_min"],
            era_max=t["era_max"],
            cost=t["cost"],
            complexity=t["complexity"],
            tags=t["tags"],
            hard_prereqs=t["hard_prereqs"],
            soft_prereqs=t["soft_prereqs"],
            fecundity_bonus=t["fecundity_bonus"]
        )
    
    events = []
    for e in events_data["events"]:
        events.append(Event(
            name=e["name"],
            event_type=e["type"],
            safe_tags=e.get("safe_tags", []),
            doomed_tags=e.get("doomed_tags", []),
            neutral_roll=e.get("neutral_roll")
        ))
    
    return traits, events


def simulate_allele_roll(player: Player, trait_db: dict[str, Trait]) -> int:
    """Simulate allele income for one era."""
    base = random.randint(1, 6) + random.randint(1, 6)
    
    if player.markers >= 7:
        pop_bonus = 2
    elif player.markers >= 4:
        pop_bonus = 1
    else:
        pop_bonus = 0
    
    tile_bonus = player.tiles_controlled
    fecundity = player.get_fecundity_bonus(trait_db)
    
    return base + pop_bonus + tile_bonus + fecundity


def simulate_extinction(player: Player, event: Event, trait_db: dict[str, Trait]) -> bool:
    """
    Simulate extinction event. Returns True if player survives with full pop.
    Modifies player.markers if they take losses.
    """
    if event.event_type != "extinction":
        return True
    
    tags = player.get_tags(trait_db)
    
    has_safe = bool(tags & set(event.safe_tags))
    if has_safe:
        player.extinctions_survived += 1
        return True
    
    has_doomed = bool(tags & set(event.doomed_tags))
    if has_doomed:
        losses = (player.markers + 1) // 2
        player.markers = max(1, player.markers - losses)
        player.extinctions_survived += 1
        return False
    
    roll = random.randint(1, 6)
    threshold = event.neutral_roll or 4
    
    if roll >= threshold:
        player.extinctions_survived += 1
        return True
    else:
        losses = (player.markers + 1) // 2
        player.markers = max(1, player.markers - losses)
        player.extinctions_survived += 1
        return False


def get_available_traits(player: Player, era: int, trait_db: dict[str, Trait]) -> list[Trait]:
    """Get traits the player can acquire this era."""
    available = []
    for trait in trait_db.values():
        if trait.id in player.traits:
            continue
        if player.can_acquire(trait, era):
            available.append(trait)
    return available


def generalist_strategy(player: Player, available: list[Trait], alleles: int, trait_db: dict[str, Trait]) -> list[str]:
    """
    Generalist strategy: prioritize survival tags, then cheap traits.
    """
    survival_tags = {"Burrowing", "Small", "Freshwater", "Deep-Sea", "Cold-Resistant"}
    
    sorted_traits = sorted(available, key=lambda t: (
        -len(set(t.tags) & survival_tags),
        player.get_cost(t)
    ))
    
    acquired = []
    remaining = alleles
    
    for trait in sorted_traits:
        cost = player.get_cost(trait)
        if cost <= remaining:
            acquired.append(trait.id)
            remaining -= cost
    
    return acquired


def specialist_strategy(player: Player, available: list[Trait], alleles: int, trait_db: dict[str, Trait], target_clade: str = "Mammalia") -> list[str]:
    """
    Specialist strategy: focus on building toward a specific clade.
    """
    clade_paths = {
        "Mammalia": ["synapsid_skull", "endothermy", "fur", "mammary_glands", "live_birth", "placenta"],
        "Aves": ["diapsid_skull", "archosaur_posture", "hollow_bones", "feathers", "flight"],
        "Crocodilia": ["diapsid_skull", "archosaur_posture", "osteoderms", "crocodilian_form", "scales_reptilian", "burrowing"],
        "Insecta": ["segmentation", "exoskeleton", "six_legs", "insect_flight", "metamorphosis"]
    }
    
    target_traits = clade_paths.get(target_clade, [])
    
    def priority(t: Trait) -> tuple:
        in_path = t.id in target_traits
        path_index = target_traits.index(t.id) if in_path else 999
        return (-int(in_path), path_index, player.get_cost(t))
    
    sorted_traits = sorted(available, key=priority)
    
    acquired = []
    remaining = alleles
    
    for trait in sorted_traits:
        cost = player.get_cost(trait)
        if cost <= remaining:
            acquired.append(trait.id)
            remaining -= cost
    
    return acquired


def simulate_game(num_players: int = 4, verbose: bool = False) -> dict:
    """Simulate a complete game."""
    trait_db, all_events = load_game_data()
    
    shuffled_events = all_events.copy()
    random.shuffle(shuffled_events)
    events = shuffled_events[:12]
    
    strategies = ["generalist", "Mammalia", "Aves", "Crocodilia"]
    players = []
    for i in range(num_players):
        strat = strategies[i % len(strategies)]
        players.append(Player(
            name=f"Player {i+1}",
            strategy=strat,
            traits=["bilateral_symmetry"],
            markers=3,
            alleles=random.randint(2, 12)
        ))
    
    for era in range(12):
        if verbose:
            print(f"\n{'='*50}")
            print(f"ERA {era}")
            print(f"{'='*50}")
        
        for player in players:
            income = simulate_allele_roll(player, trait_db)
            player.alleles += income
        
        for player in players:
            available = get_available_traits(player, era, trait_db)
            
            if player.strategy == "generalist":
                acquired = generalist_strategy(player, available, player.alleles, trait_db)
            else:
                acquired = specialist_strategy(player, available, player.alleles, trait_db, player.strategy)
            
            for tid in acquired:
                trait = trait_db[tid]
                cost = player.get_cost(trait)
                if cost <= player.alleles:
                    player.traits.append(tid)
                    player.alleles -= cost
        
        for player in players:
            player.markers = min(12, player.markers + 1)
            player.tiles_controlled = random.randint(1, 3)
        
        event = events[era]
        for player in players:
            survived_full = simulate_extinction(player, event, trait_db)
            if verbose and event.event_type == "extinction":
                status = "SAFE" if survived_full else "LOST HALF"
                print(f"  {player.name}: {status} ({player.markers} markers)")
    
    results = {
        "players": [],
        "winner": None,
        "scores": []
    }
    
    for player in players:
        score = player.score(trait_db)
        results["players"].append({
            "name": player.name,
            "strategy": player.strategy,
            "score": score,
            "markers": player.markers,
            "complexity": player.get_complexity(trait_db),
            "traits": len(player.traits),
            "extinctions_survived": player.extinctions_survived
        })
        results["scores"].append(score)
    
    results["players"].sort(key=lambda x: x["score"], reverse=True)
    results["winner"] = results["players"][0]["name"]
    
    return results


def run_simulation(num_games: int = 1000, num_players: int = 4) -> None:
    """Run multiple game simulations and report statistics."""
    print(f"\n{'='*60}")
    print(f"  BALANCE SIMULATION: {num_games} games, {num_players} players")
    print(f"{'='*60}")
    
    strategy_wins = defaultdict(int)
    strategy_scores = defaultdict(list)
    strategy_survival = defaultdict(list)
    
    for i in range(num_games):
        if (i + 1) % 100 == 0:
            print(f"  Simulating game {i + 1}/{num_games}...")
        
        results = simulate_game(num_players)
        
        winner_strat = results["players"][0]["strategy"]
        strategy_wins[winner_strat] += 1
        
        for player in results["players"]:
            strategy_scores[player["strategy"]].append(player["score"])
            strategy_survival[player["strategy"]].append(player["markers"])
    
    print(f"\n{'='*60}")
    print("  RESULTS")
    print(f"{'='*60}")
    
    print("\nWin Rates by Strategy:")
    for strat, wins in sorted(strategy_wins.items(), key=lambda x: -x[1]):
        rate = wins / num_games * 100
        print(f"  {strat:15} {wins:5} wins ({rate:.1f}%)")
    
    print("\nAverage Scores by Strategy:")
    for strat, scores in sorted(strategy_scores.items(), key=lambda x: -sum(x[1])/len(x[1])):
        avg = sum(scores) / len(scores)
        min_s = min(scores)
        max_s = max(scores)
        print(f"  {strat:15} avg={avg:.1f}, min={min_s}, max={max_s}")
    
    print("\nAverage Survival (markers) by Strategy:")
    for strat, survival in sorted(strategy_survival.items(), key=lambda x: -sum(x[1])/len(x[1])):
        avg = sum(survival) / len(survival)
        print(f"  {strat:15} avg={avg:.1f} markers")
    
    print(f"\n{'='*60}")
    print("  BALANCE ASSESSMENT")
    print(f"{'='*60}")
    
    win_rates = {s: w/num_games for s, w in strategy_wins.items()}
    max_rate = max(win_rates.values())
    min_rate = min(win_rates.values())
    
    if max_rate - min_rate < 0.15:
        print("\n  ✓ BALANCED: All strategies within 15% win rate difference")
    else:
        print(f"\n  ⚠ IMBALANCED: {max_rate - min_rate:.1%} spread between strategies")
        best = max(win_rates, key=win_rates.get)
        worst = min(win_rates, key=win_rates.get)
        print(f"    Best: {best} ({win_rates[best]:.1%})")
        print(f"    Worst: {worst} ({win_rates[worst]:.1%})")


def analyze_traits() -> None:
    """Analyze trait balance and frequency."""
    trait_db, _ = load_game_data()
    
    print(f"\n{'='*60}")
    print("  TRAIT ANALYSIS")
    print(f"{'='*60}")
    
    print("\nComplexity vs Cost Ratio (value per allele):")
    ratios = []
    for t in trait_db.values():
        if t.cost > 0:
            ratio = t.complexity / t.cost
            ratios.append((t.name, ratio, t.cost, t.complexity))
    
    ratios.sort(key=lambda x: -x[1])
    
    print("\nBest Value Traits:")
    for name, ratio, cost, complexity in ratios[:10]:
        print(f"  {name:25} {ratio:.2f} ({complexity} complexity / {cost} cost)")
    
    print("\nWorst Value Traits:")
    for name, ratio, cost, complexity in ratios[-5:]:
        print(f"  {name:25} {ratio:.2f} ({complexity} complexity / {cost} cost)")
    
    print("\nSurvival Traits (appear in SAFE lists):")
    survival_tags = ["Burrowing", "Small", "Freshwater", "Deep-Sea", "Aquatic", "Nocturnal", "Avian", "Cold-Resistant"]
    for t in trait_db.values():
        if any(tag in survival_tags for tag in t.tags):
            print(f"  {t.name:25} tags={t.tags}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--analyze":
        analyze_traits()
    elif len(sys.argv) > 1 and sys.argv[1] == "--verbose":
        result = simulate_game(verbose=True)
        print(f"\n{'='*50}")
        print("FINAL RESULTS")
        print(f"{'='*50}")
        for p in result["players"]:
            print(f"{p['name']} ({p['strategy']}): {p['score']} points")
        print(f"\nWinner: {result['winner']}")
    else:
        num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
        run_simulation(num_games)

