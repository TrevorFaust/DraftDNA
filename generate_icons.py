#!/usr/bin/env python3
import argparse
import json
import os
import time

from google import genai

JSON_PATH = os.path.join("archetype_logic", "badge images", "icon_prompts.json")
OUTPUT_DIR = os.path.join("badges", "icons")

# PART 2 — style block (same for every icon)
STYLE_BLOCK = (
    "Stylized semi-realistic hand-painted 2.5D game icon. Style: mobile RPG inventory asset, high-fantasy loot icon, "
    "similar to Clash of Clans or idle tycoon game items. Rendering: soft digital brush shading, visible gradients, "
    "high contrast spotlit lighting with bright highlights and subtle shading, slightly exaggerated proportions for readability. "
    "The object must have a clean recognizable silhouette readable at small sizes. Materials should look premium and tactile — "
    "metallic shine, glossy surfaces, jewel-like reflections, richer and more vibrant than real life. Single centered object on a "
    "fully transparent background. Absolutely zero shadow of any kind. No drop shadow, no cast shadow, no ground shadow, no ambient occlusion shadow beneath the object. The object must float on pure transparency with nothing beneath it. "
    "Absolutely no black background, no dark background, no colored background. The background must be 100 percent transparent. If the model cannot produce a transparent background use pure white as a last resort, never black or dark. "
    "No ground plane, no environment, no scene, no pedestal. No text. Do not use any football equipment, helmets, goalposts, footballs, cleats, jerseys, or any sports equipment as the icon subject. If the archetype name suggests a sports concept represent it through a non-sports metaphor instead — for example the Kicker Truther should show a boot or a measuring instrument, not a football or kicker. If the icon description mentions a list, chart, document, clipboard, or evaluation sheet it must show abstract indiscriminate scribbles, generic bar graphs, or blank lined paper with no readable text, no named figures, no character stats, no people, no demons, no warriors, and no identifiable information of any kind."
)

# Color block by rb_strategy (appended after STYLE_BLOCK)
COLOR = {
    "BPA": (
        "Color palette: polished gold as the primary material, carbon fiber dark grey as secondary surface detail, electric blue "
        "as the accent glow and highlight color. The object should feel like a premium gold tool."
    ),
    "Hero RB": (
        "Color palette: brushed steel silver as the primary material, deep crimson red as secondary surface detail, ruby red as "
        "the accent glow and highlight color. The object should feel like an elite steel weapon or status symbol."
    ),
    "Robust RB": (
        "Color palette: dark cast iron and obsidian black as the primary material, hammered dark metal as secondary surface "
        "detail, mossy green as the accent glow and highlight color. The object should feel like a heavy industrial siege weapon "
        "or tool."
    ),
    "Zero RB": (
        "Color palette: prismatic platinum and iridescent chrome as the primary material, glass-etched surface detail, cyan and "
        "neon teal as the accent glow and highlight color. The object should feel like a high-tech holographic asset."
    ),
    "Hybrid": (
        "Color palette: iridescent titanium as the primary material, anodized multi-tone surface sheen as secondary detail, "
        "amethyst purple and mustard yellow orange as the dual accent glow and highlight colors. The object should feel complex "
        "and layered."
    ),
    "Chaos Tier": (
        "Color palette: fractured dark stone as the primary material, cracked obsidian surface with glowing fissures as secondary "
        "detail, vibrant hot pink and bright yellow and deep purple as the triple accent glow and highlight colors. The object "
        "should feel volatile and unpredictable."
    ),
}


def build_prompt(entry: dict) -> str:
    """Two parts: subject (icon_description), style block + color block."""
    strat = entry.get("rb_strategy", "")
    part1 = entry["icon_description"]
    part2 = f"{STYLE_BLOCK}\n\n{COLOR.get(strat, '')}".strip()
    return f"{part1}\n\n{part2}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate archetype icons.")
    parser.add_argument("--limit", type=int, default=0, help="Process at most this many entries (0 = no limit).")
    parser.add_argument(
        "--per-category",
        type=int,
        default=0,
        help="Take this many entries per rb_strategy (0 = disabled). Skips existing files when building the set.",
    )
    parser.add_argument(
        "--ids",
        type=str,
        default="",
        help="Comma-separated filenames to generate (overwrites existing).",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.5-flash-image",
        help="Gemini model id for image generation (default: gemini-2.5-flash-image).",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        default="",
        help="Comma-separated rb_strategy names to process (e.g. BPA,Hero RB). Only icons matching these strategies are generated.",
    )
    args = parser.parse_args()

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    combined = list(data.get("archetypes", [])) + list(data.get("chaos_archetypes", []))

    id_set = {s.strip() for s in args.ids.split(",") if s.strip()} if args.ids.strip() else set()

    if id_set:
        by_name = {e["filename"]: e for e in combined if e.get("filename")}
        ids_in_order = [f.strip() for f in args.ids.split(",") if f.strip()]
        entries = [by_name[f] for f in ids_in_order if f in by_name]
    elif args.per_category > 0:
        categories = list(COLOR.keys())
        remaining = {c: args.per_category for c in categories}
        entries = []
        for entry in combined:
            strat = entry.get("rb_strategy")
            if strat not in remaining or remaining[strat] <= 0:
                continue
            fn = entry.get("filename")
            if not fn:
                continue
            out_path = os.path.join(OUTPUT_DIR, fn)
            if os.path.isfile(out_path):
                continue
            entries.append(entry)
            remaining[strat] -= 1
            if all(v == 0 for v in remaining.values()):
                break
        print(
            f"Selected {len(entries)} icons (per-category={args.per_category}): "
            f"{[e.get('filename') for e in entries]}",
            flush=True,
        )
    else:
        entries = combined
        if args.limit > 0:
            entries = entries[: args.limit]

    if args.strategy.strip():
        strategy_set = {s.strip() for s in args.strategy.split(",") if s.strip()}
        entries = [e for e in entries if e.get("rb_strategy") in strategy_set]
        if strategy_set:
            print(f"Filtered to strategies {strategy_set}: {len(entries)} icons", flush=True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(entries)
    saved = 0

    for i, entry in enumerate(entries, start=1):
        filename = entry["filename"]
        path = os.path.join(OUTPUT_DIR, filename)

        if os.path.isfile(path) and filename not in id_set:
            continue

        prompt = build_prompt(entry)
        print(f"[{i}/{total}] Generating: {filename}", flush=True)

        try:
            response = client.models.generate_content(
                model=args.model,
                contents=[prompt],
            )
            parts = getattr(response, "parts", None) or []
            for part in parts:
                if part.inline_data is not None:
                    img = part.as_image()
                    if img is not None:
                        img.save(path)
                        saved += 1
                        time.sleep(10)
                        break
            else:
                print(f"Error: no image in response for {filename}", flush=True)
        except Exception as e:
            print(f"Error: {e}", flush=True)

    print(f"Saved successfully: {saved}", flush=True)


if __name__ == "__main__":
    main()
