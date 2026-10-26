// ROBOT SCENE
// Rig (pose + exploded view) comes from the Reachy Mini trailer's robot.js.
// Each slide declares a SHOT; the scene eases from shot to shot.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reachy, EXPLODE } from '../assets/robot.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadMJCF, loadParts, addGrabetteElectronics, poseMJCF } from '../assets/robots.js';

const W = 1920, H = 1080;
const ACCENT = new THREE.Color(0xff9d00); // Hugging Face orange

// Shots per slide id (an array: one per step). pos: robot position, target / cam: camera
// look-at and eye (world units, robot ~0.3 tall), explode: 0..1, yaw: body turn (rad),
// idle / ant: head and antenna motion amplitude, ghost: shells see-through 0..1, focus:
// camera glow, dim: canvas opacity, fam: family set 0..1 (fades between family and studio),
// set: studio | family | none, mark: leader line to
// 'cam' or 'mic' ('' for none). Every shot has every key, so any two can be blended.
const S = o => ({ pos: [0, 0, 0], target: [-0.24, 0.19, 0], cam: [-0.40, 0.30, 1.30], explode: 0, yaw: 0.35, idle: 1, ant: 1, ghost: 0, headGhost: 0, gears: 0, cloud: 0, focus: 0, scale: 1, dim: 1, fam: 0, shadow: 1, set: 'studio', mark: '', ...o });
const HERO = S({});
const NONE = S({ set: 'none', dim: 0 });
const SHOTS = {
    title: HERO,
    pollen: NONE,
    // Family: Reachy Mini on the table (scale set once its height is known).
    family: [S({ pos: [0, 0, 0.02], target: [0, 0.14, -0.35], cam: [0, 0.36, 2.55], yaw: 0.25, fam: 1, set: 'family' })],
    rm: S({ target: [-0.30, 0.17, 0], cam: [-0.55, 0.34, 1.25], yaw: -0.25 }),
    // Andi's talk. Close on the face, on the right: "no robot you can talk to feels natural yet".
    natural: S({ target: [-0.13, 0.25, 0], cam: [-0.20, 0.29, 0.66], yaw: 0.1 }),
    exploded: S({ target: [0.27, 0.325, 0], cam: [0.50, 0.425, 1.80], explode: 1, yaw: 0.2, idle: 0.25, ant: 0.25 }),
    moves: S({ target: [0.30, 0.17, 0], cam: [0.46, 0.33, 1.65], yaw: 0.25, idle: 0, ant: 0 }),
    motors: [
        S({ target: [0.24, 0.17, 0], cam: [0.36, 0.30, 1.25], yaw: 0.3, idle: 2.0, ant: 1, ghost: 1 }), // Stewart platform at work
        S({ target: [0.09, 0.30, 0], cam: [0.16, 0.36, 0.70], yaw: 0.3, idle: 0.35, ant: 2.4, ghost: 1 }), // antennas
    ],
    sensors: [
        S({ target: [0.08, 0.27, 0], cam: [0.12, 0.29, 0.62], yaw: 0.1, idle: 0.2, ant: 0.3, ghost: 0.6, focus: 1, mark: 'cam' }), // camera
        S({ target: [0.17, 0.25, 0.02], cam: [0.21, 1.05, 0.40], yaw: 0.1, idle: 0.2, ant: 0.3, mark: 'mic' }), // mics, from above
    ],
    sense: [S({ target: [0.45, 0.05, 0.09], cam: [0.86, 2.18, 1.86], yaw: 0, idle: 0.15, ant: 0.5 })],
    stack: S({ target: [-0.42, 0.17, 0], cam: [-0.62, 0.30, 1.40], yaw: 0.45, dim: 0.28 }),
    usage: S({ target: [-0.30, 0.17, 0], cam: [-0.55, 0.34, 1.25], yaw: 0.6 }),
    // API: the robot stays put, the camera swings round it. Python (code on the robot): robot on the right, its
    // head see-through with gears turning inside. JavaScript (remote): robot on the left, opaque again.
    api: [S({ target: [-0.24, 0.19, 0], cam: [-0.38, 0.32, 1.32], headGhost: 1, gears: 1 }), S({ target: [0.24, 0.19, 0], cam: [0.50, 0.32, 1.26], cloud: 1 })],
    apps: NONE, conversation: NONE, community: NONE, growth: NONE,
    users: S({ pos: [0.10, -0.11, 0], target: [-0.88, 0.0, 0], cam: [-0.88, 0.12, 4.7], yaw: 0.35, shadow: 0 }), // a small Reachy Mini standing on France (the divider's map)
};

/* --- Renderer, lights --- */
const canvas = document.getElementById('robotCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // 2 on a HiDPI laptop is 4x the pixels for little visible gain
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(1.5, 3, 2.5);
const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-2, 1.5, 1.5);
const rim = new THREE.DirectionalLight(0xffb366, 1.6); rim.position.set(-0.5, 2.5, -2.5);
const studioLights = new THREE.Group();
studioLights.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x333333, 0.5));
scene.add(studioLights);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(26, W / H, 0.01, 50);

/* --- Soft contact shadow --- */
function makeShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.001;
    return m;
}

/* --- Load robot --- */
// The claude.ai version decodes on this thread, from a decoder script (js/draco-inline.js).
const Draco = window.DRACO_INLINE ? (await import('./draco-inline.js')).InlineDRACOLoader : DRACOLoader;
const loader = new GLTFLoader().setDRACOLoader(new Draco().setDecoderPath('assets/vendor/draco/'));
// window.PACKED: the claude.ai version, where the models come from base64 bundles (js/packed.js).
const loadGLB = async url => window.PACKED ? loader.parseAsync(await (await import('./packed.js')).modelBytes(url), '') : loader.loadAsync(url);
const gltf = await loadGLB('assets/reachy_mini_viz.glb');
// Tighter stack than the trailer's, so the head reads large on one slide.
for (const [id, l] of Object.entries(EXPLODE)) {
    if (['base', 'motors', 'neck', 'bodyShell', 'headBot', 'headCore'].includes(id)) l.off.multiplyScalar(0.7);
    else l.off.y -= 0.063;
}
const robot = new Reachy(gltf.scene);
const contact = makeShadow(); // the soft contact shadow, faded by each shot's `shadow`
robot.group.add(contact);
scene.add(robot.group);
const pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ant: [0, 0], yaw: 0 };
robot.setPose(pose);
robot.group.updateWorldMatrix(true, true);

// Shells turn to glass while exploded, so the inside reads.
const shells = robot.meshes.filter(m => m.userData.shell);
const headShell = new Set(shells.filter(m => /^shellhead/i.test(m.name.replace(/[^a-z0-9]/gi, ''))));
for (const m of shells) {
    m.material = m.userData.origMaterial.clone();
    m.material.transparent = true;
}

// Camera part: the meshes sitting between the two eye lenses. Found by
// geometry (the GLB names are CAD exports), then tinted with the accent.
const lenses = robot.meshes.filter(m => m.material.name === 'Glass_Eyes');
const box = new THREE.Box3(), c = new THREE.Vector3();
const eyeMid = new THREE.Vector3();
for (const l of lenses) eyeMid.add(box.setFromObject(l).getCenter(c));
eyeMid.divideScalar(lenses.length || 1);
const eyeGap = lenses.length === 2 ? box.setFromObject(lenses[0]).getCenter(new THREE.Vector3()).distanceTo(box.setFromObject(lenses[1]).getCenter(c)) : 0.05;
const headParts = new Set(robot.parts.filter(p => p.id === 'headCore' || p.id === 'headFront').map(p => p.node));
const camParts = [];
for (const m of robot.meshes) {
    let inHead = false;
    for (let o = m; o && !inHead; o = o.parent) inHead = headParts.has(o);
    if (!inHead || lenses.includes(m) || m.userData.shell) continue;
    box.setFromObject(m);
    const d = box.getCenter(c).distanceTo(eyeMid);
    const size = box.getSize(new THREE.Vector3()).length();
    if (d < 0.22 * eyeGap && size < 0.6 * eyeGap) camParts.push(m);
}
for (const m of camParts) {
    m.material = m.userData.origMaterial.clone();
    m.material.emissive = ACCENT.clone();
    m.material.emissiveIntensity = 0;
}

// Gears inside the head (API slide, Python step): three meshed gears in the accent colour, centred in the head
// and facing out of the face, carried by the head bone so they follow the head's motion.
// Three meshed gears (tooth counts and spacing so neighbours mesh and turn the other way), radius R.
function makeGears(R) {
    const gear = (r, teeth) => {
        const sh = new THREE.Shape(), n = teeth * 4;
        for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI * 2, rr = i % 4 < 2 ? r : r * 0.8;
            i ? sh.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : sh.moveTo(rr, 0);
        }
        const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true); sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: r * 0.3, bevelEnabled: false });
        g.translate(0, 0, -r * 0.15);
        return g;
    };
    const mat = new THREE.MeshStandardMaterial({ color: ACCENT, metalness: 0.5, roughness: 0.35, emissive: ACCENT, emissiveIntensity: 0.25, transparent: true });
    const set = new THREE.Group();
    for (const [r, k, x, y, w] of [[1, 12, 0, 0, 1], [0.6, 8, 1.42, 0.55, -1.5], [0.7, 9, -1.3, 0.75, -12 / 9]]) {
        const m = new THREE.Mesh(gear(R * r, k), mat);
        m.position.set(x * R, y * R, 0); m.userData.w = w;
        set.add(m);
    }
    return set;
}
const spinGears = (set, dt, opacity) => {
    set.children[0].material.opacity = opacity;
    for (const g of set.children) g.rotation.z += dt * 1.2 * g.userData.w;
};
// Python step: the gears sit inside the head, above the eye module (it fills the middle), facing out of the
// face, carried by the head bone so they follow the head's motion.
let gears;
{
    const hb = new THREE.Box3(); for (const n of headParts) hb.expandByObject(n);
    const c = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
    c.y += hs.y * 0.22;
    gears = makeGears(hs.x * 0.085);
    gears.position.copy(c);
    gears.lookAt(c.clone().add(eyeMid.clone().sub(c).setY(0).normalize()));
    gears.visible = false;
    scene.add(gears);
    robot.bones.head.attach(gears);
}
// JavaScript step: the code runs remotely, so the gears turn in a cloud above the robot. The cloud is a
// dozen merged spheres, white and soft, see-through like the Python step's head; it faces that step's camera.
const cloud = new THREE.Group();
{
    const puffs = [[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.8], [-0.9, -0.2, 0.05, 0.75], [0.45, 0.45, 0, 0.75], [-0.45, 0.4, 0.05, 0.7],
        [1.5, -0.35, 0, 0.55], [-1.5, -0.38, 0, 0.5], [0.2, -0.45, 0.35, 0.65], [-0.3, -0.4, -0.35, 0.65], [0.8, 0.2, -0.3, 0.6], [-0.8, 0.15, -0.3, 0.6]];
    const geo = mergeGeometries(puffs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 28, 18).translate(x, y, z)));
    // One translucent skin, not a pile of bubbles: a depth-only pass first keeps just the front-most surface,
    // then the colour pass draws it once. The gears render before both, so they show through.
    const depth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true })); // transparent: drawn after the gears
    const puff = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xa3a9b4, roughness: 1, metalness: 0, transparent: true, depthWrite: false }));
    depth.renderOrder = 1; puff.renderOrder = 2;
    cloud.add(depth, puff);
    const g = makeGears(0.32); g.position.set(-0.01, -0.09, 0); cloud.add(g); // set centred on the cloud
    cloud.userData = { puff, gears: g };
    cloud.scale.setScalar(0.052);
    cloud.position.set(0.46, 0.385, -0.02);
    cloud.lookAt(SHOTS.api[1].cam[0], 0.385, SHOTS.api[1].cam[2]);
    cloud.visible = false;
    scene.add(cloud);
}

// Mics: under the top of the head shell; the leader points at its top.
const micParts = robot.meshes.filter(m => m.name.replace(/[^a-z0-9]/gi, '').toLowerCase().startsWith('shellheadtop'));
const stage = document.getElementById('deckStage');

// Reachy Mini is 30 cm tall with antennas up: scale the rig to match. Measured here, at rest, before the
// loading preview poses and renders it (that skewed the height and blew up the family and scout duck).
{
    const b = new THREE.Box3().setFromObject(robot.group);
    SHOTS.family[0].scale = 0.30 / (b.max.y - b.min.y);
    SHOTS.thanks = SHOTS.family[0]; // back to the family
}

// While the family set loads (most of the startup), a slide showing Reachy Mini alone already gets it,
// in its shot, idle; the full frame loop takes over at the end of the script.
const stopPreview = (() => {
    let on = true;
    const loop = () => {
        if (!on) return;
        let s = SHOTS[deck.scene().id];
        if (Array.isArray(s)) s = s[0];
        if (s?.set === 'studio') {
            robot.group.position.fromArray(s.pos); robot.setYaw(s.yaw); robot.setExplode(s.explode);
            camera.position.fromArray(s.cam); camera.lookAt(...s.target);
            canvas.style.opacity = s.dim;
            renderer.render(scene, camera);
        } else canvas.style.opacity = 0;
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { on = false; };
})();

/* --- Part labels for the exploded view --- */
const labelBox = document.getElementById('partLabels');
const labels = robot.layers.filter(l => l.label).map(l => {
    const el = document.createElement('div'); el.className = 'part-label'; el.textContent = l.label;
    labelBox.appendChild(el);
    return { id: l.id, el };
});

/* --- Family set: oak table (from the 3D voice Space) and the other Pollen robots --- */
// Metres. Table top at y = 0, legs down to FLOOR (no floor drawn: the deck backdrop shows).
const FLOOR = -0.75;
const family = new THREE.Group();
family.visible = false;
scene.add(family);
{
    const tex = url => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

    // Oak table and legs.
    const wood = tex('assets/oak-table.webp');
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(1.5, 0.8);
    const oak = new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 0.0025, roughness: 0.64 });
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.05, 0.8, 4, 0.015), oak);
    top.position.set(0, -0.025, -0.05);
    top.receiveShadow = top.castShadow = true;
    const legs = [-1, 1].flatMap(sx => [-1, 1].map(sz => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, -FLOOR - 0.05, 0.05), oak);
        l.position.set(sx * 0.68, (FLOOR - 0.05) / 2, -0.05 + sz * 0.33);
        l.castShadow = true;
        return l;
    }));

    // Warm key with shadows, soft fill, cool back light, and a warm rim (as on slide 1) that keeps
    // black antennas and arms readable against the dark backdrop.
    const famKey = new THREE.DirectionalLight(0xfff1e0, 1.8);
    famKey.position.set(1.4, 2.4, 2.2);
    famKey.castShadow = true;
    famKey.shadow.mapSize.set(2048, 2048);
    Object.assign(famKey.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 });
    famKey.shadow.bias = -0.0004;
    famKey.shadow.radius = 4;
    const famFill = new THREE.DirectionalLight(0xffffff, 0.6); famFill.position.set(-2, 1, 1.5);
    const famWin = new THREE.DirectionalLight(0xcfe0ff, 0.9); famWin.position.set(0, 1.2, -3);
    const famRim = new THREE.DirectionalLight(0xffb366, 2.2); famRim.position.set(-0.6, 2.2, -3);
    family.add(top, ...legs, famKey, famFill, famWin, famRim, new THREE.AmbientLight(0xfff4ea, 0.35));
}

// The other robots: Reachy 1 and 2 exported from their Blender files
// (shot-tools/export_glb.py), microduck from its MuJoCo model.
const R = 'assets/robots';
// Microduck's clip (shot-tools/mjcf_clip.py duck): it sits in the wide shot, so it is needed
// before the robots are placed on the table.
const duckClip = await fetch(`${R}/duck/clip.json`, { cache: 'no-cache' }).then(r => r.json());
// Blender exports face +Z; stand() expects the URDF/MJCF +X forward.
// Glossy black glass, the look of every Reachy's eyes.
const EYE_GLASS = new THREE.MeshPhysicalMaterial({ color: 0x040405, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
// Give the triangles of `matName` whose centroid lies in `box` their own material.
function repaintRegion(mesh, matName, box, mat) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const idx = mesh.geometry.index;
    if (!idx) return;
    // GLTFLoader gives one mesh per material: no groups yet, the whole index is one.
    if (!mesh.geometry.groups.length) mesh.geometry.addGroup(0, idx.count, 0);
    const gi = mesh.geometry.groups.findIndex(g => mats[g.materialIndex].name === matName);
    if (gi < 0) return;
    const g = mesh.geometry.groups[gi], pos = mesh.geometry.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    const keep = [], moved = [];
    for (let i = g.start; i < g.start + g.count; i += 3) {
        const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        c.set(0, 0, 0);
        for (const t of tri) c.add(v.fromBufferAttribute(pos, t).applyMatrix4(mesh.matrixWorld));
        (box.containsPoint(c.divideScalar(3)) ? moved : keep).push(...tri);
    }
    [...keep, ...moved].forEach((t, k) => idx.setX(g.start + k, t));
    idx.needsUpdate = true;
    mesh.material = [...mats, mat];
    g.count = keep.length;
    mesh.geometry.addGroup(g.start + keep.length, moved.length, mats.length);
}
// `swap`: material name -> replacement, for materials the Blender export gets wrong.
// `region(bbox)`: optional { mat, box, with } to repaint part of a shared material.
const blend = async (url, swap = {}, region = null) => {
    const g = new THREE.Group();
    const gltf = await loadGLB(url), s = gltf.scene;
    // Reachy 2's grasp (shot-tools/reachy2_grasp.py), exported as one clip per moving part: merge them.
    // Samples are every 2 frames and the exporter marks them STEP: interpolate linearly.
    if (gltf.animations.length) g.userData.clip = new THREE.AnimationClip('grasp', -1, gltf.animations.flatMap(c => c.tracks).map(t => t.setInterpolation(THREE.InterpolateLinear)));
    s.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3().setFromObject(s);
    s.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        o.material = Array.isArray(o.material) ? o.material.map(m => swap[m.name] ?? m) : swap[o.material.name] ?? o.material;
        if (region) { const r = region(bbox); repaintRegion(o, r.mat, r.box, r.with); }
    });
    s.rotation.y = Math.PI / 2;
    g.add(s);
    return g;
};
const DUCK_OPTS = { meshDir: `${R}/duck/assets`, keep: ['jaw', 'jaw_soft'] /* the beak is hinged by name */, recolor: n => (n === 'xl330_material' ? { color: 0x161618, roughness: 0.4 } : null) }; // black XL330 servos
const [reachy1, reachy2, duck, hand, handLeft, gripette, grabette] = await Promise.all([
    blend('assets/reachy1.glb', { glass: EYE_GLASS }), // eye glass comes out as rough white metal
    // The depth camera between the eyes shares the aluminium 'Metal' material: blacken just that spot
    // (located with a material-ID render of the head, x/y in metres from the model's top centre).
    blend('assets/reachy2.glb', {}, b => {
        const cx = (b.min.x + b.max.x) / 2, y = b.max.y - 0.259;
        return { mat: 'Metal', box: new THREE.Box3(new THREE.Vector3(cx - 0.03, y - 0.012, -1), new THREE.Vector3(cx + 0.005, y + 0.012, 1)), with: EYE_GLASS };
    }),
    loadMJCF(`${R}/duck/robot.xml`, DUCK_OPTS),
    loadMJCF(`${R}/hand/robot.xml`, { meshDir: `${R}/hand/assets` }), // with palm/top shells
    loadMJCF(`${R}/hand_left/robot.xml`, { meshDir: `${R}/hand_left/assets` }), // bare: motors show
    // OpenArm + Gripette (grabette repo, integrations/openarm/openarm_gripette_model), reaching pose.
    loadMJCF(`${R}/gripette/robot.xml`, {
        meshDir: `${R}/gripette/assets`,
        keep: ['hfsb6_6060_750_1_step'], // the post: measured below to extend it to the floor
        joints: { r_arm_pitch: 0.25, r_elbow: 1.35, r_wrist_pitch: -0.9 },
        // The arm parts carry Onshape's default part colour (no appearance set): the OpenArm is black.
        recolor: name =>
            /^j\d/.test(name) ? { color: 0x1c1d20, roughness: 0.45 }
            : /^(dm_|feetech_sts3215)/.test(name) ? { color: 0x08080a, roughness: 0.7, metalness: 0, envMapIntensity: 0.4 } // black motors (matte: flat faces catch the key light): Damiao arm joints, Feetech gripper servo
            : /^(fl\d|hfsb)/.test(name) ? { color: 0xf7f7f7, roughness: 0.45, metalness: 1 } // same as Reachy 2's aluminium
            : /soft_tip/.test(name) ? { color: 0x141416, roughness: 0.75 } // black TPU tips
            : null,
    }),
    // Grabette print STLs share the assembly frame. Two parts were rebuilt from their print form:
    // Proximal_R (flat sheet folded on its 3 hinges, shot-tools/fold_flat.py) and Raspi_Box_R
    // (cup beside the handle holding the Pi stack, shot-tools/place_pibox.py, from the blog render).
    loadParts(`${R}/grabette`, [
        // Colours from the assembly guide photos: white prints, black holder, Pi box and soft tips.
        ...['Grip_R', 'Pivot_Bot_R', 'Button', 'Spacer_H8.5', 'Grip_Shell_R', 'Proximal_Shell_R', 'Proximal_R', 'Distal_R'].map(f => ({ file: `${f}.stl`, color: 0xe8e6e1 })),
        ...['Cameras_Holder_R', 'Raspi_Box_R', 'Grip_soft_tip_R', 'Distal_Soft_tip'].map(f => ({ file: `${f}.stl`, color: 0x1d1d1f })),
    ]),
]);
// Place a robot so its lowest point sits on y = `ground` (or its top on `top`),
// facing the camera then turned by `yaw`.
function stand(obj, x, z, ground, yaw, top) {
    obj.rotation.y = -Math.PI / 2 + yaw;
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    obj.position.set(x, top !== undefined ? top - b.max.y : ground - b.min.y, z);
    family.add(obj);
}
// Chronological left to right, Reachy Mini in the centre. Reachy 1 (retired) stands back behind Reachy 2.
stand(reachy1, -1.05, -1.3, null, 0.35 - Math.PI / 2, 0.56); // its Blender front is +X
// Reachy 2: tripod lowered a bit, base hidden by the table. Its top at 0.71 above the table and
// this spot put the cube of its grasp clip on the tabletop (shot-tools/reachy2_grasp.py, TABLE_Z).
stand(reachy2, -0.72, -0.65, null, 0.3, 0.71);
stand(hand, -0.22, 0.12, 0, 0);
stand(handLeft, -0.37, 0.12, 0, 0);
// Microduck: seated (its clip's first frame) for the wide shot. Its beak is fixed to the head
// in the model: hinge the lower beak at the jaw servo, about the head's lateral (y) axis.
const hingeBeak = d => {
    const jaw = new THREE.Group();
    const head = d.userData.bodies['jaw_soft'].children[0]; // head body (named after its first part)
    jaw.position.set(0.003, 0, -0.018);
    for (const n of ['jaw', 'jaw_soft']) {
        const m = head.children.find(c => c.name === n);
        m.position.sub(jaw.position);
        jaw.add(m);
    }
    head.add(jaw);
    return jaw;
};
const duckJaw = hingeBeak(duck);
const poseDuck = t => {
    poseMJCF(duck, duckClip, t);
    const x = Math.max(0, Math.min(duckClip.jaw.length - 1, t * duckClip.fps)), i = Math.floor(x);
    duckJaw.rotation.y = 0.55 * (duckClip.jaw[i] + (duckClip.jaw[Math.min(duckClip.jaw.length - 1, i + 1)] - duckClip.jaw[i]) * (x - i));
};
poseDuck(0);
stand(duck, 0.21, 0.02, 0, 0.65);
// Gripette behind the table on the right, its 750 mm mount post raised on a matching extrusion
// so the shoulder sits at chest height.
stand(gripette, 0.88, -0.75, -0.25, 0.15); // foot 0.25 below the tabletop: keep in sync with mjcf_clip.py TABLE_ABOVE_POST
// Grabette (handheld) on the table, with its Pi stack and camera lenses (not printed parts).
addGrabetteElectronics(grabette.children[0]);
// Its moving jaw (finger frame, shell, distal, soft tip) swings about the handle's vertical
// pivot axis, taken through the bottom pivot part. Positive = towards the fixed jaw. CAD mm.
const grabetteJaw = new THREE.Group();
{
    const cad = grabette.children[0];
    const pb = new THREE.Box3().setFromObject(cad.getObjectByName('Pivot_Bot_R'));
    grabetteJaw.position.set((pb.min.x + pb.max.x) / 2, (pb.min.y + pb.max.y) / 2, 0);
    for (const n of ['Proximal_R', 'Proximal_Shell_R', 'Distal_R', 'Distal_Soft_tip']) {
        const m = cad.getObjectByName(n);
        m.position.sub(grabetteJaw.position);
        grabetteJaw.add(m);
    }
    cad.add(grabetteJaw);
}
// The tip (distal + soft tip) hinges on the finger frame's top pin, at CAD (42.6, 22.6) mm (fitted
// on Distal_R's pin), and curls in as the jaw closes: same angle, as the Gripette's coupled joints.
const grabetteTip = new THREE.Group();
grabetteTip.position.set(42.6, 22.6, 0).sub(grabetteJaw.position);
for (const n of ['Distal_R', 'Distal_Soft_tip']) {
    const m = grabetteJaw.getObjectByName(n);
    m.position.sub(grabetteTip.position);
    grabetteTip.add(m);
}
grabetteJaw.add(grabetteTip);
stand(grabette, 0.44, 0.25, 0, Math.PI * 1.5 - 0.25); // front (camera windows) is +Y in CAD; turned so the Pi side faces away
{
    let post = null;
    gripette.updateWorldMatrix(true, true); // stand() moved it after its own update
    gripette.traverse(o => {
        if (!o.isMesh) return;
        const b = new THREE.Box3().setFromObject(o);
        if (b.max.y - b.min.y > 0.7) post = { b, mat: o.material };
    });
    if (post) {
        const c = post.b.getCenter(new THREE.Vector3()), sz = post.b.getSize(new THREE.Vector3());
        const ext = new THREE.Mesh(new THREE.BoxGeometry(sz.x, post.b.min.y - FLOOR, sz.z), post.mat);
        ext.position.set(c.x, (post.b.min.y + FLOOR) / 2, c.z);
        ext.castShadow = ext.receiveShadow = true;
        family.add(ext);
    }
}
robot.meshes.forEach(m => { m.castShadow = true; });


// Leader-line anchors: a point on each robot's chest, in world space.
const chest = (obj, k) => { const b = new THREE.Box3().setFromObject(obj); return new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + k * (b.max.y - b.min.y), (b.min.z + b.max.z) / 2); };
const anchors = { reachy1: chest(reachy1, 0.62), reachy2: chest(reachy2, 0.62), duck: chest(duck, 0.45), hand: chest(hand, 0.55).lerp(chest(handLeft, 0.55), 0.5), gripette: chest(gripette, 0.75), grabette: chest(grabette, 0.65) };
const famLines = document.getElementById('familyLines');
const members = [...document.querySelectorAll('.member')];

/* --- Shot easing; a change of set dips the canvas to black --- */
const lerpArr = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
// Family focus steps, in talk order: the camera frames each group from the wide shot's angle,
// its card stays lit. Boxes are cut at the tabletop so legs and mounts don't widen the frame.
// The duck is framed standing (mid-clip), not seated as it is when the zoom starts.
poseDuck(duckClip.segments.idle[0]); duck.updateWorldMatrix(true, true);
const duckStandBox = new THREE.Box3().setFromObject(duck);
poseDuck(0); duck.updateWorldMatrix(true, true);
const miniBox = new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.08), new THREE.Vector3(0.1, 0.3, 0.12)).translate(new THREE.Vector3(...SHOTS.family[0].pos));
const FOCUS = [
    { ids: ['reachy1', 'reachy2'], objs: [reachy1, reachy2] },
    { ids: ['hand'], objs: [hand, handLeft] },
    { ids: ['grabette', 'gripette'], objs: [grabette, gripette] },
    { ids: ['duck'], box: duckStandBox },
    { ids: ['mini'], box: miniBox },
].map(f => {
    const b = f.box?.clone() ?? f.objs.reduce((b, o) => b.expandByObject(o), new THREE.Box3());
    b.min.y = Math.max(b.min.y, -0.05);
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = (Math.max(sz.y, sz.x / camera.aspect) / (2 * tanH)) * 1.75;
    const target = c.clone().setY(c.y - 0.16 * 2 * dist * tanH); // subject sits above the name strip
    const dir = new THREE.Vector3(...SHOTS.family[0].cam).sub(new THREE.Vector3(...SHOTS.family[0].target)).normalize();
    return { ...f, shot: { ...SHOTS.family[0], target: target.toArray(), cam: target.clone().addScaledVector(dir, dist).toArray() } };
});
const strip = document.querySelector('.family-strip');
const shotFor = ({ id, step }) => {
    if (id === 'family' && step > 0) return FOCUS[step - 1].shot;
    const v = SHOTS[id] ?? NONE; // a slide without a shot has no robot
    return Array.isArray(v) ? v[Math.min(step, v.length - 1)] : v;
};
let focusIds = null;
const deckState = () => window.deck.scene(); // data-scene, else the slide's own id
let from = shotFor(deckState()), to = from, t0 = 0;
const DUR = 1.8;
// Recorded moves (shot-tools/bake_moves.py): played in a loop on the moves slide, blended in and
// out with the slide (MOVE_IN) and between moves (MOVE_X). Frames: [x y z qx qy qz qw antR antL yaw].
const MOVE_IN = 0.7, MOVE_X = 0.35;
const { moves } = await fetch('assets/moves.json', { cache: 'no-cache' }).then(r => r.json());
const moveList = document.getElementById('moveList');
moveList.innerHTML = ['emotion', 'dance'].map(k => `<div><h4>${k}s</h4>${moves.map((m, i) => m.kind === k ? `<div class="mv" data-i="${i}">${m.name.replace(/\d+$/, '').replace(/_/g, ' ')}</div>` : '').join('')}</div>`).join('');
const moveEls = [...moveList.querySelectorAll('.mv')];
const player = { w: 0, i: 0, t: 0, x: 1, from: null, p: new THREE.Vector3(), q: new THREE.Quaternion(), ant: [0, 0], yaw: 0 };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const moveFrame = (m, t, out) => {
    const f = m.frames, k = Math.min(t * m.fps, f.length - 1), i = Math.floor(k), a = f[i], b = f[Math.min(i + 1, f.length - 1)], u = k - i;
    const l = j => a[j] + (b[j] - a[j]) * u;
    out.p.set(l(0), l(1), l(2));
    out.q.slerpQuaternions(qa.fromArray(a, 3), qb.fromArray(b, 3), u);
    out.ant = [l(7), l(8)]; out.yaw = l(9);
    return out;
};
const playMove = i => {
    player.from = { p: player.p.clone(), q: player.q.clone(), ant: [...player.ant], yaw: player.yaw };
    player.i = i % moves.length; player.t = 0; player.x = 0;
    moveEls.forEach(e => e.classList.toggle('on', +e.dataset.i === player.i));
};
const moveUpdate = (dt, on) => {
    if (on && player.w === 0) { moveFrame(moves[0], 0, player); playMove(0); player.x = 1; }
    player.w = Math.max(0, Math.min(1, player.w + (on ? dt : -dt) / MOVE_IN));
    if (player.w === 0) return 0;
    const m = moves[player.i];
    player.t += dt;
    if (player.t >= m.frames.length / m.fps) playMove(player.i + 1);
    const { from } = player;
    moveFrame(moves[player.i], player.t, player);
    if (player.x < 1) {
        player.x = Math.min(1, player.x + dt / MOVE_X);
        const k = smooth(player.x);
        player.p.lerpVectors(from.p, player.p, k);
        player.q.slerpQuaternions(from.q, player.q.clone(), k);
        player.ant = player.ant.map((a, j) => from.ant[j] + (a - from.ant[j]) * k);
        player.yaw = from.yaw + (player.yaw - from.yaw) * k;
    }
    return smooth(player.w);
};

/* --- Sensing slide: a second Microduck in the studio, at the family scale (Reachy Mini 30 cm) --- */
// Step 0: it walks in on Reachy Mini's left, stops facing it and quacks; sound rings run to the
// robot, which turns to the sound (direction of arrival, a cone on the floor). Step 1: it walks an
// arc in front and back, the robot follows it and a detection box tracks it (face tracking).
// Walk clip: shot-tools/mjcf_clip.py duck_walk; the duck moves at its baked speed, so feet don't slide.
const walkClip = await fetch(`${R}/duck/clip_walk.json`, { cache: 'no-cache' }).then(r => r.json());
const scout = await loadMJCF(`${R}/duck/robot.xml`, DUCK_OPTS);
const scoutJaw = hingeBeak(scout);
const scoutRig = new THREE.Group();
const SCOUT_S = 1 / SHOTS.family[0].scale; // metres -> studio units
scoutRig.scale.setScalar(SCOUT_S);
scoutRig.visible = false;
scout.traverse(o => { if (o.isMesh) o.castShadow = true; });
poseMJCF(scout, walkClip, 0);
scout.updateWorldMatrix(true, true);
scout.position.y = -new THREE.Box3().setFromObject(scout).min.y; // feet on the floor
const scoutShadow = makeShadow(); scoutShadow.scale.setScalar(0.55 / SCOUT_S);
scoutRig.add(scout, scoutShadow);
scene.add(scoutRig);
const robotH = 0.30 * SCOUT_S; // Reachy Mini's height in studio units
const seg = walkClip.segments;
const WALK_V = walkClip.speed * SCOUT_S, WALK_P = seg.walk[1] - seg.walk[0], QUACK_T = seg.quack[1] - seg.quack[0];
// Robot frame on the floor: forward f (out of the face) and left = up x f, from the eyes at load.
const faceLocal = robot.root.worldToLocal(eyeMid.clone()), originLocal = robot.root.worldToLocal(new THREE.Vector3());
const fwd = new THREE.Vector3(), left = new THREE.Vector3(), rpos = new THREE.Vector3();
const robotFrame = () => {
    robot.root.localToWorld(fwd.copy(faceLocal)); robot.root.localToWorld(rpos.copy(originLocal));
    fwd.sub(rpos).setY(0).normalize(); rpos.setY(0);
    left.set(fwd.z, 0, -fwd.x);
};
const polar = (r, th, out = new THREE.Vector3()) => out.copy(rpos).addScaledVector(fwd, r * robotH * Math.cos(th)).addScaledVector(left, r * robotH * Math.sin(th));
const D = Math.PI / 180, R_STOP = 1.35, TH_STOP = 55 * D, TH_ARC = 45 * D;
// The duck's script, as phases: walk (to a polar point), turn (in place, to a heading or facing the
// robot), quack, hold. Step 1 loops its arc. Each phase knows its own end.
const scoutState = { step: -1, i: 0, t: 0, phases: [], pos: new THREE.Vector3(), head: 0, seg: 'stand', segT: 0, snap: null, blend: 1, quacks: [] };
const heading = d => Math.atan2(-d.z, d.x); // the duck's forward is its local +x
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const arcPhases = () => {
    const ph = [];
    for (const [a, b] of [[TH_STOP, -TH_ARC], [-TH_ARC, TH_STOP]]) {
        ph.push({ kind: 'turnArc', from: a, to: b }, { kind: 'arc', from: a, to: b });
    }
    return ph;
};
const scoutStart = step => {
    robotFrame();
    const s = scoutState;
    s.step = step; s.i = 0; s.t = 0;
    if (step === 0) {
        polar(2.1, 72 * D, s.pos);
        s.phases = [{ kind: 'walk', to: polar(R_STOP, TH_STOP) }, { kind: 'face' }, { kind: 'quack' }, { kind: 'hold' }];
        look.heard = false; // back from step 1: wait for the quack again
        s.head = heading(s.phases[0].to.clone().sub(s.pos));
    } else {
        s.phases = arcPhases();
    }
    s.loop = step === 1;
};
const scoutSeg = name => {
    const s = scoutState;
    if (s.seg === name) return;
    s.snap = Object.values(scout.userData.bodies).map(g => [g.position.clone(), g.quaternion.clone()]);
    s.seg = name; s.segT = 0; s.blend = 0;
};
const quackRings = [];
const ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, depthWrite: false, side: THREE.DoubleSide });
for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 96), ringMat.clone());
    m.rotation.x = -Math.PI / 2; m.visible = false;
    scene.add(m); quackRings.push({ m, t: -1 });
}
const doaCone = new THREE.Mesh(new THREE.CircleGeometry(1, 40, -0.22, 0.44), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
doaCone.rotation.x = -Math.PI / 2; doaCone.position.y = 0.002; doaCone.scale.setScalar(robotH * 1.1);
const doaPivot = new THREE.Group(); doaPivot.add(doaCone); scene.add(doaPivot);
const look = { w: 0, yaw: 0, pitch: 0, heard: false, doa: 0 };
const trackBox = document.getElementById('trackBox');
const scoutUpdate = (dt, on, step) => {
    const s = scoutState;
    scoutRig.visible = on;
    look.w = Math.max(0, Math.min(1, look.w + (on ? dt : -dt) / 0.6));
    if (!on) { s.step = -1; look.heard = false; if (look.w === 0) look.yaw = look.pitch = 0; doaCone.material.opacity = 0; trackBox.classList.remove('on'); for (const r of quackRings) r.m.visible = false; return; }
    if (step !== s.step) scoutStart(step);
    robotFrame();
    const ph = s.phases[s.i];
    s.t += dt;
    let done = false;
    if (ph.kind === 'walk' || ph.kind === 'arc') {
        scoutSeg('walk');
        if (ph.kind === 'walk') {
            const to = ph.to.clone().sub(s.pos).setY(0), d = to.length(), stepLen = WALK_V * dt;
            s.head += angTo(s.head, heading(to)) * Math.min(1, dt * 6);
            if (d <= stepLen) { s.pos.copy(ph.to); done = true; } else s.pos.addScaledVector(to.normalize(), stepLen);
        } else {
            const dir = Math.sign(ph.to - ph.from), w = WALK_V / (R_STOP * robotH);
            const th = ph.from + dir * w * s.t;
            done = dir > 0 ? th >= ph.to : th <= ph.to;
            polar(R_STOP, done ? ph.to : th, s.pos);
            const tan = polar(R_STOP, th + dir * 0.01).sub(s.pos);
            s.head = heading(tan);
        }
    } else if (ph.kind === 'face' || ph.kind === 'turnArc') {
        scoutSeg('walk'); // steps in place while turning
        let goal;
        if (ph.kind === 'face') goal = heading(rpos.clone().sub(s.pos));
        else { const dir = Math.sign(ph.to - ph.from); goal = heading(polar(R_STOP, ph.from + dir * 0.01).sub(polar(R_STOP, ph.from))); }
        const e = angTo(s.head, goal), stepA = 2.2 * dt;
        if (Math.abs(e) <= stepA) { s.head = goal; done = s.t > 0.4; } else s.head += Math.sign(e) * stepA;
    } else if (ph.kind === 'quack') {
        scoutSeg('quack');
        done = s.segT >= QUACK_T;
        for (const q of [0.2, 0.8]) if (s.segT - dt < q && s.segT >= q) { const r = quackRings.find(x => x.t < 0) ?? quackRings[0]; r.t = 0; r.from = s.pos.clone(); }
        if (s.segT >= 0.5) look.heard = true; // the robot turns once the first quack reached it
    } else scoutSeg('stand');
    if (done) { s.i++; s.t = 0; if (s.i >= s.phases.length) s.i = s.loop ? 0 : s.phases.length - 1; }
    // legs: the segment's clip time (walk loops), eased from the previous segment's pose
    s.segT += dt;
    const [a, b] = seg[s.seg];
    const ct = s.seg === 'walk' ? a + (s.segT % WALK_P) : Math.min(b, a + s.segT);
    poseMJCF(scout, walkClip, ct);
    const x = Math.min(walkClip.jaw.length - 1, ct * walkClip.fps), i = Math.floor(x);
    scoutJaw.rotation.y = 0.55 * (walkClip.jaw[i] + (walkClip.jaw[Math.min(walkClip.jaw.length - 1, i + 1)] - walkClip.jaw[i]) * (x - i));
    if (s.blend < 1) {
        s.blend = Math.min(1, s.blend + dt / 0.25);
        const k = smooth(s.blend);
        Object.values(scout.userData.bodies).forEach((g, j) => {
            g.position.lerpVectors(s.snap[j][0], g.position, k);
            g.quaternion.slerpQuaternions(s.snap[j][1], g.quaternion.clone(), k);
        });
    }
    scoutRig.position.copy(s.pos);
    scoutRig.rotation.y = s.head;
    // sound rings: from the duck to the robot
    const reach = s.pos.distanceTo(rpos);
    for (const r of quackRings) {
        if (r.t < 0) { r.m.visible = false; continue; }
        r.t += dt;
        const k = r.t / 0.8;
        if (k >= 1) { r.t = -1; r.m.visible = false; continue; }
        r.m.visible = true;
        r.m.position.set(r.from.x, 0.003, r.from.z);
        r.m.scale.setScalar(Math.max(0.01, reach * k));
        r.m.material.opacity = 0.9 * (1 - k);
    }
    // where the robot looks: the duck once heard (step 0) or always (step 1)
    const tracking = step === 1 || look.heard;
    if (tracking) {
        const to = s.pos.clone().sub(rpos);
        const tgt = Math.atan2(to.dot(left), to.dot(fwd));
        look.doa = tgt;
        look.yaw += (tgt - look.yaw) * (1 - Math.exp(-dt / (step === 1 ? 0.18 : 0.3)));
        look.pitch += (0.35 - look.pitch) * (1 - Math.exp(-dt / 0.3));
    } else { // nothing heard yet: back to looking ahead
        const k = 1 - Math.exp(-dt / 0.4);
        look.yaw -= look.yaw * k; look.pitch -= look.pitch * k;
    }
    doaPivot.position.copy(rpos);
    doaPivot.rotation.y = heading(polar(1, look.doa).sub(rpos)); // cone along the heard direction; the head follows it
    const coneOn = step === 0 && look.heard;
    doaCone.material.opacity += ((coneOn ? 0.28 : 0) - doaCone.material.opacity) * Math.min(1, dt * 4);
    trackBox.classList.toggle('on', step === 1);
};
const applySet = name => { robot.group.visible = name !== 'none'; };
// Family <-> studio: the other robots, the table and their lights fade over the first half of the
// move (last half coming back) while the camera eases, so Reachy Mini stays on screen throughout.
const famMats = new Map(), lightsOf = g => { const m = new Map(); g.traverse(o => { if (o.isLight) m.set(o, o.intensity); }); return m; };
family.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) famMats.set(m, [m.opacity, m.transparent]); });
const famLights = lightsOf(family), studioL = lightsOf(studioLights);
let famK = -1;
const applyFam = f => {
    const k = Math.max(0, 2 * f - 1);
    if (k === famK) return;
    famK = k;
    family.visible = k > 0;
    studioLights.visible = k < 1;
    for (const [m, [op, tr]] of famMats) {
        const t = tr || k < 1;
        if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
        m.opacity = op * k;
    }
    for (const [l, i] of famLights) l.intensity = i * k;
    for (const [l, i] of studioL) l.intensity = i * (1 - k);
    scene.environmentIntensity = 0.55 - 0.25 * k;
};
applySet(from.set);
canvas.style.opacity = from.dim;
let swap = null;
// Reachy 2 reaches for its cube while the camera is on the Reachys (focus step 1). Leaving the
// step lets the cycle in progress finish, so it always ends back at rest.
const r2mixer = new THREE.AnimationMixer(reachy2);
const r2grasp = r2mixer.clipAction(reachy2.userData.clip);
r2grasp.clampWhenFinished = true;
// MuJoCo-baked clips (shot-tools/mjcf_clip.py), each looping while the camera is on its
// robots: the Amazing Hands count on their fingers (step 2); the Gripette sways and opens and
// closes its jaws while the Grabette's jaw does the same (step 3). Leaving a step lets the
// cycle finish. The Microduck (step 4) has its own state machine, below.
const [handClip, handLeftClip, gripetteClip] = await Promise.all([`${R}/hand/clip.json`, `${R}/hand_left/clip.json`, `${R}/gripette/clip.json`].map(u => fetch(u, { cache: 'no-cache' }).then(r => r.json())));
const handAnim = { playing: false, t: 0, loop: false, step: 2 };
const gripAnim = { playing: false, t: 0, loop: false, step: 3 };
// Microduck: zooming in plays "up" (stands, opens its beak twice) then loops "idle" (looks
// around); zooming out plays "down" (sits). Each switch eases from the pose it is in over
// DUCK_BLEND seconds, so leaving mid-look or coming back mid-sit never snaps.
const DUCK_BLEND = 0.4;
const duckAnim = { seg: null, t: 0, blend: 1, snap: null, jaw: 0 };
const duckBodies = Object.values(duck.userData.bodies);
const duckPlay = seg => {
    duckAnim.snap = duckBodies.map(g => [g.position.clone(), g.quaternion.clone()]);
    duckAnim.snapJaw = duckJaw.rotation.y;
    duckAnim.seg = seg;
    duckAnim.t = duckClip.segments[seg][0];
    duckAnim.blend = 0;
};
const duckFocus = on => {
    if (on && (duckAnim.seg === null || duckAnim.seg === 'down')) duckPlay('up');
    if (!on && (duckAnim.seg === 'up' || duckAnim.seg === 'idle')) duckPlay('down');
};
const duckUpdate = dt => {
    if (duckAnim.seg === null) return;
    const [, end] = duckClip.segments[duckAnim.seg];
    duckAnim.t += dt;
    if (duckAnim.t >= end) {
        if (duckAnim.seg === 'up') { duckAnim.seg = 'idle'; duckAnim.t = duckClip.segments.idle[0] + (duckAnim.t - end); }
        else if (duckAnim.seg === 'idle') duckAnim.t = duckClip.segments.idle[0] + (duckAnim.t - end);
        else { poseDuck(end); duckAnim.seg = null; return; } // seated again: hold
    }
    poseDuck(duckAnim.t);
    if (duckAnim.blend < 1) {
        duckAnim.blend = Math.min(1, duckAnim.blend + dt / DUCK_BLEND);
        const w = smooth(duckAnim.blend);
        duckBodies.forEach((g, i) => {
            g.position.lerpVectors(duckAnim.snap[i][0], g.position, w);
            g.quaternion.slerpQuaternions(duckAnim.snap[i][1], g.quaternion.clone(), w);
        });
        duckJaw.rotation.y = duckAnim.snapJaw + (duckJaw.rotation.y - duckAnim.snapJaw) * w;
    }
};
// Grabette jaw angle (rad) over the Gripette clip: same open/close beats as its JAW_KEYS.
const JAW = [[0, 0], [1.5, 0], [2.7, 1], [3.7, 1], [4.9, 0], [6, 0], [7.2, 1], [8, 1], [9.2, 0], [10, 0]];
const jawAngle = t => {
    for (let i = 0; i + 1 < JAW.length; i++) {
        const [t0, a] = JAW[i], [t1, b] = JAW[i + 1];
        if (t >= t0 && t <= t1) { const k = smooth((t - t0) / (t1 - t0)); return (a + (b - a) * k) * 0.9; }
    }
    return 0;
};
const applyFocus = ({ id, step }) => {
    const fam = id === 'family';
    duckFocus(fam && step === 4);
    for (const a of [handAnim, gripAnim]) {
        a.loop = fam && step === a.step;
        if (a.loop && !a.playing) { a.playing = true; a.t = 0; }
    }
    if (fam && step === 1) {
        r2grasp.setLoop(THREE.LoopRepeat, Infinity);
        if (!r2grasp.isRunning()) r2grasp.reset().play();
    } else r2grasp.setLoop(THREE.LoopOnce, 1);
    const f = fam && step > 0 ? FOCUS[step - 1] : null;
    focusIds = f?.ids ?? null;
    strip.classList.toggle('focusing', !!f);
    for (const m of members) m.classList.toggle('focus', !!f && m.dataset.robot.split(' ').some(id => f.ids.includes(id)));
};
applyFocus(deckState()); // deep link (#3.2) fired before this listener
addEventListener('slidechange', e => {
    const next = shotFor(e.detail);
    applyFocus(e.detail);
    clearTimeout(swap);
    if (next.set === to.set || (next.set !== 'none' && to.set !== 'none')) {
        canvas.style.opacity = next.dim;
        from = current(); to = next; t0 = performance.now() / 1000;
        return;
    }
    canvas.style.opacity = 0;
    swap = setTimeout(() => {
        applySet(next.set);
        from = to = next; t0 = 0;
        canvas.style.opacity = next.dim;
    }, 400);
});
const smooth = k => k * k * k * (k * (6 * k - 15) + 10);
let now = 0;
window.__explodeFrom0 = () => { window.__arm = true; };
function current() {
    const k = smooth(Math.min(1, Math.max(0, (now - t0) / DUR)));
    const out = {};
    for (const key of Object.keys(to)) out[key] = typeof to[key] === 'string' ? to[key] : Array.isArray(to[key]) ? lerpArr(from[key], to[key], k) : from[key] + (to[key] - from[key]) * k;
    return out;
}

/* --- Family parts the camera never sees --- */
// The family set is only seen from its wide shot and the five focus shots. Each mesh is rendered in a
// flat ID colour from those six cameras, at several moments of every clip (Reachy 2's grasp, the hands,
// the Gripette and Grabette jaws, the Microduck standing up); meshes of the family-only robots whose
// colour never shows are removed. Reachy Mini and the Microduck only occlude: they appear elsewhere.
function findHidden() {
    const prunable = [reachy1, reachy2, hand, handLeft, gripette, grabette];
    const ids = [], saved = new Map(), mats = [];
    const famShots = [SHOTS.family[0], ...FOCUS.map(f => f.shot)];
    scene.traverse(o => {
        if (!o.isMesh) return;
        saved.set(o, [o.material, o.visible]);
        const solid = [o.material].flat().every(m => !m.transparent || m.opacity > 0.99);
        if (!solid) { o.visible = false; return; }
        const i = ids.push(o), mat = new THREE.MeshBasicMaterial();
        mat.color.setRGB((i & 255) / 255, ((i >> 8) & 255) / 255, ((i >> 16) & 255) / 255, THREE.LinearSRGBColorSpace);
        mats.push(mat);
        o.material = mat;
    });
    const was = { tm: renderer.toneMapping, sm: renderer.shadowMap.enabled, fam: family.visible, scout: scoutRig.visible, studio: studioLights.visible };
    renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = false;
    family.visible = true; scoutRig.visible = false;
    const rt = new THREE.WebGLRenderTarget(960, 540), px = new Uint8Array(960 * 540 * 4), seen = new Set();
    const K = 12, r2len = reachy2.userData.clip.duration;
    r2grasp.reset().play();
    for (let k = 0; k < K; k++) {
        const f = k / (K - 1);
        r2grasp.time = f * r2len; r2mixer.update(0);
        poseMJCF(hand, handClip, f * handClip.duration); poseMJCF(handLeft, handLeftClip, f * handClip.duration);
        poseMJCF(gripette, gripetteClip, f * gripetteClip.duration);
        grabetteJaw.rotation.z = grabetteTip.rotation.z = jawAngle(f * gripetteClip.duration);
        poseDuck(f < 0.5 ? 0 : duckClip.segments.idle[0]);
        for (const s of famShots) {
            robot.group.position.fromArray(s.pos); robot.group.scale.setScalar(s.scale); robot.setYaw(s.yaw);
            camera.position.fromArray(s.cam); camera.lookAt(...s.target);
            scene.updateMatrixWorld(true);
            renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
            renderer.readRenderTargetPixels(rt, 0, 0, 960, 540, px);
            for (let i = 0; i < px.length; i += 4) seen.add(px[i] | (px[i + 1] << 8) | (px[i + 2] << 16));
        }
    }
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0);
    rt.dispose(); mats.forEach(m => m.dispose());
    for (const [o, [m, v]] of saved) { o.material = m; o.visible = v; }
    Object.assign(renderer, { toneMapping: was.tm }); renderer.shadowMap.enabled = was.sm;
    family.visible = was.fam; scoutRig.visible = was.scout; studioLights.visible = was.studio;
    r2grasp.stop(); r2mixer.update(0);
    poseMJCF(hand, handClip, 0); poseMJCF(handLeft, handLeftClip, 0); poseMJCF(gripette, gripetteClip, 0);
    grabetteJaw.rotation.z = grabetteTip.rotation.z = 0; poseDuck(0);
    const inPrunable = new Set(); for (const r of prunable) r.traverse(o => o.isMesh && inPrunable.add(o));
    return ids.filter((o, i) => !seen.has(i + 1) && inPrunable.has(o));
}
for (const o of findHidden()) { o.removeFromParent(); o.geometry.dispose(); }

/* --- Render cost: once everything is placed --- */
// Transmissive glass makes three render the whole opaque scene a second time each frame. The only two
// are eye glass: Reachy 2's is invisible (opacity 0), Reachy Mini's reads the same as dark glossy glass.
scene.traverse(o => {
    for (const m of [o.material].flat()) {
        if (!(m?.transmission > 0)) continue;
        if (m.opacity === 0) { o.visible = false; continue; }
        m.transmission = 0;
        m.color.set(0x050506);
        Object.assign(m, { roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9, depthWrite: false });
        m.needsUpdate = true;
    }
});
// Shadows only from parts bigger than a few cm: screws and small brackets don't show at this scale,
// but each would cost a draw in the shadow pass.
{
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3(), d = new THREE.Vector3();
    scene.traverse(o => { if (o.isMesh && o.castShadow && b.setFromObject(o).getSize(d).length() < 0.04) o.castShadow = false; });
}

// Hidden sets cost nothing per frame: three walks the whole graph to update world matrices, visible
// or not (the family set alone is ~1,000 objects). Installed after setup, so every placement is done.
for (const g of [family, scoutRig]) {
    const update = g.updateMatrixWorld;
    g.updateMatrixWorld = function (force) { if (this.visible) update.call(this, force); };
}

/* --- Frame loop --- */
const euler = new THREE.Euler();
const v = new THREE.Vector3(), p2 = new THREE.Vector3();
const toScreen = w => { v.copy(w).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; };
const leader = document.getElementById('leader'), dot = document.getElementById('leaderDot'), ring = document.getElementById('leaderRing'), halo = document.getElementById('leaderHalo');

function frame(ms) {
    const dt = Math.max(0, Math.min(0.1, ms / 1000 - now)); // capped after a hidden tab
    r2mixer.update(dt);
    if (handAnim.playing) {
        handAnim.t += dt;
        if (handAnim.t >= handClip.duration) { handAnim.t = 0; handAnim.playing = handAnim.loop; }
        poseMJCF(hand, handClip, handAnim.t);
        poseMJCF(handLeft, handLeftClip, handAnim.t);
    }
    if (gripAnim.playing) {
        gripAnim.t += dt;
        if (gripAnim.t >= gripetteClip.duration) { gripAnim.t = 0; gripAnim.playing = gripAnim.loop; }
        poseMJCF(gripette, gripetteClip, gripAnim.t);
        grabetteJaw.rotation.z = grabetteTip.rotation.z = jawAngle(gripAnim.t);
    }
    duckUpdate(dt);
    now = ms / 1000;
    if (window.__arm) { window.__arm = false; from = { ...to, explode: 0 }; t0 = now; }
    const s = current();
    const t = now;
    applyFam(s.fam);

    // Idle life: a head that is never quite still, antennas swaying.
    const a = s.idle;
    euler.set(
        a * (0.10 * Math.sin(t * 0.7) + 0.04 * Math.sin(t * 1.9)),
        a * 0.12 * Math.sin(t * 0.45 + 1),
        a * (0.28 * Math.sin(t * 0.33) + 0.06 * Math.sin(t * 1.3)),
        'XYZ');
    pose.q.setFromEuler(euler);
    pose.p.set(0, 0, a * 0.006 * Math.sin(t * 0.9));
    pose.ant = [s.ant * 0.35 * Math.sin(t * 1.1) - 0.1, s.ant * -0.35 * Math.sin(t * 1.1 + 0.6) + 0.1];
    pose.yaw = 0;
    const st = deckState();
    scoutUpdate(dt, st.id === 'sense', st.step);
    if (look.w > 0) {
        const k = smooth(look.w);
        pose.q.premultiply(qa.setFromEuler(euler.set(0, look.pitch * k, look.yaw * k, 'ZYX')));
        pose.yaw = 0.6 * look.yaw * k; // the body takes part of the turn
    }
    const mw = moveUpdate(dt, st.id === 'moves');
    if (mw > 0) {
        pose.p.lerp(player.p, mw);
        pose.q.slerp(player.q, mw);
        pose.ant = pose.ant.map((a, j) => a + (player.ant[j] - a) * mw);
        pose.yaw = player.yaw * mw;
    }

    robot.group.position.fromArray(s.pos);
    contact.material.opacity = s.shadow;
    robot.group.scale.setScalar(s.scale);
    robot.setYaw(s.yaw);
    robot.setPose(pose);
    robot.setExplode(s.explode);
    const shellOpacity = 1 - 0.75 * Math.max(s.explode, s.ghost), headOpacity = Math.min(shellOpacity, 1 - 0.8 * s.headGhost);
    for (const m of shells) {
        const op = headShell.has(m) ? headOpacity : shellOpacity;
        m.material.opacity = op;
        // See-through: outer faces only and no depth writes. Double-sided, the four head shells stack about
        // eight layers between the camera and the eyes, which then read as a solid grey block.
        const solid = op > 0.99;
        m.material.depthWrite = solid;
        m.material.side = solid ? m.userData.origMaterial.side : THREE.FrontSide;
    }
    gears.visible = s.gears > 0.01;
    if (gears.visible) spinGears(gears, dt, s.gears);
    cloud.visible = s.cloud > 0.01;
    if (cloud.visible) {
        const c = cloud.userData;
        const light = document.documentElement.dataset.theme === 'light'; // white on the light page vanishes: tint it
        c.puff.material.color.setHex(light ? 0x9fb0c8 : 0xffffff); c.puff.material.emissive.setHex(light ? 0x4a5a72 : 0xa3a9b4);
        c.puff.material.opacity = (light ? 0.38 : 0.22) * s.cloud; // see-through like the Python step's head
        spinGears(c.gears, dt, s.cloud);
        cloud.position.y = 0.385 + 0.006 * Math.sin(t * 0.8); // drifts a little
    }
    const glow = s.focus * (1.8 + 0.8 * Math.sin(t * 3));
    for (const m of camParts) m.material.emissiveIntensity = glow;

    camera.position.fromArray(s.cam);
    camera.lookAt(...s.target);
    robot.group.updateWorldMatrix(true, true);
    // Nothing 3D on this slide (the canvas is faded out): skip the render.
    if (robot.group.visible || family.visible || scoutRig.visible) renderer.render(scene, camera);

    // Overlay: part labels in one column left of the stack, each at its
    // sub-assembly's height, and a leader line from the camera to the panel.
    if (s.explode > 0.01) {
        const [col] = toScreen(robot.group.position);
        for (const anchor of robot.explodeAnchors()) {
            const l = labels.find(x => x.id === anchor.id);
            if (!l) continue;
            const [, y] = toScreen(anchor.world);
            l.el.style.left = `${col - 170}px`; l.el.style.top = `${y}px`;
        }
    }
    if (stage.dataset.mark !== s.mark) stage.dataset.mark = s.mark;
    if (s.mark) {
        box.makeEmpty();
        for (const m of s.mark === 'cam' ? camParts : micParts) box.expandByObject(m);
        box.getCenter(p2);
        if (s.mark === 'mic') p2.y = box.max.y; // top of the head: the mic holes
        const [x, y] = toScreen(p2);
        const X = 1160, Y = 300;
        leader.setAttribute('points', `${x + 58},${y} ${X - 60},${Y} ${X},${Y}`);
        dot.setAttribute('cx', x); dot.setAttribute('cy', y);
        ring.setAttribute('cx', x); ring.setAttribute('cy', y);
        halo.setAttribute('cx', x); halo.setAttribute('cy', y);
    }
    if (scoutRig.visible) {
        box.setFromObject(scout);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < 8; i++) {
            const [x, y] = toScreen(p2.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        Object.assign(trackBox.style, { left: `${x0 - 10}px`, top: `${y0 - 10}px`, width: `${x1 - x0 + 20}px`, height: `${y1 - y0 + 20}px` });
    }
    // Family slide: a curve from each name card up to its robot. The cards don't move, so their
    // positions are read once (reading them each frame forced a layout), and the SVG is only
    // rewritten when a curve changed.
    if (family.visible && stage.dataset.slide === 'family') {
        anchors.mini = p2.copy(robot.group.position).add(v.set(0, 0.17, 0));
        let d = '', dots = '';
        for (const m of members) {
            if (focusIds && !m.classList.contains('focus')) continue;
            m.at ??= [m.parentElement.offsetLeft + m.offsetLeft + 2, m.parentElement.offsetTop + m.offsetTop - 14];
            const [x0, y0] = m.at;
            for (const id of m.dataset.robot.split(' ')) { // a card may point at several robots
                const [ax, ay] = toScreen(anchors[id]).map(Math.round);
                d += `M${x0},${y0} C${x0},${(y0 + ay) / 2} ${ax},${(y0 + ay) / 2 + 40} ${ax},${ay} `;
                dots += `<circle cx="${ax}" cy="${ay}" r="5"/>`;
            }
            dots += `<circle cx="${x0}" cy="${y0}" r="3"/>`;
        }
        const svg = `<path d="${d}"/>${dots}`;
        if (svg !== famLines.dataset.last) { famLines.innerHTML = svg; famLines.dataset.last = svg; }
    }
    requestAnimationFrame(frame);
}
stopPreview();
canvas.style.opacity = from.dim; // the preview hid it on slides it can't show
requestAnimationFrame(frame);
window.__ready = true;
