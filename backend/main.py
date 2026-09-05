"""
MineCAD AI — FastAPI Backend Server
Provides REST API for AI-powered mining CAD generation and file export.
"""

import os
import json
import logging
import tempfile
from typing import Dict, Any, Optional, List

import requests
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from parser import parse_prompt, validate_provider_url
from geometry import generate_geometry, GENERATORS
from exporter import export_dxf, export_svg, export_pdf, export_obj, export_stl

logger = logging.getLogger("minecad")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="MineCAD AI",
    description="AI-Powered CAD Generator for Mining Engineering",
    version="1.0.0",
)

# Parse allowed origins from env — supports comma-separated list
# e.g. ALLOWED_ORIGINS="https://minecad.vercel.app,https://www.minecad.ai"
# Unset/empty means same-origin only (no cross-origin CORS headers).
# Credentials are only enabled when origins are explicitly listed.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _raw_origins == "*":
    _allow_origins = ["*"]
    _allow_credentials = False
elif _raw_origins:
    _allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = bool(_allow_origins)
else:
    _allow_origins = []
    _allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Natural language mining engineering prompt")
    ai_provider: str = Field("local", description="AI provider: local, ollama, huggingface, deepseek")
    ai_model: str = Field("", description="Model name for the provider")
    ai_base_url: str = Field("http://localhost:11434", description="Base URL for provider")
    ai_api_key: str = Field("", description="API key for provider")
    current_properties: Optional[Dict[str, Any]] = Field(None, description="Current design properties for edit commands")


class DeepSeekChatRequest(BaseModel):
    prompt: str = Field(..., description="User prompt or query for DeepSeek AI terminal")
    model: str = Field("deepseek-chat", description="DeepSeek model name")
    api_key: str = Field("", description="DeepSeek API key")
    base_url: str = Field("https://api.deepseek.com", description="DeepSeek API Base URL")


class DeepSeekChatResponse(BaseModel):
    success: bool
    response: str = ""
    error: str = ""


class DirectGenerateRequest(BaseModel):
    object_type: str = Field(..., description="Type of mining object to generate")
    params: Dict[str, Any] = Field(default_factory=dict, description="Parameters for the object")


class ExportRequest(BaseModel):
    format: str = Field(..., description="Export format: dxf, svg, pdf, obj, stl")
    geometry_data: Dict[str, Any] = Field(..., description="Geometry data to export")


class GenerateResponse(BaseModel):
    success: bool
    object_type: str = ""
    params: Dict[str, Any] = {}
    geometry: Dict[str, Any] = {}
    parse_method: str = ""
    error: str = ""



# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "MineCAD AI", "version": "1.0.0"}


@app.get("/api/generators")
def list_generators():
    """List available geometry generators and their default parameters."""
    defaults = {
        "open_pit": {
            "bench_height": 10, "bench_width": 8, "num_benches": 5,
            "pit_length": 300, "pit_width": 200, "haul_road_width": 22,
            "overall_slope": 55, "batter_angle": 75
        },
        "room_and_pillar": {
            "room_width": 6, "pillar_width": 8, "num_rooms_x": 5,
            "num_rooms_y": 4, "room_height": 3, "entry_width": 5
        },
        "ventilation": {
            "num_airways": 6, "airway_length": 100,
            "shaft_diameter": 6, "fan_power": 200
        },
        "conveyor": {
            "length": 200, "width": 1.2, "inclination": 15,
            "start_x": 0, "start_y": 0, "end_x": 200, "end_y": 0,
            "belt_speed": 3.5
        },
        "blast_pattern": {
            "burden": 4, "spacing": 5, "num_rows": 4,
            "num_holes_per_row": 8, "hole_diameter": 0.2,
            "hole_depth": 12, "pattern": "staggered"
        },
        "decline": {
            "width": 5, "height": 4.5, "gradient": 10,
            "total_length": 500, "num_levels": 4, "level_spacing": 30
        },
    }
    return {"generators": list(GENERATORS.keys()), "defaults": defaults}


@app.post("/api/generate", response_model=GenerateResponse)
def generate_from_prompt(req: GenerateRequest):
    """Parse an NLP prompt and generate CAD geometry."""
    try:
        # Parse the prompt
        parsed = parse_prompt(
            prompt=req.prompt,
            ai_provider=req.ai_provider,
            ai_model=req.ai_model,
            ai_base_url=req.ai_base_url,
            ai_api_key=req.ai_api_key,
            current_properties=req.current_properties,
        )

        object_type = parsed.get("object_type", "open_pit")
        params = parsed.get("params", {})
        method = parsed.get("method", "local")

        # Generate geometry
        geometry = generate_geometry(object_type, params)

        # Attach internal metadata
        geometry["properties"]["_object_type"] = object_type

        return GenerateResponse(
            success=True,
            object_type=object_type,
            params=params,
            geometry=geometry,
            parse_method=method,
        )

    except ValueError as e:
        # Bad input: unknown object type, rejected provider URL, degenerate params
        logger.warning("/api/generate rejected: %s", e)
        return JSONResponse(status_code=400,
                            content=GenerateResponse(success=False, error=str(e)).model_dump())
    except requests.RequestException as e:
        logger.error("/api/generate LLM provider request failed: %s", e)
        return JSONResponse(status_code=502,
                            content=GenerateResponse(success=False, error="LLM provider request failed").model_dump())
    except Exception:
        logger.exception("/api/generate unexpected error")
        return JSONResponse(status_code=500,
                            content=GenerateResponse(success=False, error="Internal server error").model_dump())


@app.post("/api/generate-direct", response_model=GenerateResponse)
def generate_direct(req: DirectGenerateRequest):
    """Generate geometry from explicit type and parameters (no AI parsing)."""
    try:
        geometry = generate_geometry(req.object_type, req.params)
        geometry["properties"]["_object_type"] = req.object_type
        return GenerateResponse(
            success=True,
            object_type=req.object_type,
            params=req.params,
            geometry=geometry,
            parse_method="direct",
        )
    except ValueError as e:
        # Bad input: unknown object type or invalid/degenerate params
        logger.warning("/api/generate-direct rejected: %s", e)
        return JSONResponse(status_code=400,
                            content=GenerateResponse(success=False, error=str(e)).model_dump())
    except Exception:
        logger.exception("/api/generate-direct unexpected error")
        return JSONResponse(status_code=500,
                            content=GenerateResponse(success=False, error="Internal server error").model_dump())


@app.post("/api/export")
def export_file(req: ExportRequest):
    """Export geometry data to various CAD file formats."""
    fmt = req.format.lower()

    try:
        if fmt == "dxf":
            data = export_dxf(req.geometry_data)
            return Response(content=data, media_type="application/octet-stream",
                          headers={"Content-Disposition": "attachment; filename=minecad_export.dxf"})

        elif fmt == "svg":
            data = export_svg(req.geometry_data)
            return Response(content=data, media_type="image/svg+xml",
                          headers={"Content-Disposition": "attachment; filename=minecad_export.svg"})

        elif fmt == "pdf":
            data = export_pdf(req.geometry_data)
            return Response(content=data, media_type="application/pdf",
                          headers={"Content-Disposition": "attachment; filename=minecad_export.pdf"})

        elif fmt == "obj":
            data = export_obj(req.geometry_data)
            return Response(content=data, media_type="text/plain",
                          headers={"Content-Disposition": "attachment; filename=minecad_export.obj"})

        elif fmt == "stl":
            data = export_stl(req.geometry_data)
            return Response(content=data, media_type="application/octet-stream",
                          headers={"Content-Disposition": "attachment; filename=minecad_export.stl"})

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

    except HTTPException:
        raise
    except Exception:
        logger.exception("/api/export failed")
        raise HTTPException(status_code=500, detail="Export failed")


@app.post("/api/deepseek/chat", response_model=DeepSeekChatResponse)
def deepseek_chat(req: DeepSeekChatRequest):
    """Direct terminal chat query with DeepSeek AI."""
    try:
        base_url = validate_provider_url(req.base_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        url = base_url.rstrip("/")
        if not url.endswith("/chat/completions"):
            url = f"{url}/chat/completions"

        headers = {"Content-Type": "application/json"}
        if req.api_key:
            headers["Authorization"] = f"Bearer {req.api_key}"

        payload = {
            "model": req.model or "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are DeepSeek AI integrated into MineCAD AI Terminal Console. "
                        "Assist mining engineers with CLI terminal commands, CAD design parameters, mining methods, and geometric calculations. "
                        "Keep responses concise, clear, and actionable for terminal output."
                    ),
                },
                {"role": "user", "content": req.prompt},
            ],
            "temperature": 0.3,
        }

        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            data = res.json()
            choices = data.get("choices", [])
            if choices and len(choices) > 0:
                txt = choices[0].get("message", {}).get("content", "")
                return DeepSeekChatResponse(success=True, response=txt)
        logger.warning("DeepSeek chat API returned HTTP %s", res.status_code)
        return JSONResponse(status_code=502,
                            content=DeepSeekChatResponse(success=False, error="DeepSeek API request failed").model_dump())
    except requests.RequestException as e:
        logger.error("DeepSeek chat request failed: %s", e)
        return JSONResponse(status_code=502,
                            content=DeepSeekChatResponse(success=False, error="DeepSeek API request failed").model_dump())
    except Exception:
        logger.exception("DeepSeek chat unexpected error")
        return JSONResponse(status_code=500,
                            content=DeepSeekChatResponse(success=False, error="Internal server error").model_dump())


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
