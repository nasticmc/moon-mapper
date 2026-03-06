const surfaceStage = document.getElementById('surfaceStage');
const surfaceShell = document.getElementById('surfaceShell');
const moonSurface = document.getElementById('moonSurface');
const form = document.getElementById('poiForm');
const poiList = document.getElementById('poiList');
const template = document.getElementById('poiTemplate');
const syncStatus = document.getElementById('syncStatus');

const zoomLabel = document.getElementById('zoomLabel');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetViewBtn = document.getElementById('resetView');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const spinToggleBtn = document.getElementById('toggleSpin');

const poiLatInput = document.getElementById('poiLat');
const poiLonInput = document.getElementById('poiLon');

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (e.g. plain HTTP)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let pois = [];
let selectedPoiId = null;
let viewState = { scale: 1, rotation: 0 };
let dragState = null;
let spinState = { enabled: true, rafId: null, lastTs: 0 };
let suppressSurfaceClick = false;

function clampLat(lat) {
  return Math.min(90, Math.max(-90, lat));
}

function normalizeLon(lon) {
  let value = lon;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function latLonToPercent(lat, lon) {
  // The equirectangular image (2:1) rendered at auto 100% in a square container
  // is exactly 2× the container width, so 180° spans the full container width.
  const x = 50 + (lon - viewState.rotation) * 100 / 180;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function percentToLatLon(x, y) {
  const lon = normalizeLon((x - 50) * 180 / 100 + viewState.rotation);
  const lat = clampLat(90 - (y / 100) * 180);
  return { lat: Number(lat.toFixed(1)), lon: Number(lon.toFixed(1)) };
}

async function fetchPOIsFromServer() {
  const response = await fetch('/api/pois');
  if (!response.ok) throw new Error(`Unable to load POIs (${response.status})`);
  const data = await response.json();
  return Array.isArray(data.pois) ? data.pois : [];
}

async function savePOIToServer(poi) {
  const response = await fetch('/api/pois', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(poi)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Unable to save POI (${response.status})`);
  }
}

function setStatus(message, variant = 'neutral') {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.dataset.variant = variant;
}

function applyView() {
  const { scale, rotation } = viewState;
  moonSurface.style.transform = `scale(${scale})`;
  moonSurface.style.backgroundPosition = `${50 + rotation * 5 / 9}% center`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  renderPOIDots();
}

function createPOIDot(poi) {
  const dot = document.createElement('button');
  dot.className = 'poi-dot' + (poi.id === selectedPoiId ? ' poi-dot--selected' : '');
  dot.type = 'button';
  dot.title = poi.name;
  const { x, y } = latLonToPercent(poi.lat, poi.lon);
  dot.style.left = `${x}%`;
  dot.style.top = `${y}%`;
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPoiId = poi.id;
    renderPOIList();
  });
  moonSurface.appendChild(dot);
}

function renderPOIDots() {
  moonSurface.querySelectorAll('.poi-dot').forEach((n) => n.remove());
  for (const poi of pois) createPOIDot(poi);
}

function renderPOIList() {
  poiList.innerHTML = '';

  const poi = pois.find(p => p.id === selectedPoiId);

  if (!poi) {
    poiList.innerHTML = pois.length
      ? '<p class="poi-empty">Click a marker on the globe to view details.</p>'
      : '<p class="poi-empty">No points yet — add your first lunar marker.</p>';
    renderPOIDots();
    return;
  }

  const node = template.content.firstElementChild.cloneNode(true);
  node.id = `poi-${poi.id}`;
  node.querySelector('h3').textContent = poi.name;
  node.querySelector('.poi-desc').textContent = poi.description || 'No description';
  node.querySelector('.poi-coords').textContent = `Lat ${poi.lat.toFixed(1)}°, Lon ${poi.lon.toFixed(1)}°`;

  const linksWrap = node.querySelector('.poi-links');
  const safeLinks = (poi.links ?? []).filter(l => typeof l === 'string' && /^https?:\/\//i.test(l));
  if (safeLinks.length) {
    for (const url of safeLinks) {
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      linksWrap.appendChild(a);
    }
  } else linksWrap.textContent = 'No links attached';

  const filesWrap = node.querySelector('.poi-files');
  if (poi.files?.length) {
    for (const file of poi.files) {
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = file.dataUrl;
        img.alt = `${poi.name} upload`;
        filesWrap.appendChild(img);
      } else {
        const fileLink = document.createElement('a');
        fileLink.href = file.dataUrl;
        fileLink.textContent = `📎 ${file.name}`;
        fileLink.download = file.name;
        filesWrap.appendChild(fileLink);
      }
    }
  } else filesWrap.textContent = 'No files uploaded';

  poiList.appendChild(node);
  renderPOIDots();
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

async function filesToPayload(fileList) {
  const payload = [];
  for (const file of fileList) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — files must be under 10 MB.`);
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    payload.push({ name: file.name, type: file.type || 'application/octet-stream', dataUrl });
  }
  return payload;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const files = await filesToPayload(document.getElementById('poiFiles').files);
    const poi = {
      id: generateId(),
      name: document.getElementById('poiName').value.trim(),
      description: document.getElementById('poiDescription').value.trim(),
      lat: Number(poiLatInput.value),
      lon: Number(poiLonInput.value),
      links: document.getElementById('poiLinks').value.split(',').map((s) => s.trim()).filter(Boolean),
      files
    };
    setStatus('Saving to server...', 'neutral');
    await savePOIToServer(poi);
    pois = await fetchPOIsFromServer();
    renderPOIList();
    form.reset();
    setStatus(`Synced ${pois.length} POIs from server`, 'ok');
  } catch (err) {
    setStatus(err.message || 'Failed to save POI to server', 'error');
  }
});

function updateScale(nextScale) {
  viewState.scale = Math.min(3.5, Math.max(0.7, nextScale));
  applyView();
}

function updateRotation(delta) {
  viewState.rotation = normalizeLon(viewState.rotation + delta);
  applyView();
}

function animationTick(ts) {
  if (!spinState.enabled) return;
  if (spinState.lastTs) {
    const dt = ts - spinState.lastTs;
    updateRotation((dt / 1000) * 5);
  }
  spinState.lastTs = ts;
  spinState.rafId = requestAnimationFrame(animationTick);
}

function setSpin(enabled) {
  spinState.enabled = enabled;
  spinToggleBtn.textContent = enabled ? 'Pause Spin' : 'Resume Spin';
  if (enabled) {
    spinState.lastTs = 0;
    if (!spinState.rafId) spinState.rafId = requestAnimationFrame(animationTick);
  } else if (spinState.rafId) {
    cancelAnimationFrame(spinState.rafId);
    spinState.rafId = null;
  }
}

zoomInBtn.addEventListener('click', () => updateScale(viewState.scale + 0.2));
zoomOutBtn.addEventListener('click', () => updateScale(viewState.scale - 0.2));
rotateLeftBtn.addEventListener('click', () => updateRotation(-12));
rotateRightBtn.addEventListener('click', () => updateRotation(12));
spinToggleBtn.addEventListener('click', () => setSpin(!spinState.enabled));
resetViewBtn.addEventListener('click', () => {
  viewState = { scale: 1, rotation: 0 };
  applyView();
});

surfaceShell.addEventListener('wheel', (event) => {
  event.preventDefault();
  updateScale(viewState.scale + (event.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

surfaceShell.addEventListener('pointerdown', (event) => {
  dragState = { x: event.clientX, y: event.clientY, moved: false };
  suppressSurfaceClick = false;
  if (spinState.enabled) setSpin(false);
  surfaceShell.setPointerCapture(event.pointerId);
});

surfaceShell.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  const moved = dragState.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2;
  dragState = { x: event.clientX, y: event.clientY, moved };
  if (moved) suppressSurfaceClick = true;
  updateRotation(dx * 0.35);
});

surfaceShell.addEventListener('pointerup', () => {
  dragState = null;
});

moonSurface.addEventListener('click', (event) => {
  if (suppressSurfaceClick) {
    suppressSurfaceClick = false;
    return;
  }

  if (spinState.enabled) setSpin(false);

  selectedPoiId = null;
  renderPOIList();

  const rect = moonSurface.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const { lat, lon } = percentToLatLon(x, y);
  poiLatInput.value = String(lat);
  poiLonInput.value = String(lon);
});

async function init() {
  applyView();
  setStatus('Loading POIs from server...', 'neutral');
  try {
    pois = await fetchPOIsFromServer();
    renderPOIList();
    setStatus(`Synced ${pois.length} POIs from server`, 'ok');
    setSpin(true);
  } catch {
    setStatus('Unable to load shared POIs from server', 'error');
    poiList.innerHTML = '<p>Server unavailable. Start server.js to use shared data.</p>';
  }
}

init();
