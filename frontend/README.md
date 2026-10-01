# MineCAD AI frontend

Next.js app for conceptual mining CAD drawings. The hosted app includes its own
`/api/health`, `/api/generate`, `/api/generate-direct`, `/api/scene-plan`, `/api/export`, and
`/api/deepseek/chat` routes; no separate Python deployment is needed for the
website.

## Run and verify

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run smoke
```

The smoke check starts the production build locally and checks health,
multi-component planning, unsupported requests, slope geometry, generation,
invalid prompts, and all five export formats.

## Prompt-led layout

- A prompt can request several supported components, such as an open pit and a
  conveyor. `Create` starts a new project; `add` updates or adds to the selected
  project. Objects can be selected in 2D or 3D, moved in the 2D view or Inspector,
  edited in the Inspector, deleted, and restored with Undo.
- The Local planner handles named components and supported parameters. DeepSeek
  can interpret a multi-component request when the user supplies an API key.
  Unsupported named components are reported before any partial design is made.
- Multiple components are auto-placed side by side. Their physical connection,
  clashes, grades, and access are not yet validated. The plan is conceptual.
- Imported survey stations can remain as a fixed reference while components
  are added to the same scene. Generated shapes do not yet conform to measured
  terrain, geology, or survey boundaries.
- Overall pit slope now drives bench geometry when requested. If bench width is
  the controlling parameter, the displayed overall slope is calculated from the
  actual bench dimensions. Conflicting values and simplified road/volume
  assumptions appear as design warnings.

## Data and providers

- Projects are automatically saved in browser IndexedDB. Users can download
  and import MineCAD project JSON files for backups and sharing.
- Survey station CSV files can be imported with `station,easting,northing,elevation`
  columns. The app does not verify datum, measurements, or engineering accuracy.
- Local generation uses explicit rule-based parsing and works offline after
  the app shell has been cached. DeepSeek is optional and needs a user-supplied
  API key; the key remains in tab memory and is forwarded through a fixed
  same-origin API route for each request.
- Templates, contour maps, and derived engineering quantities are conceptual
  demonstrations. There is no site-specific slope stability analysis.

Deploy the `frontend/` directory as a Next.js project on Vercel. The old
`NEXT_PUBLIC_BACKEND_URL` proxy is no longer used.
