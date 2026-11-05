'use strict';

const $ = id => document.getElementById(id);
const D = Diagram;
const board = $('board');
const viewport = $('viewport');
const properties = $('properties');
const NS = 'http://www.w3.org/2000/svg';
const icons = {
  diagram: 'M8 7h8v5H8zM3 17h6v4H3zM15 17h6v4h-6zM12 12v3M6 17v-2h12v2',
  undo: 'M9 14 4 9l5-5M4 9h10a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5m5 5H10a5 5 0 0 0 0 10h3',
  format: 'M4 4h13v6H4zM17 7h3v6h-9v3m-2 0h4v6H9z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
  unlock: 'M7 10V7a5 5 0 0 1 9-3M5 10h14v11H5zM12 14v3',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  moon: 'M20.5 14A8.7 8.7 0 0 1 10 3.5 8.7 8.7 0 1 0 20.5 14Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  folder: 'M3 5h7l2 3h9v12H3z',
  save: 'M5 3h12l3 3v15H4V3zM8 3v6h8V3M8 21v-7h8v7',
  download: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  panel: 'M3 4h18v16H3zM9 4v16m6-11-3 3 3 3',
  expand: 'M3 4h18v16H3zM9 4v16m4-11 3 3-3 3',
  cursor: 'M5 3l14 10-7 1-3 7z',
  text: 'M4 7V4h16v3m-8-3v16m-4 0h8',
  image: 'M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5m-5-10h.01',
  port: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  sliders: 'M5 3v5m0 4v9M12 3v10m0 4v4M19 3v2m0 4v12M3 8h4v4H3zm7 5h4v4h-4zm7-8h4v4h-4z'
};

let project = D.create();
let selection = null;
let mode = 'select';
let shape = 'rectangle';
let pendingImage = null;
let copiedStyle = null;
let gesture = null;
let grid = true;
let zoom = null;
let scale = 1;
let drawingBounds = { width: D.width, height: D.height };
const foldedProperties = new Map([['POSICIÓN Y TAMAÑO', true]]);
const undo = [];
const redo = [];

function svg(tag, attributes = {}, parent) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent?.append(element);
  return element;
}

function drawIcon(container, name) {
  container.querySelector('.ui-icon')?.remove();
  const icon = svg('svg', { class: 'ui-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg('path', { d: icons[name] }, icon);
  container.prepend(icon);
}

document.querySelectorAll('[data-icon]').forEach(el => drawIcon(el, el.dataset.icon));
for (const [key, [label, path, , detail]] of Object.entries(D.shapes)) {
  const button = document.createElement('button');
  button.dataset.shape = key;
  button.title = label;
  button.setAttribute('aria-label', label);
  const icon = svg('svg', { class: 'ui-icon', viewBox: '-10 -10 120 120', 'aria-hidden': 'true' }, button);
  svg('path', { d: path, fill: 'var(--selected)', 'stroke-width': 6 }, icon);
  if (detail) svg('path', { d: detail, 'stroke-width': 6 }, icon);
  $('shapes').append(button);
}

const dark = () => document.body.dataset.theme === 'dark';
const selected = () => (selection?.type === 'node' ? project.nodes : project.edges).find(item => item.id === selection?.id);
const snapshot = () => structuredClone(project);
const themeInk = () => dark() ? '#e7edf7' : '#202b3c';
const ink = n => n.textColor || (n.type === 'shape' && !n.transparent ? '#202b3c' : themeInk());
const surface = () => dark() ? '#101722' : '#ffffff';

function remember(before) {
  undo.push(before);
  if (undo.length > 60) undo.shift();
  redo.length = 0;
}

function edit(change) {
  const before = snapshot();
  change();
  remember(before);
  refresh();
}

function history(from, to) {
  if (project.locked || gesture || !from.length) return;
  to.push(snapshot());
  project = from.pop();
  project.locked = false;
  selection = null;
  setMode('select');
}

function setMode(next, nextShape = shape) {
  mode = next;
  shape = nextShape;
  if (mode !== 'image') pendingImage = null;
  if (mode !== 'format') copiedStyle = null;
  refresh();
}

function resizeBoard() {
  const content = D.contentBounds(project.nodes);
  scale = zoom ?? D.clamp(Math.min(viewport.clientWidth / content.width, viewport.clientHeight / content.height), .15, 1);
  const pixelWidth = Math.max(viewport.clientWidth, content.width * scale);
  const pixelHeight = Math.max(viewport.clientHeight, content.height * scale);
  drawingBounds = { width: pixelWidth / scale, height: pixelHeight / scale };
  board.setAttribute('viewBox', '0 0 ' + drawingBounds.width + ' ' + drawingBounds.height);
  board.style.width = pixelWidth + 'px';
  board.style.height = pixelHeight + 'px';
  board.style.backgroundSize = 24 * scale + 'px ' + 24 * scale + 'px';
  for (const input of properties.querySelectorAll('[data-axis]')) {
    input.max = Math.floor(drawingBounds[input.dataset.axis]);
  }
  $('zoom').textContent = Math.round(scale * 100) + ' %';
  positionEmpty();
}

function positionEmpty() {
  viewport.style.setProperty('--empty-x', viewport.scrollLeft + viewport.clientWidth / 2 + 'px');
  viewport.style.setProperty('--empty-y', viewport.scrollTop + viewport.clientHeight / 2 + 'px');
}

function zoomTo(value, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) {
  const x = (viewport.scrollLeft + anchorX) / scale;
  const y = (viewport.scrollTop + anchorY) / scale;
  zoom = value === null ? null : D.clamp(value, .15, 2.5);
  resizeBoard();
  viewport.scrollLeft = x * scale - anchorX;
  viewport.scrollTop = y * scale - anchorY;
  render(board, true);
}

function drawNode(parent, n, interactive, strokeScale) {
  const attrs = { transform: 'translate(' + n.x + ' ' + n.y + ') rotate(' + n.rotation + ' ' + n.w / 2 + ' ' + n.h / 2 + ')' };
  if (interactive) {
    attrs['data-node'] = n.id;
    if (n.locked) attrs['data-locked'] = '';
  }
  const g = svg('g', attrs, parent);
  if (interactive && n.type !== 'shape') {
    svg('rect', { width: n.w, height: n.h, fill: 'transparent' }, g);
  }
  if (n.type === 'shape') {
    const style = { fill: n.transparent ? 'transparent' : n.fill, stroke: n.stroke, 'stroke-width': n.strokeWidth, 'stroke-linejoin': 'round' };
    const scaledPath = {
      ...style, transform: 'scale(' + n.w / 100 + ' ' + n.h / 100 + ')',
      'vector-effect': 'non-scaling-stroke',
      'stroke-width': n.strokeWidth * strokeScale
    };
    if (D.hasCorners(n.shape)) {
      svg('rect', { ...style, width: n.w, height: n.h, rx: Math.min(n.radius, n.w / 2, n.h / 2) }, g);
    } else {
      svg('path', { ...scaledPath, d: D.shapes[n.shape][1] }, g);
    }
    const detail = D.shapes[n.shape][3];
    if (detail) svg('path', { ...scaledPath, fill: 'none', d: detail, 'pointer-events': 'none' }, g);
  }
  if (n.type === 'image') {
    svg('image', { href: n.src, width: n.w, height: n.h, opacity: n.opacity / 100, preserveAspectRatio: n.stretch ? 'none' : 'xMidYMid meet' }, g);
  }
  if (n.text && n.type !== 'image') {
    const x = { start: 8, middle: n.w / 2, end: n.w - 8 }[n.align];
    const text = svg('text', {
      x, transform: 'translate(' + x + ' ' + n.h / 2 + ') scale(' + n.textScaleX + ' ' + n.textScaleY + ') translate(' + -x + ' ' + -n.h / 2 + ')',
      fill: ink(n), 'font-family': n.font + ', sans-serif', 'font-size': n.size,
      'font-weight': n.bold ? '700' : '400', 'font-style': n.italic ? 'italic' : 'normal',
      'text-anchor': n.align, 'dominant-baseline': 'central', 'pointer-events': 'none',
      'xml:space': 'preserve'
    }, g);
    const lines = n.text.split('\n');
    lines.forEach((line, index) => {
      svg('tspan', { x, y: n.h / 2 + (index - (lines.length - 1) / 2) * n.size * 1.2 }, text).textContent = line;
    });
  }
}

function drawEdge(parent, defs, e, nodes, interactive, hitOnly = false) {
  const path = D.pathFor(e, nodes);
  if (hitOnly) {
    svg('path', { d: path, 'data-edge': e.id, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(16, e.width + 10), 'pointer-events': 'stroke' }, parent);
    return;
  }
  const selectedEdge = interactive && selection?.id === e.id;
  const attrs = {
    d: path, fill: 'none', stroke: e.color, 'stroke-width': e.width,
    'stroke-dasharray': D.dashes[e.dash], 'stroke-linejoin': 'round',
    'stroke-linecap': 'round', 'pointer-events': 'none'
  };
  if (e.arrows !== 'none') {
    const size = 7 + e.width * 1.6;
    const marker = svg('marker', {
      id: 'arrow-' + e.id, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: size, markerHeight: size, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse'
    }, defs);
    svg('path', { d: 'M0 0L10 5 0 10 2.5 5Z', fill: e.color }, marker);
    if (e.arrows === 'end' || e.arrows === 'both') attrs['marker-end'] = 'url(#arrow-' + e.id + ')';
    if (e.arrows === 'start' || e.arrows === 'both') attrs['marker-start'] = 'url(#arrow-' + e.id + ')';
  }
  if (selectedEdge) {
    svg('path', { d: path, fill: 'none', stroke: '#2878e8', 'stroke-opacity': .28, 'stroke-width': e.width + 9, 'pointer-events': 'none' }, parent);
  }
  svg('path', attrs, parent);
}

function drawSelection(overlay, n) {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const box = svg('g', { transform: 'rotate(' + n.rotation + ' ' + cx + ' ' + cy + ')' }, overlay);
  svg('rect', {
    x: n.x, y: n.y, width: n.w, height: n.h, fill: 'none', stroke: '#2878e8',
    'stroke-dasharray': '5 4', 'stroke-width': 1 / scale, 'pointer-events': 'none'
  }, box);
  if (n.locked || project.locked || mode !== 'select') return;
  const r = 3.5 / scale;
  const style = { fill: surface(), stroke: '#2878e8', 'stroke-width': 1 / scale, 'data-handle': n.id };
  const grip = svg('rect', {
    ...style, x: n.x + n.w - 7, y: n.y + n.h - 7,
    width: 14, height: 14, rx: 2, 'data-kind': 'resize'
  }, box);
  svg('title', {}, grip).textContent = 'Redimensionar';
  const offset = 21 / scale;
  const top = D.rotatePoint(n, { x: cx, y: n.y - offset });
  const fits = top.x >= r && top.y >= r && top.x <= drawingBounds.width - r && top.y <= drawingBounds.height - r;
  const y = fits ? n.y - offset : n.y + offset;
  svg('line', { x1: cx, x2: cx, y1: n.y, y2: y, stroke: style.stroke, 'stroke-width': 1 / scale, 'pointer-events': 'none' }, box);
  const rotate = svg('circle', { ...style, cx, cy: y, r: r * 1.25, 'data-kind': 'rotate' }, box);
  svg('title', {}, rotate).textContent = 'Rotar';
}

function render(parent, interactive, bounds = drawingBounds, strokeScale = scale) {
  parent.replaceChildren();
  if (!interactive) svg('rect', { width: bounds.width, height: bounds.height, fill: surface() }, parent);
  const defs = svg('defs', {}, parent);
  const nodes = new Map(project.nodes.map(n => [n.id, n]));
  // Links sit above elements so interior connection points and arrows stay visible.
  const content = svg('g', {}, parent);
  project.nodes.forEach(n => drawNode(content, n, interactive, strokeScale));
  const links = svg('g', {}, parent);
  project.edges.forEach(e => drawEdge(links, defs, e, nodes, interactive));
  if (!interactive) return;

  project.edges.forEach(e => drawEdge(links, defs, e, nodes, true, true));
  const overlay = svg('g', {}, parent);
  const n = selection?.type === 'node' && nodes.get(selection.id);
  if (n) drawSelection(overlay, n);
  if (!project.locked && (mode === 'select' || mode === 'port')) {
    const pointRadius = Math.max(5, 4 / scale);
    for (const node of project.nodes) {
      for (const p of node.ports) {
        const pos = D.portPosition(node, p);
        svg('circle', {
          cx: pos.x, cy: pos.y, r: pointRadius, class: 'port', fill: surface(),
          stroke: '#2878e8', 'stroke-width': Math.max(2, pointRadius / 3),
          'data-port': p.id, 'data-owner': node.id
        }, overlay);
      }
    }
  }
  if (gesture?.kind === 'connect') {
    svg('line', {
      x1: gesture.start.x, y1: gesture.start.y, x2: gesture.end.x, y2: gesture.end.y,
      stroke: '#2878e8', 'stroke-width': 3, 'stroke-dasharray': '7 5', 'pointer-events': 'none'
    }, overlay);
  }
  if (gesture?.kind === 'create') {
    const rect = creationRect(gesture.start, gesture.end);
    svg('rect', {
      x: rect.x, y: rect.y, width: rect.w, height: rect.h, fill: '#2878e8', 'fill-opacity': .1,
      stroke: '#2878e8', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'pointer-events': 'none'
    }, overlay);
  }
}

function setTheme(value) {
  document.body.dataset.theme = value;
  drawIcon($('theme'), dark() ? 'sun' : 'moon');
  $('theme').setAttribute('aria-pressed', dark());
}

function setCollapsed(value) {
  $('tools').classList.toggle('collapsed', value);
  $('palette').hidden = value;
  $('collapse').setAttribute('aria-expanded', !value);
  $('collapse').title = value ? 'Expandir herramientas' : 'Contraer herramientas';
  $('collapse').setAttribute('aria-label', $('collapse').title);
  drawIcon($('collapse'), value ? 'expand' : 'panel');
  resizeBoard();
  render(board, true);
}

function refresh(inspect = true) {
  const locked = project.locked;
  $('lock').setAttribute('aria-pressed', locked);
  $('lock').title = locked ? 'Desbloquear lienzo' : 'Bloquear lienzo';
  $('lock').setAttribute('aria-label', $('lock').title);
  drawIcon($('lock'), locked ? 'lock' : 'unlock');
  $('lock-badge').hidden = !locked;
  $('undo').disabled = locked || !undo.length;
  $('redo').disabled = locked || !redo.length;
  $('format').disabled = locked || !selected();
  $('format').setAttribute('aria-pressed', mode === 'format');
  $('open').disabled = locked;
  $('clear').disabled = locked || !project.nodes.length;
  $('image').disabled = locked;
  $('start').disabled = locked;
  $('empty').hidden = project.nodes.length > 0 || mode !== 'select' || locked;
  $('grid').setAttribute('aria-pressed', grid);
  board.classList.toggle('show-grid', grid);
  resizeBoard();
  board.dataset.mode = mode;
  board.toggleAttribute('data-readonly', locked);
  for (const button of document.querySelectorAll('[data-mode], [data-shape]')) {
    if (button === board) continue;
    const active = button.dataset.mode === mode || (mode === 'shape' && button.dataset.shape === shape);
    button.setAttribute('aria-pressed', active);
    button.disabled = locked && button.dataset.mode !== 'select';
  }
  const prompts = {
    shape: 'Haz clic o arrastra para colocar la forma.',
    text: 'Haz clic en el lienzo para colocar el texto.',
    image: 'Haz clic en el lienzo para colocar la imagen.',
    port: 'Haz clic sobre un elemento para añadir un punto.',
    format: 'Haz clic en el objeto al que quieres aplicar el formato. Esc para cancelar.'
  };
  $('status').textContent = locked ? 'Lienzo de solo lectura' : prompts[mode] ??
    (project.nodes.length + ' ' + (project.nodes.length === 1 ? 'elemento' : 'elementos') + ' · ' +
      project.edges.length + ' ' + (project.edges.length === 1 ? 'conexión' : 'conexiones'));
  render(board, true);
  if (inspect) renderProperties();
}

function renderProperties() {
  for (const details of properties.querySelectorAll('details[data-group]')) {
    foldedProperties.set(details.dataset.group, !details.open);
  }
  properties.replaceChildren();
  const body = document.createElement('div');
  body.className = 'property-body';
  properties.append(body);
  const item = selected();
  if (!item) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Selecciona un elemento o una conexión del lienzo para editar sus propiedades.';
    body.append(hint);
    return;
  }

  const isNode = selection.type === 'node';
  const disabled = project.locked || item.locked;
  const title = document.createElement('p');
  title.className = 'property-title';
  title.textContent = isNode ? D.shapes[item.shape]?.[0] ?? (item.type === 'text' ? 'Texto' : item.name || 'Imagen') : 'Conexión';
  const actions = document.createElement('div');
  actions.className = 'property-actions';
  body.append(title, actions);
  const action = (text, fn, disabled, icon) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.disabled = disabled;
    if (icon) drawIcon(btn, icon);
    btn.addEventListener('click', fn);
    actions.append(btn);
    return btn;
  };
  action(item.locked ? 'Desbloquear' : 'Bloquear', () => edit(() => { item.locked = !item.locked; }), project.locked, item.locked ? 'lock' : 'unlock');
  const remove = action('Eliminar', removeSelected, disabled || hasLockedLinks(item.id), 'trash');
  remove.classList.add('danger');

  let section;
  const syncGeometry = [];
  function group(name) {
    const details = document.createElement('details');
    details.dataset.group = name;
    details.open = !foldedProperties.get(name);
    const summary = document.createElement('summary');
    summary.textContent = name;
    section = document.createElement('section');
    details.append(summary, section);
    body.append(details);
  }
  function field(label, key, type, config = {}) {
    const numeric = type === 'number';
    const wrapper = document.createElement(numeric ? 'div' : 'label');
    wrapper.className = 'field';
    const tag = ['textarea', 'select'].includes(type) ? type : 'input';
    const control = document.createElement(tag);
    if (tag === 'input') control.type = type;
    if (type === 'select') {
      for (const [value, caption] of config.options) control.append(new Option(caption, value));
    }
    const slider = numeric ? document.createElement('input') : null;
    if (numeric) {
      wrapper.classList.add('number-field');
      control.id = 'property-' + key;
      slider.type = 'range';
      slider.setAttribute('aria-label', label + ' (deslizador)');
      for (const input of [control, slider]) {
        input.min = config.min;
        input.max = config.axis ? Math.floor(drawingBounds[config.axis]) : config.max;
        if (config.axis) input.dataset.axis = config.axis;
        input.disabled = disabled;
      }
    }
    if (type === 'textarea') {
      control.maxLength = 4000;
      control.dataset.textEditor = '';
    }
    const sync = () => {
      if (type === 'checkbox') control.checked = item[key];
      else control.value = item[key] === '' && type === 'color' ? ink(item) : item[key];
      if (slider) slider.value = item[key];
    };
    if (config.axis) syncGeometry.push(sync);
    sync();
    control.disabled = disabled;
    function apply(value, record) {
      if (project.locked || item.locked || selected() !== item) return;
      if (numeric) {
        if (!Number.isFinite(value)) return sync();
        value = Math.round(D.clamp(value, config.min, Number(control.max)));
      }
      if (item[key] === value) {
        sync();
        return false;
      }
      if (record) remember(snapshot());
      item[key] = value;
      if (config.axis) {
        if (D.shapes[item.shape]?.[2] && (key === 'w' || key === 'h')) {
          item.w = item.h = Math.min(value, drawingBounds.width, drawingBounds.height);
        }
        D.fitNode(item, drawingBounds);
      }
      if (config.axis) syncGeometry.forEach(update => update());
      else if (key === 'transparent') renderProperties();
      else sync();
      refresh(false);
      return true;
    }
    control.addEventListener('change', () => {
      const value = numeric ? control.valueAsNumber : type === 'checkbox' ? control.checked : control.value;
      apply(value, true);
    });
    if (slider) {
      let adjusting = false;
      slider.addEventListener('input', () => {
        if (apply(slider.valueAsNumber, !adjusting)) adjusting = true;
      });
      for (const event of ['change', 'blur', 'pointercancel']) {
        slider.addEventListener(event, () => { adjusting = false; });
      }
      const caption = document.createElement('label');
      caption.htmlFor = control.id;
      caption.textContent = label;
      wrapper.append(caption, control, slider);
    } else {
      wrapper.append(document.createTextNode(label), control);
    }
    section.append(wrapper);
  }

  if (!isNode) {
    group('TRAZO');
    field('Color', 'color', 'color');
    field('Grosor', 'width', 'number', { min: 1, max: 24 });
    field('Tipo de línea', 'dash', 'select', { options: [['solid', 'Continua'], ['dash', 'Discontinua'], ['dot', 'Punteada'], ['dashdot', 'Punto y raya']] });
    field('Trayectoria', 'route', 'select', { options: [['straight', 'Recta'], ['curve', 'Curva'], ['elbow', 'En ángulo']] });
    field('Flechas', 'arrows', 'select', { options: [['none', 'Sin flechas'], ['end', 'Al destino'], ['start', 'Al origen'], ['both', 'Bidireccional']] });
    return;
  }

  group('POSICIÓN Y TAMAÑO');
  for (const [label, key, min, axis] of [['X', 'x', 0, 'width'], ['Y', 'y', 0, 'height'], ['Ancho', 'w', 16, 'width'], ['Alto', 'h', 16, 'height']]) {
    field(label, key, 'number', { min, axis });
  }

  if (item.type === 'shape') {
    group('APARIENCIA');
    field('Relleno', 'fill', 'color');
    field('Sin relleno', 'transparent', 'checkbox');
    field('Color del borde', 'stroke', 'color');
    field('Grosor del borde', 'strokeWidth', 'number', { min: 0, max: 24 });
    if (D.hasCorners(item.shape)) {
      field('Radio de esquina', 'radius', 'number', { min: 0, max: 400 });
    }
  }

  if (item.type === 'image') {
    group('APARIENCIA');
    field('Opacidad (%)', 'opacity', 'number', { min: 0, max: 100 });
  }

  if (item.type !== 'image') {
    group('TEXTO');
    field('Contenido', 'text', 'textarea');
    field('Color', 'textColor', 'color');
    field('Tipografía', 'font', 'select', { options: D.fonts.map(font => [font, font]) });
    field('Tamaño', 'size', 'number', { min: 6, max: 160 });
    field('Alineación', 'align', 'select', { options: [['start', 'Izquierda'], ['middle', 'Centro'], ['end', 'Derecha']] });
    field('Negrita', 'bold', 'checkbox');
    field('Cursiva', 'italic', 'checkbox');
  }

  group('CONEXIONES');
  const add = document.createElement('button');
  add.textContent = 'Añadir punto';
  add.disabled = disabled;
  drawIcon(add, 'port');
  add.addEventListener('click', () => setMode('port'));
  section.append(add);
  item.ports.forEach((port, index) => {
    const button = document.createElement('button');
    button.textContent = 'Quitar punto ' + (index + 1);
    button.disabled = disabled || hasLockedLinks(item.id, port.id);
    button.addEventListener('click', () => edit(() => {
      item.ports = item.ports.filter(p => p !== port);
      project.edges = project.edges.filter(e => !touches(e, item.id, port.id));
    }));
    section.append(button);
  });
}

function touches(e, node, port) {
  return [e.from, e.to].some(end => end.node === node && (!port || end.port === port));
}

function hasLockedLinks(node, port) {
  return project.edges.some(e => e.locked && touches(e, node, port));
}

function removeSelected() {
  const item = selected();
  if (!item || project.locked || item.locked || hasLockedLinks(item.id)) return;
  edit(() => {
    if (selection.type === 'node') {
      project.nodes = project.nodes.filter(n => n !== item);
      project.edges = project.edges.filter(e => !touches(e, item.id));
    } else {
      project.edges = project.edges.filter(e => e !== item);
    }
    selection = null;
  });
}

function coordinates(event, clip = true) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(board.getScreenCTM().inverse());
  return clip ? { x: D.clamp(p.x, 0, drawingBounds.width), y: D.clamp(p.y, 0, drawingBounds.height) } : p;
}

function creationRect(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let w = Math.max(16, Math.abs(dx));
  let h = Math.max(16, Math.abs(dy));
  if (D.shapes[shape][2]) w = h = Math.min(Math.max(w, h), drawingBounds.width, drawingBounds.height);
  return D.fitNode({ x: dx < 0 ? a.x - w : a.x, y: dy < 0 ? a.y - h : a.y, w, h }, drawingBounds);
}

function insert(type, rect) {
  const n = D.fitNode(D.node(type, type === 'shape' ? shape : '', rect.x, rect.y, rect.w, rect.h), drawingBounds);
  if (type === 'image') Object.assign(n, { src: pendingImage.src, name: pendingImage.name });
  edit(() => {
    project.nodes.push(n);
    selection = { type: 'node', id: n.id };
    mode = 'select';
    pendingImage = null;
  });
  if (type === 'text') focusText();
}

function focusText() {
  const text = properties.querySelector('[data-text-editor]:enabled');
  if (text) text.closest('details').open = true;
  text?.focus({ preventScroll: true });
  text?.select();
}

function begin(event, details) {
  gesture = { ...details, pointer: event.pointerId, startClient: [event.clientX, event.clientY] };
  board.setPointerCapture(event.pointerId);
}

function applyCopiedStyle(targetSelection) {
  if (!targetSelection) return report('Haz clic sobre un objeto para aplicar el formato.');
  const { type, id } = targetSelection;
  const item = (type === 'edge' ? project.edges : project.nodes).find(item => item.id === id);
  if (!item) return;
  if (item.locked) return report('El objeto está bloqueado. Elige otro destino o pulsa Esc.');
  const style = D.compatibleStyle(copiedStyle, { ...item, type: type === 'edge' ? type : item.type });
  const keys = Object.keys(style);
  if (!keys.length) return report('El formato no es compatible con ese objeto. Elige otro destino o pulsa Esc.');
  if (keys.some(key => item[key] !== style[key])) {
    remember(snapshot());
    Object.assign(item, style);
  }
  selection = targetSelection;
  setMode('select');
  report('Formato aplicado.');
}

board.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || gesture) return;
  const at = coordinates(event);
  const target = event.target;
  const port = target.closest('[data-port]');
  const handle = target.closest('[data-handle]');
  const object = target.closest('[data-node]');
  const link = target.closest('[data-edge]');
  if (properties.contains(document.activeElement)) document.activeElement.blur();
  if (!project.locked && mode === 'format') {
    const targetSelection = link ? { type: 'edge', id: link.dataset.edge }
      : object ? { type: 'node', id: object.dataset.node } : null;
    applyCopiedStyle(targetSelection);
    return;
  }
  if (!project.locked && mode === 'shape') {
    begin(event, { kind: 'create', start: at, end: at });
    refresh(false);
    return;
  }
  if (!project.locked && mode === 'text') {
    insert('text', { x: at.x - 95, y: at.y - 28, w: 190, h: 56 });
    return;
  }
  if (!project.locked && mode === 'image' && pendingImage) {
    const { w, h } = pendingImage;
    insert('image', { x: at.x - w / 2, y: at.y - h / 2, w, h });
    return;
  }
  if (port && !project.locked) {
    const n = project.nodes.find(n => n.id === port.dataset.owner);
    const p = n.ports.find(p => p.id === port.dataset.port);
    begin(event, { kind: 'connect', from: { node: n.id, port: p.id }, start: D.portPosition(n, p), end: at });
    refresh(false);
    return;
  }
  const node = project.nodes.find(n => n.id === (handle?.dataset.handle ?? object?.dataset.node));
  if (!project.locked && mode === 'port') {
    if (!node || node.locked) {
      $('status').textContent = node ? 'Desbloquea el elemento para añadir puntos.' : 'Haz clic sobre un elemento.';
      return;
    }
    const local = D.rotatePoint(node, at, -node.rotation);
    edit(() => {
      node.ports.push({
        id: D.newId(),
        u: D.clamp((local.x - node.x) / node.w, 0, 1),
        v: D.clamp((local.y - node.y) / node.h, 0, 1)
      });
      selection = { type: 'node', id: node.id };
      mode = 'select';
    });
    return;
  }
  if (link && !handle) selection = { type: 'edge', id: link.dataset.edge };
  else if (node) {
    selection = { type: 'node', id: node.id };
    if (!project.locked && !node.locked) {
      begin(event, {
        kind: handle?.dataset.kind ?? 'move', before: snapshot(), node,
        start: at, original: { x: node.x, y: node.y, w: node.w, h: node.h, rotation: node.rotation }
      });
    }
  } else selection = null;
  refresh();
});

function updateGesture(event) {
  const g = gesture;
  const placement = g.kind === 'connect' || g.kind === 'create';
  const at = coordinates(event, placement);
  if (placement) {
    g.end = at;
    return;
  }
  const dx = at.x - g.start.x;
  const dy = at.y - g.start.y;
  const n = g.node;
  const original = g.original;
  const cx = original.x + original.w / 2;
  const cy = original.y + original.h / 2;
  if (g.kind === 'move') {
    n.x = original.x + dx;
    n.y = original.y + dy;
  } else if (g.kind === 'rotate') {
    const turn = Math.atan2(at.y - cy, at.x - cx) - Math.atan2(g.start.y - cy, g.start.x - cx);
    let angle = original.rotation + turn * 180 / Math.PI;
    if (event.shiftKey) angle = Math.round(angle / 15) * 15;
    n.rotation = ((Math.round(angle) + 180) % 360 + 360) % 360 - 180;
    n.x = original.x;
    n.y = original.y;
  } else {
    const delta = D.rotateVector(dx, dy, -original.rotation);
    const availableW = drawingBounds.width - original.x;
    const availableH = drawingBounds.height - original.y;
    if (D.shapes[n.shape]?.[2]) {
      const change = Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : delta.y;
      n.w = n.h = Math.round(D.clamp(original.w + change, 16, Math.floor(Math.min(availableW, availableH))));
    } else {
      n.w = Math.round(D.clamp(original.w + delta.x, 16, Math.floor(availableW)));
      n.h = Math.round(D.clamp(original.h + delta.y, 16, Math.floor(availableH)));
    }
    const shift = D.rotateVector((n.w - original.w) / 2, (n.h - original.h) / 2, original.rotation);
    n.x = cx + shift.x - n.w / 2;
    n.y = cy + shift.y - n.h / 2;
  }
  D.fitNode(n, drawingBounds);
}

board.addEventListener('pointermove', event => {
  if (gesture?.pointer !== event.pointerId) return;
  updateGesture(event);
  render(board, true);
});

board.addEventListener('pointerup', event => {
  if (gesture?.pointer !== event.pointerId) return;
  const g = gesture;
  updateGesture(event);
  gesture = null;
  if (g.kind === 'create') {
    const distance = Math.hypot(event.clientX - g.startClient[0], event.clientY - g.startClient[1]);
    const [w, h] = D.shapes[shape][2] ? [104, 104] : [176, 100];
    insert('shape', distance < 5 ? { x: g.start.x - w / 2, y: g.start.y - h / 2, w, h } : creationRect(g.start, g.end));
    return;
  }
  if (g.kind === 'connect') {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-port]');
    if (target && target.dataset.port !== g.from.port) {
      const to = { node: target.dataset.owner, port: target.dataset.port };
      const e = D.edge(g.from, to, g.from.node === to.node);
      edit(() => {
        project.edges.push(e);
        selection = { type: 'edge', id: e.id };
        mode = 'select';
      });
      return;
    }
  } else if (Object.keys(g.original).some(key => g.node[key] !== g.original[key])) {
    remember(g.before);
  }
  refresh();
});

function cancelGesture() {
  if (!gesture) return;
  if (gesture.before) project = gesture.before;
  const pointer = gesture.pointer;
  gesture = null;
  if (board.hasPointerCapture(pointer)) board.releasePointerCapture(pointer);
  refresh();
}
board.addEventListener('pointercancel', cancelGesture);
board.addEventListener('lostpointercapture', cancelGesture);
board.addEventListener('dblclick', () => {
  if (selection?.type === 'node' && selected()?.type !== 'image') focusText();
});

function report(message) {
  $('status').textContent = message;
}

const imageTypes = {
  png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', gif: 'gif', svg: 'svg+xml',
  ico: 'x-icon', avif: 'avif', bmp: 'bmp', apng: 'apng'
};
let imageRead = 0;
$('image-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || project.locked) return;
  const request = ++imageRead;
  try {
    const extension = file.name.split('.').pop().toLowerCase();
    const blob = Object.hasOwn(imageTypes, extension) ? new Blob([file], { type: 'image/' + imageTypes[extension] }) : file;
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (!D.isDataImage(src)) throw new Error('Selecciona una imagen PNG, JPG, SVG, WebP, GIF, ICO, AVIF o BMP.');
    const image = new Image();
    image.src = src;
    await image.decode();
    if (project.locked || request !== imageRead) return;
    const ratio = Math.min(1, 260 / Math.max(image.naturalWidth, image.naturalHeight));
    pendingImage = {
      src, name: file.name.slice(0, 260),
      w: Math.max(16, image.naturalWidth * ratio),
      h: Math.max(16, image.naturalHeight * ratio)
    };
    setMode('image');
  } catch (error) {
    if (request === imageRead) report(error.message || 'No se pudo abrir la imagen.');
  }
});

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

$('save').addEventListener('click', () => {
  const view = {
    theme: document.body.dataset.theme, grid, zoom,
    collapsed: $('tools').classList.contains('collapsed'),
    left: viewport.scrollLeft, top: viewport.scrollTop
  };
  download(new Blob([JSON.stringify({ ...project, view }, null, 2)], { type: 'application/json' }), 'diagrama.flow.json');
  report('Proyecto guardado como JSON.');
});

$('project-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || project.locked) return;
  try {
    const imported = D.parse(await file.text());
    if (project.locked) return;
    cancelGesture();
    imageRead++;
    remember(snapshot());
    project = imported.project;
    selection = null;
    grid = imported.view.grid;
    zoom = imported.view.zoom;
    setTheme(imported.view.theme);
    setCollapsed(imported.view.collapsed);
    viewport.scrollTo(imported.view.left, imported.view.top);
    setMode('select');
    report('Proyecto importado' + (project.locked ? ' · Lienzo de solo lectura' : '.'));
  } catch (error) {
    report(error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message);
  }
});

$('export').addEventListener('click', async () => {
  const bounds = D.contentBounds(project.nodes);
  const { width, height } = bounds;
  const ratio = Math.min(2, 8192 / Math.max(width, height), Math.sqrt(16000000 / (width * height)));
  const outputWidth = Math.max(1, Math.floor(width * ratio));
  const outputHeight = Math.max(1, Math.floor(height * ratio));
  const art = svg('svg', { width: outputWidth, height: outputHeight, viewBox: '0 0 ' + width + ' ' + height });
  render(art, false, bounds, ratio);
  const source = new XMLSerializer().serializeToString(art);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar el PNG.');
    download(blob, 'diagrama.png');
    report('PNG exportado · ' + canvas.width + ' × ' + canvas.height + ' px.');
  } catch {
    report('No se pudo exportar el PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
});

$('palette').addEventListener('click', event => {
  const tool = event.target.closest('[data-mode], [data-shape]');
  if (!tool || tool.disabled) return;
  if (tool.dataset.shape) setMode('shape', tool.dataset.shape);
  else setMode(tool.dataset.mode);
});
$('image').addEventListener('click', () => $('image-file').click());
$('open').addEventListener('click', () => $('project-file').click());
$('undo').addEventListener('click', () => history(undo, redo));
$('redo').addEventListener('click', () => history(redo, undo));
$('format').addEventListener('click', () => {
  if (mode === 'format') return setMode('select');
  const item = selected();
  if (!item || project.locked) return;
  copiedStyle = { ...item, type: selection.type === 'edge' ? 'edge' : item.type };
  setMode('format');
});
$('lock').addEventListener('click', () => {
  cancelGesture();
  imageRead++;
  project.locked = !project.locked;
  setMode('select');
});
$('clear').addEventListener('click', () => {
  if (!confirm('¿Limpiar el lienzo? Puedes recuperar el diagrama con Deshacer.')) return;
  cancelGesture();
  imageRead++;
  edit(() => {
    project = D.create();
    selection = null;
    mode = 'select';
    pendingImage = null;
    copiedStyle = null;
  });
});
$('start').addEventListener('click', () => setMode('shape', 'rectangle'));
$('theme').addEventListener('click', () => {
  setTheme(dark() ? 'light' : 'dark');
  refresh();
});
$('grid').addEventListener('click', () => {
  grid = !grid;
  refresh(false);
});
$('collapse').addEventListener('click', () => setCollapsed(!$('tools').classList.contains('collapsed')));
$('minus').addEventListener('click', () => zoomTo(scale / 1.25));
$('plus').addEventListener('click', () => zoomTo(scale * 1.25));
$('zoom').addEventListener('click', () => zoomTo(1));
$('fit').addEventListener('click', () => zoomTo(null));
viewport.addEventListener('scroll', positionEmpty);
viewport.addEventListener('wheel', event => {
  if (gesture || !event.deltaY) return;
  event.preventDefault();
  const bounds = viewport.getBoundingClientRect();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  const delta = D.clamp(event.deltaY * units, -180, 180);
  zoomTo(scale * Math.exp(-delta * .0018), event.clientX - bounds.left, event.clientY - bounds.top);
}, { passive: false });
new ResizeObserver(() => {
  resizeBoard();
  render(board, true);
}).observe(viewport);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (properties.contains(document.activeElement)) document.activeElement.blur();
    cancelGesture();
    selection = null;
    setMode('select');
    return;
  }
  if (event.target.matches('input, textarea, select, [contenteditable]') || gesture || project.locked) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z' || key === 'y') {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) history(redo, undo);
      else history(undo, redo);
    }
    return;
  }
  if (event.altKey) return;
  if (key === 'delete') removeSelected();
  if (key === 'v') setMode('select');
  if (key === 't') setMode('text');
  if (key === 'p') setMode('port');
});

resizeBoard();
refresh();
