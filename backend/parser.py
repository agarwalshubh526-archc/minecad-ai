"""
MineCAD AI — Natural Language Parser
Maps user prompts to structured mining geometry parameters.
Supports: Local NLP rules, Ollama, HuggingFace Inference API.
"""

import ipaddress
import re
import json
from urllib.parse import urlparse

import requests
from typing import Dict, Any, Optional, Tuple, List


# ─── Outbound URL Whitelist (SSRF protection) ────────────────────────────────

ALLOWED_PROVIDER_HOSTS = frozenset({
    "api.deepseek.com",
    "api-inference.huggingface.co",
})


def validate_provider_url(base_url: str) -> str:
    """Validate an LLM provider base URL against the host whitelist.

    Allowed hosts: api.deepseek.com, api-inference.huggingface.co, and
    localhost / 127.0.0.1 (any port, for local Ollama). Anything else is
    rejected with ValueError so callers can surface a 400.
    """
    if not base_url or not isinstance(base_url, str):
        raise ValueError("Provider base URL is required")
    parsed = urlparse(base_url if "//" in base_url else f"http://{base_url}")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("Invalid provider base URL")
    if host in ALLOWED_PROVIDER_HOSTS or host == "localhost":
        return base_url
    try:
        if ipaddress.ip_address(host).is_loopback:
            return base_url
    except ValueError:
        pass
    raise ValueError(f"Provider host not allowed: {host}")


# ─── Local Rule-Based NLP Parser ─────────────────────────────────────────────

FT_TO_M = 0.3048

# Optional unit suffix after a number: metres/meters/m/ft/feet/foot, °/degrees, %
# (_LENU / _ANGU / _PCTU are capturing groups so ft→m conversion can see the unit)
_LENU = r"(metres?|meters?|feet|foot|ft|m)?"
_ANGU = r"(°|degrees?)?"
_PCTU = r"(%|percent)?"

# Maps common mining terms (and their synonyms) to generator types
TYPE_PATTERNS = [
    (r"survey|traverse|station|boundary|lease|control\s*loop", "mine_survey_traverse"),
    (r"contour|topo(?:graphy|graphic)?|elevation\s*map|dtm|surface\s*grid", "topographic_contours"),
    (r"borehole|drill\s*hole|drillhole|stratigraphy|coal\s*seam|lithology|core", "borehole_lithology"),
    (r"longwall|shearer|headgate|tailgate|chocks", "longwall_panel"),
    (r"cut\s*(?:and|&)?\s*fill|earthwork|volume|volumetric|stripping\s*ratio", "cut_fill_volume"),
    # "blast" beats the generic open_pit context words (quarry/pit): a prompt
    # like "blast pattern for a quarry" is a blast design, not a pit design.
    (r"blast", "blast_pattern"),
    (r"open\s*(?:pit|cast|cut)|quarry|pit\s*mine|surface\s*mine", "open_pit"),
    (r"room\s*(?:and|&)\s*pillar|bord\s*(?:and|&)\s*pillar", "room_and_pillar"),
    (r"ventilation|vent\s*network|airway|airflow", "ventilation"),
    (r"conveyor|belt\s*system", "conveyor"),
    (r"decline|ramp\s*access|portal|shaft|tunnel", "decline"),
    (r"haul\s*road", "open_pit"),
]

TYPE_LABELS = {
    "open_pit": "open pit",
    "room_and_pillar": "room & pillar mine",
    "ventilation": "ventilation network",
    "conveyor": "conveyor route",
    "blast_pattern": "blast pattern",
    "decline": "decline access",
    "mine_survey_traverse": "survey traverse",
    "topographic_contours": "topographic contours",
    "borehole_lithology": "borehole section",
    "longwall_panel": "longwall panel",
    "cut_fill_volume": "cut & fill section",
}

# Maps parameter names found in prompts to internal keys. Unit-aware: lengths
# accept m/metres/ft (feet are converted to metres), angles accept °/degrees,
# gradients accept %/percent.
PARAM_PATTERNS = [
    (rf"(\d+\.?\d*)\s*{_LENU}\s*bench\s*heights?", "bench_height"),
    (rf"bench\s*heights?\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "bench_height"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*bench\s*widths?", "bench_width"),
    (rf"bench\s*widths?\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "bench_width"),
    (r"(\d+)\s*bench(?:es)?", "num_benches"),
    (r"(?:more|extra|additional)\s+(\d+)\s+bench", "num_benches_add"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*haul\s*road", "haul_road_width"),
    (rf"haul\s*road\s*(?:width\s*)?(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "haul_road_width"),
    (rf"(\d+\.?\d*)\s*{_ANGU}\s*(?:overall\s*)?slope", "overall_slope"),
    (rf"overall\s*slope\s*(?:of\s*)?(\d+\.?\d*)\s*{_ANGU}", "overall_slope"),
    (rf"slope\s*angle\s*(?:of\s*)?(\d+\.?\d*)\s*{_ANGU}", "overall_slope"),
    (rf"(\d+\.?\d*)\s*{_ANGU}\s*batter", "batter_angle"),
    (rf"batter\s*(?:angle\s*)?(?:of\s*)?(\d+\.?\d*)\s*{_ANGU}", "batter_angle"),
    (rf"pit\s*(?:length|long)\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "pit_length"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*(?:pit\s*)?length", "pit_length"),
    (rf"pit\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "pit_width"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*(?:pit\s*)?width", "pit_width"),
    # Generic "N m high/deep" resolved per object type in post-processing
    (rf"(\d+\.?\d*)\s*{_LENU}\s*high\b", "_high"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*deep\b", "_deep"),
    # Room and pillar
    (rf"room\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "room_width"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*room\s*width", "room_width"),
    (rf"pillar\s*(?:width|size)\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "pillar_width"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*pillar", "pillar_width"),
    (r"(\d+)\s*rooms?\s*(?:x|by|×)", "num_rooms_x"),
    (r"(?:x|by|×)\s*(\d+)\s*rooms?", "num_rooms_y"),
    (r"(\d+)\s*rooms?", "num_rooms"),
    # Conveyor
    (rf"conveyor\s*(?:length\s*)?(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "length"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*(?:long\s*)?conveyor", "length"),
    (rf"belt\s*(?:width\s*)?(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "width"),
    (rf"inclin(?:ation|e)\s*(?:of\s*)?(\d+\.?\d*)\s*{_ANGU}", "inclination"),
    (rf"(\d+\.?\d*)\s*{_ANGU}\s*incline", "inclination"),
    # Blast
    (rf"burden\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "burden"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*burden", "burden"),
    (rf"spacing\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "spacing"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*spacing", "spacing"),
    (rf"hole\s*depth\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "hole_depth"),
    (rf"(\d+\.?\d*)\s*{_LENU}\s*hole", "hole_diameter"),
    (rf"hole\s*diam(?:eter)?\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "hole_diameter"),
    (r"(\d+)\s*rows?", "num_rows"),
    (r"(\d+)\s*holes?\s*per\s*row", "num_holes_per_row"),
    # Decline
    (rf"gradient\s*(?:of\s*)?(\d+\.?\d*)\s*{_PCTU}", "gradient"),
    (rf"(\d+\.?\d*)\s*{_PCTU}\s*gradient", "gradient"),
    (r"(\d+)\s*levels?", "num_levels"),
    (rf"level\s*spacing\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "level_spacing"),
    # Ventilation / longwall / contours / boreholes / traverse
    (r"(\d+)\s*airways?", "num_airways"),
    (rf"airway\s*length\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "airway_length"),
    (rf"shaft\s*diam(?:eter)?\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "shaft_diameter"),
    (r"(\d+)\s*stations?", "num_stations"),
    (r"(\d+)\s*boreholes?", "num_boreholes"),
    (rf"contour\s*interval\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "contour_interval"),
    (rf"face\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "face_width"),
    (rf"panel\s*length\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "panel_length"),
    (r"(\d+)\s*supports?", "num_supports"),
    (rf"seam\s*(?:height|thickness)\s*(?:of\s*)?(\d+\.?\d*)\s*{_LENU}", "seam_height"),
    (rf"coal\s*seam\s*(?:at\s*)?(\d+\.?\d*)\s*{_LENU}\s*deep", "coal_seam_depth"),
    (r"seam\s*dip\s*(?:of\s*)?(\d+\.?\d*)", "dip_angle"),
]

INT_PARAMS = {"num_benches", "num_rooms_x", "num_rooms_y", "num_rooms", "num_rows",
              "num_holes_per_row", "num_levels", "num_airways", "num_stations",
              "num_boreholes", "num_supports"}

# Secondary-clause split: "create an open pit ... and add a haul road" /
# "... then include a ventilation shaft" / "... with a sump" (article + noun).
SECONDARY_SPLIT_RE = re.compile(
    r"\s+(?:and|then|plus)\s+(?:add|include|attach)\s+|\s+with\s+a(?:n)?\s+(?!\d)", re.I)

# Secondary features we recognise. Applied features set a param when one maps;
# the rest are surfaced as notes so the user knows they were heard.
SECONDARY_FEATURES = [
    (r"haul\s*road", "haul_road", "haul road (included in the pit design)"),
    (r"vent|airway|fan", "ventilation", "ventilation shaft/raise (noted — model it with the ventilation tool)"),
    (r"decline|ramp|portal|tunnel", "decline", "decline/ramp access (noted — use the decline generator)"),
    (r"berm", "berm", "berms (included in the bench design)"),
    (r"drain|sump|pump", "drainage", "drainage/sump (noted, not modelled)"),
    (r"stockpile|dump|heap", "stockpile", "waste dump/stockpile (noted, not modelled)"),
    (r"crusher|screen|plant|mill|washer", "plant", "processing plant (noted, not modelled)"),
    (r"fence|gate|road\s*around|perimeter", "perimeter", "perimeter road/fence (noted, not modelled)"),
]


def _unit_to_m(value: float, unit: Optional[str], notes: List[str], param_key: str) -> float:
    """Convert a parsed length to metres, noting imperial conversions."""
    if unit and unit.lower() in ("ft", "feet", "foot"):
        converted = round(value * FT_TO_M, 2)
        notes.append(f"{value:g} ft → {converted:g} m ({param_key.lstrip('_').replace('_', ' ')})")
        return converted
    return value


def _detect_type(text: str) -> Optional[str]:
    for pattern, otype in TYPE_PATTERNS:
        if re.search(pattern, text):
            return otype
    return None


def _split_secondary(text: str) -> Tuple[str, str]:
    """Split a multi-step prompt into primary + secondary clause (if any)."""
    m = SECONDARY_SPLIT_RE.search(text)
    if m:
        return text[: m.start()], text[m.end():]
    return text, ""


def _parse_secondary(secondary: str, object_type: str, params: Dict[str, Any],
                     notes: List[str]) -> List[str]:
    """Recognise secondary features; apply those that map to a param."""
    applied = []
    for pattern, key, note in SECONDARY_FEATURES:
        if re.search(pattern, secondary):
            # Only note a feature once
            if note not in notes:
                notes.append(note)
            applied.append(key)
    return applied


def _resolve_generic_measure(params: Dict[str, Any], object_type: str,
                             notes: List[str]) -> None:
    """Map generic 'N m high/deep' captures onto the type's depth driver."""
    high = params.pop("_high", None)
    deep = params.pop("_deep", None)
    if high is not None and object_type == "open_pit":
        params["bench_height"] = high
    if deep is None:
        return
    if object_type == "open_pit":
        bench_h = params.get("bench_height", 10) or 10
        params["num_benches"] = max(1, int(round(deep / bench_h)))
        notes.append(f"{deep:g} m deep ≈ {params['num_benches']} benches of {bench_h:g} m")
    elif object_type == "cut_fill_volume":
        params["pit_depth"] = deep
    elif object_type == "borehole_lithology":
        params["depth"] = deep
    elif object_type == "decline":
        gradient = params.get("gradient", 10) or 10
        params["total_length"] = int(round(deep / (gradient / 100.0)))
        notes.append(f"{deep:g} m deep ≈ {params['total_length']} m decline at {gradient:g}%")
    else:
        params["depth"] = deep


def build_interpretation(object_type: str, params: Dict[str, Any],
                         notes: Optional[List[str]] = None) -> str:
    """Human-readable summary of what the parser understood."""
    p = params
    label = TYPE_LABELS.get(object_type, object_type.replace("_", " "))
    parts: List[str] = []

    if object_type == "open_pit":
        if "num_benches" in p or "bench_height" in p:
            nb = int(p.get("num_benches", 5))
            plural = "bench" if nb == 1 else "benches"
            parts.append(f"{nb} {plural} × {p.get('bench_height', 10):g} m")
        if "batter_angle" in p:
            parts.append(f"batter {p['batter_angle']:g}°")
        if "overall_slope" in p:
            parts.append(f"overall slope {p['overall_slope']:g}°")
        if "haul_road_width" in p:
            parts.append(f"haul road {p['haul_road_width']:g} m")
        if "pit_length" in p or "pit_width" in p:
            parts.append(f"{p.get('pit_length', '—'):g} × {p.get('pit_width', '—'):g} m")
    elif object_type == "room_and_pillar":
        if "room_width" in p or "pillar_width" in p:
            parts.append(f"rooms {p.get('room_width', 6):g} m, pillars {p.get('pillar_width', 8):g} m")
        if "num_rooms_x" in p or "num_rooms_y" in p:
            parts.append(f"{int(p.get('num_rooms_x', 5))} × {int(p.get('num_rooms_y', 4))} rooms")
    elif object_type == "blast_pattern":
        if "burden" in p or "spacing" in p:
            parts.append(f"burden {p.get('burden', 4):g} m, spacing {p.get('spacing', 5):g} m")
        if "num_rows" in p or "num_holes_per_row" in p:
            parts.append(f"{int(p.get('num_rows', 4))} rows × {int(p.get('num_holes_per_row', 8))} holes")
    elif object_type == "decline":
        if "gradient" in p:
            parts.append(f"gradient {p['gradient']:g}% (1 : {100 / p['gradient']:g})" if p["gradient"] else "gradient 0%")
        if "num_levels" in p:
            parts.append(f"{int(p['num_levels'])} levels")
    else:
        shown = 0
        for k, v in p.items():
            if k.startswith("_") or k == "name":
                continue
            if isinstance(v, (int, float)) and shown < 4:
                parts.append(f"{k.replace('_', ' ')} {v:g}")
                shown += 1

    base = f"{label} — {', '.join(parts)}" if parts else f"{label} (defaults)"
    if notes:
        base += "  ·  " + "; ".join(notes)
    return base


def parse_prompt_local(prompt: str) -> Dict[str, Any]:
    """
    Parse a natural language mining prompt into structured parameters using
    local regex-based rules. Returns object_type, params, plus v2 extras:
    features (applied secondary features), notes (unit conversions, carried
    features) and interpretation (human-readable summary for the UI).
    """
    text = prompt.lower().strip()
    notes: List[str] = []

    # 1) Split multi-step prompts; type comes from the primary clause
    primary, secondary = _split_secondary(text)
    object_type = _detect_type(primary) or _detect_type(text) or "open_pit"

    # 2) Extract parameters (patterns run over the whole text so secondary
    #    clause numbers like "and add a 25 m haul road" still apply)
    params: Dict[str, Any] = {}
    for pattern, param_key in PARAM_PATTERNS:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            value = float(groups[0])
            unit = groups[1] if len(groups) > 1 and groups[1] else None
            if param_key in INT_PARAMS:
                value = int(value)
            elif param_key != "pattern":
                value = _unit_to_m(value, unit, notes, param_key)
            params[param_key] = value

    # "more N benches" on top of an explicit count would double-count; treat
    # the explicit count as the total instead.
    add_benches = params.pop("num_benches_add", None)
    if add_benches is not None and "num_benches" not in params:
        params["num_benches"] = add_benches

    # 3) Resolve generic high/deep captures per object type
    _resolve_generic_measure(params, object_type, notes)

    # 4) Secondary features
    features = _parse_secondary(secondary, object_type, params, notes) if secondary else []

    return {
        "object_type": object_type,
        "params": params,
        "features": features,
        "notes": notes,
        "interpretation": build_interpretation(object_type, params, notes),
    }


# Edit command patterns (for modifying existing designs)
EDIT_PATTERNS = [
    (r"(?:increase|raise|grow)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing|room\s*width|pillar\s*width)\s*(to|by)?\s*(\d+\.?\d*)", "increase"),
    (r"(?:decrease|reduce|lower|shrink)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing|room\s*width|pillar\s*width)\s*(to|by)?\s*(\d+\.?\d*)", "decrease"),
    (r"(?:set|change|make)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing)\s*(to|=)?\s*(\d+\.?\d*)", "set"),
    (r"add\s+(?:another|a|one|more)\s+(bench|level|row|airway|room)", "add"),
    (r"remove\s+(?:a|one|last)\s+(bench|level|row|airway|room)", "remove"),
]

FIELD_MAP = {
    "bench height": "bench_height",
    "bench width": "bench_width",
    "haul road width": "haul_road_width",
    "haul road": "haul_road_width",
    "slope": "overall_slope",
    "slope angle": "overall_slope",
    "burden": "burden",
    "spacing": "spacing",
    "room width": "room_width",
    "pillar width": "pillar_width",
}

ADD_FIELD_MAP = {
    "bench": "num_benches",
    "level": "num_levels",
    "row": "num_rows",
    "airway": "num_airways",
    "room": "num_rooms_x",
}

# Relative adjectives scale an existing parameter by a factor (or a fixed step
# for angles / counts). Maps regex → (param selector, mode, magnitude).
def _relative_edit(text: str, props: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Handle adjectives without numbers: deeper/wider/steeper/bigger/more benches."""
    obj_type = props.get("_object_type", "open_pit")
    updated = dict(props)
    changed = False

    def scale(param: str, factor: float, lo: float = 0.1, hi: float = 100000) -> None:
        nonlocal changed
        cur = updated.get(param)
        if isinstance(cur, (int, float)) and not isinstance(cur, bool):
            updated[param] = round(min(hi, max(lo, cur * factor)), 2)
            changed = True

    def step(param: str, delta: float, lo: float, hi: float) -> None:
        nonlocal changed
        cur = updated.get(param)
        if isinstance(cur, (int, float)) and not isinstance(cur, bool):
            updated[param] = round(min(hi, max(lo, cur + delta)), 2)
            changed = True

    # Depth drivers per type ("deeper"/"shallower")
    if re.search(r"\bdeeper\b", text):
        if obj_type == "open_pit":
            step("num_benches", max(1, round((updated.get("num_benches", 5) or 5) * 0.25)), 1, 500)
        else:
            for cand in ("pit_depth", "depth", "total_length"):
                if cand in updated:
                    scale(cand, 1.25)
                    break
        changed = changed or "num_benches" in updated
    if re.search(r"\bshallower\b", text):
        if obj_type == "open_pit":
            step("num_benches", -max(1, round((updated.get("num_benches", 5) or 5) * 0.2)), 1, 500)
        else:
            for cand in ("pit_depth", "depth", "total_length"):
                if cand in updated:
                    scale(cand, 0.8)
                    break

    # Width / size
    if re.search(r"\bwider\b", text):
        for cand in ("pit_width", "width", "surface_width"):
            if cand in updated:
                scale(cand, 1.25)
                break
    if re.search(r"\bnarrower\b", text):
        for cand in ("pit_width", "width", "surface_width"):
            if cand in updated:
                scale(cand, 0.8)
                break
    if re.search(r"\bbigger\b", text):
        scale("pit_length", 1.25)
        scale("pit_width", 1.25)
        if not ("pit_length" in props or "pit_width" in props):
            scale("length", 1.25)
    if re.search(r"\bsmaller\b", text):
        scale("pit_length", 0.8)
        scale("pit_width", 0.8)
        if not ("pit_length" in props or "pit_width" in props):
            scale("length", 0.8)

    # Steepness: batter angle is measured from vertical → larger = steeper
    if re.search(r"\bsteeper\b", text):
        step("batter_angle", 5, 45, 87)
        step("overall_slope", 3, 20, 65)
    if re.search(r"\b(?:gentler|flatter)\b", text):
        step("batter_angle", -5, 45, 87)
        step("overall_slope", -3, 20, 65)

    # More/fewer countable structures (±2)
    more_m = re.search(r"more\s+(benches|levels|rows|airways|rooms)", text)
    fewer_m = re.search(r"(?:fewer|less)\s+(benches|levels|rows|airways|rooms)", text)
    if more_m or fewer_m:
        m = more_m or fewer_m
        item = m.group(1)
        singular = item[:-2] if item == "benches" else item[:-1]
        param_key = ADD_FIELD_MAP.get(singular)
        if param_key and param_key in updated:
            delta = 2 if more_m else -2
            updated[param_key] = max(1, int(updated[param_key]) + delta)
            changed = True

    return updated if changed else None


def parse_edit_command(prompt: str, current_properties: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse an edit command that modifies existing design parameters.
    Returns updated params or None if not an edit command.
    Handles: increase/decrease/set X to|by N, add/remove item, and relative
    adjectives without numbers (deeper, wider, steeper, bigger, more benches…).
    """
    text = prompt.lower().strip()

    # Relative adjectives first (they contain no numbers for EDIT_PATTERNS)
    relative = _relative_edit(text, current_properties)
    if relative is not None:
        return relative

    for pattern, action in EDIT_PATTERNS:
        match = re.search(pattern, text)
        if match:
            if action in ("increase", "decrease", "set"):
                field_name = match.group(1).strip()
                prep = (match.group(2) or "").strip()
                value = float(match.group(3))
                param_key = FIELD_MAP.get(field_name)
                if param_key:
                    current = current_properties.get(param_key)
                    # "increase X by N" → current + N; "decrease X by N" → current − N.
                    # "set/increase/decrease X to N" → N.
                    # When no current value is available, "by" behaves like "to".
                    if prep == "by" and isinstance(current, (int, float)) and not isinstance(current, bool):
                        new_val = current + value if action == "increase" else current - value
                    else:
                        new_val = value
                    updated = dict(current_properties)
                    updated[param_key] = new_val
                    return updated

            elif action == "add":
                item = match.group(1).strip()
                param_key = ADD_FIELD_MAP.get(item)
                if param_key and param_key in current_properties:
                    updated = dict(current_properties)
                    updated[param_key] = current_properties[param_key] + 1
                    return updated

            elif action == "remove":
                item = match.group(1).strip()
                param_key = ADD_FIELD_MAP.get(item)
                if param_key and param_key in current_properties:
                    updated = dict(current_properties)
                    updated[param_key] = max(1, current_properties[param_key] - 1)
                    return updated

    return None


# ─── LLM-Based Parser (Ollama / HuggingFace) ─────────────────────────────────

SYSTEM_PROMPT = """You are a mining engineering CAD and surveying assistant. Parse the user's natural language prompt into a JSON object describing a mining engineering design or surveying map.

Return ONLY valid JSON with these fields:
- "object_type": one of "open_pit", "room_and_pillar", "ventilation", "conveyor", "blast_pattern", "decline", "mine_survey_traverse", "topographic_contours", "borehole_lithology", "longwall_panel", "cut_fill_volume"
- "params": an object with relevant parameters

Parameter keys by type:
- open_pit: bench_height, bench_width, num_benches, pit_length, pit_width, haul_road_width, overall_slope, batter_angle
- room_and_pillar: room_width, pillar_width, num_rooms_x, num_rooms_y, room_height, entry_width
- ventilation: num_airways, airway_length, shaft_diameter, fan_power
- conveyor: length, width, inclination, start_x, start_y, end_x, end_y, belt_speed
- blast_pattern: burden, spacing, num_rows, num_holes_per_row, hole_diameter, hole_depth, pattern
- decline: width, height, gradient, total_length, num_levels, level_spacing
- mine_survey_traverse: num_stations, starting_easting, starting_northing, starting_elevation, avg_segment_len
- topographic_contours: contour_interval, grid_size_x, grid_size_y, min_elevation, max_elevation
- borehole_lithology: num_boreholes, spacing, depth, coal_seam_thickness, coal_seam_depth, dip_angle
- longwall_panel: face_width, panel_length, seam_height, num_supports, shearer_position
- cut_fill_volume: pit_depth, surface_width, bottom_width, original_ground_slope, rock_density

Only include parameters explicitly mentioned. Use metric units (meters, degrees).
Return ONLY JSON, no explanation."""


def parse_with_ollama(prompt: str, model: str = "llama3.1", base_url: str = "http://localhost:11434") -> Optional[Dict[str, Any]]:
    """Parse prompt using a local Ollama model."""
    base_url = validate_provider_url(base_url)
    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": f"{SYSTEM_PROMPT}\n\nUser prompt: {prompt}",
                "stream": False,
                "format": "json",
            },
            timeout=30,
        )
        if response.status_code == 200:
            result = response.json()
            text = result.get("response", "")
            # Extract JSON from response
            return _extract_json(text)
    except Exception as e:
        print(f"Ollama error: {e}")
    return None


def parse_with_huggingface(prompt: str, model: str = "Qwen/Qwen2.5-Coder-32B-Instruct", api_key: str = "") -> Optional[Dict[str, Any]]:
    """Parse prompt using HuggingFace Inference API."""
    try:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        response = requests.post(
            f"https://api-inference.huggingface.co/models/{model}",
            headers=headers,
            json={
                "inputs": f"<|system|>{SYSTEM_PROMPT}<|end|><|user|>{prompt}<|end|><|assistant|>",
                "parameters": {"max_new_tokens": 500, "return_full_text": False}
            },
            timeout=30,
        )
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                text = result[0].get("generated_text", "")
                return _extract_json(text)
    except Exception as e:
        print(f"HuggingFace error: {e}")
    return None


def parse_with_deepseek(
    prompt: str,
    model: str = "deepseek-chat",
    api_key: str = "",
    base_url: str = "https://api.deepseek.com",
) -> Optional[Dict[str, Any]]:
    """Parse prompt using DeepSeek API (deepseek-chat, deepseek-coder, deepseek-reasoner)."""
    url = validate_provider_url(base_url).rstrip("/")
    try:
        if not url.endswith("/chat/completions"):
            if not url.endswith("/v1"):
                url = f"{url}/chat/completions"
            else:
                url = f"{url}/chat/completions"

        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model or "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        response = requests.post(url, headers=headers, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            choices = result.get("choices", [])
            if choices and len(choices) > 0:
                content = choices[0].get("message", {}).get("content", "")
                return _extract_json(content)
        else:
            print(f"DeepSeek API error: HTTP {response.status_code} (response body omitted)")
    except Exception as e:
        print(f"DeepSeek API exception: {e}")
    return None


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON object from LLM response text."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to find JSON block
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


# ─── Unified Parse Function ──────────────────────────────────────────────────

def parse_prompt(
    prompt: str,
    ai_provider: str = "local",
    ai_model: str = "",
    ai_base_url: str = "http://localhost:11434",
    ai_api_key: str = "",
    current_properties: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Main entry: parse a user prompt into structured geometry parameters.
    
    ai_provider: "local" | "ollama" | "huggingface" | "deepseek"
    """
    # Check for edit commands first
    if current_properties:
        edit_result = parse_edit_command(prompt, current_properties)
        if edit_result is not None:
            obj_type = current_properties.get("_object_type", "open_pit")
            return {
                "object_type": obj_type,
                "params": edit_result,
                "method": "edit",
                "features": [],
                "notes": [],
                "interpretation": "edit applied — " + build_interpretation(obj_type, edit_result),
            }

    result = None

    # Try LLM providers
    if ai_provider == "ollama":
        result = parse_with_ollama(prompt, model=ai_model or "llama3.1", base_url=ai_base_url)
    elif ai_provider == "huggingface":
        result = parse_with_huggingface(prompt, model=ai_model or "Qwen/Qwen2.5-Coder-32B-Instruct", api_key=ai_api_key)
    elif ai_provider == "deepseek":
        ds_base_url = ai_base_url if (ai_base_url and "localhost:11434" not in ai_base_url) else "https://api.deepseek.com"
        result = parse_with_deepseek(
            prompt,
            model=ai_model or "deepseek-chat",
            api_key=ai_api_key,
            base_url=ds_base_url,
        )

    # Fallback to local NLP
    if not result:
        result = parse_prompt_local(prompt)
        result["method"] = "local"
    else:
        result["method"] = ai_provider

    return result

