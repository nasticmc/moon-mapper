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

let pois = [];
let viewState = { scale: 1, rotation: 0 };
let dragState = null;
let spinState = { enabled: true, rafId: null, lastTs: 0 };

function normalizeLon(lon) {
  let value = lon;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function latLonToPercent(lat, lon) {
  const shiftedLon = normalizeLon(lon + viewState.rotation);
  const x = ((shiftedLon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function percentToLatLon(x, y) {
  const shiftedLon = (x / 100) * 360 - 180;
  const lon = normalizeLon(shiftedLon - viewState.rotation);
  const lat = 90 - (y / 100) * 180;
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
  if (!response.ok) throw new Error(`Unable to save POI (${response.status})`);
}

function setStatus(message, variant = 'neutral') {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.dataset.variant = variant;
}

function applyView() {
  const { scale, rotation } = viewState;
  const darksideProgress = Math.min(1, Math.max(0, (Math.abs(rotation) - 180) / 120));
  moonSurface.style.transform = `scale(${scale})`;
  moonSurface.style.backgroundPosition = `${50 + rotation / 3.6}% center`;
  moonSurface.style.setProperty('--darkside-progress', darksideProgress.toFixed(3));
  moonSurface.style.setProperty('--darkside-angle', rotation >= 0 ? '90deg' : '270deg');
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  renderPOIDots();
}

function createPOIDot(poi) {
  const dot = document.createElement('button');
  dot.className = 'poi-dot';
  dot.type = 'button';
  dot.title = poi.name;
  const { x, y } = latLonToPercent(poi.lat, poi.lon);
  dot.style.left = `${x}%`;
  dot.style.top = `${y}%`;
  dot.addEventListener('click', () => {
    const card = document.getElementById(`poi-${poi.id}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  moonSurface.appendChild(dot);
}

function renderPOIDots() {
  moonSurface.querySelectorAll('.poi-dot').forEach((n) => n.remove());
  for (const poi of pois) createPOIDot(poi);
}

function renderPOIList() {
  poiList.innerHTML = '';

  if (!pois.length) {
    poiList.innerHTML = '<p>No points yet — add your first lunar marker.</p>';
    renderPOIDots();
    return;
  }

  for (const poi of pois) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.id = `poi-${poi.id}`;
    node.querySelector('h3').textContent = poi.name;
    node.querySelector('.poi-desc').textContent = poi.description || 'No description';
    node.querySelector('.poi-coords').textContent = `Lat ${poi.lat.toFixed(1)}°, Lon ${poi.lon.toFixed(1)}°`;

    const linksWrap = node.querySelector('.poi-links');
    if (poi.links?.length) {
      for (const url of poi.links) {
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
  }

  renderPOIDots();
}

async function filesToPayload(fileList) {
  const payload = [];
  for (const file of fileList) {
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
  const poi = {
    id: crypto.randomUUID(),
    name: document.getElementById('poiName').value.trim(),
    description: document.getElementById('poiDescription').value.trim(),
    lat: Number(poiLatInput.value),
    lon: Number(poiLonInput.value),
    links: document.getElementById('poiLinks').value.split(',').map((s) => s.trim()).filter(Boolean),
    files: await filesToPayload(document.getElementById('poiFiles').files)
  };

  try {
    setStatus('Saving to server...', 'neutral');
    await savePOIToServer(poi);
    pois = await fetchPOIsFromServer();
    renderPOIList();
    form.reset();
    setStatus(`Synced ${pois.length} POIs from server`, 'ok');
  } catch {
    setStatus('Failed to save POI to server', 'error');
  }
});

function updateScale(nextScale) {
  viewState.scale = Math.min(3.5, Math.max(0.7, nextScale));
  applyView();
}

function updateRotation(delta) {
  viewState.rotation += delta;
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
});

surfaceShell.addEventListener('pointerdown', (event) => {
  dragState = { x: event.clientX, y: event.clientY };
  surfaceShell.setPointerCapture(event.pointerId);
});

surfaceShell.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const dx = event.clientX - dragState.x;
  dragState = { x: event.clientX, y: event.clientY };
  updateRotation(dx * 0.35);
});

surfaceShell.addEventListener('pointerup', () => {
  dragState = null;
});

moonSurface.addEventListener('click', (event) => {
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
