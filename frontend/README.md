# MineCAD AI frontend

Next.js app for conceptual mining CAD drawings. The hosted app includes its own
`/api/health`, `/api/generate`, `/api/generate-direct`, `/api/export`, and
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
generation, invalid prompts, and all five export formats.

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
