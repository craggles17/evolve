#!/usr/bin/env python3
"""
Card Generator - Generate printable card sheets from game data.

Creates SVG files for trait cards, event cards, and hex tiles
that can be printed for physical gameplay.
"""

import json
from pathlib import Path
from typing import Optional


DECK_COLORS = {
    0: {"name": "Cambrian", "color": "#1a237e"},
    1: {"name": "Ordovician", "color": "#00695c"},
    2: {"name": "Silurian", "color": "#2e7d32"},
    3: {"name": "Devonian", "color": "#33691e"},
    4: {"name": "Carboniferous", "color": "#1b5e20"},
    5: {"name": "Permian", "color": "#4e342e"},
    6: {"name": "Triassic", "color": "#e65100"},
    7: {"name": "Jurassic", "color": "#b71c1c"},
    8: {"name": "Cretaceous", "color": "#4a148c"},
    9: {"name": "Paleogene", "color": "#ad1457"},
    10: {"name": "Neogene", "color": "#f9a825"},
    11: {"name": "Quaternary", "color": "#eceff1"}
}


def load_data():
    """Load all game data files."""
    data_dir = Path(__file__).parent.parent / "data"
    
    with open(data_dir / "traits.json") as f:
        traits = json.load(f)
    with open(data_dir / "events.json") as f:
        events = json.load(f)
    with open(data_dir / "era_decks.json") as f:
        decks = json.load(f)
    
    return traits, events, decks


def generate_trait_card_svg(trait: dict, trait_lookup: dict = None, enables_lookup: dict = None) -> str:
    """Generate SVG for a single trait card.
    
    Args:
        trait: The trait data dict
        trait_lookup: Maps trait_id -> display name
        enables_lookup: Maps trait_id -> list of trait_ids this enables
    """
    era_min = trait["era_min"]
    era_max = trait["era_max"]
    era_color = DECK_COLORS.get(era_min, {"color": "#333"})["color"]
    
    trait_lookup = trait_lookup or {}
    enables_lookup = enables_lookup or {}
    
    def get_name(trait_id):
        """Convert trait ID to display name."""
        if trait_id in trait_lookup:
            return trait_lookup[trait_id]
        return trait_id.replace("_", " ").title()
    
    def shorten_name(name, max_len=12):
        """Shorten trait name for display."""
        if len(name) <= max_len:
            return name
        return name[:max_len-1] + "…"
    
    hard_prereqs = trait.get("hard_prereqs", [])
    soft_prereqs = trait.get("soft_prereqs", [])
    enables = enables_lookup.get(trait["id"], [])
    
    # Build prereq display (REQUIRES section)
    prereq_items = []
    for p in hard_prereqs[:2]:
        prereq_items.append(f'<tspan x="65" dy="10" fill="#e94560">{shorten_name(get_name(p))} ◀</tspan>')
    for p in soft_prereqs[:1]:
        prereq_items.append(f'<tspan x="65" dy="10" fill="#888">{shorten_name(get_name(p))} ◁</tspan>')
    prereq_text = "".join(prereq_items) if prereq_items else '<tspan x="65" dy="10" fill="#555">—</tspan>'
    
    # Build enables display (UNLOCKS section)
    enables_items = []
    for e in enables[:3]:
        enables_items.append(f'<tspan x="185" dy="10" fill="#27ae60">{shorten_name(get_name(e))} ▶</tspan>')
    enables_text = "".join(enables_items) if enables_items else '<tspan x="185" dy="10" fill="#555">—</tspan>'
    
    tags_display = " ".join(f"[{t}]" for t in trait["tags"][:3])
    if len(trait["tags"]) > 3:
        tags_display += "..."
    
    grants = trait.get("grants", "")
    grants_lines = []
    for part in grants.split(". "):
        if len(part) > 45:
            grants_lines.append(part[:42] + "...")
        else:
            grants_lines.append(part)
    grants_lines = grants_lines[:3]
    
    science_text = trait.get("science", "")[:80]
    if len(trait.get("science", "")) > 80:
        science_text += "..."
    
    # Count for display
    prereq_count = len(hard_prereqs) + len(soft_prereqs)
    enables_count = len(enables)
    prereq_label = f"REQUIRES ({prereq_count})" if prereq_count else "REQUIRES"
    enables_label = f"UNLOCKS ({enables_count})" if enables_count else "UNLOCKS"
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350" width="250" height="350">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="eraGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:{era_color}"/>
      <stop offset="100%" style="stop-color:{era_color}"/>
    </linearGradient>
  </defs>
  
  <rect width="250" height="350" fill="url(#cardBg)" rx="15"/>
  <rect x="5" y="5" width="240" height="340" fill="none" stroke="#e94560" stroke-width="2" rx="12"/>
  
  <rect x="10" y="10" width="230" height="30" fill="url(#eraGrad)" rx="8"/>
  <text x="125" y="25" font-family="Arial" font-size="10" fill="#fff" text-anchor="middle" font-weight="bold">ERA {era_min}-{era_max} ({DECK_COLORS.get(era_min, {}).get("name", "")[:3]}-{DECK_COLORS.get(era_max, {}).get("name", "")[:3]})</text>
  <text x="30" y="35" font-family="Arial" font-size="8" fill="#f1c40f" font-weight="bold">COST: {trait["cost"]}</text>
  <text x="220" y="35" font-family="Arial" font-size="8" fill="#9b59b6" text-anchor="end">+{trait["complexity"]} CPX</text>
  
  <rect x="10" y="44" width="230" height="32" fill="#0f3460" rx="5"/>
  <text x="125" y="66" font-family="Georgia" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">{trait["name"].upper()}</text>
  
  <rect x="10" y="80" width="110" height="48" fill="#0a0a15" stroke="#e94560" rx="5"/>
  <text x="65" y="92" font-family="Arial" font-size="8" fill="#e94560" text-anchor="middle" font-weight="bold">{prereq_label}</text>
  <text font-family="Arial" font-size="7" text-anchor="middle">{prereq_text}</text>
  
  <rect x="130" y="80" width="110" height="48" fill="#0a0a15" stroke="#27ae60" rx="5"/>
  <text x="185" y="92" font-family="Arial" font-size="8" fill="#27ae60" text-anchor="middle" font-weight="bold">{enables_label}</text>
  <text font-family="Arial" font-size="7" text-anchor="middle">{enables_text}</text>
  
  <rect x="10" y="132" width="230" height="22" fill="#0a0a15" stroke="#3a3a5a" rx="5"/>
  <text x="125" y="147" font-family="Arial" font-size="8" fill="#3498db" text-anchor="middle">{tags_display}</text>
  
  <rect x="10" y="158" width="230" height="70" fill="#0a0a15" stroke="#27ae60" rx="5"/>
  <text x="20" y="173" font-family="Arial" font-size="9" fill="#27ae60" font-weight="bold">GRANTS:</text>
  <text x="20" y="186" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[0] if grants_lines else ""}</text>
  <text x="20" y="198" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[1] if len(grants_lines) > 1 else ""}</text>
  <text x="20" y="210" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[2] if len(grants_lines) > 2 else ""}</text>
  
  <rect x="10" y="232" width="230" height="55" fill="#0a0a15" stroke="#888" rx="5"/>
  <text x="20" y="246" font-family="Arial" font-size="8" fill="#888" font-style="italic">SCIENCE:</text>
  <text x="20" y="258" font-family="Arial" font-size="7" fill="#666">{science_text[:55]}</text>
  <text x="20" y="268" font-family="Arial" font-size="7" fill="#666">{science_text[55:] if len(science_text) > 55 else ""}</text>
  
  <rect x="10" y="291" width="230" height="20" fill="#0f3460" rx="5"/>
  <text x="125" y="305" font-family="Arial" font-size="9" fill="#888" text-anchor="middle">[{trait.get("clade", "Various")}]</text>
  
  <rect x="10" y="315" width="230" height="25" fill="#0a0a15" stroke="#444" rx="5"/>
  <text x="20" y="330" font-family="Arial" font-size="7" fill="#555">◀ Hard req  ◁ Soft req (cost-1)</text>
  <text x="230" y="330" font-family="Arial" font-size="7" fill="#555" text-anchor="end">▶ Enables</text>
</svg>'''
    
    return svg


def generate_event_card_svg(event: dict) -> str:
    """Generate SVG for a single event card."""
    is_extinction = event["type"] == "extinction"
    is_positive = event["type"] == "positive"
    border_color = "#c0392b" if is_extinction else "#27ae60" if is_positive else "#3498db"
    
    safe_tags = " ".join(f"[{t}]" for t in event.get("safe_tags", [])[:4])
    doomed_tags = " ".join(f"[{t}]" for t in event.get("doomed_tags", [])[:4])
    neutral_roll = event.get("neutral_roll", 4)
    
    effect_text = event.get("effect", "")[:48]
    description = event.get("description", "")[:60]
    
    real_examples = event.get("real_examples", [])
    example1 = real_examples[0][:45] if len(real_examples) > 0 else ""
    example2 = real_examples[1][:45] if len(real_examples) > 1 else ""
    
    main_section = ""
    if is_extinction:
        main_section = f'''
  <rect x="10" y="100" width="230" height="50" fill="#0a1a0a" stroke="#27ae60" stroke-width="2" rx="5"/>
  <text x="125" y="115" font-family="Arial" font-size="9" fill="#27ae60" text-anchor="middle" font-weight="bold">SAFE (survive)</text>
  <text x="125" y="132" font-family="Arial" font-size="7" fill="#27ae60" text-anchor="middle">{safe_tags}</text>
  
  <rect x="10" y="155" width="230" height="50" fill="#1a0a0a" stroke="#c0392b" stroke-width="2" rx="5"/>
  <text x="125" y="170" font-family="Arial" font-size="9" fill="#c0392b" text-anchor="middle" font-weight="bold">DOOMED (lose half)</text>
  <text x="125" y="187" font-family="Arial" font-size="7" fill="#c0392b" text-anchor="middle">{doomed_tags}</text>
  
  <rect x="10" y="210" width="230" height="25" fill="#1a1a0a" stroke="#f1c40f" rx="5"/>
  <text x="125" y="227" font-family="Arial" font-size="9" fill="#f1c40f" text-anchor="middle" font-weight="bold">NEUTRAL: Roll d6, need {neutral_roll}+</text>'''
    else:
        main_section = f'''
  <rect x="10" y="100" width="230" height="65" fill="#0a0a15" stroke="{border_color}" rx="5"/>
  <text x="125" y="118" font-family="Arial" font-size="10" fill="{border_color}" text-anchor="middle" font-weight="bold">EFFECT:</text>
  <text x="125" y="136" font-family="Arial" font-size="8" fill="#ccc" text-anchor="middle">{effect_text}</text>
  <text x="125" y="152" font-family="Arial" font-size="7" fill="#888" text-anchor="middle" font-style="italic">{description}</text>
  
  <rect x="10" y="170" width="230" height="65" fill="#0a0505" stroke="#555" rx="5"/>'''
    
    examples_y = 245 if is_extinction else 185
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350" width="250" height="350">
  <rect width="250" height="350" fill="#1a0a0a" rx="15"/>
  <rect x="5" y="5" width="240" height="340" fill="none" stroke="{border_color}" stroke-width="3" rx="12"/>
  
  <rect x="10" y="10" width="230" height="30" fill="{border_color}" rx="8"/>
  <text x="125" y="30" font-family="Arial" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">{"★ EXTINCTION ★" if is_extinction else "✦ " + event["type"].upper() + " ✦"}</text>
  
  <rect x="10" y="45" width="230" height="50" fill="#1a0505" stroke="{border_color}" rx="5"/>
  <text x="125" y="75" font-family="Georgia" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">{event["name"].upper()}</text>
  
  {main_section}
  
  <rect x="10" y="{examples_y}" width="230" height="55" fill="#0a0a1a" stroke="#9b59b6" rx="5"/>
  <text x="125" y="{examples_y + 15}" font-family="Arial" font-size="9" fill="#9b59b6" text-anchor="middle" font-weight="bold">REAL EXAMPLES:</text>
  <text x="20" y="{examples_y + 30}" font-family="Arial" font-size="7" fill="#bb88dd">• {example1}</text>
  <text x="20" y="{examples_y + 42}" font-family="Arial" font-size="7" fill="#bb88dd">• {example2}</text>
  
  <rect x="10" y="305" width="230" height="35" fill="#050505" stroke="#444" rx="5"/>
  <text x="20" y="320" font-family="Arial" font-size="6" fill="#555">{event.get("science", "")[:55]}</text>
  <text x="20" y="330" font-family="Arial" font-size="6" fill="#555">{event.get("science", "")[55:110]}</text>
</svg>'''
    
    return svg


def build_enables_lookup(traits: list) -> dict:
    """Build reverse lookup: trait_id -> list of traits it enables.
    
    A trait enables another if it appears in that trait's hard_prereqs or soft_prereqs.
    """
    enables = {}
    for trait in traits:
        trait_id = trait["id"]
        enables[trait_id] = []
    
    for trait in traits:
        for prereq_id in trait.get("hard_prereqs", []):
            if prereq_id in enables:
                enables[prereq_id].append(trait["id"])
        for prereq_id in trait.get("soft_prereqs", []):
            if prereq_id in enables:
                enables[prereq_id].append(trait["id"])
    
    return enables


def generate_all_cards(output_dir: Optional[Path] = None) -> None:
    """Generate all card SVGs."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "generated_cards"
    
    output_dir.mkdir(exist_ok=True)
    (output_dir / "traits").mkdir(exist_ok=True)
    (output_dir / "events").mkdir(exist_ok=True)
    
    traits, events, _ = load_data()
    
    trait_lookup = {t["id"]: t["name"] for t in traits["traits"]}
    enables_lookup = build_enables_lookup(traits["traits"])
    
    print(f"Generating {len(traits['traits'])} trait cards...")
    for trait in traits["traits"]:
        svg = generate_trait_card_svg(trait, trait_lookup, enables_lookup)
        filepath = output_dir / "traits" / f"{trait['id']}.svg"
        with open(filepath, "w") as f:
            f.write(svg)
    
    print(f"Generating {len(events['events'])} event cards...")
    for event in events["events"]:
        svg = generate_event_card_svg(event)
        event_id = event.get("id", event["name"].lower().replace(" ", "_").replace("-", "_"))
        filepath = output_dir / "events" / f"{event_id}.svg"
        with open(filepath, "w") as f:
            f.write(svg)
    
    (output_dir / "event_backs").mkdir(exist_ok=True)
    assets_dir = Path(__file__).parent.parent / "assets" / "cards"
    
    import shutil
    extinction_back = assets_dir / "event_back_extinction.svg"
    other_back = assets_dir / "event_back_other.svg"
    if extinction_back.exists():
        shutil.copy(extinction_back, output_dir / "event_backs" / "extinction_back.svg")
    if other_back.exists():
        shutil.copy(other_back, output_dir / "event_backs" / "other_back.svg")
    
    print(f"\nCards generated in: {output_dir}")
    print(f"  - {len(traits['traits'])} trait cards in /traits")
    print(f"  - {len(events['events'])} event cards in /events")
    print(f"  - 2 event back designs in /event_backs")


def generate_print_sheets(output_dir: Optional[Path] = None) -> None:
    """Generate print sheets for all cards (A4/Letter, 3x3 grid per sheet)."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "generated_cards" / "print_sheets"
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    traits, events, _ = load_data()
    trait_lookup = {t["id"]: t["name"] for t in traits["traits"]}
    
    cards_per_row = 3
    cards_per_col = 3
    cards_per_sheet = cards_per_row * cards_per_col
    
    card_width = 250
    card_height = 350
    margin = 10
    
    sheet_width = cards_per_row * (card_width + margin) + margin
    sheet_height = cards_per_col * (card_height + margin) + margin
    
    def create_sheet(cards: list, sheet_name: str) -> None:
        svg_header = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {sheet_width} {sheet_height}" width="{sheet_width}" height="{sheet_height}">
  <rect width="{sheet_width}" height="{sheet_height}" fill="#ffffff"/>
'''
        cards_content = []
        for i, card_svg in enumerate(cards):
            row = i // cards_per_row
            col = i % cards_per_row
            x = margin + col * (card_width + margin)
            y = margin + row * (card_height + margin)
            
            inner = card_svg.split("<svg")[1].split(">", 1)[1].rsplit("</svg>", 1)[0]
            cards_content.append(f'<g transform="translate({x}, {y})">{inner}</g>')
        
        with open(output_dir / sheet_name, "w") as f:
            f.write(svg_header + "\n".join(cards_content) + "</svg>")
    
    enables_lookup = build_enables_lookup(traits["traits"])
    trait_cards = [generate_trait_card_svg(t, trait_lookup, enables_lookup) for t in traits["traits"]]
    for i in range(0, len(trait_cards), cards_per_sheet):
        sheet_num = i // cards_per_sheet + 1
        batch = trait_cards[i:i + cards_per_sheet]
        create_sheet(batch, f"traits_sheet_{sheet_num:02d}.svg")
    
    event_cards = [generate_event_card_svg(e) for e in events["events"]]
    for i in range(0, len(event_cards), cards_per_sheet):
        sheet_num = i // cards_per_sheet + 1
        batch = event_cards[i:i + cards_per_sheet]
        create_sheet(batch, f"events_sheet_{sheet_num:02d}.svg")
    
    assets_dir = Path(__file__).parent.parent / "assets" / "cards"
    extinction_back = assets_dir / "event_back_extinction.svg"
    other_back = assets_dir / "event_back_other.svg"
    
    if extinction_back.exists() and other_back.exists():
        with open(extinction_back) as f:
            ext_svg = f.read()
        with open(other_back) as f:
            other_svg = f.read()
        
        ext_cards = [ext_svg] * 7
        other_cards = [other_svg] * 9
        create_sheet(ext_cards + other_cards[:2], "event_backs_sheet_01.svg")
        create_sheet(other_cards[2:], "event_backs_sheet_02.svg")
    
    num_trait_sheets = (len(trait_cards) + cards_per_sheet - 1) // cards_per_sheet
    num_event_sheets = (len(event_cards) + cards_per_sheet - 1) // cards_per_sheet
    
    print(f"Print sheets generated in: {output_dir}")
    print(f"  - {num_trait_sheets} trait sheets ({len(trait_cards)} cards)")
    print(f"  - {num_event_sheets} event sheets ({len(event_cards)} cards)")
    print(f"  - 2 event back sheets (for double-sided printing)")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--sheets":
        generate_all_cards()
        generate_print_sheets()
    elif len(sys.argv) > 1 and sys.argv[1] == "--print-only":
        generate_print_sheets()
    else:
        generate_all_cards()

