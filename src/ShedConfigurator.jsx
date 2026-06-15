import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* ===================== נתוני מוצר (לפי configurator-spec.md) ===================== */
const SIZES = [
  { id: "10x10", w: 1, l: 1, price: 2900, delivery: 600 },
  { id: "10x20", w: 1, l: 2, price: 4300, delivery: 700 },
  { id: "20x10", w: 2, l: 1, price: 6900, delivery: 1100 },
  { id: "20x20", w: 2, l: 2, price: 5990, delivery: 900 },
  { id: "20x40", w: 2, l: 4, price: 8800, delivery: 1100 },
  { id: "30x20", w: 3, l: 2, price: 7800, delivery: 1000 },
  { id: "30x30", w: 3, l: 3, price: 9800, delivery: 1200 },
  { id: "30x40", w: 3, l: 4, price: 11990, delivery: 1400 },
  { id: "30x50", w: 3, l: 5, price: 14990, delivery: 1700 },
  { id: "30x60", w: 3, l: 6, price: 17900, delivery: 2000 },
];
const FRAME_COLORS = {
  white: { name: "לבן", hex: "#f4f5f6", three: 0xf4f5f6 },
  black: { name: "שחור", hex: "#1b1d21", three: 0x1b1d21 },
};
const PANEL_PRICE = { window: 1190, glass: 1190 };
const WALL_NAME = { front: "קיר קדמי", back: "קיר אחורי", left: "צד שמאל", right: "צד ימין" };
const TYPE_NAME = { empty: "ריק", door: "דלת", window: "חלון", glass: "זכוכית" };

/* ===================== קבועי גיאומטריה ===================== */
const H_FRONT = 2.3, H_BACK = 2.0, H_PANELS = 1.9;
const OVERHANG = 0.2, ROOF_T = 0.08, PROFILE = 0.06;
const ACCENT = "#0d7d84";

const nis = (n) => "₪" + n.toLocaleString("he-IL");
const midFront = (l) => `front-${Math.floor(Math.round(l) / 2)}`;

/* ===================== סט ידית דלת — רוזטות + ידית מעוקלת + מנעול ===================== */
function addHandleSet(g, M, hx) {
  const yHandle = 1.03; // גובה הידית
  const yLock = 0.86;   // גובה המנעול
  const faceZ = 0.05;   // פני הדלת (כנף ב-z≈0.012, עובי 0.075 → פנים ~0.05)
  const mat = M.handle;

  // רוזטה עליונה — דיסק שטוח צמוד לדלת
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 20), mat);
  rose.rotation.x = Math.PI / 2;
  rose.position.set(hx, yHandle, faceZ + 0.006);
  rose.castShadow = true;
  g.add(rose);

  // צוואר הידית — גליל קצר שיוצא מהרוזטה
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 12), mat);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(hx, yHandle, faceZ + 0.03);
  g.add(neck);

  // ידית — אופקית מימין לשמאל עם קשת עדינה כלפי מעלה, הקצה חוזר לגובה הבסיס
  const z0 = faceZ + 0.05;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hx, yHandle, faceZ + 0.045),       // יציאה מהצוואר
    new THREE.Vector3(hx, yHandle, z0),                  // בסיס ימין (ליד הרוזטה)
    new THREE.Vector3(hx - 0.06, yHandle + 0.016, z0),   // קשת עולה עדינה
    new THREE.Vector3(hx - 0.13, yHandle + 0.012, z0),   // ממשיך שמאלה
    new THREE.Vector3(hx - 0.19, yHandle, z0 - 0.004),   // קצה שמאל — חזרה לגובה הבסיס
  ]);
  // צינור מחודד: רדיוס יורד לכיוון הקצה החופשי
  const lever = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.012, 12, false),
    mat
  );
  lever.castShadow = true;
  g.add(lever);
  // הצרה בקצה — חרוט דק שמדמה את הקצה המחודד
  const tipPt = curve.getPoint(1);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 10), mat);
  tip.position.copy(tipPt);
  g.add(tip);

  // רוזטת מנעול — דיסק שטוח נמוך יותר
  const lockRose = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 20), mat);
  lockRose.rotation.x = Math.PI / 2;
  lockRose.position.set(hx, yLock, faceZ + 0.005);
  lockRose.castShadow = true;
  g.add(lockRose);

  // חור מפתח — שקע כהה קטן
  const kh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10),
    new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9 })
  );
  kh.rotation.x = Math.PI / 2;
  kh.position.set(hx, yLock + 0.004, faceZ + 0.012);
  g.add(kh);
}

/* ===================== בניית תא (פאנל) — פונה ל-+Z מקומי ===================== */
function buildCell(type, M) {
  const g = new THREE.Group();
  const add = (w, h, d, m, x, y, z, cast = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  if (type === "door") {
    add(0.9, 1.84, 0.075, M.panel, 0, 0.96, 0.012); // כנף הדלת
    [0.42, 0.8, 1.18, 1.56].forEach((y) => add(0.905, 0.012, 0.08, M.groove, 0, y, 0.012, false));
    addHandleSet(g, M, 0.36); // סט ידית מלא בצד ימין (ציר משמאל)
    add(0.94, 0.05, 0.09, M.frame, 0, 0.027, 0); // סף
  } else if (type === "window") {
    add(0.94, 1.84, 0.055, M.panel, 0, 0.95, 0);
    [0.34, 0.66].forEach((y) => add(0.945, 0.012, 0.06, M.groove, 0, y, 0, false));
    const cy = 1.36, fw = 0.88, fh = 0.96;
    add(fw, 0.05, 0.07, M.frame, 0, cy + fh / 2 - 0.025, 0.012);
    add(fw, 0.05, 0.07, M.frame, 0, cy - fh / 2 + 0.025, 0.012);
    add(0.05, fh - 0.1, 0.07, M.frame, -(fw / 2 - 0.025), cy, 0.012);
    add(0.05, fh - 0.1, 0.07, M.frame, fw / 2 - 0.025, cy, 0.012);
    add(0.76, 0.82, 0.02, M.glassDark, 0, cy, 0.02, false); // זכוכית כהה
    add(0.92, 0.035, 0.1, M.frame, 0, cy - fh / 2 - 0.02, 0.02); // אדן
  } else if (type === "glass") {
    add(0.94, 0.12, 0.07, M.frame, 0, 0.09, 0); // פס תחתון
    add(0.94, 1.7, 0.022, M.glassWall, 0, 1.0, 0, false); // זכוכית מלאה
    add(0.94, 0.04, 0.06, M.frame, 0, 1.87, 0);
  } else {
    add(0.94, 1.84, 0.055, M.panel, 0, 0.95, 0); // פאנל אטום
    [0.38, 0.76, 1.14, 1.52].forEach((y) => add(0.945, 0.012, 0.06, M.groove, 0, y, 0, false));
  }
  return g;
}

/* ===================== בניית המחסן המלא ===================== */
function buildShed(size, frameThree, panels) {
  const L = size.l, W = size.w;
  const slope = Math.atan(0.3 / W);
  const g = new THREE.Group();
  const hits = [];

  const M = {
    panel: new THREE.MeshStandardMaterial({ color: 0xededee, roughness: 0.62, metalness: 0.04 }),
    groove: new THREE.MeshStandardMaterial({ color: 0xd9dbde, roughness: 0.72, metalness: 0.03 }),
    frame: new THREE.MeshStandardMaterial({ color: frameThree, roughness: 0.32, metalness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.28, metalness: 0.9 }),
    handle: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.42, metalness: 0.6 }),
    glassTop: new THREE.MeshPhysicalMaterial({ color: 0xb9cdd6, roughness: 0.06, metalness: 0.7, transparent: true, opacity: 0.5, clearcoat: 1 }),
    glassDark: new THREE.MeshPhysicalMaterial({ color: 0x39424a, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.92, clearcoat: 1 }),
    glassWall: new THREE.MeshPhysicalMaterial({ color: 0xc2d6dd, roughness: 0.07, metalness: 0.55, transparent: true, opacity: 0.42, clearcoat: 1, side: THREE.DoubleSide }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  };

  const box = (w, h, d, m, x, y, z, opt = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (opt.rx) mesh.rotation.x = opt.rx;
    if (opt.ry) mesh.rotation.y = opt.ry;
    mesh.castShadow = opt.cast !== false;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  /* בסיס מוגבה */
  box(L + 0.02, 0.09, W + 0.02, M.frame, 0, 0.045, 0);

  const hTop = (z) => H_BACK + (H_FRONT - H_BACK) * ((z + W / 2) / W);
  const nF = Math.round(L), nS = Math.round(W);

  /* ---------- קיר קדמי + אחורי ---------- */
  [
    ["front", W / 2, 0, H_FRONT],
    ["back", -W / 2, Math.PI, H_BACK],
  ].forEach(([id, z, ry, hWall]) => {
    box(L, 0.06, PROFILE, M.frame, 0, 0.05, z); // פס תחתון
    box(L, PROFILE, PROFILE, M.frame, 0, H_PANELS, z); // מפריד clerestory
    box(L, PROFILE, PROFILE, M.frame, 0, hWall - PROFILE / 2, z); // פס עליון
    for (let i = 0; i <= nF; i++)
      box(PROFILE, hWall, PROFILE, M.frame, -L / 2 + i, hWall / 2, z); // פרופילים אנכיים רציפים
    for (let i = 0; i < nF; i++) {
      const cx = -L / 2 + 0.5 + i;
      const glassH = Math.max(hWall - H_PANELS - PROFILE - 0.02, 0.06);
      box(1 - PROFILE - 0.05, glassH, 0.024, M.glassTop, cx, (H_PANELS + hWall) / 2, z, { cast: false }); // clerestory
      const cell = buildCell(panels[`${id}-${i}`] || "empty", M);
      cell.position.set(cx, 0, z);
      cell.rotation.y = ry;
      g.add(cell);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.97, H_PANELS, 0.14), M.hit);
      hit.position.set(cx, H_PANELS / 2, z);
      hit.rotation.y = ry;
      hit.userData = { key: `${id}-${i}`, wall: id, index: i };
      g.add(hit);
      hits.push(hit);
    }
  });

  /* ---------- קירות צד (טרפזים) ---------- */
  [
    ["right", L / 2, Math.PI / 2],
    ["left", -L / 2, -Math.PI / 2],
  ].forEach(([id, x, ry]) => {
    box(PROFILE, 0.06, W, M.frame, x, 0.05, 0); // פס תחתון
    box(PROFILE, PROFILE, W, M.frame, x, H_PANELS, 0); // מפריד
    const railLen = Math.sqrt(W * W + 0.09);
    box(PROFILE, PROFILE, railLen, M.frame, x, (H_FRONT + H_BACK) / 2 - PROFILE / 2, 0, { rx: -slope }); // פס עליון משופע
    for (let j = 1; j < nS; j++) {
      const z = -W / 2 + j;
      const h = hTop(z);
      box(PROFILE, h, PROFILE, M.frame, x, h / 2, z); // פרופילים אנכיים פנימיים
    }
    for (let j = 0; j < nS; j++) {
      /* clerestory טרפזי */
      const z0 = -W / 2 + j + PROFILE / 2 + 0.02;
      const z1 = -W / 2 + j + 1 - PROFILE / 2 - 0.02;
      const yB = H_PANELS + PROFILE / 2 + 0.01;
      const s = new THREE.Shape();
      s.moveTo(z0, yB);
      s.lineTo(z1, yB);
      s.lineTo(z1, hTop(z1) - 0.05);
      s.lineTo(z0, hTop(z0) - 0.05);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: false });
      const glass = new THREE.Mesh(geo, M.glassTop);
      glass.rotation.y = -Math.PI / 2;
      glass.position.set(x + 0.012, 0, 0);
      glass.castShadow = false;
      glass.receiveShadow = true;
      g.add(glass);

      /* תא */
      const cz = -W / 2 + 0.5 + j;
      const cell = buildCell(panels[`${id}-${j}`] || "empty", M);
      cell.position.set(x, 0, cz);
      cell.rotation.y = ry;
      g.add(cell);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.97, H_PANELS, 0.14), M.hit);
      hit.position.set(x, H_PANELS / 2, cz);
      hit.rotation.y = ry;
      hit.userData = { key: `${id}-${j}`, wall: id, index: j };
      g.add(hit);
      hits.push(hit);
    }
  });

  /* ---------- גג משופע ---------- */
  const roof = new THREE.Group();
  roof.rotation.x = -slope;
  roof.position.set(0, (H_FRONT + H_BACK) / 2 + ROOF_T / 2 + 0.012, 0);
  const depth = (W + 2 * OVERHANG) / Math.cos(slope);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * OVERHANG, ROOF_T, depth), M.frame);
  slab.castShadow = true;
  slab.receiveShadow = true;
  roof.add(slab);
  const fas = (w, h, d, x, z) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.frame);
    f.position.set(x, 0, z);
    f.castShadow = true;
    roof.add(f);
  };
  fas(L + 2 * OVERHANG + 0.05, 0.13, 0.045, 0, depth / 2);
  fas(L + 2 * OVERHANG + 0.05, 0.13, 0.045, 0, -depth / 2);
  fas(0.045, 0.13, depth + 0.05, L / 2 + OVERHANG, 0);
  fas(0.045, 0.13, depth + 0.05, -(L / 2 + OVERHANG), 0);
  g.add(roof);

  return { group: g, hits };
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose();
    }
  });
}

/* ===================== הקומפוננטה הראשית ===================== */
export default function ShedConfigurator() {
  const mountRef = useRef(null);
  const api = useRef({});
  const actions = useRef({});

  const [sizeId, setSizeId] = useState("30x30");
  const [frameColor, setFrameColor] = useState("white");
  const [panels, setPanels] = useState(() => ({ [midFront(3)]: "door" }));
  const [menu, setMenu] = useState(null); // {key, x, y}

  const size = SIZES.find((s) => s.id === sizeId);
  const windows = Object.values(panels).filter((t) => t === "window").length;
  const glasses = Object.values(panels).filter((t) => t === "glass").length;
  const addons = windows * PANEL_PRICE.window + glasses * PANEL_PRICE.glass;
  const total = size.price + size.delivery + addons;

  actions.current.openMenu = (d) => setMenu(d);
  actions.current.closeMenu = () => setMenu(null);

  /* ---------- אתחול סצנה (פעם אחת) ---------- */
  useEffect(() => {
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    const hemi = new THREE.HemisphereLight(0xeaf2f7, 0xd8d2c8, 0.75);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(6, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe9f0, 0.32);
    fill.position.set(-6, 4, -4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const orbit = {
      theta: 0.62, phi: 1.22, radius: 9,
      dTheta: 0.62, dPhi: 1.22, dRadius: 9,
      target: new THREE.Vector3(0, 1.12, 0),
      userZoomed: false,
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
    );
    highlight.visible = false;
    scene.add(highlight);

    Object.assign(api.current, { renderer, scene, camera, orbit, key, highlight, hits: [], shed: null });

    /* --- אינטראקציה --- */
    const pointers = new Map();
    let downX = 0, downY = 0, moved = 0, pinchDist = 0;

    const castAt = (clientX, clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const inter = raycaster.intersectObjects(api.current.hits, false);
      return inter.length ? inter[0].object : null;
    };

    const onDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downX = e.clientX; downY = e.clientY; moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (pointers.has(e.pointerId)) {
        const p = pointers.get(e.pointerId);
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (pointers.size === 1) {
          orbit.dTheta -= dx * 0.0055;
          orbit.dPhi = THREE.MathUtils.clamp(orbit.dPhi - dy * 0.0045, 0.32, 1.5);
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0) {
            orbit.dRadius = THREE.MathUtils.clamp(orbit.dRadius * (pinchDist / d), 2.4, 32);
            orbit.userZoomed = true;
          }
          pinchDist = d;
        }
      } else if (e.pointerType === "mouse") {
        const hit = castAt(e.clientX, e.clientY);
        if (hit) {
          highlight.visible = true;
          hit.getWorldPosition(highlight.position);
          hit.getWorldQuaternion(highlight.quaternion);
          highlight.scale.set(0.97, H_PANELS, 1);
          highlight.translateZ(0.09);
          renderer.domElement.style.cursor = "pointer";
        } else {
          highlight.visible = false;
          renderer.domElement.style.cursor = "grab";
        }
      }
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      renderer.domElement.style.cursor = "grab";
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 8 && dist < 8 && pointers.size === 0) {
        const hit = castAt(e.clientX, e.clientY);
        const r = el.getBoundingClientRect();
        if (hit) actions.current.openMenu({ key: hit.userData.key, x: e.clientX - r.left, y: e.clientY - r.top });
        else actions.current.closeMenu();
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.dRadius = THREE.MathUtils.clamp(orbit.dRadius * (1 + e.deltaY * 0.0012), 2.4, 32);
      orbit.userZoomed = true;
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (api.current.fit && !orbit.userZoomed) api.current.fit();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      orbit.theta += (orbit.dTheta - orbit.theta) * 0.14;
      orbit.phi += (orbit.dPhi - orbit.phi) * 0.14;
      orbit.radius += (orbit.dRadius - orbit.radius) * 0.1;
      const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * cp,
        orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      if (api.current.shed) disposeGroup(api.current.shed);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  /* ---------- בנייה מחדש של המודל ---------- */
  useEffect(() => {
    const a = api.current;
    if (!a.scene) return;
    if (a.shed) {
      a.scene.remove(a.shed);
      disposeGroup(a.shed);
    }
    const { group, hits } = buildShed(size, FRAME_COLORS[frameColor].three, panels);
    a.scene.add(group);
    a.shed = group;
    a.hits = hits;
    a.highlight.visible = false;

    /* התאמת מצלמה */
    a.fit = () => {
      const el = mountRef.current;
      const aspect = Math.max(el.clientWidth / el.clientHeight, 0.4);
      const span = Math.max(size.l + 1.3, size.w + 1.3, 3.4);
      const vF = THREE.MathUtils.degToRad(40);
      const hF = 2 * Math.atan(Math.tan(vF / 2) * aspect);
      const f = Math.min(vF, hF);
      a.orbit.dRadius = (span / 2) / Math.tan(f / 2) * 1.18 + span * 0.18;
    };
    a.fit();
  }, [sizeId, frameColor, panels]); // eslint-disable-line

  /* ---------- שינוי מידה: איפוס פאנלים + דלת באמצע ---------- */
  const pickSize = (id) => {
    if (id === sizeId) return;
    const s = SIZES.find((x) => x.id === id);
    setSizeId(id);
    setPanels({ [midFront(s.l)]: "door" });
    setMenu(null);
    if (api.current.orbit) api.current.orbit.userZoomed = false;
  };

  /* ---------- החלת בחירה על פאנל ---------- */
  const applyType = (key, type) => {
    setPanels((prev) => {
      const next = { ...prev };
      if (type === "door") {
        for (const k of Object.keys(next)) if (next[k] === "door") delete next[k];
        next[key] = "door";
      } else if (prev[key] === "door") {
        return prev; // אי אפשר להסיר את הדלת היחידה
      } else if (type === "empty") {
        delete next[key];
      } else {
        next[key] = type;
      }
      return next;
    });
    setMenu(null);
  };

  /* ---------- תפריט פאנל ---------- */
  const renderMenu = () => {
    if (!menu) return null;
    const cur = panels[menu.key] || "empty";
    const isDoorHere = cur === "door";
    const [wall, idx] = menu.key.split("-");
    const opts = [
      { t: "empty", label: "ריק", sub: "", disabled: isDoorHere },
      { t: "door", label: "דלת", sub: isDoorHere ? "נמצאת כאן" : "תועבר לכאן · כלולה", disabled: false },
      { t: "window", label: "חלון", sub: "+" + nis(PANEL_PRICE.window), disabled: isDoorHere },
      { t: "glass", label: "זכוכית", sub: "+" + nis(PANEL_PRICE.glass), disabled: isDoorHere },
    ];
    const el = mountRef.current;
    const left = Math.min(Math.max(menu.x - 110, 10), (el ? el.clientWidth : 320) - 230);
    const top = Math.min(Math.max(menu.y - 10, 10), (el ? el.clientHeight : 300) - 190);
    return (
      <>
        <div className="menu-backdrop" onClick={() => setMenu(null)} />
        <div className="panel-menu" style={{ left, top }}>
          <div className="pm-title">
            {WALL_NAME[wall]} · פאנל {Number(idx) + 1}
          </div>
          <div className="pm-grid">
            {opts.map((o) => (
              <button
                key={o.t}
                className={"pm-btn" + (cur === o.t ? " current" : "") + (o.disabled ? " disabled" : "")}
                disabled={o.disabled}
                onClick={() => applyType(menu.key, o.t)}
              >
                <span className="pm-label">{o.label}</span>
                {o.sub && <span className="pm-sub">{o.sub}</span>}
              </button>
            ))}
          </div>
          {isDoorHere && <div className="pm-note">חייבת להיות דלת אחת — בחרו פאנל אחר כדי להעביר אותה</div>}
        </div>
      </>
    );
  };

  return (
    <div className="cfg" dir="rtl">
      <style>{`
        .cfg{--ink:#15181c;--mut:#6b7280;--line:#e4e7eb;--accent:${ACCENT};--bg:#eef1f4;
          height:100vh;display:flex;flex-direction:column;background:var(--bg);
          font-family:-apple-system,"Segoe UI","Helvetica Neue",Arial,sans-serif;color:var(--ink);}
        .stage{position:relative;flex:1;min-height:0;
          background:linear-gradient(180deg,#f6f8fa 0%,#e7ebef 70%,#dde2e7 100%);}
        .stage>div.mount{position:absolute;inset:0;}
        .hud{position:absolute;top:12px;right:12px;display:flex;gap:8px;align-items:center;pointer-events:none;}
        .chip{background:rgba(255,255,255,.85);backdrop-filter:blur(6px);border:1px solid var(--line);
          border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;}
        .chip b{color:var(--accent);}
        .hint{position:absolute;bottom:12px;right:12px;left:12px;display:flex;justify-content:center;pointer-events:none;}
        .hint span{background:rgba(21,24,28,.72);color:#fff;font-size:12px;border-radius:999px;padding:6px 14px;}
        .menu-backdrop{position:absolute;inset:0;}
        .panel-menu{position:absolute;width:220px;background:#fff;border-radius:14px;border:1px solid var(--line);
          box-shadow:0 12px 32px rgba(20,30,40,.18);padding:10px;z-index:5;}
        .pm-title{font-size:12px;font-weight:700;color:var(--mut);margin:2px 4px 8px;}
        .pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
        .pm-btn{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:8px 6px;cursor:pointer;
          display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit;}
        .pm-btn:active{transform:scale(.97);}
        .pm-btn.current{border-color:var(--accent);background:#0d7d840d;}
        .pm-btn.disabled{opacity:.4;cursor:not-allowed;}
        .pm-label{font-size:14px;font-weight:700;}
        .pm-sub{font-size:10.5px;color:var(--mut);}
        .pm-note{font-size:10.5px;color:var(--mut);margin:8px 4px 0;line-height:1.4;}
        .ui{background:#fff;border-top:3px solid var(--accent);box-shadow:0 -8px 24px rgba(20,30,40,.07);
          padding:16px 16px 22px;overflow-y:auto;max-height:62%;}
        .ui h1{font-size:17px;margin:0 0 2px;font-weight:800;}
        .ui .lead{font-size:12px;color:var(--mut);margin:0 0 14px;}
        .sec{font-size:11.5px;font-weight:700;color:var(--mut);letter-spacing:.02em;margin:14px 0 8px;}
        .sizes{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;}
        .size-btn{border:1.5px solid var(--line);border-radius:11px;background:#fff;padding:8px 2px;cursor:pointer;
          display:flex;flex-direction:column;align-items:center;gap:1px;font-family:inherit;}
        .size-btn.sel{border-color:var(--accent);background:#0d7d840d;}
        .size-btn .d{font-size:13.5px;font-weight:800;}
        .size-btn .m{font-size:10px;color:var(--mut);}
        .colors{display:flex;gap:14px;align-items:center;}
        .color-dot{width:42px;height:42px;border-radius:50%;border:2.5px solid var(--line);cursor:pointer;position:relative;}
        .color-dot.sel{border-color:var(--accent);box-shadow:0 0 0 3px #0d7d8422;}
        .color-name{font-size:11px;color:var(--mut);text-align:center;margin-top:4px;}
        .sum{border-top:1px solid var(--line);margin-top:16px;padding-top:12px;}
        .row{display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0;}
        .row .l{color:var(--mut);}
        .row.total{font-size:18px;font-weight:800;margin-top:6px;padding-top:10px;border-top:1px dashed var(--line);}
        .row.total .v{color:var(--accent);}
        @media(min-width:980px){
          .cfg{flex-direction:row;}
          .stage{order:2;}
          .ui{order:1;width:370px;max-height:none;border-top:none;border-left:1px solid var(--line);
            border-right:3px solid var(--accent);}
        }
      `}</style>

      {/* ===== תצוגת תלת-ממד ===== */}
      <div className="stage">
        <div className="mount" ref={mountRef} />
        <div className="hud">
          <div className="chip">
            {size.w}×{size.l} מ' · <b>{(size.w * size.l).toLocaleString("he-IL")} מ"ר</b>
          </div>
        </div>
        <div className="hint">
          <span>גררו לסיבוב · צבטו לזום · לחצו על פאנל להוספת דלת / חלון / זכוכית</span>
        </div>
        {renderMenu()}
      </div>

      {/* ===== פאנל בקרה ===== */}
      <div className="ui">
        <h1>קונפיגורטור יחידת חצר</h1>
        <p className="lead">גג חד-שיפועי · פאנלים מודולריים של 1 מ' · גובה 2.40 / 2.10 מ'</p>

        <div className="sec">מידה (רוחב × אורך)</div>
        <div className="sizes">
          {SIZES.map((s) => (
            <button key={s.id} className={"size-btn" + (s.id === sizeId ? " sel" : "")} onClick={() => pickSize(s.id)}>
              <span className="d">{s.w}×{s.l}</span>
              <span className="m">{s.w * s.l} מ"ר</span>
            </button>
          ))}
        </div>

        <div className="sec">צבע שלד אלומיניום</div>
        <div className="colors">
          {Object.entries(FRAME_COLORS).map(([k, c]) => (
            <div key={k}>
              <div
                className={"color-dot" + (k === frameColor ? " sel" : "")}
                style={{ background: c.hex, boxShadow: k === "white" ? "inset 0 0 0 1px #d6d9dd" : undefined }}
                onClick={() => setFrameColor(k)}
              />
              <div className="color-name">{c.name}</div>
            </div>
          ))}
        </div>

        <div className="sum">
          <div className="row"><span className="l">יחידת בסיס {size.w}×{size.l} מ' (כולל דלת)</span><span>{nis(size.price)}</span></div>
          {windows > 0 && (
            <div className="row"><span className="l">חלון ×{windows}</span><span>{nis(windows * PANEL_PRICE.window)}</span></div>
          )}
          {glasses > 0 && (
            <div className="row"><span className="l">פאנל זכוכית ×{glasses}</span><span>{nis(glasses * PANEL_PRICE.glass)}</span></div>
          )}
          <div className="row"><span className="l">הובלה והתקנה</span><span>{nis(size.delivery)}</span></div>
          <div className="row total"><span>סה"כ</span><span className="v">{nis(total)}</span></div>
        </div>
      </div>
    </div>
  );
}
