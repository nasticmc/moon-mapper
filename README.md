# Moon Mapper

Moon Mapper is a single-page lunar exploration app. Points of interest (POIs) are persisted on the server so every connected device shares the same dataset in real time.

## Features

- **NASA LROC basemap** — high-resolution equirectangular lunar imagery from the Lunar Reconnaissance Orbiter Camera, sized so the texture aligns precisely with dropped POI coordinates at any rotation angle.
- **Interactive globe view** — animated auto-spin, drag-to-rotate, scroll/button zoom, and reset controls.
- **Click-to-prefill** — click anywhere on the moon surface to populate the latitude/longitude fields instantly.
- **POI form** — name, description, lat/lon, comma-separated resource links, and file attachments (images, PDFs, and more).
- **Server-side persistence** — POIs are stored in `data/pois.json` and shared across all clients connected to the same server.

## Project structure

```
moon-mapper/
├── index.html       # App layout, controls, POI form and list
├── styles.css       # Visual styling and responsive layout
├── app.js           # Browser-side interactions: sync, zoom, rotation, POI rendering
├── server.js        # Static file server + shared POI REST API
└── data/
    └── pois.json    # Persisted POI storage (created automatically on first run)
```

## Running the server

```bash
node server.js
```

The server binds to `0.0.0.0:4173` by default so it is reachable from other devices on your local network.

| Device | URL |
|---|---|
| Local machine | `http://localhost:4173` |
| Other device on same network | `http://<host-ip>:4173` |

> If remote devices cannot connect, check that inbound TCP on port `4173` is allowed in your firewall.

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4173` | Port the server listens on |
| `HOST` | `0.0.0.0` | Interface the server binds to |

## API

### `GET /api/pois`

Returns all saved POIs.

**Response `200`**
```json
{ "pois": [ { "id": "...", "name": "...", "lat": 0.0, "lon": 0.0, ... } ] }
```

### `POST /api/pois`

Saves a new POI. Concurrent requests are serialised to prevent data loss.

**Request body**
```json
{
  "id": "<uuid>",
  "name": "Tycho Crater",
  "description": "Prominent ray crater in the southern highlands.",
  "lat": -43.3,
  "lon": -11.2,
  "links": ["https://example.com"],
  "files": [
    { "name": "photo.jpg", "type": "image/jpeg", "dataUrl": "data:image/jpeg;base64,..." }
  ]
}
```

**Responses**

| Status | Meaning |
|---|---|
| `201` | POI saved successfully |
| `400` | Payload failed validation or body was not valid JSON |
| `409` | A POI with this `id` already exists |
| `413` | Request body exceeds the 50 MB limit |

**Validation rules**

- `id`, `name`, `description` — non-empty strings; `name` must not be blank after trimming.
- `lat` — finite number in `[-90, 90]`.
- `lon` — finite number in `[-180, 180]`.
- `links` — array of strings (only `http://` and `https://` URLs are rendered in the UI).
- `files` — array of objects each with a non-empty `name` string, a `type` string, and a `dataUrl` string beginning with `data:`.

## File attachments

Files are encoded as base64 data URLs and stored inside each POI record in `pois.json`. Keep individual files under **10 MB** — the client enforces this limit before upload and the server rejects bodies larger than **50 MB** total.

Supported types rendered in the UI: images (`image/*`). Other file types (PDF, text, etc.) are shown as download links.

## Imagery attribution

Lunar basemap: [NASA LROC CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) — Lunar Reconnaissance Orbiter Camera, NASA Goddard Space Flight Center.
