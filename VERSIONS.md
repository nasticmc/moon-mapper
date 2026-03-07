# Moon Mapper — Version History

## v0.4 — Full-Moon Redesign

- **Layout overhaul** — replaced the two-column grid (globe + sidebar) with a full-viewport moon that fills the screen; controls float in a compact HUD over the globe.
- **Warm neutral theme** — swapped the electric-blue neon palette for dark grays, muted stone text, and a warm gold accent; buttons are flat with subtle borders instead of blue gradients.
- **Quieter POI markers** — removed the pulsing animation; dots are now gold with a hover-scale effect, and the selected state uses a white dot with a soft accent ring.
- **Review link removed** — the "Review POIs" shortcut is no longer shown on the main page; the review page is still accessible directly at `/review`.
- **Typography cleanup** — switched to Helvetica Neue, dropped the emoji from the page title, lighter font weights throughout.
- **Form polish** — gold focus rings on inputs, consistent font inheritance, more restrained modal styling.

---

## v0.3 — Globe & POI Display Polish

- **Rotation coordinate fix** — `viewState.rotation` is now normalised to `[-180, 180]` on every update, so POI markers stay anchored to their correct lunar coordinates no matter how many full rotations the globe has made.
- **Smaller dot markers** — POI dots reduced from 14 px to 8 px for a cleaner look; the pulse ring scales to match.
- **Selected-POI detail panel** — the full POI list is replaced with a single "Point Details" panel. Clicking a marker highlights it in gold and shows only that POI's card (name, description, coordinates, links, attachments). Clicking the bare globe surface deselects and returns to the placeholder prompt.

---

## v0.2 — Make It Function

- **Server-side persistence** — POIs are stored in `data/pois.json` and shared across all devices connected to the same server in real time.
- **NASA LROC basemap** — high-resolution equirectangular lunar imagery from the Lunar Reconnaissance Orbiter Camera; texture loaded from the NASA SVS CDN and sized so coordinate alignment is exact at any rotation angle.
- **Drag-to-rotate globe** — click and drag left/right to spin the moon in place with pointer-capture so movement stays smooth outside the element boundary.
- **Auto-spin animation** — continuous 5°/s rotation driven by `requestAnimationFrame`; pauses automatically when the user starts interacting.
- **Scroll & button zoom** — mouse wheel and ± buttons adjust scale between 0.7× and 3.5×; zoom level shown as a live percentage label.
- **Click-to-prefill coordinates** — clicking anywhere on the moon surface converts the click position to lunar lat/lon and pre-populates the POI form fields.
- **File attachments** — images (rendered inline), PDFs, text files, and other formats (shown as download links) stored as base64 data URLs inside each POI record.
- **POI validation & error handling** — server rejects malformed payloads (400), duplicate IDs (409), and oversized bodies (413); client reports sync status after every save.
- **Crypto fallback** — `generateId()` falls back to `crypto.getRandomValues` or `Math.random` when `crypto.randomUUID` is unavailable in non-secure contexts.

---

## v0.1 — Mockup

- Initial project scaffold: `index.html`, `styles.css`, `app.js`, `server.js`.
- Static dark-themed layout with a two-column grid (globe viewer + sidebar).
- Placeholder moon surface with zoom and rotate button controls wired up.
- Basic POI form (name, description, lat/lon, links, file input) with no persistence.
- Animated circular globe shell with highlight overlay and `pulse` CSS keyframe on markers.
