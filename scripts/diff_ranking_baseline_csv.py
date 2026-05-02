"""Compare first N rows of data/ranking_template.csv to a 4-lines-per-player baseline CSV."""
from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path

SUFFIXES = (" III", " II", " IV", " V", " Jr.", " Sr.", " Jr", " Sr")

# Template `player_id` (defense-*) -> NFL team abbrev. used in baseline parens.
DEFENSE_SLUG_TO_ABBR: dict[str, str] = {
    "defense-arizona-cardinals": "ARI",
    "defense-atlanta-falcons": "ATL",
    "defense-baltimore-ravens": "BAL",
    "defense-buffalo-bills": "BUF",
    "defense-carolina-panthers": "CAR",
    "defense-chicago-bears": "CHI",
    "defense-cincinnati-bengals": "CIN",
    "defense-cleveland-browns": "CLE",
    "defense-dallas-cowboys": "DAL",
    "defense-denver-broncos": "DEN",
    "defense-detroit-lions": "DET",
    "defense-green-bay-packers": "GB",
    "defense-houston-texans": "HOU",
    "defense-indianapolis-colts": "IND",
    "defense-jacksonville-jaguars": "JAX",
    "defense-kansas-city-chiefs": "KC",
    "defense-las-vegas-raiders": "LV",
    "defense-los-angeles-chargers": "LAC",
    "defense-los-angeles-rams": "LAR",
    "defense-miami-dolphins": "MIA",
    "defense-minnesota-vikings": "MIN",
    "defense-new-england-patriots": "NE",
    "defense-new-orleans-saints": "NO",
    "defense-new-york-giants": "NYG",
    "defense-new-york-jets": "NYJ",
    "defense-philadelphia-eagles": "PHI",
    "defense-pittsburgh-steelers": "PIT",
    "defense-san-francisco-49ers": "SF",
    "defense-seattle-seahawks": "SEA",
    "defense-tampa-bay-buccaneers": "TB",
    "defense-tennessee-titans": "TEN",
    "defense-washington-commanders": "WAS",
}

# Sleeper / template sometimes uses LA for Rams; baseline export uses LAR.
TEAM_ALIASES: dict[str, tuple[str, ...]] = {
    "LA": ("LAR", "LAC"),  # try LAR first for Rams-heavy fantasy data
}


def strip_suffix(last: str) -> str:
    s = last.strip()
    for suf in SUFFIXES:
        if s.endswith(suf):
            return s[: -len(suf)].strip()
    return s


def norm_last(s: str) -> str:
    s = strip_suffix(s)
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def parse_short_line(name_raw: str) -> tuple[str | None, str]:
    s = name_raw.strip().strip('"').rstrip(",").strip()
    if "." not in s:
        return None, s
    a, b = s.split(".", 1)
    return a.strip(), b.strip()


def full_to_key(full: str, pos: str, team: str) -> tuple[str, str, str, str] | None:
    parts = full.strip().split()
    if len(parts) < 2:
        return None
    initial = parts[0][0]
    last = " ".join(parts[1:])
    return (initial.lower(), norm_last(last), pos.upper(), team.upper())


def short_to_key(short: str, pos: str, team: str) -> tuple[str, str, str, str] | None:
    ini, last = parse_short_line(short)
    if not ini:
        return None
    return (ini.lower(), norm_last(last), norm_pos(pos), team.upper())


def norm_pos(pos: str) -> str:
    p = pos.strip().upper()
    if p in ("D/ST", "DST", "DEF"):
        return "DST"
    return p


def parse_weird_csv(path: Path) -> list[dict]:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    records: list[dict] = []
    i = 0
    while i + 3 < len(lines):
        rank_s = lines[i].strip().strip('"')
        name_s = lines[i + 1].strip()
        pos_s = lines[i + 2].strip()
        team_s = lines[i + 3].strip()
        if not rank_s.isdigit():
            i += 1
            continue
        m = re.match(r"\(([A-Z]{2,3})-null\)", team_s)
        team = m.group(1) if m else team_s
        pos_n = norm_pos(pos_s)
        if pos_n == "DST":
            key: tuple[str, str] | tuple[str, str, str, str] | None = ("__dst__", team.upper())
        else:
            key = short_to_key(name_s, pos_s, team)
        records.append(
            {
                "rank": int(rank_s),
                "name_short": name_s,
                "position": pos_s,
                "team": team,
                "key": key,
            }
        )
        i += 4
    return records


def template_team_abbr(row: dict) -> str:
    team = (row.get("team") or "").strip().upper()
    if team:
        return team
    pid = (row.get("player_id") or "").strip().lower()
    if pid.startswith("defense-") and pid in DEFENSE_SLUG_TO_ABBR:
        return DEFENSE_SLUG_TO_ABBR[pid]
    return ""


def full_to_key(
    full: str, pos: str, team: str, pos_norm: str | None = None
) -> tuple[str, str, str, str] | tuple[str, str] | None:
    pn = pos_norm if pos_norm is not None else norm_pos(pos)
    if pn == "DST":
        if not team:
            return None
        return ("__dst__", team.upper())
    parts = full.strip().split()
    if len(parts) < 2:
        return None
    initial = parts[0][0]
    last = " ".join(parts[1:])
    if not team:
        return None
    return (initial.lower(), norm_last(last), pn, team.upper())


def key_variants(
    k: tuple[str, str, str, str] | tuple[str, str] | None,
) -> list[tuple]:
    if k is None:
        return []
    if isinstance(k, tuple) and len(k) == 2 and k[0] == "__dst__":
        return [k]
    if not isinstance(k, tuple) or len(k) != 4:
        return [k] if k else []
    ini, lastn, pos, tm = k
    alts = [k]
    for alt in TEAM_ALIASES.get(tm, ()):
        alts.append((ini, lastn, pos, alt))
    return alts


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("baseline_csv", type=Path)
    p.add_argument("--template", type=Path, default=Path("data/ranking_template.csv"))
    p.add_argument("--top", type=int, default=500)
    args = p.parse_args()

    baseline = parse_weird_csv(args.baseline_csv)
    baseline_keys = {r["key"] for r in baseline if r["key"]}

    sig_to_teams: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    for r in baseline:
        k = r["key"]
        if k and len(k) == 4:
            ini, ln, pos, tm = k
            sig_to_teams[(ini, ln, pos)].add(tm)

    rows: list[dict] = []
    with args.template.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rows.append(row)

    def sort_key(row: dict) -> int:
        s = row.get("sort_index", "").strip()
        return int(s) if s.isdigit() else 10**9

    rows.sort(key=sort_key)
    top = rows[: args.top]

    missing: list[tuple[str, str, str, str]] = []
    for row in top:
        full = row["name"].strip()
        pos = row["position"].strip()
        team_raw = row["team"].strip()
        team = template_team_abbr(row)
        pos_n = norm_pos(pos)

        k = full_to_key(full, pos, team, pos_n)
        if k is None and pos_n != "DST":
            parts = full.split()
            if len(parts) >= 2 and not team:
                initial = parts[0][0].lower()
                last = " ".join(parts[1:])
                ln = norm_last(strip_suffix(last))
                teams = sig_to_teams.get((initial, ln, pos_n), set())
                if len(teams) == 1:
                    tm = next(iter(teams))
                    k = (initial, ln, pos_n, tm)
                elif len(teams) > 1:
                    if any((initial, ln, pos_n, t) in baseline_keys for t in teams):
                        k = next(
                            (initial, ln, pos_n, t)
                            for t in teams
                            if (initial, ln, pos_n, t) in baseline_keys
                        )
            if k is None:
                missing.append((row["sort_index"], full, pos, team_raw))
                continue

        if k is None:
            missing.append((row["sort_index"], full, pos, team_raw))
            continue
        if any(kv in baseline_keys for kv in key_variants(k)):
            continue

        parts = full.split()
        if len(parts) >= 2 and len(k) == 4:
            initial = parts[0][0].lower()
            last = " ".join(parts[1:])
            k2 = (initial, norm_last(strip_suffix(last)), pos_n, k[3])
            if any(kv in baseline_keys for kv in key_variants(k2)):
                continue
        missing.append((row["sort_index"], full, pos, team_raw))

    print("Baseline file:", args.baseline_csv)
    print("Baseline rows parsed:", len(baseline))
    print("Unique match keys:", len(baseline_keys))
    print("Template top:", args.top)
    print("Missing from baseline (count):", len(missing))
    print("---")
    for m in missing:
        print(f"{m[0]}\t{m[1]}\t{m[2]}\t{m[3]}")


if __name__ == "__main__":
    main()
