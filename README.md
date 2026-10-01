# MineCAD AI

MineCAD AI is a prompt-led conceptual mine layout app. A request can place several supported components in one editable 2D/3D scene — open pits, room-and-pillar layouts, ventilation networks, conveyors, blast patterns, declines, survey traverses, topo contours, borehole sections, longwall panels, and cut-and-fill volumes — exportable as DXF, SVG, PDF, OBJ, or STL. It does not yet validate that components connect or meet site engineering requirements.

## Architecture

- **`backend/`** — Python FastAPI service. Parses prompts with local regex NLP rules or an LLM provider (Ollama, HuggingFace, DeepSeek — API keys are sent per-request, never stored server-side), generates parametric geometry (2D primitives + 3D meshes), and exports CAD files. Includes an SSRF whitelist for provider URLs, input clamping, and XML escaping on export.
- **`frontend/`** — Next.js app (React Three Fiber viewport, 2D canvas, command-line terminal). The hosted website includes same-origin API routes for generation, export, and optional DeepSeek requests. See `frontend/README.md`.

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

- No environment variables are required for the hosted website. Same-origin Next.js routes handle its API requests.
- Optional DeepSeek uses a user-supplied API key held in browser tab memory and forwarded per request; it is never stored with projects.

## PWA

The frontend is an installable, offline-capable Progressive Web App. After the first visit the app shell is cached by a hand-rolled service worker (`frontend/public/sw.js`), so local rule-based generation and client-side exports can continue offline. DeepSeek requests require connectivity and are never cached.

## Deployment

- **Frontend**: Vercel (repo root = `frontend/`). Its Next.js API routes work without Railway.
- **Optional standalone Python API**: Railway (`backend/railway.toml`/`Procfile` — `uvicorn main:app --host 0.0.0.0 --port $PORT`). It is separate from the hosted website.

## Tests

```bash
cd backend
venv/bin/python -m pytest
```

Covers all endpoints (health, generators, generate, generate-direct, export, deepseek chat — mocked, no network), parser rules and edit commands, SSRF whitelist, and a full smoke pass of all 11 generators × 5 exporters. `venv/bin/python test_app.py` still runs the standalone smoke script.
