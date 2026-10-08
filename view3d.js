import * as THREE from "./vendor/three.module.js";
import { ALLIANCES, MAX_POWER, dominantAlliance, planetNames, activeVectors } from "./campaign.js";
import { terrainTheme, seededRandom } from "./terrain.js";
import { ALLIANCE_EMBLEMS, drawEmblem, fleetEmblem } from "./emblems.js";

const PLANET_RADIUS = 26;
const PHOSPHOR = 0x33ff33;
const FONT = '"Share Tech Mono", Consolas, "Lucida Console", "Courier New", monospace';

// ---------- Procedural surfaces ----------
function blotches(c, colors, rand, count, min, max, alpha = 0.55) {
  for (let i = 0; i < count; i++) {
    const x = rand() * 512;
    const y = rand() * 256;
    const r = min + rand() * (max - min);
    const fill = colors[Math.floor(rand() * colors.length)];
    for (const offset of [-512, 0, 512]) {
      const gradient = c.createRadialGradient(x + offset, y, 0, x + offset, y, r);
      gradient.addColorStop(0, fill);
      gradient.addColorStop(1, "transparent");
      c.globalAlpha = alpha * (0.5 + rand() * 0.5);
      c.fillStyle = gradient;
      c.fillRect(x + offset - r, y - r, r * 2, r * 2);
    }
  }
  c.globalAlpha = 1;
}

function strokes(c, rand, count, colors, width, curl, glow) {
  c.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const points = [[rand() * 512, rand() * 256]];
    for (let k = 0; k < 4; k++) {
      const [x, y] = points[points.length - 1];
      points.push([x + (rand() - 0.3) * curl, y + (rand() - 0.5) * curl * 0.6], [x + (rand() - 0.2) * curl, y + (rand() - 0.5) * curl * 0.6], [x + (rand() - 0.1) * curl, y + (rand() - 0.5) * curl * 0.4]);
    }
    c.strokeStyle = colors[Math.floor(rand() * colors.length)];
    c.lineWidth = width * (0.4 + rand());
    c.globalAlpha = 0.35 + rand() * 0.45;
    c.shadowColor = glow || "transparent";
    c.shadowBlur = glow ? 10 : 0;
    for (const offset of [-512, 0, 512]) {
      c.beginPath();
      c.moveTo(points[0][0] + offset, points[0][1]);
      for (let k = 1; k < points.length; k += 3) c.bezierCurveTo(points[k][0] + offset, points[k][1], points[k + 1][0] + offset, points[k + 1][1], points[k + 2][0] + offset, points[k + 2][1]);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  c.shadowBlur = 0;
}

function cracks(c, rand, count, color, width, glow) {
  c.strokeStyle = color;
  c.shadowColor = glow || color;
  c.shadowBlur = 8;
  c.lineCap = "round";
  for (let i = 0; i < count; i++) {
    let x = rand() * 512;
    let y = rand() * 256;
    let angle = rand() * Math.PI * 2;
    c.lineWidth = width * (0.5 + rand());
    c.beginPath();
    c.moveTo(x, y);
    for (let step = 0; step < 18; step++) {
      angle += (rand() - 0.5) * 1.1;
      x += Math.cos(angle) * 9;
      y += Math.sin(angle) * 9;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.shadowBlur = 0;
}

function lavaSeams(c, rand) {
  cracks(c, rand, 46, "#ff2a1a", 2.6, "#ff0000");
  cracks(c, rand, 30, "#ff7a3a", 1.1, "#ff3300");
  blotches(c, ["#ff3a1a", "#ffb04a"], rand, 18, 3, 10, 0.85);
}

function cloudPainter(c, theme, rand) {
  if (theme.key === "smog") {
    blotches(c, [theme.cloud, "#6b7a3a"], rand, 90, 18, 60, 0.32);
    return;
  }
  blotches(c, [theme.cloud], rand, 40, 10, 40, 0.22);
  strokes(c, rand, theme.key === "ice" ? 90 : 40, [theme.cloud, "#e8f7ff"], theme.key === "ice" ? 4 : 3, 110);
}

const PAINTERS = {
  swirl(c, t, rand) {
    blotches(c, [t.dark, t.accent, t.base], rand, 70, 14, 60);
    strokes(c, rand, 70, [t.accent, t.dark, "#0f3d12"], 5, 70);
    blotches(c, ["#ffffff"], rand, 18, 10, 40, 0.12);
  },
  cracks(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base, "#3a0f04", "#5a1a06"], rand, 60, 16, 70, 0.7);
    cracks(c, rand, 55, t.accent, 2.4, "#ff5a00");
    blotches(c, ["#ffdd55"], rand, 14, 4, 14, 0.8);
  },
  ice(c, t, rand) {
    const gradient = c.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.25, t.base);
    gradient.addColorStop(0.5, t.dark);
    gradient.addColorStop(0.75, t.base);
    gradient.addColorStop(1, "#ffffff");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.accent, "#e8f7ff", t.dark], rand, 70, 10, 50, 0.5);
    // Crystalline facets.
    for (let i = 0; i < 90; i++) {
      const x = rand() * 512;
      const y = rand() * 256;
      const r = 6 + rand() * 18;
      c.globalAlpha = 0.18 + rand() * 0.3;
      c.fillStyle = rand() > 0.5 ? "#ffffff" : "#7fc4ec";
      c.beginPath();
      c.moveTo(x, y - r);
      c.lineTo(x + r * (0.4 + rand() * 0.6), y + r * rand() * 0.6);
      c.lineTo(x - r * (0.4 + rand() * 0.6), y + r * (0.2 + rand() * 0.6));
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;
    cracks(c, rand, 40, "#3d6f9a", 1.2, "transparent");
  },
  lava(c, t, rand, seed) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base, "#2a1f1d", "#0e0a0a", "#3a2a26"], rand, 120, 10, 50, 0.8);
    lavaSeams(c, seededRandom(`${seed}-seams`));
  },
  canopy(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base, "#123d1c", "#061a0b", "#1c4a26"], rand, 160, 6, 34, 0.75);
    strokes(c, rand, 40, ["#020904", "#0a2410"], 6, 60);
    for (let i = 0; i < 120; i++) {
      c.globalAlpha = 0.2 + rand() * 0.5;
      c.fillStyle = rand() > 0.7 ? "#7dffb0" : "#2aff7a";
      c.fillRect(rand() * 512, rand() * 256, 1.4, 1.4);
    }
    c.globalAlpha = 1;
    blotches(c, ["#0a1a10"], rand, 20, 20, 60, 0.35);
  },
  smog(c, t, rand) {
    blotches(c, [t.base, t.dark, "#4a5a30", "#6b7a3a"], rand, 110, 10, 50, 0.7);
    c.strokeStyle = "#8f9a94";
    c.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = 0.18 + rand() * 0.3;
      c.strokeRect(Math.round(rand() * 32) * 16, Math.round(rand() * 16) * 16, 16 + Math.round(rand() * 3) * 16, 8 + Math.round(rand() * 2) * 8);
    }
    c.globalAlpha = 1;
    strokes(c, rand, 30, [t.seam, "#8a4a1e"], 2.4, 50);
    for (let i = 0; i < 160; i++) {
      c.globalAlpha = 0.3 + rand() * 0.6;
      c.fillStyle = rand() > 0.5 ? "#d8e86a" : "#ff9a3a";
      c.fillRect(rand() * 512, rand() * 256, 1.6, 1.6);
    }
    c.globalAlpha = 1;
  },
  blotch(c, t, rand) {
    blotches(c, [t.dark, t.accent, t.base], rand, 110, 8, 46, 0.6);
    strokes(c, rand, 20, [t.accent], 2, 40);
  },
  circuit(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base], rand, 40, 20, 60, 0.6);
    c.strokeStyle = t.accent;
    c.fillStyle = t.accent;
    c.shadowColor = t.accent;
    c.shadowBlur = 6;
    for (let i = 0; i < 140; i++) {
      let x = Math.round(rand() * 32) * 16;
      let y = Math.round(rand() * 16) * 16;
      c.globalAlpha = 0.3 + rand() * 0.6;
      c.lineWidth = 1 + rand() * 1.5;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (k % 2) y += (rand() - 0.5) * 64; else x += (rand() - 0.5) * 96;
        c.lineTo(x, y);
      }
      c.stroke();
      c.fillRect(x - 2, y - 2, 4, 4);
    }
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  },
  city(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base, "#2b2a27"], rand, 50, 20, 70, 0.8);
    c.fillStyle = t.accent;
    for (let cluster = 0; cluster < 26; cluster++) {
      const cx = rand() * 512;
      const cy = 30 + rand() * 196;
      for (let i = 0; i < 70; i++) {
        const spread = 30 * rand();
        const angle = rand() * Math.PI * 2;
        c.globalAlpha = 0.25 + rand() * 0.75;
        c.fillRect(cx + Math.cos(angle) * spread * 1.6, cy + Math.sin(angle) * spread, 1 + rand() * 2.4, 1 + rand() * 2.4);
      }
    }
    c.globalAlpha = 1;
  },
  bands(c, t, rand) {
    const phase = rand() * 10;
    const palette = [new THREE.Color(t.dark), new THREE.Color(t.base), new THREE.Color(t.accent)];
    for (let y = 0; y < 256; y++) {
      const value = (Math.sin(y * 0.09 + phase) + Math.sin(y * 0.031 + phase * 2) * 0.6 + 1.6) / 3.2;
      const colour = value < 0.5 ? palette[0].clone().lerp(palette[1], value * 2) : palette[1].clone().lerp(palette[2], (value - 0.5) * 2);
      c.fillStyle = `#${colour.getHexString()}`;
      c.fillRect(0, y, 512, 1);
    }
    blotches(c, [t.dark, t.accent], rand, 40, 6, 30, 0.35);
  },
  plates(c, t, rand) {
    blotches(c, [t.dark, t.base], rand, 40, 20, 60, 0.6);
    for (let y = 0; y < 256; y += 16) {
      for (let x = (y / 16) % 2 ? -12 : 0; x < 512; x += 24) {
        c.globalAlpha = 0.15 + rand() * 0.35;
        c.fillStyle = rand() > 0.85 ? t.accent : t.dark;
        c.fillRect(x + 1, y + 1, 22, 14);
      }
    }
    c.globalAlpha = 0.7;
    c.strokeStyle = t.accent;
    c.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) { const y = rand() * 256; c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    c.globalAlpha = 1;
  },
  fields(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    const colours = [t.base, t.accent, "#c98a1e", "#7aa83a", "#3e6b1c", "#e8c860", "#a8782a"];
    for (let i = 0; i < 420; i++) {
      c.globalAlpha = 0.6 + rand() * 0.4;
      c.fillStyle = colours[Math.floor(rand() * colours.length)];
      c.fillRect(Math.round(rand() * 64) * 8, Math.round(rand() * 32) * 8, 8 + Math.round(rand() * 5) * 8, 6 + Math.round(rand() * 3) * 6);
    }
    c.globalAlpha = 0.5;
    c.strokeStyle = "#2c4512";
    c.lineWidth = 1;
    for (let x = 0; x < 512; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
    c.globalAlpha = 1;
    strokes(c, rand, 6, ["#2a5ea8"], 3, 60);
    blotches(c, ["#ffffff"], rand, 20, 10, 36, 0.12);
  },
  rift(c, t, rand) {
    c.fillStyle = t.dark;
    c.fillRect(0, 0, 512, 256);
    blotches(c, [t.base, "#5c0f2f", "#1d0638"], rand, 70, 16, 60, 0.75);
    strokes(c, rand, 40, [t.accent, "#9d2cff"], 3, 80, t.accent);
    cracks(c, rand, 26, "#ff3333", 1.8, "#ff0000");
  },
};

// ---------- Canvas sprites ----------
function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function chamferPath(c, x, y, w, h, k) {
  c.beginPath();
  c.moveTo(x + k, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + k);
  c.closePath();
}

export function createCogitatorView(container, initialData, initialSelection, { onSelect, vectors = true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x020703, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "Cogitator 3D projection. Drag to pan, right-drag or Shift-drag to rotate, scroll to zoom, click a world to open its dossier.");
  canvas.setAttribute("role", "img");
  container.append(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020703, 0.00045);
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 12000);
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const textures = new Map();
  const target = new THREE.Vector3();
  const focusGoal = new THREE.Vector3();
  const orbit = { distance: 1400, theta: 0, phi: 0.92 };
  let focusing = false;
  let shake = 0;

  scene.add(new THREE.AmbientLight(0xd8e0d8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-600, 900, 400);
  scene.add(sun);
  const grid = new THREE.GridHelper(4000, 80, 0x1a5a24, 0x0b2a10);
  grid.position.y = -70;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);
  scene.add(starfield());

  const glowTexture = canvasTexture(128, 128, (c) => {
    const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 128, 128);
  });
  textures.set("glow", glowTexture);

  let data = initialData;
  let selection = initialSelection;
  let offset = new THREE.Vector3();
  let worldGroup = new THREE.Group();
  let laneGroup = new THREE.Group();
  let fleetGroup = new THREE.Group();
  let vectorGroup = new THREE.Group();
  let showVectors = vectors;
  vectorGroup.visible = showVectors;
  scene.add(worldGroup, laneGroup, fleetGroup, vectorGroup);
  let projectiles = [];
  let spinners = [];
  let ships = [];
  let pulses = [];
  let throbs = [];
  let smokes = [];
  let selectable = [];
  let debrisById = new Map();
  let planetById = new Map();
  let knownDestroyed = null;
  const fleetAngles = new Map();
  const effects = [];
  const spawns = new Map();
  let active = false;
  let frame = null;
  let previous = null;
  let elapsed = 0;
  let drag = null;

  function starfield() {
    const rand = seededRandom("vespator-stars");
    const positions = new Float32Array(1800 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      const direction = new THREE.Vector3(rand() - 0.5, rand() * 0.8 - 0.1, rand() - 0.5).normalize().multiplyScalar(4500 + rand() * 2500);
      positions.set([direction.x, direction.y, direction.z], i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x9dffb0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false }));
    return points;
  }

  function cached(key, make) {
    if (!textures.has(key)) textures.set(key, make());
    return textures.get(key);
  }

  function surface(planet, theme) {
    return cached(`surface:${planet.id}:${theme.key}`, () => {
      const texture = canvasTexture(512, 256, (c) => {
        c.fillStyle = theme.base;
        c.fillRect(0, 0, 512, 256);
        PAINTERS[theme.pattern](c, theme, seededRandom(planet.id), planet.id);
      });
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    });
  }

  function label(planet) {
    const lead = dominantAlliance(planet);
    const key = `label:${planet.id}:${planet.name}:${planet.subName || ""}:${planet.terrain}:${planet.destroyed}:${ALLIANCES.map((a) => planet.powerLevels[a]).join("")}:${lead}`;
    return cached(key, () => canvasTexture(512, 176, (c) => {
      const { world, system } = planetNames(planet);
      const tone = planet.destroyed ? "#ff3333" : "#33ff33";
      c.fillStyle = "rgba(2,12,4,.82)";
      chamferPath(c, 4, 4, 504, 168, 18);
      c.fill();
      c.strokeStyle = tone;
      c.lineWidth = 3;
      c.shadowColor = tone;
      c.shadowBlur = 10;
      c.stroke();
      c.fillStyle = tone;
      c.font = `bold 46px ${FONT}`;
      c.fillText(world.length > 14 ? `${world.slice(0, 13)}…` : world, 22, 58);
      c.shadowBlur = 0;
      c.font = `26px ${FONT}`;
      c.globalAlpha = 0.8;
      c.fillText(system.length > 20 ? `${system.slice(0, 19)}…` : system, 22, 94);
      c.font = `20px ${FONT}`;
      const terrain = planet.destroyed ? "EXTERMINATUS ENACTED" : planet.terrain.toUpperCase();
      c.fillText(terrain.length > 26 ? `${terrain.slice(0, 25)}…` : terrain, 22, 128);
      c.globalAlpha = 1;
      ALLIANCES.forEach((alliance, column) => {
        const hex = data.alliances[alliance].color;
        const x = 372 + column * 42;
        for (let level = 1; level <= MAX_POWER; level++) {
          const lit = level <= planet.powerLevels[alliance];
          c.fillStyle = lit ? hex : "rgba(51,255,51,.12)";
          c.globalAlpha = lit ? (level === planet.powerLevels[alliance] ? 1 : 0.55) : 1;
          c.fillRect(x, 136 - level * 28, 32, 24);
        }
        c.globalAlpha = 1;
        drawEmblem(c, ALLIANCE_EMBLEMS[alliance], x + 16, 156, 22, hex, 2.2);
      });
    }));
  }

  function emblemTexture(emblem, alliance) {
    const hex = data.alliances[alliance].color;
    return cached(`emblem:${emblem}:${hex}`, () => canvasTexture(96, 96, (c) => {
      c.fillStyle = "rgba(2,10,3,.85)";
      c.beginPath();
      for (let i = 0; i < 6; i++) c.lineTo(48 + Math.cos(Math.PI / 6 + i * Math.PI / 3) * 44, 48 + Math.sin(Math.PI / 6 + i * Math.PI / 3) * 44);
      c.closePath();
      c.fill();
      c.strokeStyle = hex;
      c.lineWidth = 4;
      c.stroke();
      drawEmblem(c, emblem, 48, 48, 56, hex, 2);
    }));
  }

  function seamTexture(planet) {
    return cached(`seams:${planet.id}`, () => {
      const texture = canvasTexture(512, 256, (c) => {
        c.fillStyle = "#000000";
        c.fillRect(0, 0, 512, 256);
        lavaSeams(c, seededRandom(`${planet.id}-seams`));
      });
      texture.wrapS = THREE.RepeatWrapping;
      return texture;
    });
  }

  function cloudTexture(planet, theme) {
    return cached(`clouds:${planet.id}:${theme.key}`, () => {
      const texture = canvasTexture(512, 256, (c) => cloudPainter(c, theme, seededRandom(`${planet.id}-clouds`)));
      texture.wrapS = THREE.RepeatWrapping;
      return texture;
    });
  }

  function addEffects(planet, theme, holder) {
    const effectsList = theme.effects || [];
    if (effectsList.includes("clouds")) {
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS * 1.045, 40, 28), new THREE.MeshLambertMaterial({ map: cloudTexture(planet, theme), transparent: true, depthWrite: false, emissive: new THREE.Color(theme.cloud), emissiveIntensity: 0.12 }));
      clouds.rotation.z = 0.2;
      holder.add(clouds);
      spinners.push({ object: clouds, speed: theme.key === "ice" ? 0.42 : 0.3 });
    }
    if (effectsList.includes("seams")) {
      const seams = new THREE.Mesh(new THREE.IcosahedronGeometry(PLANET_RADIUS * 1.025, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.seam), wireframe: true, transparent: true, opacity: 0.55 }));
      holder.add(seams);
      spinners.push({ object: seams, speed: 0.18 });
      const girders = new THREE.Mesh(new THREE.TorusGeometry(PLANET_RADIUS * 1.12, 0.9, 6, 64), new THREE.MeshLambertMaterial({ color: 0x8f9a94, emissive: new THREE.Color(theme.seam), emissiveIntensity: 0.35 }));
      girders.rotation.x = Math.PI / 2 + 0.3;
      holder.add(girders);
    }
    if (effectsList.includes("shield")) {
      const gold = new THREE.Color(theme.accent);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS * 1.32, 40, 28), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      const lattice = new THREE.Mesh(new THREE.IcosahedronGeometry(PLANET_RADIUS * 1.34, 1), new THREE.MeshBasicMaterial({ color: gold, wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      holder.add(shell, lattice);
      spinners.push({ object: lattice, speed: -0.12 });
      throbs.push({ material: shell.material, base: 0.08, amp: 0.05, speed: 2.2 }, { material: lattice.material, base: 0.22, amp: 0.1, speed: 1.6 });
      [[0, 0], [1.05, 0.4], [-1.05, 0.9], [Math.PI / 2, 1.6]].forEach(([tilt, yaw], index) => {
        const pivot = new THREE.Group();
        pivot.rotation.set(tilt, yaw, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(PLANET_RADIUS * (1.48 + index * 0.1), 0.55, 6, 120), new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
        pivot.add(ring);
        holder.add(pivot);
        spinners.push({ object: ring, speed: (index % 2 ? -1 : 1) * (0.35 + index * 0.1), axis: "z" });
        throbs.push({ material: ring.material, base: 0.6, amp: 0.25, speed: 3 + index, phase: index });
      });
    }
    if (effectsList.includes("smoke")) {
      const count = 70;
      const rand = seededRandom(`${planet.id}-smoke`);
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const particles = Array.from({ length: count }, () => ({
        direction: new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize(),
        life: rand(),
        speed: 0.18 + rand() * 0.22,
      }));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 13, map: glowTexture, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }));
      holder.add(points);
      const entry = { points, particles };
      smokes.push(entry);
      stepSmoke(entry, 0);
    }
  }

  const emberColor = new THREE.Color(0xff8a2a);
  const ashColor = new THREE.Color(0x3a302c);
  function stepSmoke(entry, delta) {
    const positions = entry.points.geometry.attributes.position;
    const colors = entry.points.geometry.attributes.color;
    const colour = new THREE.Color();
    entry.particles.forEach((particle, i) => {
      particle.life += delta * particle.speed;
      if (particle.life > 1) particle.life -= 1;
      const distance = PLANET_RADIUS * 0.95 + particle.life * 48;
      positions.array[i * 3] = particle.direction.x * distance;
      positions.array[i * 3 + 1] = particle.direction.y * distance + particle.life * 14;
      positions.array[i * 3 + 2] = particle.direction.z * distance;
      colour.copy(emberColor).lerp(ashColor, Math.min(1, particle.life * 1.6)).multiplyScalar(1 - particle.life * 0.7);
      colors.array.set([colour.r, colour.g, colour.b], i * 3);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  function disposeGroup(group) {
    group.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach((material) => material.dispose());
    });
    scene.remove(group);
  }

  const world = (planet) => new THREE.Vector3(planet.x - offset.x, 0, planet.y - offset.z);

  function addPlanet(planet) {
    const theme = terrainTheme(planet);
    const position = world(planet);
    const holder = new THREE.Group();
    holder.position.copy(position);
    holder.userData.planetId = planet.id;
    worldGroup.add(holder);
    planetById.set(planet.id, holder);
    const lead = dominantAlliance(planet);
    const accent = new THREE.Color(planet.destroyed ? "#ff3333" : lead ? data.alliances[lead].color : "#33ff33");

    if (planet.destroyed) {
      const debris = new THREE.Group();
      const rand = seededRandom(`${planet.id}-debris`);
      for (let i = 0; i < 16; i++) {
        const size = 4 + rand() * 7;
        const geometry = rand() > 0.5 ? new THREE.TetrahedronGeometry(size) : new THREE.OctahedronGeometry(size * 0.8);
        const shard = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff3333 : 0xff8a1a, wireframe: true, transparent: true, opacity: 0.9 }));
        const direction = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize();
        shard.position.copy(direction.multiplyScalar(10 + rand() * 26));
        shard.rotation.set(rand() * 6, rand() * 6, rand() * 6);
        shard.userData.planetId = planet.id;
        shard.userData.spin = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
        debris.add(shard);
        selectable.push(shard);
      }
      const hazard = new THREE.Mesh(new THREE.RingGeometry(34, 36, 6), new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
      hazard.rotation.x = -Math.PI / 2;
      debris.add(hazard);
      holder.add(debris);
      spinners.push({ object: debris, speed: 0.08 });
      debrisById.set(planet.id, debris);
    } else {
      const lava = (theme.effects || []).includes("pulse");
      const body = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 48, 32), new THREE.MeshLambertMaterial({ map: surface(planet, theme), emissive: 0xffffff, emissiveMap: lava ? seamTexture(planet) : surface(planet, theme), emissiveIntensity: lava ? 1.1 : 0.32 }));
      if (lava) throbs.push({ material: body.material, property: "emissiveIntensity", base: 1.05, amp: 0.55, speed: 2.4 });
      body.rotation.z = 0.35;
      body.userData.planetId = planet.id;
      holder.add(body);
      selectable.push(body);
      spinners.push({ object: body, speed: 0.18 });
      if (!(theme.effects || []).includes("seams")) {
        const lattice = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS * 1.06, 18, 12), new THREE.MeshBasicMaterial({ color: PHOSPHOR, wireframe: true, transparent: true, opacity: 0.09 }));
        holder.add(lattice);
        spinners.push({ object: lattice, speed: -0.07 });
      }
      addEffects(planet, theme, holder);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: new THREE.Color(theme.glow), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(PLANET_RADIUS * 3.6);
      holder.add(halo);
      if (spawns.has(planet.id)) holder.scale.setScalar(0.01);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(40, 41.2, 72), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0.35 }));
    ring.rotation.x = -Math.PI / 2;
    holder.add(ring);
    if (planet.id === selection) {
      const selected = new THREE.Mesh(new THREE.RingGeometry(47, 50, 6), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide }));
      selected.rotation.x = -Math.PI / 2;
      holder.add(selected);
      spinners.push({ object: selected, speed: 0.4, axis: "z" });
    }
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(planet), transparent: true, depthWrite: false }));
    tag.scale.set(118, 40.5, 1);
    tag.position.set(0, PLANET_RADIUS + 46, 0);
    tag.center.set(0.5, 0);
    tag.userData.planetId = planet.id;
    holder.add(tag);
    selectable.push(tag);
    const pylon = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -70, 0), new THREE.Vector3(0, -PLANET_RADIUS, 0)]), new THREE.LineDashedMaterial({ color: PHOSPHOR, dashSize: 4, gapSize: 4, transparent: true, opacity: 0.35 }));
    pylon.computeLineDistances();
    holder.add(pylon);
  }

  function addLane([a, b], planets) {
    const first = planets.get(a);
    const second = planets.get(b);
    const blocked = first.destroyed || second.destroyed;
    const start = world(first);
    const end = world(second);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += 18 + start.distanceTo(end) * 0.05;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const glowColor = blocked ? 0xff3333 : PHOSPHOR;
    laneGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 3.2, 8), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: blocked ? 0.06 : 0.12, blending: THREE.AdditiveBlending, depthWrite: false })));
    laneGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.7, 6), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: blocked ? 0.35 : 0.85 })));
    const dashes = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60).map((p) => p.add(new THREE.Vector3(0, 4.5, 0)))), new THREE.LineDashedMaterial({ color: glowColor, dashSize: 8, gapSize: 9, transparent: true, opacity: 0.6 }));
    dashes.computeLineDistances();
    laneGroup.add(dashes);
    if (!blocked) {
      for (let i = 0; i < 2; i++) {
        const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0x9dff9d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        pulse.scale.setScalar(16);
        laneGroup.add(pulse);
        pulses.push({ sprite: pulse, curve, t: (i * 0.5 + (a.length * 0.13)) % 1, speed: 0.08 + (b.length % 5) * 0.012, reverse: i === 1 });
      }
    }
  }

  // Offensive vectors: a high orbital arc from attacker to target with looping glowing projectiles and comet tails.
  const TAIL = 7;
  function addVector(assault, index) {
    const from = data.planets.find((planet) => planet.id === assault.from);
    const to = data.planets.find((planet) => planet.id === assault.to);
    const hex = new THREE.Color(data.alliances[assault.alliance].color);
    const a = world(from);
    const b = world(to);
    const direction = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(14);
    const start = a.clone().addScaledVector(direction, PLANET_RADIUS * 1.5).add(side).setY(12);
    const end = b.clone().addScaledVector(direction, -PLANET_RADIUS * 1.7).add(side).setY(12);
    const control = start.clone().lerp(end, 0.5).add(side.clone().multiplyScalar(1.5));
    control.y += 70 + start.distanceTo(end) * 0.22;
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const group = new THREE.Group();
    group.userData = { assault: `${assault.from}>${assault.to}>${assault.alliance}` };
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 2.4, 6), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })));
    const track = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineDashedMaterial({ color: hex, dashSize: 6, gapSize: 7, transparent: true, opacity: 0.7 }));
    track.computeLineDistances();
    group.add(track);
    const head = new THREE.Mesh(new THREE.ConeGeometry(6, 16, 10), new THREE.MeshBasicMaterial({ color: hex }));
    head.position.copy(end);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1).normalize());
    group.add(head);
    throbs.push({ material: head.material, property: "opacity", base: 0.75, amp: 0.25, speed: 7, phase: index });
    head.material.transparent = true;
    const reticle = new THREE.Mesh(new THREE.RingGeometry(PLANET_RADIUS * 1.75, PLANET_RADIUS * 1.9, 48, 1, 0, Math.PI * 1.6), new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    reticle.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.copy(b);
    pivot.position.y = -PLANET_RADIUS * 0.2 + index * 3;
    pivot.add(reticle);
    group.add(pivot);
    spinners.push({ object: pivot, speed: 1.4 });
    const count = Math.max(3, Math.min(6, Math.round(curve.getLength() / 120)));
    for (let i = 0; i < count; i++) {
      const sprites = [];
      for (let k = 0; k < TAIL; k++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: k === 0 ? hex.clone().lerp(new THREE.Color(0xffffff), 0.45) : hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        sprite.scale.setScalar(k === 0 ? 22 : 15 - k * 1.4);
        group.add(sprite);
        sprites.push(sprite);
      }
      projectiles.push({ sprites, curve, t: i / count, speed: 70 / curve.getLength() });
    }
    vectorGroup.add(group);
  }

  function stepProjectile(projectile, delta) {
    projectile.t = (projectile.t + delta * projectile.speed) % 1;
    projectile.sprites.forEach((sprite, k) => {
      const t = projectile.t - k * 0.016;
      sprite.visible = t >= 0;
      if (!sprite.visible) return;
      sprite.position.copy(projectile.curve.getPoint(t));
      const fade = Math.min(1, t / 0.08, (1 - t) / 0.08);
      sprite.material.opacity = fade * (1 - k / TAIL);
    });
  }

  function setVectors(visible) {
    showVectors = visible;
    vectorGroup.visible = visible;
    if (active) render();
  }

  function shipGeometry() {
    const geometry = new THREE.BufferGeometry();
    const v = [0, 0, 9, -5, 0, -6, 5, 0, -6, 0, 2.6, -4, 0, -1.6, -5];
    const index = [0, 1, 3, 0, 3, 2, 0, 2, 4, 0, 4, 1, 1, 4, 2, 1, 2, 3];
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addFleets(planet) {
    const center = world(planet);
    planet.fleets.forEach((fleet, index) => {
      const hex = data.alliances[fleet.alliance].color;
      const emblem = fleetEmblem(fleet);
      const key = `${planet.id}:${index}:${fleet.faction}:${fleet.badge || ""}:${fleet.name || ""}`;
      const radius = PLANET_RADIUS + 22 + index * 11;
      const tilt = (index % 2 ? -1 : 1) * (0.25 + index * 0.12);
      const ship = new THREE.Group();
      const hull = new THREE.Mesh(shipGeometry(), new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.35, flatShading: true }));
      hull.scale.setScalar(1.25);
      hull.userData.planetId = planet.id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(hull.geometry), new THREE.LineBasicMaterial({ color: 0xeaffea, transparent: true, opacity: 0.6 }));
      edges.scale.copy(hull.scale);
      const engine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      engine.position.set(0, 0, -8);
      engine.scale.setScalar(10);
      const insignia = new THREE.Sprite(new THREE.SpriteMaterial({ map: emblemTexture(emblem, fleet.alliance), transparent: true, depthWrite: false }));
      insignia.position.set(0, 13, 0);
      insignia.scale.setScalar(15);
      insignia.userData.planetId = planet.id;
      ship.add(hull, edges, engine, insignia);
      fleetGroup.add(ship);
      selectable.push(hull, insignia);
      const path = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2).getPoints(80).map((p) => new THREE.Vector3(p.x, 0, p.y).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).add(center));
      fleetGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.22 })));
      if (!fleetAngles.has(key)) fleetAngles.set(key, index * 2.1 + planet.x * 0.01);
      ships.push({ object: ship, insignia, center, radius, tilt, key, speed: planet.destroyed ? 0.05 : 0.32 - index * 0.04 });
    });
  }

  function placeShip(entry) {
    const angle = fleetAngles.get(entry.key);
    const axis = new THREE.Vector3(1, 0, 0);
    const point = new THREE.Vector3(Math.cos(angle) * entry.radius, 0, Math.sin(angle) * entry.radius).applyAxisAngle(axis, entry.tilt).add(entry.center);
    const ahead = new THREE.Vector3(Math.cos(angle + 0.05) * entry.radius, 0, Math.sin(angle + 0.05) * entry.radius).applyAxisAngle(axis, entry.tilt).add(entry.center);
    entry.object.position.copy(point);
    entry.object.lookAt(ahead);
  }

  // ---------- Exterminatus ----------
  function exterminatus(planet) {
    const theme = terrainTheme(planet);
    const origin = world(planet);
    const group = new THREE.Group();
    scene.add(group);
    const rand = seededRandom(`${planet.id}-${Date.now()}`);
    const core = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 40, 28), new THREE.MeshBasicMaterial({ map: surface(planet, theme), color: 0xffffff, transparent: true }));
    core.position.copy(origin);
    group.add(core);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffcc66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.copy(origin);
    group.add(flash);
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    shock.rotation.x = -Math.PI / 2;
    shock.position.copy(origin);
    shock.visible = false;
    group.add(shock);
    const shards = [];
    const colours = [theme.base, theme.accent, theme.dark, "#ff5a1a", "#ffb347"];
    for (let i = 0; i < 70; i++) {
      const direction = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(2 + rand() * 5.5), new THREE.MeshBasicMaterial({ color: colours[i % colours.length], transparent: true }));
      shard.position.copy(origin).addScaledVector(direction, PLANET_RADIUS * rand());
      shard.visible = false;
      group.add(shard);
      shards.push({ mesh: shard, velocity: direction.multiplyScalar(40 + rand() * 150), spin: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6) });
    }
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = [];
    const lifetimes = [];
    for (let i = 0; i < count; i++) {
      const direction = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      positions.set([origin.x + direction.x * PLANET_RADIUS * 0.8, origin.y + direction.y * PLANET_RADIUS * 0.8, origin.z + direction.z * PLANET_RADIUS * 0.8], i * 3);
      velocities.push(direction.multiplyScalar(30 + rand() * 210));
      lifetimes.push(1.4 + rand() * 2.4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const fire = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 7, map: glowTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.visible = false;
    group.add(fire);
    effects.push({ planetId: planet.id, group, core, flash, shock, shards, fire, velocities, lifetimes, age: 0, duration: 4.2 });
    shake = 1;
  }

  const fireRamp = [new THREE.Color(0xffffe0), new THREE.Color(0xffc040), new THREE.Color(0xff5a10), new THREE.Color(0x801008), new THREE.Color(0x000000)];
  function rampColor(t, out) {
    const scaled = Math.min(0.999, Math.max(0, t)) * (fireRamp.length - 1);
    const index = Math.floor(scaled);
    return out.copy(fireRamp[index]).lerp(fireRamp[index + 1], scaled - index);
  }

  function stepEffect(effect, delta) {
    effect.age += delta;
    const { age } = effect;
    const charge = Math.min(1, age / 0.45);
    if (age < 0.45) {
      effect.core.scale.setScalar(1 + charge * 0.18 + Math.sin(age * 60) * 0.03);
      effect.core.material.color.setRGB(1, 1 - charge * 0.5, 1 - charge * 0.9);
      effect.flash.material.opacity = charge * 0.8;
      effect.flash.scale.setScalar(PLANET_RADIUS * (2 + charge * 3));
      return;
    }
    if (effect.core.visible) {
      effect.core.visible = false;
      effect.shock.visible = true;
      effect.fire.visible = true;
      effect.shards.forEach((shard) => { shard.mesh.visible = true; });
    }
    const t = age - 0.45;
    effect.flash.material.opacity = Math.max(0, 1 - t * 1.6);
    effect.flash.scale.setScalar(PLANET_RADIUS * (5 + t * 10));
    effect.shock.scale.setScalar(PLANET_RADIUS + t * 260);
    effect.shock.material.opacity = Math.max(0, 0.9 - t * 0.55);
    const fade = Math.max(0, 1 - t / (effect.duration - 0.45));
    for (const shard of effect.shards) {
      shard.mesh.position.addScaledVector(shard.velocity, delta);
      shard.velocity.multiplyScalar(1 - delta * 0.5);
      shard.mesh.rotation.x += shard.spin.x * delta;
      shard.mesh.rotation.y += shard.spin.y * delta;
      shard.mesh.material.opacity = fade;
      shard.mesh.material.color.lerp(fireRamp[2], delta * 0.6);
    }
    const positions = effect.fire.geometry.attributes.position;
    const colors = effect.fire.geometry.attributes.color;
    const colour = new THREE.Color();
    for (let i = 0; i < effect.velocities.length; i++) {
      const velocity = effect.velocities[i];
      positions.array[i * 3] += velocity.x * delta;
      positions.array[i * 3 + 1] += velocity.y * delta + 6 * delta;
      positions.array[i * 3 + 2] += velocity.z * delta;
      velocity.multiplyScalar(1 - delta * 0.9);
      rampColor(t / effect.lifetimes[i], colour);
      colors.array.set([colour.r, colour.g, colour.b], i * 3);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  function finishEffect(index) {
    const effect = effects[index];
    disposeGroup(effect.group);
    effects.splice(index, 1);
  }

  // ---------- Scene sync ----------
  function update(nextData, nextSelection) {
    const selectionChanged = nextSelection !== selection;
    data = nextData;
    selection = nextSelection;
    const xs = data.planets.map((p) => p.x);
    const zs = data.planets.map((p) => p.y);
    offset = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
    const destroyedNow = new Set(data.planets.filter((p) => p.destroyed).map((p) => p.id));
    if (knownDestroyed) {
      for (const planet of data.planets) {
        if (planet.destroyed && !knownDestroyed.has(planet.id) && active && !reducedMotion.matches) exterminatus(planet);
        if (!planet.destroyed && knownDestroyed.has(planet.id) && active && !reducedMotion.matches) spawns.set(planet.id, 0);
      }
    }
    knownDestroyed = destroyedNow;
    for (const group of [worldGroup, laneGroup, fleetGroup, vectorGroup]) disposeGroup(group);
    worldGroup = new THREE.Group();
    laneGroup = new THREE.Group();
    fleetGroup = new THREE.Group();
    vectorGroup = new THREE.Group();
    vectorGroup.visible = showVectors;
    scene.add(worldGroup, laneGroup, fleetGroup, vectorGroup);
    projectiles = [];
    spinners = [];
    ships = [];
    pulses = [];
    throbs = [];
    smokes = [];
    selectable = [];
    debrisById = new Map();
    planetById = new Map();
    const planets = new Map(data.planets.map((planet) => [planet.id, planet]));
    data.planets.forEach(addPlanet);
    data.warpLanes.forEach((lane) => addLane(lane, planets));
    data.planets.forEach(addFleets);
    activeVectors(data).forEach(addVector);
    projectiles.forEach((projectile) => stepProjectile(projectile, 0));
    ships.forEach(placeShip);
    for (const effect of effects) {
      const debris = debrisById.get(effect.planetId);
      if (debris) debris.visible = false;
    }
    if (selectionChanged && active) {
      const planet = planets.get(selection);
      if (planet) { focusGoal.copy(world(planet)); focusing = true; }
    }
    if (!active) return;
    render();
  }

  function render() {
    const offsetShake = shake > 0 ? new THREE.Vector3((Math.random() - 0.5) * shake * 8, (Math.random() - 0.5) * shake * 8, 0) : new THREE.Vector3();
    camera.position.set(
      target.x + orbit.distance * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      target.y + orbit.distance * Math.cos(orbit.phi),
      target.z + orbit.distance * Math.sin(orbit.phi) * Math.cos(orbit.theta),
    ).add(offsetShake);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function resize() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (active) render();
  }

  function fit() {
    const xs = data.planets.map((p) => p.x - offset.x);
    const zs = data.planets.map((p) => p.y - offset.z);
    target.set(0, 0, 0);
    focusing = false;
    const spanX = Math.max(...xs) - Math.min(...xs) + 260;
    const spanZ = Math.max(...zs) - Math.min(...zs) + 260;
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    orbit.distance = Math.max(spanZ * 0.9, spanX / camera.aspect) / (2 * vertical) * 1.05;
    orbit.theta = 0;
    orbit.phi = 0.92;
    if (active) render();
  }

  function zoom(factor) {
    orbit.distance = THREE.MathUtils.clamp(orbit.distance * factor, 160, 5000);
    if (active) render();
  }

  // ---------- Input ----------
  function ndc(event) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  }
  function groundPoint(event) {
    raycaster.setFromCamera(ndc(event), camera);
    return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
  }
  function pick(event) {
    raycaster.setFromCamera(ndc(event), camera);
    const hit = raycaster.intersectObjects(selectable, false)[0];
    return hit?.object.userData.planetId;
  }
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.0015));
  }, { passive: false });
  canvas.addEventListener("pointerdown", (event) => {
    const rotate = event.button === 2 || (event.button === 0 && event.shiftKey);
    if (event.button !== 0 && event.button !== 2) return;
    drag = { id: event.pointerId, rotate, x: event.clientX, y: event.clientY, start: groundPoint(event), target: target.clone(), theta: orbit.theta, phi: orbit.phi, moved: false };
    focusing = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) {
      canvas.style.cursor = pick(event) ? "pointer" : "grab";
      return;
    }
    if (event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved ||= Math.hypot(dx, dy) > 4;
    if (!drag.moved) return;
    canvas.style.cursor = "grabbing";
    if (drag.rotate) {
      orbit.theta = drag.theta - dx * 0.006;
      orbit.phi = THREE.MathUtils.clamp(drag.phi - dy * 0.005, 0.25, 1.4);
    } else if (drag.start) {
      target.copy(drag.target);
      render();
      const point = groundPoint(event);
      if (point) target.copy(drag.target).add(drag.start.clone().sub(point));
    }
    if (!frame) render();
  });
  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && !drag.rotate) {
      const id = pick(event);
      if (id) onSelect(id);
    }
    drag = null;
    canvas.style.cursor = "grab";
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", (event) => { if (drag?.id === event.pointerId) drag = null; });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    setActive(false);
    container.dispatchEvent(new CustomEvent("projectionerror", { detail: "WebGL context lost. Returned to Tactical 2D; reload to restore the 3D projection." }));
  });
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // ---------- Loop ----------
  function animate(time) {
    if (!active) return;
    const delta = previous === null ? 0 : Math.min(0.05, (time - previous) / 1000);
    previous = time;
    elapsed += delta;
    const still = reducedMotion.matches;
    if (!still) {
      for (const spinner of spinners) spinner.object.rotation[spinner.axis || "y"] += delta * spinner.speed;
      for (const entry of ships) {
        fleetAngles.set(entry.key, fleetAngles.get(entry.key) + delta * entry.speed);
        placeShip(entry);
      }
      for (const pulse of pulses) {
        pulse.t = (pulse.t + delta * pulse.speed) % 1;
        pulse.sprite.position.copy(pulse.curve.getPoint(pulse.reverse ? 1 - pulse.t : pulse.t));
        pulse.sprite.material.opacity = 0.5 + Math.sin(elapsed * 6 + pulse.t * 10) * 0.3;
      }
      for (const throb of throbs) throb.material[throb.property || "opacity"] = throb.base + Math.sin(elapsed * throb.speed + (throb.phase || 0)) * throb.amp;
      for (const smoke of smokes) stepSmoke(smoke, delta);
      if (showVectors) for (const projectile of projectiles) stepProjectile(projectile, delta);
    }
    for (const [id, progress] of spawns) {
      const next = progress + delta / 1.1;
      const holder = planetById.get(id);
      if (holder) holder.scale.setScalar(Math.min(1, THREE.MathUtils.smoothstep(next, 0, 1) + 0.01));
      if (next >= 1) spawns.delete(id); else spawns.set(id, next);
    }
    for (let index = effects.length - 1; index >= 0; index--) {
      const effect = effects[index];
      stepEffect(effect, delta);
      const debris = debrisById.get(effect.planetId);
      if (debris && effect.age > 2.4) {
        debris.visible = true;
        debris.scale.setScalar(Math.min(1, (effect.age - 2.4) / 1.2));
      }
      if (effect.age >= effect.duration) finishEffect(index);
    }
    if (focusing) {
      target.lerp(focusGoal, Math.min(1, delta * 3));
      if (target.distanceTo(focusGoal) < 0.5) focusing = false;
    }
    shake = Math.max(0, shake - delta * 1.4);
    render();
    frame = requestAnimationFrame(animate);
  }

  function setActive(value) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    active = value;
    previous = null;
    if (active) {
      resize();
      frame = requestAnimationFrame(animate);
    } else {
      for (let index = effects.length - 1; index >= 0; index--) finishEffect(index);
      for (const debris of debrisById.values()) { debris.visible = true; debris.scale.setScalar(1); }
      spawns.clear();
      planetById.forEach((holder) => holder.scale.setScalar(1));
    }
  }

  function dispose() {
    setActive(false);
    observer.disconnect();
    for (const group of [worldGroup, laneGroup, fleetGroup, vectorGroup]) disposeGroup(group);
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
    canvas.remove();
  }

  update(data, selection);
  fit();
  return { update, zoom, fit, setActive, setVectors, dispose, debug: { scene, vectors: () => ({ visible: vectorGroup.visible, arcs: vectorGroup.children.length, projectiles: projectiles.length }), effects: () => effects.length, planets: () => planetById.size, ships: () => ships.length, lanes: () => data.warpLanes.length } };
}
