const surfaceShell = document.getElementById('surfaceShell');
const moonSurface = document.getElementById('moonSurface');
const form = document.getElementById('poiForm');
const poiList = document.getElementById('poiList');
const template = document.getElementById('poiTemplate');

const zoomLabel = document.getElementById('zoomLabel');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetViewBtn = document.getElementById('resetView');

const poiLatInput = document.getElementById('poiLat');
const poiLonInput = document.getElementById('poiLon');

let pois = loadPOIs();
let viewState = { scale: 1, offsetX: 0, offsetY: 0 };
let dragState = null;

function latLonToPercent(lat, lon) {
  const x = ((lon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function percentToLatLon(x, y) {
  const lon = (x / 100) * 360 - 180;
  const lat = 90 - (y / 100) * 180;
  return { lat: Number(lat.toFixed(1)), lon: Number(lon.toFixed(1)) };
}

function loadPOIs() {
  try {
    return JSON.parse(localStorage.getItem('moon-pois') || '[]');
  } catch {
    return [];
  }
}

function savePOIs() {
  localStorage.setItem('moon-pois', JSON.stringify(pois));
}

function applyView() {
  const { scale, offsetX, offsetY } = viewState;
  moonSurface.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
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
    card?.animate([{ outline: '2px solid #fff' }, { outline: '0px solid transparent' }], {
      duration: 1200,
      easing: 'ease-out'
    });
  });
  moonSurface.appendChild(dot);
}

function renderPOIList() {
  poiList.innerHTML = '';
  moonSurface.querySelectorAll('.poi-dot').forEach((n) => n.remove());

  if (!pois.length) {
    poiList.innerHTML = '<p>No points yet — add your first lunar marker.</p>';
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
    createPOIDot(poi);
  }
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
  const name = document.getElementById('poiName').value.trim();
  const description = document.getElementById('poiDescription').value.trim();
  const lat = Number(poiLatInput.value);
  const lon = Number(poiLonInput.value);
  const links = document
    .getElementById('poiLinks')
    .value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const files = await filesToPayload(document.getElementById('poiFiles').files);

  pois.unshift({
    id: crypto.randomUUID(),
    name,
    description,
    lat,
    lon,
    links,
    files
  });

  savePOIs();
  renderPOIList();
  form.reset();
});

function updateScale(nextScale) {
  viewState.scale = Math.min(3.5, Math.max(0.7, nextScale));
  applyView();
}

zoomInBtn.addEventListener('click', () => updateScale(viewState.scale + 0.2));
zoomOutBtn.addEventListener('click', () => updateScale(viewState.scale - 0.2));
resetViewBtn.addEventListener('click', () => {
  viewState = { scale: 1, offsetX: 0, offsetY: 0 };
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
  const dy = event.clientY - dragState.y;
  dragState = { x: event.clientX, y: event.clientY };
  viewState.offsetX += dx;
  viewState.offsetY += dy;
  applyView();
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

applyView();
renderPOIList();
