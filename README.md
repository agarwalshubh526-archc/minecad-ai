# MineCAD AI

MineCAD AI is an AI-assisted CAD web app for mining engineering: describe a design in natural language ("open pit with 12m benches, 6 levels") and get interactive 2D/3D CAD geometry — open pits, room-and-pillar layouts, ventilation networks, conveyors, blast patterns, declines, survey traverses, topo contours, borehole sections, longwall panels, and cut-and-fill volumes — exportable as DXF, SVG, PDF, OBJ, or STL.

## Architecture

- **`backend/`** — Python FastAPI service. Parses prompts with local regex NLP rules or an LLM provider (Ollama, HuggingFace, DeepSeek — API keys are sent per-request, never stored server-side), generates parametric geometry (2D primitives + 3D meshes), and exports CAD files. Includes an SSRF whitelist for provider URLs, input clamping, and XML escaping on export.
- **`frontend/`** — Next.js app (React Three Fiber viewport, 2D canvas, command-line terminal). Talks to the backend over a Next.js rewrite proxy; when the backend is unreachable it falls back to generating equivalent geometry client-side.

## Run locally

Backend (port 8000):

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/uvicorn main:app --reload
```

Frontend (port 3000):

```bash
cd frontend
npm install
npm run dev
```

## Environment variables

Backend:

- `ALLOWED_ORIGINS` — comma-separated CORS origins (e.g. `https://app.example.com`). Unset = same-origin only; credentials are only enabled with an explicit list.

Frontend:

- `NEXT_PUBLIC_BACKEND_URL` — backend origin used by the Next.js rewrite proxy (default `http://localhost:8000`).
- `NEXT_PUBLIC_API_URL` — direct API base override in `src/lib/apiClient.ts`; defaults to `http://localhost:8000` (or the rewrite path when unset in production).
- AI provider, model, base URL, and API key are chosen in the UI and passed per-request (`ai_provider`, `ai_model`, `ai_base_url`, `ai_api_key`) — there are no server-side AI env vars.

## Deployment

- **Frontend**: Vercel (repo root = `frontend/`); set `NEXT_PUBLIC_BACKEND_URL` to the Railway URL.
- **Backend**: Railway (`backend/railway.toml`/`Procfile` — `uvicorn main:app --host 0.0.0.0 --port $PORT`); set `ALLOWED_ORIGINS` to the Vercel domain.

## Tests

```bash
cd backend
venv/bin/python -m pytest
```

Covers all endpoints (health, generators, generate, generate-direct, export, deepseek chat — mocked, no network), parser rules and edit commands, SSRF whitelist, and a full smoke pass of all 11 generators × 5 exporters. `venv/bin/python test_app.py` still runs the standalone smoke script.
