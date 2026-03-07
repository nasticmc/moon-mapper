// ── DOM refs ──────────────────────────────────────────────────────────────────
const surfaceShell  = document.getElementById('surfaceShell');
const moonSurface   = document.getElementById('moonSurface');
const poiList       = document.getElementById('poiList');
const template      = document.getElementById('poiTemplate');
const syncStatus    = document.getElementById('syncStatus');

const zoomLabel     = document.getElementById('zoomLabel');
const zoomInBtn     = document.getElementById('zoomIn');
const zoomOutBtn    = document.getElementById('zoomOut');
const resetViewBtn  = document.getElementById('resetView');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn= document.getElementById('rotateRight');
const spinToggleBtn = document.getElementById('toggleSpin');

// Modal elements
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const cancelModal   = document.getElementById('cancelModal');
const form          = document.getElementById('poiForm');
const poiLatInput   = document.getElementById('poiLat');
const poiLonInput   = document.getElementById('poiLon');

// Detail panel elements
const detailPanel   = document.getElementById('detailPanel');
const panelClose    = document.getElementById('panelClose');

// ── State ─────────────────────────────────────────────────────────────────────
let pois            = [];
let selectedPoiId   = null;
let viewState       = { scale: 1, rotation: 0 };
let dragState       = null;
let spinState       = { enabled: true, rafId: null, lastTs: 0 };
let suppressClick   = false;
let longPressTimer  = null;
let longPressOrigin = { x: 0, y: 0 };

// ── Utilities ─────────────────────────────────────────────────────────────────
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function clampLat(lat)    { return Math.min(90, Math.max(-90, lat)); }
function normalizeLon(lon) {
  let v = lon;
  while (v >  180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

function latLonToPercent(lat, lon) {
  const x = 50 + (lon - viewState.rotation) * 100 / 180;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function percentToLatLon(x, y) {
  const lon = normalizeLon((x - 50) * 180 / 100 + viewState.rotation);
  const lat = clampLat(90 - (y / 100) * 180);
  return { lat: Number(lat.toFixed(1)), lon: Number(lon.toFixed(1)) };
}

/** Convert a pointer event's client coordinates to lunar lat/lon */
function clientToLatLon(clientX, clientY) {
  const rect = moonSurface.getBoundingClientRect();
  const x = ((clientX - rect.left)  / rect.width)  * 100;
  const y = ((clientY - rect.top)   / rect.height) * 100;
  return percentToLatLon(x, y);
}

// ── Server API ────────────────────────────────────────────────────────────────
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

// ── Status bar ────────────────────────────────────────────────────────────────
function setStatus(message, variant = 'neutral') {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.dataset.variant = variant;
}

// ── View rendering ────────────────────────────────────────────────────────────
function applyView() {
  const { scale, rotation } = viewState;
  moonSurface.style.transform = `scale(${scale})`;
  moonSurface.style.backgroundPosition = `center, center, ${50 + rotation * 5 / 9}% center`;
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
  dot.style.top  = `${y}%`;
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPoiId = poi.id;
    openDetailPanel(poi);
    renderPOIDots();
  });
  moonSurface.appendChild(dot);
}

function renderPOIDots() {
  moonSurface.querySelectorAll('.poi-dot').forEach(n => n.remove());
  for (const poi of pois) createPOIDot(poi);
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function openDetailPanel(poi) {
  poiList.innerHTML = '';

  const node = template.content.firstElementChild.cloneNode(true);
  node.id = `poi-${poi.id}`;
  node.querySelector('h3').textContent = poi.name;
  node.querySelector('.poi-desc').textContent = poi.description || 'No description';
  node.querySelector('.poi-coords').textContent =
    `Lat ${poi.lat.toFixed(1)}°, Lon ${poi.lon.toFixed(1)}°`;

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
  } else {
    linksWrap.textContent = 'No links attached';
  }

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
  } else {
    filesWrap.textContent = 'No files uploaded';
  }

  poiList.appendChild(node);
  detailPanel.classList.add('open');
}

function closeDetailPanel() {
  detailPanel.classList.remove('open');
  selectedPoiId = null;
  renderPOIDots();
}

panelClose.addEventListener('click', closeDetailPanel);

// ── Add POI modal ─────────────────────────────────────────────────────────────
function openAddModal(lat, lon) {
  poiLatInput.value = String(lat);
  poiLonInput.value = String(lon);
  modalBackdrop.hidden = false;
  setTimeout(() => document.getElementById('poiName').focus(), 50);
}

function closeAddModal() {
  modalBackdrop.hidden = true;
  form.reset();
}

modalClose.addEventListener('click', closeAddModal);
cancelModal.addEventListener('click', closeAddModal);

// Close modal on backdrop click
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeAddModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalBackdrop.hidden) closeAddModal();
    else closeDetailPanel();
  }
});

// ── Form submission ───────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
      id:          generateId(),
      name:        document.getElementById('poiName').value.trim(),
      description: document.getElementById('poiDescription').value.trim(),
      lat:         Number(poiLatInput.value),
      lon:         Number(poiLonInput.value),
      links:       document.getElementById('poiLinks').value.split(',').map(s => s.trim()).filter(Boolean),
      files
    };
    setStatus('Saving to server...', 'neutral');
    await savePOIToServer(poi);
    pois = await fetchPOIsFromServer();
    renderPOIDots();
    closeAddModal();
    setStatus('POI submitted — pending review', 'ok');
  } catch (err) {
    setStatus(err.message || 'Failed to save POI to server', 'error');
  }
});

// ── Globe controls ────────────────────────────────────────────────────────────
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
  spinToggleBtn.textContent = enabled ? '⏸' : '▶';
  spinToggleBtn.title = enabled ? 'Pause spin' : 'Resume spin';
  if (enabled) {
    spinState.lastTs = 0;
    if (!spinState.rafId) spinState.rafId = requestAnimationFrame(animationTick);
  } else if (spinState.rafId) {
    cancelAnimationFrame(spinState.rafId);
    spinState.rafId = null;
  }
}

zoomInBtn.addEventListener('click',   () => updateScale(viewState.scale + 0.2));
zoomOutBtn.addEventListener('click',  () => updateScale(viewState.scale - 0.2));
rotateLeftBtn.addEventListener('click',  () => updateRotation(-12));
rotateRightBtn.addEventListener('click', () => updateRotation(12));
spinToggleBtn.addEventListener('click',  () => setSpin(!spinState.enabled));
resetViewBtn.addEventListener('click', () => {
  viewState = { scale: 1, rotation: 0 };
  applyView();
});

surfaceShell.addEventListener('wheel', (event) => {
  event.preventDefault();
  updateScale(viewState.scale + (event.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

// ── Pointer events (drag + long-press) ───────────────────────────────────────
surfaceShell.addEventListener('pointerdown', (event) => {
  dragState = { x: event.clientX, y: event.clientY, moved: false };
  suppressClick = false;

  if (spinState.enabled) setSpin(false);
  surfaceShell.setPointerCapture(event.pointerId);

  // Start long-press timer (only for primary pointer, not right-click)
  if (event.button === 0) {
    longPressOrigin = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      suppressClick = true;
      const { lat, lon } = clientToLatLon(longPressOrigin.x, longPressOrigin.y);
      openAddModal(lat, lon);
    }, 600);
  }
});

surfaceShell.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  const moved = dragState.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2;
  dragState = { x: event.clientX, y: event.clientY, moved };

  if (moved) {
    suppressClick = true;
    // Cancel long-press if the pointer moved significantly
    const moveX = Math.abs(event.clientX - longPressOrigin.x);
    const moveY = Math.abs(event.clientY - longPressOrigin.y);
    if (longPressTimer && (moveX > 8 || moveY > 8)) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  updateRotation(dx * 0.35);
});

surfaceShell.addEventListener('pointerup', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  dragState = null;
});

surfaceShell.addEventListener('pointercancel', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  dragState = null;
});

// ── Right-click to add POI ────────────────────────────────────────────────────
surfaceShell.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  // Don't trigger if the pointer was dragged
  if (dragState?.moved) return;
  const { lat, lon } = clientToLatLon(event.clientX, event.clientY);
  openAddModal(lat, lon);
});

// ── Surface click (deselect panel on empty-space click) ───────────────────────
moonSurface.addEventListener('click', () => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  closeDetailPanel();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  applyView();
  setStatus('Loading POIs from server...', 'neutral');
  try {
    pois = await fetchPOIsFromServer();
    renderPOIDots();
    setStatus(`Synced ${pois.length} approved POI${pois.length !== 1 ? 's' : ''}`, 'ok');
    setSpin(true);
  } catch {
    setStatus('Unable to load POIs from server', 'error');
  }
}

init();
