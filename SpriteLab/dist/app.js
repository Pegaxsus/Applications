'use strict';

const byId = id => document.getElementById(id);
const fileInput = byId('file');
const viewport = byId('viewport');
const stage = byId('stage');
const image = byId('image');
const overlay = byId('overlay');
const pixels = image.getContext('2d', { willReadFrequently: true });
const preview = overlay.getContext('2d');
const color = byId('color');
const brushSize = byId('brushSize');
const showBackground = byId('showBackground');
const backgroundColor = byId('backgroundColor');
const editing = byId('editing');

let filename = '';
let requestId = 0;
let language = 'es';
let notice = '';
let tool = 'brush';
let mode = 'paint';
let zoom = 1;
let fit = true;
let stroke;
const undoStack = [];
const redoStack = [];
const tileSize = 64;
const historyLimit = 96 * 1024 * 1024;
let historyBytes = 0;

function updateHistoryButtons() {
  byId('undo').disabled = !undoStack.length;
  byId('redo').disabled = !redoStack.length;
}

function resetHistory() {
  undoStack.length = redoStack.length = 0;
  historyBytes = 0;
  updateHistoryButtons();
}

function rememberTiles(action, x, y, width, height) {
  const right = Math.min(x + width, image.width);
  const bottom = Math.min(y + height, image.height);
  for (let top = Math.floor(Math.max(0, y) / tileSize) * tileSize; top < bottom; top += tileSize) {
    for (let left = Math.floor(Math.max(0, x) / tileSize) * tileSize; left < right; left += tileSize) {
      const key = top * image.width + left;
      if (action.tiles.has(key)) continue;
      const data = pixels.getImageData(left, top, Math.min(tileSize, image.width - left),
        Math.min(tileSize, image.height - top));
      action.tiles.set(key, { left, top, data });
      action.bytes += data.data.byteLength;
    }
  }
}

function commitAction(action) {
  if (!action.tiles.size) return;
  for (const entry of redoStack) historyBytes -= entry.bytes;
  redoStack.length = 0;
  undoStack.push(action);
  historyBytes += action.bytes;
  while (historyBytes > historyLimit && undoStack.length > 1) {
    historyBytes -= undoStack.shift().bytes;
  }
  updateHistoryButtons();
}

function restoreAction(from, to) {
  if (stroke) finishStroke();
  const action = from.pop();
  if (!action) return;
  for (const tile of action.tiles.values()) {
    const { left, top, data } = tile;
    tile.data = pixels.getImageData(left, top, data.width, data.height);
    pixels.putImageData(data, left, top);
  }
  to.push(action);
  updateHistoryButtons();
}

byId('undo').addEventListener('click', () => restoreAction(undoStack, redoStack));
byId('redo').addEventListener('click', () => restoreAction(redoStack, undoStack));
document.addEventListener('keydown', event => {
  if (!filename || !(event.ctrlKey || event.metaKey) || event.altKey ||
      event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  event.preventDefault();
  if (key === 'y' || event.shiftKey) restoreAction(redoStack, undoStack);
  else restoreAction(undoStack, redoStack);
});

const messages = {
  es: {
    noFile: 'Ninguna imagen cargada',
    invalid: 'No se pudo abrir el archivo. Selecciona un PNG válido.',
    tooLarge: 'El PNG supera el límite de 16 megapíxeles o de 8192 píxeles por lado.',
    transparent: 'Este píxel es transparente.',
    exportError: 'No se pudo exportar el PNG.'
  },
  en: {
    noFile: 'No image loaded',
    invalid: 'Could not open the file. Select a valid PNG.',
    tooLarge: 'The PNG exceeds 16 megapixels or 8192 pixels per side.',
    transparent: 'This pixel is transparent.',
    exportError: 'Could not export the PNG.'
  }
};

function preference(key, value) {
  try {
    if (value === undefined) return localStorage.getItem('spritelab-' + key);
    localStorage.setItem('spritelab-' + key, value);
  } catch { /* The editor also works with storage disabled. */ }
}

function select(group, value) {
  document.querySelectorAll('[data-' + group + ']').forEach(button => {
    button.setAttribute('aria-pressed', String(button.getAttribute('data-' + group) === value));
  });
}

const labels = [...document.querySelectorAll('[data-en], [data-label-en]')].map(element => {
  const attribute = element.hasAttribute('data-label-en') ? 'aria-label' : '';
  return {
    element, attribute,
    es: attribute ? element.getAttribute(attribute) : element.textContent,
    en: element.dataset.labelEn ?? element.dataset.en
  };
});

function updateNotice(key = notice) {
  notice = key;
  byId('notice').textContent = messages[language][key] ?? '';
  byId('filename').textContent = filename || messages[language].noFile;
}

function setLanguage(value) {
  language = value === 'en' ? 'en' : 'es';
  document.documentElement.lang = language;
  for (const label of labels) {
    if (label.attribute) label.element.setAttribute(label.attribute, label[language]);
    else label.element.textContent = label[language];
  }
  const themeLabels = language === 'es' ? ['Idioma', 'Tema', 'Tema claro', 'Tema oscuro'] :
    ['Language', 'Theme', 'Light theme', 'Dark theme'];
  document.querySelectorAll('[data-i18n-aria]').forEach((element, index) => {
    element.setAttribute('aria-label', themeLabels[index]);
    if (element.tagName === 'BUTTON') element.title = themeLabels[index];
  });
  select('language', language);
  preference('language', language);
  updateNotice();
}

function setTheme(value) {
  const theme = value === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = theme;
  select('theme-choice', theme);
  preference('theme', theme);
}

function setTool(value) {
  tool = value;
  select('tool', tool);
  updateNotice('');
}

function setMode(value) {
  mode = value;
  select('mode', mode);
  if (tool === 'picker') setTool('brush');
  updateNotice('');
}

for (const [group, handler] of Object.entries({
  language: setLanguage, 'theme-choice': setTheme, tool: setTool, mode: setMode
})) {
  document.querySelectorAll('[data-' + group + ']').forEach(button => {
    button.addEventListener('click', () => handler(button.getAttribute('data-' + group)));
  });
}

function fitZoom() {
  return Math.min(
    (viewport.clientWidth - 28) / image.width,
    (viewport.clientHeight - 28) / image.height,
    32
  );
}

function minimumZoom() {
  return Math.min(.0625, fitZoom());
}

function maximumZoom() {
  return Math.min(64, 131072 / Math.max(image.width, image.height));
}

function applyZoom(value) {
  if (!filename) return;
  zoom = Math.max(minimumZoom(), Math.min(maximumZoom(), value));
  stage.style.width = image.width * zoom + 'px';
  stage.style.height = image.height * zoom + 'px';
  byId('zoomLevel').textContent = Number((zoom * 100).toFixed(1)) + ' %';
  byId('zoomIn').disabled = zoom >= maximumZoom();
  byId('zoomOut').disabled = zoom <= minimumZoom();
}

function fitImage() {
  fit = true;
  applyZoom(fitZoom());
}

function zoomAt(value, x, y) {
  if (stroke) return;
  const before = image.getBoundingClientRect();
  const ratioX = (x - before.left) / before.width;
  const ratioY = (y - before.top) / before.height;
  fit = false;
  applyZoom(value);
  const after = image.getBoundingClientRect();
  viewport.scrollLeft += after.left + ratioX * after.width - x;
  viewport.scrollTop += after.top + ratioY * after.height - y;
}

function zoomFromCenter(value) {
  const bounds = viewport.getBoundingClientRect();
  zoomAt(value, bounds.left + viewport.clientWidth / 2, bounds.top + viewport.clientHeight / 2);
}

new ResizeObserver(() => { if (filename && fit) fitImage(); }).observe(viewport);
byId('zoomOut').addEventListener('click', () => zoomFromCenter(zoom / 1.5));
byId('zoomIn').addEventListener('click', () => zoomFromCenter(zoom * 1.5));
byId('actualSize').addEventListener('click', () => zoomFromCenter(1));
byId('fit').addEventListener('click', fitImage);
viewport.addEventListener('wheel', event => {
  if (!filename || !event.deltaY || event.shiftKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  zoomAt(zoom * (event.deltaY < 0 ? 1.25 : 1 / 1.25), event.clientX, event.clientY);
}, { passive: false });

async function load(file) {
  if (!file) return;
  const id = ++requestId;
  let bitmap;
  try {
    const header = new DataView(await file.slice(0, 24).arrayBuffer());
    if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a ||
        header.getUint32(12) !== 0x49484452) throw new Error('Invalid PNG');
    const width = header.getUint32(16);
    const height = header.getUint32(20);
    if (width > 8192 || height > 8192 || width * height > 16000000) {
      if (id === requestId) updateNotice('tooLarge');
      return;
    }
    bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
    if (id !== requestId) return;
    finishStroke();
    resetHistory();
    image.width = overlay.width = bitmap.width;
    image.height = overlay.height = bitmap.height;
    pixels.drawImage(bitmap, 0, 0);
    filename = file.name;
    stage.hidden = false;
    byId('empty').hidden = true;
    editing.disabled = false;
    byId('dimensions').textContent = image.width + ' × ' + image.height + ' px';
    byId('coordinates').textContent = '—';
    updateNotice('');
    fitImage();
  } catch {
    if (id === requestId) updateNotice('invalid');
  } finally {
    bitmap?.close();
  }
}

fileInput.addEventListener('change', () => {
  load(fileInput.files[0]);
  fileInput.value = '';
});

viewport.addEventListener('dragover', event => {
  event.preventDefault();
  viewport.classList.add('dragging');
});
viewport.addEventListener('dragleave', event => {
  if (!viewport.contains(event.relatedTarget)) viewport.classList.remove('dragging');
});
viewport.addEventListener('drop', event => {
  event.preventDefault();
  viewport.classList.remove('dragging');
  load(event.dataTransfer.files[0]);
});

function updateColor() {
  byId('hex').textContent = color.value.toUpperCase();
}
color.addEventListener('input', updateColor);

brushSize.addEventListener('input', () => {
  byId('brushSizeValue').textContent = brushSize.value + ' px';
});

function updateBackground() {
  stage.classList.toggle('solid-background', showBackground.checked);
  stage.style.setProperty('--reference-background', backgroundColor.value);
}
showBackground.addEventListener('change', updateBackground);
backgroundColor.addEventListener('input', () => {
  showBackground.checked = true;
  updateBackground();
});
updateBackground();

function locate(event, clamp = true) {
  const box = image.getBoundingClientRect();
  const x = Math.floor((event.clientX - box.left) * image.width / box.width);
  const y = Math.floor((event.clientY - box.top) * image.height / box.height);
  if (!clamp) return { x, y };
  return {
    x: Math.min(image.width - 1, Math.max(0, x)),
    y: Math.min(image.height - 1, Math.max(0, y))
  };
}

// Walk the integer pixel centers between pointer samples.
function brushLine(from, to, size, write) {
  let { x, y } = from;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const stepX = x < to.x ? 1 : -1;
  const stepY = y < to.y ? 1 : -1;
  const offset = Math.floor((size - 1) / 2);
  let error = dx + dy;
  while (true) {
    write(x - offset, y - offset, size, size);
    if (x === to.x && y === to.y) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += stepX; }
    if (twice <= dx) { error += dx; y += stepY; }
  }
}

function drawShape(shape, from, to, write) {
  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const width = Math.abs(from.x - to.x) + 1;
  const height = Math.abs(from.y - to.y) + 1;
  if (shape === 'rectangle' || width === 1 || height === 1) {
    write(left, top, width, height);
    return;
  }
  const radiusX = width / 2;
  const radiusY = height / 2;
  // Keep the geometry of the full drag and rasterize only visible rows.
  const firstRow = Math.max(0, -top);
  const lastRow = Math.min(height, image.height - top);
  for (let row = firstRow; row < lastRow; row++) {
    const dy = (row + .5 - radiusY) / radiusY;
    const halfSpan = radiusX * Math.sqrt(1 - dy * dy);
    const start = Math.ceil(radiusX - halfSpan - .5);
    const end = Math.floor(radiusX + halfSpan - .5);
    if (end >= start) write(left + start, top + row, end - start + 1, 1);
  }
}

function pixelWriter(context, gesture, isPreview = false) {
  context.fillStyle = gesture.mode === 'erase' ? 'rgba(226, 66, 55, .42)' : gesture.color;
  if (isPreview) return context.fillRect.bind(context);
  const write = gesture.mode === 'erase' ? context.clearRect.bind(context) : context.fillRect.bind(context);
  return (x, y, width, height) => {
    rememberTiles(gesture.action, x, y, width, height);
    write(x, y, width, height);
  };
}

function finishStroke(end) {
  if (!stroke) return;
  const gesture = stroke;
  stroke = undefined;
  preview.clearRect(0, 0, overlay.width, overlay.height);
  if (end) {
    const write = pixelWriter(pixels, gesture);
    if (gesture.tool === 'brush') brushLine(gesture.last, end, gesture.size, write);
    else drawShape(gesture.tool, gesture.start, end, write);
  }
  commitAction(gesture.action);
  if (image.hasPointerCapture(gesture.id)) image.releasePointerCapture(gesture.id);
}

image.addEventListener('pointerdown', event => {
  if (event.button !== 0 || stroke) return;
  const point = locate(event);
  if (tool === 'picker') {
    const [r, g, b, alpha] = pixels.getImageData(point.x, point.y, 1, 1).data;
    if (!alpha) {
      updateNotice('transparent');
      return;
    }
    color.value = '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('');
    updateColor();
    setMode('paint');
    return;
  }
  updateNotice('');
  stroke = { id: event.pointerId, start: point, last: point, tool, mode, color: color.value, size: brushSize.valueAsNumber };
  stroke.action = { tiles: new Map(), bytes: 0 };
  image.setPointerCapture(event.pointerId);
  if (tool === 'brush') brushLine(point, point, stroke.size, pixelWriter(pixels, stroke));
  else drawShape(tool, point, point, pixelWriter(preview, stroke, true));
});

image.addEventListener('pointermove', event => {
  const point = locate(event, false);
  const inside = point.x >= 0 && point.y >= 0 && point.x < image.width && point.y < image.height;
  byId('coordinates').textContent = inside ? 'X ' + point.x + ' · Y ' + point.y : '—';
  if (stroke?.id !== event.pointerId) return;
  if (stroke.tool === 'brush') {
    const write = pixelWriter(pixels, stroke);
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples) {
      const next = locate(sample);
      brushLine(stroke.last, next, stroke.size, write);
      stroke.last = next;
    }
    const next = inside ? point : locate(event);
    brushLine(stroke.last, next, stroke.size, write);
    stroke.last = next;
  } else {
    preview.clearRect(0, 0, overlay.width, overlay.height);
    drawShape(stroke.tool, stroke.start, point, pixelWriter(preview, stroke, true));
  }
});

image.addEventListener('pointerup', event => {
  if (stroke?.id === event.pointerId) finishStroke(locate(event, stroke.tool === 'brush'));
});
for (const type of ['pointercancel', 'lostpointercapture']) {
  image.addEventListener(type, event => {
    if (stroke?.id === event.pointerId) finishStroke();
  });
}
image.addEventListener('pointerleave', () => { byId('coordinates').textContent = '—'; });

byId('clear').addEventListener('click', () => {
  requestId++;
  finishStroke();
  resetHistory();
  filename = '';
  image.width = image.height = overlay.width = overlay.height = 1;
  stage.hidden = true;
  byId('empty').hidden = false;
  editing.disabled = true;
  for (const id of ['dimensions', 'coordinates', 'zoomLevel']) byId(id).textContent = '—';
  setMode('paint');
  setTool('brush');
});

byId('export').addEventListener('click', () => {
  const name = filename.replace(/\.png$/i, '') + '-spritelab.png';
  const id = requestId;
  image.toBlob(blob => {
    if (!blob) {
      if (id === requestId) updateNotice('exportError');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
});

setLanguage(preference('language'));
setTheme(preference('theme'));
