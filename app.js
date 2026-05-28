/**
 * GLB Viewer — app.js
 *
 * Stack:
 *   Three.js r169 (via importmap CDN)
 *   GLTFLoader + DRACOLoader  → GLB / compressed GLB
 *   OrbitControls             → rotate, zoom, pan
 *   RoomEnvironment + PMREM   → physically-based studio lighting
 */

import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ═══════════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ═══════════════════════════════════════════════════════════════════

const canvas        = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
const viewport      = /** @type {HTMLElement}       */ (document.getElementById('viewport'));
const uploadZone    = document.getElementById('uploadZone');
const uploadBtn     = document.getElementById('uploadBtn');
const uploadNewBtn  = document.getElementById('uploadNewBtn');
const fileInput     = /** @type {HTMLInputElement}  */ (document.getElementById('fileInput'));
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingLabel  = document.getElementById('loadingLabel');
const dragOverlay   = document.getElementById('dragOverlay');
const hintBar       = document.getElementById('hintBar');
const modelMeta     = document.getElementById('modelMeta');
const metaName      = document.getElementById('metaName');
const metaMeshes    = document.getElementById('metaMeshes');
const metaVerts     = document.getElementById('metaVerts');
const metaMats      = document.getElementById('metaMats');
const toolbar       = document.getElementById('toolbar');
const btnAutoRotate = document.getElementById('btnAutoRotate');
const btnWireframe  = document.getElementById('btnWireframe');
const btnGrid       = document.getElementById('btnGrid');
const btnFit        = document.getElementById('btnFit');
const btnScreenshot = document.getElementById('btnScreenshot');

// ═══════════════════════════════════════════════════════════════════
//  APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════

const state = {
  /** @type {THREE.Object3D|null} */  model:          null,
  /** @type {THREE.AnimationMixer|null} */ mixer:      null,
  /** @type {THREE.GridHelper|null} */ gridHelper:     null,
  isAutoRotating:  false,
  isWireframe:     false,
  isGridVisible:   false,
  hintShown:       false,
  clock:           new THREE.Clock(),
};

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Returns the current pixel dimensions of the viewport element. */
function vpSize() {
  return {
    w: viewport.clientWidth  || window.innerWidth,
    h: viewport.clientHeight || window.innerHeight,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  THREE.JS RENDERER
// ═══════════════════════════════════════════════════════════════════

const { w: initW, h: initH } = vpSize();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias:             true,
  powerPreference:       'high-performance',
  preserveDrawingBuffer: true,   // required for canvas.toDataURL() screenshots
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initW, initH);
renderer.outputColorSpace    = THREE.SRGBColorSpace;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled   = false;   // no shadow-casting lights, keep it clean

// ═══════════════════════════════════════════════════════════════════
//  SCENE
// ═══════════════════════════════════════════════════════════════════

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080e);

// ── Environment lighting (RoomEnvironment → PMREM) ───────────────
// RoomEnvironment creates a soft, multi-directional studio light
// that drives physically-based materials beautifully.
const pmremGen    = new THREE.PMREMGenerator(renderer);
const roomEnv     = new RoomEnvironment();
const envTexture  = pmremGen.fromScene(roomEnv, 0.04).texture;
scene.environment = envTexture;
roomEnv.dispose();
pmremGen.dispose();

// ═══════════════════════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════════════════════

const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.001, 2000);
camera.position.set(0, 1.5, 5);

// ═══════════════════════════════════════════════════════════════════
//  ORBIT CONTROLS
// ═══════════════════════════════════════════════════════════════════

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping   = true;
controls.dampingFactor   = 0.05;
controls.screenSpacePanning = true;   // pan along the camera plane
controls.minDistance     = 0.005;
controls.maxDistance     = 2000;
controls.autoRotate      = false;
controls.autoRotateSpeed = 1.8;
controls.enablePan       = true;

// Mouse button mapping
controls.mouseButtons = {
  LEFT:   THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT:  THREE.MOUSE.PAN,
};

// Touch mapping
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};

// ═══════════════════════════════════════════════════════════════════
//  LOADERS
// ═══════════════════════════════════════════════════════════════════

// DRACO decoder (hosted by Google; handles compressed GLB files)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.preload();   // start downloading decoder JS/WASM immediately

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// ═══════════════════════════════════════════════════════════════════
//  MODEL LOADING
// ═══════════════════════════════════════════════════════════════════

/**
 * Load a .glb file from a File object.
 * Uses URL.createObjectURL so we get native progress events.
 * @param {File} file
 */
function loadModel(file) {
  setLoading(true, 'Preparing…');
  hideUploadZone();

  const objectURL = URL.createObjectURL(file);

  gltfLoader.load(
    objectURL,

    // ── onLoad ──────────────────────────────────────────────────
    (gltf) => {
      URL.revokeObjectURL(objectURL);

      // Remove & dispose old model
      if (state.model) {
        scene.remove(state.model);
        disposeObject(state.model);
        state.model = null;
      }
      if (state.mixer) {
        state.mixer.stopAllAction();
        state.mixer = null;
      }

      const model = gltf.scene;
      state.model = model;

      // ── Normalise: centre + scale to a ~2-unit bounding sphere ─
      const box    = new THREE.Box3().setFromObject(model);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (maxDim > 0) {
        model.scale.multiplyScalar(2 / maxDim);
        // Recompute after scale
        box.setFromObject(model);
        box.getCenter(center);
        model.position.sub(center);   // re-centre at world origin
      }

      scene.add(model);

      // ── Animations ─────────────────────────────────────────────
      if (gltf.animations && gltf.animations.length > 0) {
        state.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) =>
          state.mixer.clipAction(clip).play()
        );
      }

      // ── Grid helper below the model ─────────────────────────────
      refreshGrid();

      // ── Position camera to frame the model neatly ───────────────
      fitCamera();

      // ── Show stats in header ─────────────────────────────────────
      updateStats(file, model);

      // ── Reveal viewer UI ─────────────────────────────────────────
      setLoading(false);
      revealViewer();
    },

    // ── onProgress ──────────────────────────────────────────────
    (xhr) => {
      if (xhr.total > 0) {
        const pct = Math.min(99, Math.round((xhr.loaded / xhr.total) * 100));
        setLoading(true, `Loading model… ${pct}%`);
      } else {
        const mb = (xhr.loaded / 1_048_576).toFixed(1);
        setLoading(true, `Loading… ${mb} MB`);
      }
    },

    // ── onError ─────────────────────────────────────────────────
    (error) => {
      URL.revokeObjectURL(objectURL);
      setLoading(false);
      // If we had no previous model, show the upload zone again
      if (!state.model) showUploadZone();
      console.error('[GLB Viewer] Loader error:', error);
      // eslint-disable-next-line no-alert
      alert(
        'Could not load the GLB file.\n' +
        'Please make sure it is a valid .glb (binary GLTF) file.\n\n' +
        (error.message || error)
      );
    }
  );
}

// ═══════════════════════════════════════════════════════════════════
//  DISPOSAL — prevent GPU memory leaks
// ═══════════════════════════════════════════════════════════════════

/**
 * Recursively dispose geometries, materials and textures.
 * @param {THREE.Object3D} obj
 */
function disposeObject(obj) {
  obj.traverse((child) => {
    if (!child.isMesh) return;

    /** @type {THREE.Mesh} */
    const mesh = child;
    mesh.geometry?.dispose();

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((mat) => {
      if (!mat) return;
      // Dispose all textures stored on the material
      Object.values(mat).forEach((val) => {
        if (val && val.isTexture) val.dispose();
      });
      mat.dispose();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  CAMERA FIT
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute camera position + target so the model fills the viewport nicely.
 * Call after loading (or when the user presses "Fit View").
 */
function fitCamera() {
  if (!state.model) return;

  const box    = new THREE.Box3().setFromObject(state.model);
  const size   = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  // Distance so the whole model fits within the vertical FOV
  const fitH = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const fitW = fitH / camera.aspect;
  const dist = Math.max(fitH, fitW) * 1.45;  // 1.45 = comfortable padding

  // Keep the current azimuth; just update radial distance and target
  const dir = new THREE.Vector3(0.6, 0.45, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);

  controls.target.copy(center);
  controls.minDistance = dist * 0.008;
  controls.maxDistance = dist * 25;
  controls.update();
}

// ═══════════════════════════════════════════════════════════════════
//  GRID HELPER
// ═══════════════════════════════════════════════════════════════════

/** Rebuild and optionally display a GridHelper under the current model. */
function refreshGrid() {
  // Remove old one
  if (state.gridHelper) {
    scene.remove(state.gridHelper);
    state.gridHelper.geometry.dispose();
    state.gridHelper.material.dispose();
    state.gridHelper = null;
  }

  if (!state.model) return;

  const box     = new THREE.Box3().setFromObject(state.model);
  const size    = box.getSize(new THREE.Vector3());
  const gridSz  = Math.max(Math.max(size.x, size.z) * 6, 6);

  state.gridHelper = new THREE.GridHelper(gridSz, 24, 0x1a2535, 0x0d1420);
  state.gridHelper.position.y = box.min.y - 0.001;   // just below the model

  if (state.isGridVisible) scene.add(state.gridHelper);
}

// ═══════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════

/**
 * Walk the model scene and count meshes / vertices / unique materials.
 * Display results in the header metadata strip.
 * @param {File} file
 * @param {THREE.Object3D} model
 */
function updateStats(file, model) {
  let meshCount = 0;
  let vertCount = 0;
  const matUUIDs = new Set();

  model.traverse((child) => {
    if (!child.isMesh) return;
    meshCount++;

    const pos = child.geometry?.attributes?.position;
    if (pos) vertCount += pos.count;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => m && matUUIDs.add(m.uuid));
  });

  const fmt = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  };

  // Truncate filename (remove extension)
  let displayName = file.name.replace(/\.glb$/i, '');
  if (displayName.length > 22) displayName = displayName.slice(0, 20) + '…';

  metaName.textContent   = displayName;
  metaMeshes.textContent = fmt(meshCount);
  metaVerts.textContent  = fmt(vertCount);
  metaMats.textContent   = fmt(matUUIDs.size);
}

// ═══════════════════════════════════════════════════════════════════
//  UI TRANSITIONS
// ═══════════════════════════════════════════════════════════════════

function setLoading(visible, label = 'Loading…') {
  if (visible) {
    loadingLabel.textContent = label;
    loadingOverlay.classList.add('show');
  } else {
    loadingOverlay.classList.remove('show');
  }
}

function hideUploadZone() { uploadZone.classList.add('hide'); }
function showUploadZone() { uploadZone.classList.remove('hide'); }

function revealViewer() {
  canvas.classList.add('show');
  toolbar.classList.add('show');
  modelMeta.classList.add('show');
  uploadNewBtn.classList.add('show');

  if (!state.hintShown) {
    hintBar.classList.add('show');
    state.hintShown = true;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  TOOLBAR CONTROLS
// ═══════════════════════════════════════════════════════════════════

// Auto-Rotate toggle
btnAutoRotate.addEventListener('click', () => {
  state.isAutoRotating  = !state.isAutoRotating;
  controls.autoRotate   = state.isAutoRotating;
  btnAutoRotate.classList.toggle('active', state.isAutoRotating);
});

// Wireframe toggle
btnWireframe.addEventListener('click', () => {
  state.isWireframe = !state.isWireframe;
  if (state.model) {
    state.model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => { if (m) m.wireframe = state.isWireframe; });
    });
  }
  btnWireframe.classList.toggle('active', state.isWireframe);
});

// Grid toggle
btnGrid.addEventListener('click', () => {
  state.isGridVisible = !state.isGridVisible;
  if (state.gridHelper) {
    if (state.isGridVisible) scene.add(state.gridHelper);
    else                     scene.remove(state.gridHelper);
  }
  btnGrid.classList.toggle('active', state.isGridVisible);
});

// Fit camera
btnFit.addEventListener('click', () => fitCamera());

// Screenshot — renders a fresh frame then grabs the canvas as PNG
btnScreenshot.addEventListener('click', () => {
  renderer.render(scene, camera);    // force a clean frame before capture
  const link = document.createElement('a');
  link.download = `glb-viewer-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// ═══════════════════════════════════════════════════════════════════
//  FILE UPLOAD HANDLING
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate and hand a File off to the loader.
 * @param {File|null|undefined} file
 */
function handleFile(file) {
  if (!file) return;
  if (!/\.glb$/i.test(file.name)) {
    // eslint-disable-next-line no-alert
    alert('Only .glb files are supported.\nPlease upload a binary GLB file.');
    return;
  }
  loadModel(file);
}

// Click triggers
uploadBtn.addEventListener('click',     () => fileInput.click());
uploadNewBtn.addEventListener('click',  () => fileInput.click());

// File input change
fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files?.[0]);
  e.target.value = '';   // reset so the same file can be re-selected
});

// ── Drag & Drop ────────────────────────────────────────────────────
// We track a counter because dragleave fires when moving between
// child elements, causing flickering if we toggle on every event.
let dragDepth = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  if (dragDepth === 1) {
    uploadZone.classList.add('drag-active');
    dragOverlay.classList.add('show');
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth <= 0) {
    dragDepth = 0;
    uploadZone.classList.remove('drag-active');
    dragOverlay.classList.remove('show');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();   // required to allow the drop
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  uploadZone.classList.remove('drag-active');
  dragOverlay.classList.remove('show');
  handleFile(e.dataTransfer?.files?.[0]);
});

// ═══════════════════════════════════════════════════════════════════
//  WINDOW RESIZE
// ═══════════════════════════════════════════════════════════════════

function onResize() {
  const { w, h } = vpSize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener('resize', onResize);

// ═══════════════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════

(function animate() {
  requestAnimationFrame(animate);

  const delta = state.clock.getDelta();

  // Advance any embedded animations
  if (state.mixer) state.mixer.update(delta);

  // OrbitControls must be updated every frame when damping or auto-rotate is on
  controls.update();

  renderer.render(scene, camera);
}());
