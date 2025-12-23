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


def generate_trait_card_svg(trait: dict, trait_lookup: dict = None) -> str:
    """Generate SVG for a single trait card."""
    era_min = trait["era_min"]
    era_max = trait["era_max"]
    era_color = DECK_COLORS.get(era_min, {"color": "#333"})["color"]
    
    trait_lookup = trait_lookup or {}
    
    def get_name(trait_id):
        """Convert trait ID to display name."""
        if trait_id in trait_lookup:
            return trait_lookup[trait_id]
        return trait_id.replace("_", " ").title()
    
    hard_prereqs = trait.get("hard_prereqs", [])
    soft_prereqs = trait.get("soft_prereqs", [])
    
    prereq_lines = []
    for p in hard_prereqs[:2]:
        prereq_lines.append(f'<tspan x="185" dy="12" fill="#e94560">{get_name(p)} ━</tspan>')
    for p in soft_prereqs[:2]:
        prereq_lines.append(f'<tspan x="185" dy="12" fill="#888">{get_name(p)} ┅</tspan>')
    
    prereq_text = "".join(prereq_lines) if prereq_lines else '<tspan x="185" dy="12" fill="#666">None</tspan>'
    
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
  
  <rect x="10" y="10" width="230" height="35" fill="url(#eraGrad)" rx="8"/>
  <text x="125" y="28" font-family="Arial" font-size="11" fill="#fff" text-anchor="middle" font-weight="bold">ERA WINDOW: {era_min}-{era_max}</text>
  <text x="125" y="40" font-family="Arial" font-size="8" fill="#ccc" text-anchor="middle">({DECK_COLORS.get(era_min, {}).get("name", "")} to {DECK_COLORS.get(era_max, {}).get("name", "")})</text>
  
  <rect x="10" y="50" width="230" height="40" fill="#0f3460" rx="5"/>
  <text x="125" y="76" font-family="Georgia" font-size="16" fill="#fff" text-anchor="middle" font-weight="bold">{trait["name"].upper()}</text>
  
  <rect x="10" y="95" width="110" height="50" fill="#0a0a15" stroke="#3a3a5a" rx="5"/>
  <text x="65" y="112" font-family="Arial" font-size="10" fill="#f1c40f" text-anchor="middle" font-weight="bold">COST</text>
  <text x="65" y="135" font-family="Arial" font-size="24" fill="#f1c40f" text-anchor="middle" font-weight="bold">{trait["cost"]}</text>
  
  <rect x="130" y="95" width="110" height="50" fill="#0a0a15" stroke="#3a3a5a" rx="5"/>
  <text x="185" y="112" font-family="Arial" font-size="10" fill="#e94560" text-anchor="middle" font-weight="bold">PREREQS</text>
  <text font-family="Arial" font-size="8" text-anchor="middle">{prereq_text}</text>
  
  <rect x="10" y="150" width="230" height="35" fill="#0a0a15" stroke="#3a3a5a" rx="5"/>
  <text x="70" y="170" font-family="Arial" font-size="10" fill="#9b59b6" text-anchor="middle">COMPLEXITY +{trait["complexity"]}</text>
  <text x="185" y="170" font-family="Arial" font-size="8" fill="#3498db" text-anchor="middle">{tags_display}</text>
  
  <rect x="10" y="190" width="230" height="70" fill="#0a0a15" stroke="#27ae60" rx="5"/>
  <text x="20" y="206" font-family="Arial" font-size="10" fill="#27ae60" font-weight="bold">GRANTS:</text>
  <text x="20" y="220" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[0] if grants_lines else ""}</text>
  <text x="20" y="232" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[1] if len(grants_lines) > 1 else ""}</text>
  <text x="20" y="244" font-family="Arial" font-size="8" fill="#ccc">{grants_lines[2] if len(grants_lines) > 2 else ""}</text>
  
  <rect x="10" y="265" width="230" height="45" fill="#0a0a15" stroke="#888" rx="5"/>
  <text x="20" y="280" font-family="Arial" font-size="8" fill="#888" font-style="italic">SCIENCE:</text>
  <text x="20" y="292" font-family="Arial" font-size="7" fill="#666">{science_text[:55]}</text>
  <text x="20" y="302" font-family="Arial" font-size="7" fill="#666">{science_text[55:] if len(science_text) > 55 else ""}</text>
  
  <rect x="10" y="315" width="230" height="25" fill="#0f3460" rx="5"/>
  <text x="125" y="332" font-family="Arial" font-size="10" fill="#888" text-anchor="middle">[Clade: {trait.get("clade", "Various")}]</text>
</svg>'''
    
    return svg


def generate_event_card_svg(event: dict) -> str:
    """Generate SVG for a single event card."""
    is_extinction = event["type"] == "extinction"
    border_color = "#c0392b" if is_extinction else "#27ae60" if event["type"] == "positive" else "#3498db"
    
    safe_tags = " ".join(f"[{t}]" for t in event.get("safe_tags", [])[:4])
    doomed_tags = " ".join(f"[{t}]" for t in event.get("doomed_tags", [])[:4])
    neutral_roll = event.get("neutral_roll", 4)
    
    effect_text = event.get("effect", "")[:50]
    description = event.get("description", "")[:70]
    
    extinction_section = ""
    if is_extinction:
        extinction_section = f'''
  <rect x="10" y="100" width="230" height="60" fill="#0a1a0a" stroke="#27ae60" stroke-width="2" rx="5"/>
  <text x="125" y="118" font-family="Arial" font-size="10" fill="#27ae60" text-anchor="middle" font-weight="bold">SAFE (survive automatically)</text>
  <text x="125" y="138" font-family="Arial" font-size="8" fill="#27ae60" text-anchor="middle">{safe_tags}</text>
  
  <rect x="10" y="165" width="230" height="55" fill="#1a0a0a" stroke="#c0392b" stroke-width="2" rx="5"/>
  <text x="125" y="183" font-family="Arial" font-size="10" fill="#c0392b" text-anchor="middle" font-weight="bold">DOOMED (lose half markers)</text>
  <text x="125" y="203" font-family="Arial" font-size="8" fill="#c0392b" text-anchor="middle">{doomed_tags}</text>
  
  <rect x="10" y="225" width="230" height="30" fill="#1a1a0a" stroke="#f1c40f" rx="5"/>
  <text x="125" y="244" font-family="Arial" font-size="9" fill="#f1c40f" text-anchor="middle" font-weight="bold">NEUTRAL: Roll d6, need {neutral_roll}+</text>'''
    else:
        extinction_section = f'''
  <rect x="10" y="100" width="230" height="80" fill="#0a0a15" stroke="#555" rx="5"/>
  <text x="125" y="120" font-family="Arial" font-size="10" fill="#ccc" text-anchor="middle" font-weight="bold">EFFECT:</text>
  <text x="125" y="140" font-family="Arial" font-size="9" fill="#aaa" text-anchor="middle">{effect_text}</text>
  <text x="125" y="160" font-family="Arial" font-size="8" fill="#888" text-anchor="middle" font-style="italic">{description[:40]}</text>'''
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350" width="250" height="350">
  <rect width="250" height="350" fill="#1a0a0a" rx="15"/>
  <rect x="5" y="5" width="240" height="340" fill="none" stroke="{border_color}" stroke-width="3" rx="12"/>
  
  <rect x="10" y="10" width="230" height="30" fill="{border_color}" rx="8"/>
  <text x="125" y="30" font-family="Arial" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">{"★ EXTINCTION EVENT ★" if is_extinction else event["type"].upper() + " EVENT"}</text>
  
  <rect x="10" y="45" width="230" height="50" fill="#1a0505" stroke="{border_color}" rx="5"/>
  <text x="125" y="75" font-family="Georgia" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">{event["name"].upper()}</text>
  
  {extinction_section}
  
  <rect x="10" y="265" width="230" height="75" fill="#0a0505" stroke="#555" rx="5"/>
  <text x="125" y="283" font-family="Arial" font-size="9" fill="#888" text-anchor="middle" font-style="italic">SCIENCE:</text>
  <text x="20" y="300" font-family="Arial" font-size="7" fill="#666">{event.get("science", "")[:55]}</text>
  <text x="20" y="312" font-family="Arial" font-size="7" fill="#666">{event.get("science", "")[55:110]}</text>
  <text x="20" y="324" font-family="Arial" font-size="7" fill="#666">{event.get("science", "")[110:165]}</text>
</svg>'''
    
    return svg


def generate_all_cards(output_dir: Optional[Path] = None) -> None:
    """Generate all card SVGs."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "generated_cards"
    
    output_dir.mkdir(exist_ok=True)
    (output_dir / "traits").mkdir(exist_ok=True)
    (output_dir / "events").mkdir(exist_ok=True)
    
    traits, events, _ = load_data()
    
    trait_lookup = {t["id"]: t["name"] for t in traits["traits"]}
    
    print(f"Generating {len(traits['traits'])} trait cards...")
    for trait in traits["traits"]:
        svg = generate_trait_card_svg(trait, trait_lookup)
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


def generate_print_sheet(cards_per_row: int = 3, cards_per_col: int = 3) -> str:
    """Generate a print sheet with multiple cards for A4/Letter printing."""
    traits, _, _ = load_data()
    
    card_width = 250
    card_height = 350
    margin = 10
    
    sheet_width = cards_per_row * (card_width + margin) + margin
    sheet_height = cards_per_col * (card_height + margin) + margin
    
    svg_header = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {sheet_width} {sheet_height}" width="{sheet_width}" height="{sheet_height}">
  <rect width="{sheet_width}" height="{sheet_height}" fill="#ffffff"/>
'''
    
    svg_footer = "</svg>"
    
    cards_content = []
    for i, trait in enumerate(traits["traits"][:cards_per_row * cards_per_col]):
        row = i // cards_per_row
        col = i % cards_per_row
        x = margin + col * (card_width + margin)
        y = margin + row * (card_height + margin)
        
        card_svg = generate_trait_card_svg(trait)
        inner_content = card_svg.split("<svg")[1].split(">", 1)[1].rsplit("</svg>", 1)[0]
        
        cards_content.append(f'<g transform="translate({x}, {y})">{inner_content}</g>')
    
    return svg_header + "\n".join(cards_content) + svg_footer


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--sheet":
        sheet = generate_print_sheet()
        output = Path(__file__).parent.parent / "generated_cards" / "print_sheet.svg"
        output.parent.mkdir(exist_ok=True)
        with open(output, "w") as f:
            f.write(sheet)
        print(f"Print sheet generated: {output}")
    else:
        generate_all_cards()

