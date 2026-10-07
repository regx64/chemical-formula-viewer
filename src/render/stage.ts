import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ELEMENT_BY_SYMBOL, stageColor } from '../chem/elements';
import type { Vec3 } from '../chem/types';

export type RenderStyle = 'ball-stick' | 'spacefill' | 'licorice';

export interface SceneAtom {
  el: string;
  pos: Vec3;
  charge?: number;
  /** 0..1 — scales the sphere (used for fade-in) */
  presence?: number;
}

export interface SceneBond {
  a: number;
  b: number;
  /** 1, 2, 3, 1.5 (aromatic), 0 (ionic/metallic contact, dashed) */
  order: number;
  /** 0..1 — bond thickness multiplier, 0 hides the bond */
  strength?: number;
}

export interface SceneFrame {
  atoms: SceneAtom[];
  bonds: SceneBond[];
  /** 0..1 — transition-state glow */
  glow?: number;
}

export interface HoverInfo {
  index: number;
  screen: { x: number; y: number };
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vD = new THREE.Vector3();

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,200,140,0.55)');
  grad.addColorStop(0.55, 'rgba(255,120,80,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private atomMesh: THREE.InstancedMesh;
  private bondMesh: THREE.InstancedMesh;
  private haloMesh: THREE.InstancedMesh;
  private atomMaterial: THREE.MeshPhysicalMaterial;
  private glow: THREE.Sprite;
  private dust: THREE.Points;
  private labels: CSS2DObject[] = [];
  private measureGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frameData: SceneFrame = { atoms: [], bonds: [] };
  private style: RenderStyle = 'ball-stick';
  private showLabels = false;
  private selection: number[] = [];
  private hovered = -1;
  private enterStart = -1;
  private enterOrder: number[] = [];
  private camTween: { from: number; to: number; start: number; dur: number; target: THREE.Vector3; fromTarget: THREE.Vector3 } | null = null;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private clock = new THREE.Clock();
  private capacityAtoms = 0;
  private capacityBonds = 0;
  onHover: ((info: HoverInfo | null) => void) | null = null;
  onPick: ((index: number) => void) | null = null;
  onFrame: ((dt: number) => void) | null = null;

  constructor(private container: HTMLElement) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'stage-canvas';
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = 'stage-labels';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 2000);
    this.camera.position.set(0, 0, 18);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(6, 9, 10);
    const rim = new THREE.DirectionalLight(0x7fd6ff, 1.6);
    rim.position.set(-8, 2, -10);
    const fill = new THREE.DirectionalLight(0xb59cff, 0.6);
    fill.position.set(-6, -8, 6);
    this.scene.add(key, rim, fill, new THREE.HemisphereLight(0x9fb7ff, 0x0a0a12, 0.35));

    this.atomMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.3,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
      emissive: new THREE.Color(0xff9a5c),
      emissiveIntensity: 0,
    });
    const bondMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.38, metalness: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    this.atomMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 48, 32), this.atomMaterial, 1);
    this.bondMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), bondMaterial, 1);
    this.haloMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x8be9ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      8,
    );
    for (const m of [this.atomMesh, this.bondMesh]) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.haloMesh.count = 0;
    this.haloMesh.frustumCulled = false;
    this.ensureCapacity(64, 128);
    this.scene.add(this.atomMesh, this.bondMesh, this.haloMesh, this.measureGroup);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.glow.scale.setScalar(12);
    this.scene.add(this.glow);

    // ambient "dust" for depth
    const n = 700;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 30 + Math.random() * 70;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pts.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.18, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true }));
    this.scene.add(this.dust);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.8;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 400;

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.handlePointerMove);
    el.addEventListener('pointerleave', () => this.setHovered(-1, null));
    let downAt = { x: 0, y: 0 };
    el.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const hit = this.pick(e);
      if (hit >= 0) this.onPick?.(hit);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.loop();
  }

  private ensureCapacity(atoms: number, bonds: number) {
    if (atoms > this.capacityAtoms) {
      const cap = Math.max(atoms, this.capacityAtoms * 2);
      const mesh = new THREE.InstancedMesh(this.atomMesh.geometry, this.atomMesh.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.remove(this.atomMesh);
      this.atomMesh = mesh;
      this.scene.add(mesh);
      this.capacityAtoms = cap;
    }
    if (bonds > this.capacityBonds) {
      const cap = Math.max(bonds, this.capacityBonds * 2);
      const mesh = new THREE.InstancedMesh(this.bondMesh.geometry, this.bondMesh.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.remove(this.bondMesh);
      this.bondMesh = mesh;
      this.scene.add(mesh);
      this.capacityBonds = cap;
    }
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  atomRadius(el: string): number {
    const vdw = ELEMENT_BY_SYMBOL[el]?.vdw ?? 1.8;
    if (this.style === 'spacefill') return vdw;
    if (this.style === 'licorice') return 0.17;
    return 0.22 * vdw;
  }

  setStyle(style: RenderStyle) {
    this.style = style;
    this.rebuild();
  }

  setLabels(on: boolean) {
    this.showLabels = on;
    this.rebuild();
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  setSelection(indices: number[]) {
    this.selection = indices.slice(-4);
    this.rebuild();
  }

  /** Replace the displayed frame. `enter` plays the staggered build-in animation. */
  setFrame(frame: SceneFrame, opts: { enter?: boolean } = {}) {
    this.frameData = frame;
    if (opts.enter) {
      this.enterStart = performance.now();
      // order atoms by distance from the centroid → the molecule "grows" outward
      const c = frame.atoms.reduce((acc, a) => [acc[0] + a.pos[0], acc[1] + a.pos[1], acc[2] + a.pos[2]], [0, 0, 0]);
      const n = frame.atoms.length || 1;
      const d = frame.atoms.map((a) => Math.hypot(a.pos[0] - c[0] / n, a.pos[1] - c[1] / n, a.pos[2] - c[2] / n));
      const max = Math.max(1e-3, ...d);
      this.enterOrder = d.map((x) => x / max);
    }
    this.rebuild();
  }

  private appear(i: number): number {
    if (this.enterStart < 0) return 1;
    const t = (performance.now() - this.enterStart) / 900 - (this.enterOrder[i] ?? 0) * 0.45;
    return easeOutExpo(Math.max(0, Math.min(1, t / 0.55)));
  }

  private rebuild() {
    const { atoms, bonds } = this.frameData;
    const lines = this.style === 'spacefill' ? 0 : bonds.length * 6 + 8;
    this.ensureCapacity(atoms.length + 1, lines * 2 + 16);

    // atoms
    atoms.forEach((a, i) => {
      const r = this.atomRadius(a.el) * (a.presence ?? 1) * this.appear(i) * (i === this.hovered ? 1.08 : 1);
      tmpM.compose(tmpP.set(a.pos[0], a.pos[1], a.pos[2]), tmpQ.identity(), tmpS.setScalar(Math.max(r, 1e-4)));
      this.atomMesh.setMatrixAt(i, tmpM);
      tmpC.set(stageColor(a.el));
      if (i === this.hovered) tmpC.lerp(new THREE.Color(0xffffff), 0.25);
      this.atomMesh.setColorAt(i, tmpC);
    });
    this.atomMesh.count = atoms.length;
    this.atomMesh.instanceMatrix.needsUpdate = true;
    if (this.atomMesh.instanceColor) this.atomMesh.instanceColor.needsUpdate = true;
    this.atomMesh.computeBoundingSphere();

    // bonds
    let k = 0;
    if (this.style !== 'spacefill') {
      const adj: number[][] = atoms.map(() => []);
      for (const b of bonds) {
        if ((b.strength ?? 1) <= 0.02) continue;
        adj[b.a]?.push(b.b);
        adj[b.b]?.push(b.a);
      }
      for (const b of bonds) {
        const s = (b.strength ?? 1) * Math.min(this.appear(b.a), this.appear(b.b));
        if (s <= 0.02 || !atoms[b.a] || !atoms[b.b]) continue;
        k = this.emitBond(k, atoms, adj, b, s);
      }
    }
    this.bondMesh.count = k;
    this.bondMesh.instanceMatrix.needsUpdate = true;
    if (this.bondMesh.instanceColor) this.bondMesh.instanceColor.needsUpdate = true;

    // selection halos
    this.selection.forEach((idx, i) => {
      const a = atoms[idx];
      if (!a) return;
      const r = this.atomRadius(a.el) * 1.3 + 0.06;
      tmpM.compose(tmpP.set(...a.pos), tmpQ.identity(), tmpS.setScalar(r));
      this.haloMesh.setMatrixAt(i, tmpM);
    });
    this.haloMesh.count = this.selection.filter((i) => atoms[i]).length;
    this.haloMesh.instanceMatrix.needsUpdate = true;

    this.updateLabels();
    this.updateMeasurement();

    const g = this.frameData.glow ?? 0;
    (this.glow.material as THREE.SpriteMaterial).opacity = g * 0.9;
    this.atomMaterial.emissiveIntensity = g * 0.35;
  }

  private emitBond(k: number, atoms: SceneAtom[], adj: number[][], b: SceneBond, s: number): number {
    const A = atoms[b.a];
    const B = atoms[b.b];
    vA.set(...A.pos);
    vB.set(...B.pos);
    vD.subVectors(vB, vA);
    const len = vD.length();
    if (len < 1e-4) return k;
    const dir = vD.clone().divideScalar(len);
    // a perpendicular in the plane of a neighbour (keeps double bonds in the π plane, aromatic lines inside rings)
    let perp = new THREE.Vector3();
    const nb = (adj[b.a] ?? []).find((x) => x !== b.b) ?? (adj[b.b] ?? []).find((x) => x !== b.a);
    if (nb !== undefined && atoms[nb]) {
      const ref = new THREE.Vector3(...atoms[nb].pos).sub(adj[b.a]?.includes(nb) ? vA : vB);
      perp = ref.sub(dir.clone().multiplyScalar(ref.dot(dir)));
    }
    if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0));
    perp.normalize();

    const licorice = this.style === 'licorice';
    const base = licorice ? 0.17 : 0.11;
    const lines: { off: number; r: number; dashed: boolean }[] = [];
    const order = licorice && b.order >= 1 ? 1 : b.order;
    if (order === 0) lines.push({ off: 0, r: 0.045, dashed: true });
    else if (order === 1) lines.push({ off: 0, r: base, dashed: false });
    else if (order === 1.5) {
      lines.push({ off: 0, r: base * 0.85, dashed: false });
      lines.push({ off: 0.24, r: 0.045, dashed: true });
    } else if (order === 2) {
      lines.push({ off: -0.1, r: 0.07, dashed: false }, { off: 0.1, r: 0.07, dashed: false });
    } else {
      lines.push({ off: -0.16, r: 0.06, dashed: false }, { off: 0, r: 0.06, dashed: false }, { off: 0.16, r: 0.06, dashed: false });
    }
    const colA = stageColor(A.el);
    const colB = stageColor(B.el);
    const rA = this.atomRadius(A.el);
    const rB = this.atomRadius(B.el);
    for (const line of lines) {
      const o = perp.clone().multiplyScalar(line.off);
      const p0 = vA.clone().add(o);
      const p1 = vB.clone().add(o);
      const r = line.r * Math.max(0.15, s);
      if (line.dashed) {
        // dashes between the atom surfaces
        const t0 = Math.min(0.45, (rA * 0.9) / len);
        const t1 = Math.max(0.55, 1 - (rB * 0.9) / len);
        const n = Math.max(3, Math.round(((t1 - t0) * len) / 0.22));
        for (let i = 0; i < n; i++) {
          const u0 = t0 + ((t1 - t0) * i) / n;
          const u1 = u0 + ((t1 - t0) / n) * 0.55;
          k = this.cylinder(k, p0.clone().lerp(p1, u0), p0.clone().lerp(p1, u1), r, (u0 + u1) / 2 < 0.5 ? colA : colB, s);
        }
      } else {
        const mid = p0.clone().lerp(p1, 0.5);
        k = this.cylinder(k, p0, mid, r, colA, s);
        k = this.cylinder(k, mid, p1, r, colB, s);
      }
    }
    return k;
  }

  private cylinder(k: number, p0: THREE.Vector3, p1: THREE.Vector3, r: number, color: string, strength: number): number {
    if (k >= this.capacityBonds) return k;
    const d = new THREE.Vector3().subVectors(p1, p0);
    const len = d.length();
    tmpQ.setFromUnitVectors(UP, d.clone().normalize());
    tmpM.compose(p0.clone().add(p1).multiplyScalar(0.5), tmpQ, tmpS.set(r, len, r));
    this.bondMesh.setMatrixAt(k, tmpM);
    tmpC.set(color);
    if (strength < 1) tmpC.lerp(new THREE.Color(0xffd7a8), (1 - strength) * 0.6);
    this.bondMesh.setColorAt(k, tmpC);
    return k + 1;
  }

  private updateLabels() {
    const atoms = this.frameData.atoms;
    const want = this.showLabels ? atoms.length : 0;
    while (this.labels.length < want) {
      const div = document.createElement('div');
      div.className = 'atom-label';
      const obj = new CSS2DObject(div);
      this.scene.add(obj);
      this.labels.push(obj);
    }
    this.labels.forEach((obj, i) => {
      const a = atoms[i];
      obj.visible = i < want && !!a && (a.presence ?? 1) > 0.2;
      if (!obj.visible || !a) return;
      obj.position.set(...a.pos);
      const ch = a.charge ? (Math.abs(a.charge) > 1 ? Math.abs(a.charge) : '') + (a.charge > 0 ? '+' : '−') : '';
      const text = a.el + (ch ? `<sup>${ch}</sup>` : '');
      if (obj.element.innerHTML !== text) obj.element.innerHTML = text;
    });
  }

  private updateMeasurement() {
    this.measureGroup.clear();
    const atoms = this.frameData.atoms;
    const pts = this.selection.map((i) => atoms[i]).filter(Boolean).map((a) => new THREE.Vector3(...a.pos));
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x8be9ff, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.9, depthTest: false }));
    line.computeLineDistances();
    line.renderOrder = 10;
    this.measureGroup.add(line);
  }

  private pick(e: PointerEvent): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.atomMesh, false);
    return hits.length && hits[0].instanceId !== undefined ? hits[0].instanceId : -1;
  }

  private handlePointerMove = (e: PointerEvent) => {
    const hit = this.pick(e);
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.setHovered(hit, hit >= 0 ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  };

  private setHovered(i: number, screen: { x: number; y: number } | null) {
    const changed = i !== this.hovered;
    this.hovered = i;
    this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (changed) this.rebuild();
    this.onHover?.(i >= 0 && screen ? { index: i, screen } : null);
  }

  /** Fit the camera to a bounding radius around the origin. */
  fit(radius: number, instant = false) {
    this.lastFit = radius;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = (Math.max(radius, 1.5) / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08;
    const current = this.camera.position.distanceTo(this.controls.target);
    if (instant) {
      this.camera.position.sub(this.controls.target).setLength(dist);
      this.controls.target.set(0, 0, 0);
      this.camTween = null;
      return;
    }
    this.camTween = { from: current, to: dist, start: performance.now(), dur: 900, target: new THREE.Vector3(), fromTarget: this.controls.target.clone() };
  }

  private lastFit = 5;

  /** Fit the camera to the current frame using the active render style's atom radii. */
  fitToFrame(instant = false) {
    let r = 1;
    for (const a of this.frameData.atoms) r = Math.max(r, Math.hypot(...a.pos) + this.atomRadius(a.el));
    this.fit(r + 0.3, instant);
  }

  resetView() {
    this.camera.position.set(0, 0, 1);
    this.controls.target.set(0, 0, 0);
    this.fit(this.lastFit, true);
  }

  projectAtom(i: number): { x: number; y: number } | null {
    const a = this.frameData.atoms[i];
    if (!a) return null;
    const v = new THREE.Vector3(...a.pos).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
    grad.addColorStop(0, '#10131c');
    grad.addColorStop(1, '#050507');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    return c.toDataURL('image/png');
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.clock.getDelta());
    this.onFrame?.(dt);
    if (this.camTween) {
      const t = Math.min(1, (performance.now() - this.camTween.start) / this.camTween.dur);
      const e = easeInOutCubic(t);
      this.controls.target.lerpVectors(this.camTween.fromTarget, this.camTween.target, e);
      const d = this.camTween.from + (this.camTween.to - this.camTween.from) * e;
      this.camera.position.sub(this.controls.target).setLength(d).add(this.controls.target);
      if (t >= 1) this.camTween = null;
    }
    if (this.enterStart >= 0) {
      this.rebuild();
      if (performance.now() - this.enterStart > 1500) {
        this.enterStart = -1;
        this.rebuild();
      }
    }
    this.dust.rotation.y += dt * 0.01;
    this.dust.rotation.x += dt * 0.004;
    this.glow.quaternion.copy(this.camera.quaternion);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
