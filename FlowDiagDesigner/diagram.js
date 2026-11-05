'use strict';

const Diagram = (() => {
  const width = 1600;
  const height = 1000;
  const shapes = {
    rectangle: ['Rectángulo', 'M0 0H100V100H0Z'],
    rounded: ['Rectángulo redondeado', 'M15 0H85Q100 0 100 15V85Q100 100 85 100H15Q0 100 0 85V15Q0 0 15 0Z'],
    square: ['Cuadrado', 'M0 0H100V100H0Z', true],
    capsule: ['Inicio / fin', 'M30 0H70A30 50 0 0 1 70 100H30A30 50 0 0 1 30 0Z'],
    circle: ['Círculo', 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z', true],
    ellipse: ['Elipse', 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z'],
    diamond: ['Decisión / rombo', 'M50 0L100 50 50 100 0 50Z'],
    triangle: ['Triángulo', 'M50 0L100 100H0Z'],
    inverted: ['Triángulo invertido', 'M0 0H100L50 100Z'],
    rightTriangle: ['Triángulo rectángulo', 'M0 0L100 100H0Z'],
    trapezoid: ['Trapecio', 'M22 0H78L100 100H0Z'],
    parallelogram: ['Entrada / salida', 'M21 0H100L79 100H0Z'],
    pentagon: ['Pentágono', 'M50 0L100 38 82 100H18L0 38Z'],
    hexagon: ['Preparación / hexágono', 'M24 0H76L100 50 76 100H24L0 50Z'],
    heptagon: ['Heptágono', 'M50 0L89 18 100 59 72 100H28L0 59 11 18Z'],
    octagon: ['Octágono', 'M28 0H72L100 28V72L72 100H28L0 72V28Z'],
    star: ['Estrella', 'M50 0L64 34 100 38 73 63 81 100 50 81 19 100 27 63 0 38 36 34Z'],
    cross: ['Cruz', 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z'],
    heart: ['Corazón', 'M50 100C40 85 0 62 0 32 0 4 32 -11 50 15 68 -11 100 4 100 32 100 62 60 85 50 100Z'],
    arrow: ['Flecha', 'M0 31H56V0L100 50 56 100V69H0Z'],
    doubleArrow: ['Flecha doble', 'M0 50L29 0V31H71V0L100 50 71 100V69H29V100Z'],
    chevron: ['Chevron', 'M0 0H57L100 50 57 100H0L43 50Z'],
    cylinder: ['Base de datos', 'M0 19C0 -6 100 -6 100 19V81C100 106 0 106 0 81Z', false, 'M0 19C0 44 100 44 100 19'],
    document: ['Documento', 'M0 0H100V83C66 55 33 118 0 91Z'],
    subprocess: ['Subproceso', 'M0 0H100V100H0Z', false, 'M15 0V100M85 0V100'],
    delay: ['Demora', 'M0 0H53A47 50 0 0 1 53 100H0Z'],
    display: ['Pantalla', 'M20 0H63Q100 0 100 50T63 100H20L0 50Z'],
    cloud: ['Nube', 'M17 86C-5 86 -8 51 12 43 5 20 32 8 44 22 49 -7 81 -5 84 25 104 20 108 54 93 65 107 94 75 108 64 94 51 105 33 105 28 88Z']
  };
  const fonts = ['Segoe UI', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Tahoma', 'Impact'];
  const dashes = { solid: '', dash: '10 6', dot: '1 6', dashdot: '10 5 1 5' };
  const arrows = ['none', 'end', 'start', 'both'];
  const routes = ['straight', 'curve', 'elbow'];
  const isShape = name => Object.hasOwn(shapes, name);
  const hasCorners = name => ['rectangle', 'rounded', 'square', 'subprocess'].includes(name);
  const isDataImage = value => typeof value === 'string' && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|avif|bmp|apng);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const number = (n, min, max, fallback) => Number.isFinite(n) ? clamp(n, min, max) : fallback;
  const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  const option = (value, options, fallback) => options.includes(value) ? value : fallback;
  const newId = () => globalThis.crypto?.randomUUID?.() ?? 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const create = () => ({ version: 1, locked: false, nodes: [], edges: [] });

  function node(type, shape, x, y, w, h) {
    return {
      id: newId(), type, shape, x, y, w, h, locked: false, ports: [],
      fill: '#eaf2ff', transparent: false, stroke: '#2878e8', strokeWidth: 2,
      radius: shape === 'rounded' ? 14 : 0,
      text: type === 'text' ? 'Nuevo texto' : '', textColor: '', font: fonts[0],
      size: 20, bold: false, italic: false, align: 'middle', src: '', name: '', opacity: 100,
      rotation: 0, textScaleX: 1, textScaleY: 1, stretch: false
    };
  }

  function edge(from, to, sameNode) {
    return {
      id: newId(), from, to, locked: false, color: '#4876ae', width: 2,
      dash: 'solid', arrows: 'end', route: sameNode ? 'curve' : 'straight'
    };
  }

  function fitNode(n, bounds) {
    const w = Math.floor(bounds.width);
    const h = Math.floor(bounds.height);
    n.w = Math.round(clamp(n.w, 16, w));
    n.h = Math.round(clamp(n.h, 16, h));
    n.x = Math.round(clamp(n.x, 0, w - n.w));
    n.y = Math.round(clamp(n.y, 0, h - n.h));
    const extent = rotatedExtent(n);
    n.x = Math.max(n.x, Math.ceil(extent.x - n.w / 2 - 1e-8));
    n.y = Math.max(n.y, Math.ceil(extent.y - n.h / 2 - 1e-8));
    return n;
  }

  function contentBounds(nodes) {
    const bounds = { width, height };
    for (const n of nodes) {
      const extent = rotatedExtent(n);
      bounds.width = Math.max(bounds.width, n.x + n.w, Math.ceil(n.x + n.w / 2 + extent.x - 1e-8));
      bounds.height = Math.max(bounds.height, n.y + n.h, Math.ceil(n.y + n.h / 2 + extent.y - 1e-8));
    }
    return bounds;
  }

  function rotateVector(x, y, degrees) {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }

  function rotatePoint(n, point, degrees = n.rotation) {
    const x = n.x + n.w / 2;
    const y = n.y + n.h / 2;
    const offset = rotateVector(point.x - x, point.y - y, degrees);
    return { x: x + offset.x, y: y + offset.y };
  }

  function rotatedExtent(n) {
    const axis = rotateVector(1, 0, n.rotation ?? 0);
    return {
      x: (n.w * Math.abs(axis.x) + n.h * Math.abs(axis.y)) / 2,
      y: (n.w * Math.abs(axis.y) + n.h * Math.abs(axis.x)) / 2
    };
  }

  function compatibleStyle(source, target) {
    const keys = [];
    if (source.type === 'edge' && target.type === 'edge') {
      keys.push('color', 'width', 'dash', 'arrows', 'route');
    }
    if (source.type === 'image' && target.type === 'image') keys.push('opacity');
    if (source.type === 'shape' && target.type === 'shape') {
      keys.push('fill', 'transparent', 'stroke', 'strokeWidth');
      if (hasCorners(source.shape) && hasCorners(target.shape)) keys.push('radius');
    }
    if (['shape', 'text'].includes(source.type) && ['shape', 'text'].includes(target.type)) {
      keys.push('textColor', 'font', 'size', 'bold', 'italic', 'align');
    }
    return Object.fromEntries(keys.map(key => [key, source[key]]));
  }

  function portPosition(n, p) {
    return rotatePoint(n, { x: n.x + n.w * p.u, y: n.y + n.h * p.v });
  }

  function normal(p) {
    const distances = [p.u, 1 - p.u, p.v, 1 - p.v];
    return [[-1, 0], [1, 0], [0, -1], [0, 1]][distances.indexOf(Math.min(...distances))];
  }

  function loopPoints(n, a, b, [ax, ay], [bx, by]) {
    const margin = 38;
    const left = n.x - margin;
    const right = n.x + n.w + margin;
    const top = n.y - margin;
    const bottom = n.y + n.h + margin;
    const side = (x, y) => y < 0 ? 0 : x > 0 ? 1 : y > 0 ? 2 : 3;
    const point = (p, x, y) => [x < 0 ? left : x > 0 ? right : p.x, y < 0 ? top : y > 0 ? bottom : p.y];
    const corners = [[right, top], [right, bottom], [left, bottom], [left, top]];
    const from = side(ax, ay);
    const to = side(bx, by);
    const steps = (to - from + 4) % 4;
    const bends = [point(a, ax, ay)];
    if (steps === 3) bends.push(corners[to]);
    else {
      for (let i = 0; i < steps; i++) bends.push(corners[(from + i) % 4]);
    }
    return [...bends, point(b, bx, by), [b.x, b.y]];
  }

  function pathFor(e, nodes) {
    const from = nodes.get(e.from.node);
    const to = nodes.get(e.to.node);
    const p = from.ports.find(port => port.id === e.from.port);
    const q = to.ports.find(port => port.id === e.to.port);
    const a = portPosition(from, p);
    const b = portPosition(to, q);
    const start = 'M ' + a.x + ' ' + a.y;
    if (e.route === 'straight') return start + ' L ' + b.x + ' ' + b.y;

    if (from === to) {
      const points = loopPoints(from, rotatePoint(from, a, -from.rotation), rotatePoint(to, b, -to.rotation), normal(p), normal(q))
        .map(([x, y]) => Object.values(rotatePoint(from, { x, y })));
      if (e.route === 'elbow') return start + points.map(point => ' L ' + point.join(' ')).join('');
      let path = start;
      let previous = [a.x, a.y];
      points.slice(0, -1).forEach((point, index) => {
        const next = points[index + 1];
        const towards = ([x, y]) => {
          const ratio = Math.min(.5, 18 / Math.hypot(x - point[0], y - point[1]));
          return [point[0] + (x - point[0]) * ratio, point[1] + (y - point[1]) * ratio].join(' ');
        };
        path += ' L ' + towards(previous) + ' Q ' + point.join(' ') + ' ' + towards(next);
        previous = point;
      });
      return path + ' L ' + b.x + ' ' + b.y;
    }
    const { x: ax, y: ay } = rotateVector(...normal(p), from.rotation);
    const { x: bx, y: by } = rotateVector(...normal(q), to.rotation);
    if (e.route === 'elbow') {
      const horizontal = Math.abs(ax) > Math.abs(ay);
      const middle = horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
      return horizontal ? start + ' H ' + middle + ' V ' + b.y + ' H ' + b.x
        : start + ' V ' + middle + ' H ' + b.x + ' V ' + b.y;
    }
    const reach = clamp(Math.hypot(b.x - a.x, b.y - a.y) * .45, 25, 220);
    return start + ' C ' + (a.x + ax * reach) + ' ' + (a.y + ay * reach) + ' '
      + (b.x + bx * reach) + ' ' + (b.y + by * reach) + ' ' + b.x + ' ' + b.y;
  }

  function parse(raw) {
    const input = JSON.parse(raw);
    if (input?.version !== 1 || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
      throw new Error('El archivo no es un proyecto compatible de FlowDiagDesigner.');
    }
    const out = create();
    out.locked = input.locked === true;
    const ids = new Set();
    const readId = (value, known) => {
      if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value) || known.has(value)) {
        throw new Error('El proyecto contiene identificadores duplicados o no válidos.');
      }
      known.add(value);
      return value;
    };
    for (const item of input.nodes) {
      if (!item || !['shape', 'text', 'image'].includes(item.type) ||
          (item.type === 'shape' && !isShape(item.shape)) ||
          (item.type === 'image' && !isDataImage(item.src)) || !Array.isArray(item.ports)) {
        throw new Error('El proyecto contiene un elemento no válido.');
      }
      const n = node(item.type, item.type === 'shape' ? item.shape : '', 0, 0, 160, 84);
      n.id = readId(item.id, ids);
      for (const key of ['x', 'y', 'w', 'h']) {
        n[key] = Math.round(number(item[key], 0, 1000000, n[key]));
      }
      n.w = Math.max(16, n.w);
      n.h = Math.max(16, n.h);
      n.rotation = number(item.rotation, -180, 180, 0);
      n.textScaleX = number(item.textScaleX, .001, 10000, 1);
      n.textScaleY = number(item.textScaleY, .001, 10000, 1);
      n.stretch = item.stretch === true;
      for (const key of ['fill', 'stroke', 'textColor']) n[key] = color(item[key], n[key]);
      for (const key of ['bold', 'italic', 'transparent', 'locked']) n[key] = item[key] === true;
      n.strokeWidth = number(item.strokeWidth, 0, 24, n.strokeWidth);
      n.radius = number(item.radius, 0, 400, n.radius);
      n.size = number(item.size, 6, 160, n.size);
      n.font = option(item.font, fonts, n.font);
      n.align = option(item.align, ['start', 'middle', 'end'], n.align);
      n.text = typeof item.text === 'string' ? item.text.slice(0, 4000) : n.text;
      if (n.type === 'image') {
        n.src = item.src;
        n.name = typeof item.name === 'string' ? item.name.slice(0, 260) : '';
        n.opacity = number(item.opacity, 0, 100, n.opacity);
      }
      n.ports = item.ports.map(p => {
        if (!p || !Number.isFinite(p.u) || !Number.isFinite(p.v)) throw new Error('Hay un punto de conexión no válido.');
        return { id: readId(p.id, ids), u: clamp(p.u, 0, 1), v: clamp(p.v, 0, 1) };
      });
      out.nodes.push(n);
    }

    const nodes = new Map(out.nodes.map(n => [n.id, n]));
    function endpoint(value) {
      const n = nodes.get(value?.node);
      if (!n || !n.ports.some(p => p.id === value.port)) throw new Error('Hay una conexión sin un punto válido.');
      return { node: value.node, port: value.port };
    }
    for (const item of input.edges) {
      const from = endpoint(item?.from);
      const to = endpoint(item?.to);
      if (from.port === to.port) throw new Error('Una conexión necesita dos puntos diferentes.');
      const e = edge(from, to, from.node === to.node);
      e.id = readId(item.id, ids);
      e.locked = item.locked === true;
      e.color = color(item.color, e.color);
      e.width = number(item.width, 1, 24, e.width);
      e.dash = option(item.dash, Object.keys(dashes), e.dash);
      e.arrows = option(item.arrows, arrows, e.arrows);
      e.route = option(item.route, routes, e.route);
      out.edges.push(e);
    }
    const view = input.view ?? {};
    return { project: out, view: {
      theme: view.theme === 'dark' ? 'dark' : 'light',
      grid: view.grid !== false,
      collapsed: view.collapsed === true,
      zoom: number(view.zoom, .15, 2.5, null),
      left: number(view.left, 0, 2500000, 0),
      top: number(view.top, 0, 2500000, 0)
    } };
  }

  return { width, height, shapes, fonts, dashes, hasCorners, isDataImage, clamp, newId, create, node, edge, fitNode, contentBounds, rotateVector, rotatePoint, compatibleStyle, portPosition, pathFor, parse };
})();

if (typeof module !== 'undefined') module.exports = Diagram;
