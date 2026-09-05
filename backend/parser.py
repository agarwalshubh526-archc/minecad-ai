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
from typing import Dict, Any, Optional, Tuple


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

# Maps common mining terms to generator types
TYPE_PATTERNS = [
    (r"survey|traverse|station|boundary|lease|control\s*loop", "mine_survey_traverse"),
    (r"contour|topography|topographic|elevation\s*map|dtm|surface\s*grid", "topographic_contours"),
    (r"borehole|drillhole|stratigraphy|coal\s*seam|lithology|core", "borehole_lithology"),
    (r"longwall|shearer|headgate|tailgate|chocks", "longwall_panel"),
    (r"cut\s*and\s*fill|cut\s*fill|volume|volumetric|earthwork|stripping\s*ratio", "cut_fill_volume"),
    (r"open\s*pit|pit\s*mine|surface\s*mine", "open_pit"),
    (r"room\s*and\s*pillar|room\s*&\s*pillar|bord\s*and\s*pillar", "room_and_pillar"),
    (r"ventilation|vent\s*network|airway", "ventilation"),
    (r"conveyor|belt\s*system", "conveyor"),
    (r"blast\s*(pattern|layout|design|hole)", "blast_pattern"),
    (r"decline|ramp\s*access|portal|shaft", "decline"),
    (r"haul\s*road", "open_pit"),
]

# Maps parameter names found in prompts to internal keys
PARAM_PATTERNS = [
    (r"(\d+\.?\d*)\s*m?\s*bench\s*height", "bench_height"),
    (r"bench\s*height\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "bench_height"),
    (r"(\d+\.?\d*)\s*m?\s*bench\s*width", "bench_width"),
    (r"bench\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "bench_width"),
    (r"(\d+)\s*bench(?:es)?", "num_benches"),
    (r"(\d+\.?\d*)\s*m?\s*haul\s*road", "haul_road_width"),
    (r"haul\s*road\s*(?:width\s*)?(?:of\s*)?(\d+\.?\d*)\s*m?", "haul_road_width"),
    (r"(\d+\.?\d*)°?\s*(?:overall\s*)?slope", "overall_slope"),
    (r"overall\s*slope\s*(?:of\s*)?(\d+\.?\d*)°?", "overall_slope"),
    (r"slope\s*angle\s*(?:of\s*)?(\d+\.?\d*)°?", "overall_slope"),
    (r"(\d+\.?\d*)°?\s*batter", "batter_angle"),
    (r"pit\s*(?:length|long)\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "pit_length"),
    (r"(\d+\.?\d*)\s*m?\s*(?:pit\s*)?length", "pit_length"),
    (r"pit\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "pit_width"),
    (r"(\d+\.?\d*)\s*m?\s*(?:pit\s*)?width", "pit_width"),
    (r"depth\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "pit_depth"),
    (r"(\d+\.?\d*)\s*m?\s*depth", "pit_depth"),
    # Room and pillar
    (r"room\s*width\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "room_width"),
    (r"(\d+\.?\d*)\s*m?\s*room\s*width", "room_width"),
    (r"pillar\s*(?:width|size)\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "pillar_width"),
    (r"(\d+\.?\d*)\s*m?\s*pillar", "pillar_width"),
    (r"(\d+)\s*rooms?\s*(?:x|by|×)", "num_rooms_x"),
    (r"(?:x|by|×)\s*(\d+)\s*rooms?", "num_rooms_y"),
    # Conveyor
    (r"conveyor\s*(?:length\s*)?(?:of\s*)?(\d+\.?\d*)\s*m?", "length"),
    (r"(\d+\.?\d*)\s*m?\s*(?:long\s*)?conveyor", "length"),
    (r"belt\s*(?:width\s*)?(?:of\s*)?(\d+\.?\d*)\s*m?", "width"),
    (r"inclin(?:ation|e)\s*(?:of\s*)?(\d+\.?\d*)°?", "inclination"),
    # Blast
    (r"burden\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "burden"),
    (r"(\d+\.?\d*)\s*m?\s*burden", "burden"),
    (r"spacing\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "spacing"),
    (r"(\d+\.?\d*)\s*m?\s*spacing", "spacing"),
    (r"hole\s*depth\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "hole_depth"),
    (r"(\d+)\s*rows?", "num_rows"),
    (r"(\d+)\s*holes?\s*per\s*row", "num_holes_per_row"),
    # Decline
    (r"gradient\s*(?:of\s*)?(\d+\.?\d*)\s*%?", "gradient"),
    (r"(\d+)\s*levels?", "num_levels"),
    (r"level\s*spacing\s*(?:of\s*)?(\d+\.?\d*)\s*m?", "level_spacing"),
]

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


def parse_prompt_local(prompt: str) -> Dict[str, Any]:
    """
    Parse a natural language mining prompt into structured parameters using
    local regex-based rules. Returns object_type and params dict.
    """
    text = prompt.lower().strip()

    # 1) Detect object type
    object_type = None
    for pattern, otype in TYPE_PATTERNS:
        if re.search(pattern, text):
            object_type = otype
            break

    # Default to open_pit if no match
    if not object_type:
        object_type = "open_pit"

    # 2) Extract parameters
    params = {}
    for pattern, param_key in PARAM_PATTERNS:
        match = re.search(pattern, text)
        if match:
            value = float(match.group(1))
            if param_key in ("num_benches", "num_rooms_x", "num_rooms_y", "num_rows", "num_holes_per_row", "num_levels", "num_airways"):
                value = int(value)
            params[param_key] = value

    return {"object_type": object_type, "params": params}


def parse_edit_command(prompt: str, current_properties: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse an edit command that modifies existing design parameters.
    Returns updated params or None if not an edit command.
    """
    text = prompt.lower().strip()

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
            return {"object_type": obj_type, "params": edit_result, "method": "edit"}

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

