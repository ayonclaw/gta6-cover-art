// Live editor interactions: each frame keeps its own image, zoom and crop; all rendering stays on this device.
import { drawCover, panelRects } from './cover.js';
import { readShotSettings, markShotReady } from './shots.js';

const SIZES = {
  square: { label: 'SQUARE', width: 1080, height: 1080 },
  portrait: { label: 'PORTRAIT', width: 1080, height: 1350 },
  wide: { label: 'WIDE', width: 1920, height: 1080 },
  link: { label: 'LINK CARD', width: 1200, height: 630 },
};
const SAMPLE_PATHS = { boulevard: './samples/boulevard.jpg', pier: './samples/pier.jpg' };
const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d', { alpha: false });
const status = document.getElementById('status');
const caption = document.getElementById('caption');
const photoInput = document.getElementById('photo');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const sizeKeys = Object.keys(SIZES);
const settings = readShotSettings(location.search);
let activePanel = 0;
let activeSize = 'square';
let pointerDrag = null;
let noisePattern = null;
let loadsFinished = false;
const panels = Array.from({ length: 4 }, (_, index) => ({
  image: null,
  url: null,
  label: '',
  zoom: 1,
  panX: 0,
  panY: 0,
}));

function setStatus(message, state = '') {
  status.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  status.append(dot, document.createTextNode(message));
  status.dataset.state = state;
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be opened. Try another photo.'));
    image.src = url;
  });
}

function panelLabel(url) {
  if (url.startsWith('blob:')) return 'YOUR PHOTO';
  return url.includes('pier') ? 'PIER' : 'BOULEVARD';
}

function refreshPanelCard(index) {
  const panel = panels[index];
  const thumb = document.getElementById(`thumb-${index}`);
  const name = document.getElementById(`photo-name-${index}`);
  if (panel.url) thumb.src = panel.url;
  thumb.alt = `Frame ${index + 1}: ${panel.label.toLowerCase()} photo`;
  name.textContent = panel.label;
}

function selectPanel(index) {
  activePanel = Math.max(0, Math.min(panels.length - 1, index));
  document.querySelectorAll('.panel-select').forEach((button, i) => {
    const selected = i === activePanel;
    button.parentElement.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.getElementById('active-frame-label').textContent = String(activePanel + 1).padStart(2, '0');
  zoomInput.value = String(panels[activePanel].zoom);
  zoomValue.value = `${panels[activePanel].zoom.toFixed(1)}×`;
  document.querySelector('.preview-footer b').textContent = String(activePanel + 1).padStart(2, '0');
  redraw();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function currentOptions() {
  return {
    caption: caption.value,
    caseStyle: document.getElementById('case-style').value,
    tracking: Number(document.getElementById('tracking').value),
    colorway: document.getElementById('colorway').value,
    chrome: document.getElementById('chrome').checked,
  };
}

function redraw() {
  if (!ctx) return;
  drawCover(ctx, canvas.width, canvas.height, panels, currentOptions(), () => noisePattern, (value) => { noisePattern = value; });
}

function setSize(key) {
  if (!Object.hasOwn(SIZES, key)) return;
  activeSize = key;
  const size = SIZES[key];
  canvas.width = size.width;
  canvas.height = size.height;
  document.querySelectorAll('.size-option').forEach((button) => {
    const selected = button.dataset.size === key;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const dimensions = `${size.width} × ${size.height}`;
  document.getElementById('preview-size').textContent = dimensions;
  document.getElementById('export-size-label').textContent = `PNG · ${dimensions}`;
  redraw();
}

async function replacePanelPhoto(file, index) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('Choose an image file to fill this frame.', 'error');
    return;
  }
  let url = null;
  let urls = [];
  try {
    url = URL.createObjectURL(file);
    const image = await imageFromUrl(url);
    const targets = document.getElementById('fill-all').checked ? panels.map((_, panelIndex) => panelIndex) : [index];
    urls = targets.map((_, targetIndex) => targetIndex === 0 ? url : URL.createObjectURL(file));
    targets.forEach((panelIndex, targetIndex) => {
      if (panels[panelIndex].url?.startsWith('blob:')) URL.revokeObjectURL(panels[panelIndex].url);
      panels[panelIndex] = { image, url: urls[targetIndex], label: panelLabel(urls[targetIndex]), zoom: 1, panX: 0, panY: 0 };
      refreshPanelCard(panelIndex);
    });
    selectPanel(index);
    setStatus(targets.length === 1 ? `Frame ${index + 1} updated · photo stays on this device.` : 'All four frames updated · crops can be adjusted independently.', 'done');
  } catch (error) {
    for (const failedUrl of urls) URL.revokeObjectURL(failedUrl);
    if (url) URL.revokeObjectURL(url);
    setStatus(error.message, 'error');
  }
}

function activateTileAction(action, index) {
  if (action === 'reset') {
    panels[index].zoom = 1;
    panels[index].panX = 0;
    panels[index].panY = 0;
    if (activePanel === index) selectPanel(index);
    else redraw();
    setStatus(`Frame ${index + 1} crop reset.`, 'done');
    return;
  }
  if (action === 'swap') {
    const next = (index + 1) % panels.length;
    [panels[index], panels[next]] = [panels[next], panels[index]];
    refreshPanelCard(index);
    refreshPanelCard(next);
    selectPanel(index);
    setStatus(`Frames ${index + 1} and ${next + 1} swapped.`, 'done');
  }
}

function exportCover() {
  setStatus('Rendering PNG…');
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('PNG export failed. Try again.', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `afterglow-${activeSize}-${canvas.width}x${canvas.height}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus(`PNG saved · ${canvas.width} × ${canvas.height}.`, 'done');
  }, 'image/png');
}

function pointOnCanvas(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height,
  };
}

function frameAt(point) {
  const rects = panelRects(canvas.width, canvas.height);
  const found = rects.findIndex((rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height);
  return found < 0 ? activePanel : found;
}

canvas.addEventListener('pointerdown', (event) => {
  const point = pointOnCanvas(event);
  const index = frameAt(point);
  selectPanel(index);
  pointerDrag = { id: event.pointerId, index, x: point.x, y: point.y };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
  const point = pointOnCanvas(event);
  const rect = panelRects(canvas.width, canvas.height)[pointerDrag.index];
  const panel = panels[pointerDrag.index];
  panel.panX = clamp(panel.panX + (point.x - pointerDrag.x) / rect.width * 2, -1, 1);
  panel.panY = clamp(panel.panY + (point.y - pointerDrag.y) / rect.height * 2, -1, 1);
  pointerDrag.x = point.x;
  pointerDrag.y = point.y;
  redraw();
});
canvas.addEventListener('pointerup', () => { pointerDrag = null; });
canvas.addEventListener('pointercancel', () => { pointerDrag = null; });
canvas.addEventListener('dragover', (event) => {
  event.preventDefault();
  document.querySelector('.canvas-frame').classList.add('is-dragover');
});
canvas.addEventListener('dragleave', () => document.querySelector('.canvas-frame').classList.remove('is-dragover'));
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  document.querySelector('.canvas-frame').classList.remove('is-dragover');
  const file = event.dataTransfer.files[0];
  if (file) replacePanelPhoto(file, frameAt(pointOnCanvas(event)));
});

for (const button of document.querySelectorAll('.panel-select')) {
  button.addEventListener('click', () => selectPanel(Number(button.dataset.panel)));
}
for (const action of document.querySelectorAll('.tile-action')) {
  action.addEventListener('click', (event) => {
    event.stopPropagation();
    activateTileAction(action.dataset.action, Number(action.dataset.index));
  });
}

document.getElementById('photo-button').addEventListener('click', () => photoInput.click());
document.getElementById('fill-all').addEventListener('change', (event) => {
  setStatus(event.target.checked ? 'Next photo will fill all four frames; crops stay independent.' : 'Next photo will replace only the selected frame.');
});
photoInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) replacePanelPhoto(file, activePanel);
  photoInput.value = '';
});
zoomInput.addEventListener('input', () => {
  panels[activePanel].zoom = Number(zoomInput.value);
  zoomValue.value = `${panels[activePanel].zoom.toFixed(1)}×`;
  redraw();
});
caption.addEventListener('input', redraw);
for (const id of ['case-style', 'colorway', 'chrome']) document.getElementById(id).addEventListener('input', redraw);
document.getElementById('tracking').addEventListener('input', (event) => {
  document.getElementById('tracking-value').value = event.target.value;
  redraw();
});
for (const button of document.querySelectorAll('.size-option')) button.addEventListener('click', () => setSize(button.dataset.size));
document.getElementById('export').addEventListener('click', exportCover);

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  if (/^[1-4]$/.test(event.key)) selectPanel(Number(event.key) - 1);
  if (event.key === '[' || event.key === ']') {
    event.preventDefault();
    const next = (sizeKeys.indexOf(activeSize) + (event.key === ']' ? 1 : -1) + sizeKeys.length) % sizeKeys.length;
    setSize(sizeKeys[next]);
  }
  if (event.key.toLowerCase() === 'e') exportCover();
});

async function start() {
  document.body.classList.toggle('poster-mode', settings.shot === 'cover');
  activeSize = settings.size in SIZES ? settings.size : 'square';
  if (settings.caption) caption.value = settings.caption.slice(0, 32);
  const primary = settings.photo in SAMPLE_PATHS ? settings.photo : 'boulevard';
  const alternate = primary === 'boulevard' ? 'pier' : 'boulevard';
  const sources = [primary, alternate, alternate, primary];
  try {
    await Promise.all(panels.map(async (panel, index) => {
      const url = SAMPLE_PATHS[sources[index]];
      panel.image = await imageFromUrl(url);
      panel.url = url;
      panel.label = panelLabel(url);
      refreshPanelCard(index);
    }));
    loadsFinished = true;
    setSize(activeSize);
    selectPanel(0);
    setStatus('FOUR FRAMES READY · PHOTOS STAY LOCAL.', 'done');
    requestAnimationFrame(() => requestAnimationFrame(() => markShotReady(loadsFinished)));
  } catch (error) {
    setStatus(error.message, 'error');
    requestAnimationFrame(() => requestAnimationFrame(() => markShotReady(false)));
  }
}

start();
