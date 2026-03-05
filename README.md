# Moon Mapper

Moon Mapper is a single-page lunar exploration app that lets you:

- view an animated moon surface,
- zoom and pan around the map,
- add points of interest (POIs) with latitude/longitude,
- attach images or supporting materials to each POI,
- store POIs in browser local storage.

## Features

- **Interactive moon map** with animated surface rendering.
- **Zoom controls** (zoom in, zoom out, reset) plus mouse-wheel zoom.
- **Drag to pan** for map navigation.
- **Click-to-prefill coordinates** for quick marker placement.
- **POI form** with name, description, lat/lon, links, and file attachments.
- **POI list view** showing marker metadata and uploaded resources.
- **Persistence** via `localStorage` (no backend required).

## Project Structure

- `index.html` — page layout, controls, POI form, and list template.
- `styles.css` — moon/map styling, layout, and POI visual styles.
- `app.js` — interaction logic, POI rendering, uploads, persistence, zoom/pan.

## Run (localhost only)

From the repository root:

```bash
python3 -m http.server 4173
```

Open in your browser:

```text
http://localhost:4173
```

## Run on your local network

To allow other devices on your network to reach the app, bind the server to all interfaces:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open from another machine using your host IP, for example:

```text
http://192.168.1.42:4173
```

> Tip: If remote devices still cannot connect, allow inbound TCP traffic on port `4173` in your OS/firewall settings.

## Usage

1. Click on the moon surface to prefill latitude/longitude.
2. Enter a POI name (required), optional description, and optional links.
3. Upload files (images, PDFs, or text/docs).
4. Click **Add POI**.
5. Use zoom/pan controls to explore and select markers.

## Notes

- Data is stored in the current browser profile’s local storage.
- Clearing site data or using a different browser/profile will reset saved POIs.
