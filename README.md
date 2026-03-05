# Moon Mapper

Moon Mapper is a single-page lunar exploration app where all points of interest (POIs) are stored on the server so every device sees the same shared dataset.

## Features

- **Interactive moon map** with zoom, wheel zoom, drag-to-pan, and reset.
- **Click-to-prefill coordinates** for fast marker placement.
- **POI form** with name, description, lat/lon, links, and file attachments.
- **Server-side persistence** in `data/pois.json` shared across clients.
- **Cross-device consistency**: all users connected to the same server get the same POIs.

## Project Structure

- `index.html` — app layout, controls, POI form/list.
- `styles.css` — visual styling and responsive layout.
- `app.js` — browser-side interactions and API calls.
- `server.js` — static file server + shared POI API.
- `data/pois.json` — persisted POI storage file (created automatically).

## Run the shared server

From the repository root:

```bash
node server.js
```

The server binds to `0.0.0.0:4173` by default, so it is reachable from other devices on your network.

Open from your machine:

```text
http://localhost:4173
```

Open from another device (replace IP with your host machine IP):

```text
http://192.168.1.42:4173
```

> Tip: If remote devices cannot connect, allow inbound TCP traffic on port `4173` in your firewall.

## API

- `GET /api/pois` — fetch all saved POIs.
- `POST /api/pois` — append a new POI to shared storage.

## Notes

- POIs are persisted on disk in `data/pois.json`, not in browser local storage.
- Uploaded files are stored as data URLs inside POI records.
