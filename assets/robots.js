// Minimal MJCF loader (microduck): kinematic tree + visual STL meshes, posed by
// an optional { jointName: angle } map. Returned group is Y-up (MJCF is Z-up).
// ponytail: hinge joints about the body origin, no default-class inheritance.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const nums = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);
const kids = (el, tag) => [...el.children].filter(c => c.tagName === tag);

// Smooth normals across faces under 30 deg, sharp CAD edges above, so decimated parts don't look faceted.
// Same rule as three's toCreasedNormals, which takes about a minute on these 3M triangles (a string key
// per vertex): corners are welded on a numeric key, and each corner averages the normals of the faces
// around its vertex that are within the crease angle of its own face.
function creaseNormals(geo, crease = Math.PI / 6) {
    const p = geo.attributes.position.array, n = p.length / 3, nf = n / 3, cos = Math.cos(crease);
    const fn = new Float32Array(nf * 3);
    for (let f = 0; f < nf; f++) {
        const i = f * 9, ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
        const x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx, l = Math.hypot(x, y, z) || 1;
        fn[f * 3] = x / l; fn[f * 3 + 1] = y / l; fn[f * 3 + 2] = z / l;
    }
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox, q = (max.distanceTo(min) || 1) * 2e-5, K = 65536; // < 2^53 for any part
    const ids = new Map(), vid = new Uint32Array(n);
    for (let c = 0; c < n; c++) {
        const key = (Math.round((p[c * 3] - min.x) / q) * K + Math.round((p[c * 3 + 1] - min.y) / q)) * K + Math.round((p[c * 3 + 2] - min.z) / q);
        let v = ids.get(key);
        if (v === undefined) ids.set(key, (v = ids.size));
        vid[c] = v;
    }
    const start = new Uint32Array(ids.size + 1), list = new Uint32Array(n); // corners around each vertex
    for (let c = 0; c < n; c++) start[vid[c] + 1]++;
    for (let v = 0; v < ids.size; v++) start[v + 1] += start[v];
    const fill = start.slice(0, ids.size);
    for (let c = 0; c < n; c++) list[fill[vid[c]]++] = c;
    const out = new Float32Array(n * 3);
    for (let c = 0; c < n; c++) {
        const f = (c / 3) | 0, fx = fn[f * 3], fy = fn[f * 3 + 1], fz = fn[f * 3 + 2], v = vid[c];
        let x = 0, y = 0, z = 0;
        for (let k = start[v]; k < start[v + 1]; k++) {
            const g = ((list[k] / 3) | 0) * 3, gx = fn[g], gy = fn[g + 1], gz = fn[g + 2];
            if (gx * fx + gy * fy + gz * fz >= cos) { x += gx; y += gy; z += gz; }
        }
        const l = Math.hypot(x, y, z) || 1;
        out[c * 3] = x / l; out[c * 3 + 1] = y / l; out[c * 3 + 2] = z / l;
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
    return geo;
}

// Load each mesh file once; callers clone.
const cache = new Map();
function loadMesh(url) {
    // window.PACKED: the claude.ai version, where the meshes come from base64 bundles (js/packed.js).
    const load = () => window.PACKED ? import('../js/packed.js').then(m => m.modelBytes(url)).then(b => new STLLoader().parse(b)) : new STLLoader().loadAsync(url);
    if (!cache.has(url)) cache.set(url, load().then(creaseNormals));
    return cache.get(url).then(geo => new THREE.Mesh(geo));
}

// STL parts exported in one shared CAD frame (mm, Z-up): [{ file, color }].
export async function loadParts(dir, parts, scale = 0.001) {
    const root = new THREE.Group();
    await Promise.all(parts.map(async ({ file, color }) => {
        const m = await loadMesh(`${dir}/${file}`);
        m.name = file.replace(/\.stl$/i, '');
        m.material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });
        m.castShadow = m.receiveShadow = true;
        root.add(m);
    }));
    root.scale.setScalar(scale);
    root.rotation.x = -Math.PI / 2;
    const out = new THREE.Group();
    out.add(root);
    return out;
}

// recolor(materialName) -> null | { color, roughness?, metalness? } overrides a CAD colour.
// keep: mesh names left as their own object (looked up by name later); every other part of a body is
// merged with the body's other parts of the same look, so a robot is a few draws instead of one per part.
export async function loadMJCF(url, { meshDir, joints = {}, recolor = () => null, keep = [] } = {}) {
    const doc = new DOMParser().parseFromString(await (await fetch(url, { cache: 'no-cache' })).text(), 'application/xml');
    const meshes = Object.fromEntries([...doc.querySelectorAll('asset > mesh')].map(m => {
        const file = m.getAttribute('file');
        return [m.getAttribute('name') ?? file.replace(/\.[^.]+$/, ''), file];
    }));
    const mats = Object.fromEntries([...doc.querySelectorAll('asset > material')].map(m => [m.getAttribute('name'), nums(m.getAttribute('rgba'), [0.8, 0.8, 0.8, 1])]));
    const jobs = [];
    const place = (obj, el) => {
        obj.position.fromArray(nums(el.getAttribute('pos'), [0, 0, 0]));
        const [w, x, y, z] = nums(el.getAttribute('quat'), [1, 0, 0, 0]);
        obj.quaternion.set(x, y, z, w);
    };
    const build = el => {
        const g = new THREE.Group(); g.name = el.getAttribute('name') ?? '';
        bodies[g.name] = g;
        place(g, el);
        const inner = new THREE.Group(); // joint rotation, applied after the body frame
        g.add(inner);
        for (const j of kids(el, 'joint')) {
            const a = joints[j.getAttribute('name')];
            if (a) inner.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...nums(j.getAttribute('axis'), [0, 0, 1])).normalize(), a));
        }
        for (const geom of kids(el, 'geom')) {
            if (geom.getAttribute('class') !== 'visual' || geom.getAttribute('type') !== 'mesh') continue;
            const holder = new THREE.Group();
            holder.name = geom.getAttribute('mesh');
            place(holder, geom);
            inner.add(holder);
            const name = geom.getAttribute('material');
            const [r, gr, b] = mats[name] ?? [0.8, 0.8, 0.8];
            const over = recolor(name);
            jobs.push(loadMesh(`${meshDir}/${meshes[geom.getAttribute('mesh')]}`).then(m => {
                // MJCF rgba from Onshape is sRGB; Color(r, g, b) would read it as linear and wash it out.
                m.material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(r, gr, b, THREE.SRGBColorSpace), roughness: 0.55, metalness: 0.05, ...over });
                m.castShadow = m.receiveShadow = true;
                holder.add(m);
            }));
        }
        for (const b of kids(el, 'body')) inner.add(build(b));
        return g;
    };
    const bodies = {};
    const root = new THREE.Group();
    for (const b of kids(doc.querySelector('worldbody'), 'body')) root.add(build(b));
    await Promise.all(jobs);
    const looks = new Map(); // one material per colour / finish, shared by the merged meshes
    for (const g of Object.values(bodies)) {
        const inner = g.children[0], byLook = new Map();
        for (const h of [...inner.children]) {
            const m = h.children[0];
            if (!m?.isMesh || keep.includes(h.name)) continue; // child bodies are skipped: no mesh child
            const mat = m.material, key = [mat.color.getHex(), mat.roughness, mat.metalness, mat.envMapIntensity].join();
            if (!looks.has(key)) looks.set(key, mat);
            h.updateMatrix();
            (byLook.get(key) ?? byLook.set(key, []).get(key)).push(m.geometry.clone().applyMatrix4(h.matrix));
            inner.remove(h);
        }
        for (const [key, geos] of byLook) {
            const mesh = new THREE.Mesh(mergeGeometries(geos), looks.get(key));
            mesh.castShadow = mesh.receiveShadow = true;
            inner.add(mesh);
        }
    }
    const out = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    out.add(root);
    out.userData.bodies = bodies; // body name -> group (its first child carries the joint rotation)
    return out;
}

// Play a clip baked by shot-tools/mjcf_clip.py on a loadMJCF() model: each body's pose
// relative to its parent at `t` seconds (linear between samples), the joint groups reset.
export function poseMJCF(model, clip, t) {
    const n = clip.bodies[Object.keys(clip.bodies)[0]].pos.length;
    const x = Math.max(0, Math.min(n - 1, t * clip.fps)), i = Math.floor(x), k = x - i, j = Math.min(n - 1, i + 1);
    for (const [name, b] of Object.entries(clip.bodies)) {
        const g = model.userData.bodies[name];
        if (!g) continue;
        g.position.set(...b.pos[i]).lerp(_v.set(...b.pos[j]), k);
        g.quaternion.set(...b.quat[i]).slerp(_q.set(...b.quat[j]), k);
        g.children[0].quaternion.identity();
    }
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

// Grabette's bought-in parts, not in the print STLs: a simplified Pi stack standing in the
// Raspi_Box cup, and the camera lenses behind the shell windows. CAD mm, Z-up, front = +Y.
export function addGrabetteElectronics(root) {
    const mat = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const box = (sx, sy, sz, x, y, z, m) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
        b.position.set(x, y, z);
        b.castShadow = b.receiveShadow = true;
        root.add(b);
        return b;
    };
    const pcb = mat(0x1f6b34, 0.6), steel = mat(0xc9ccd0, 0.3, 0.9), black = mat(0x141416, 0.6);
    // Stack across the cup (grip x 33..66), boards 85 tall, ports out of the top.
    box(10, 52, 70, 37, -38.7, -64, black); // PiSugar battery
    box(1.6, 56, 85, 45, -38.7, -57, pcb); // Raspberry Pi 4
    box(1.6, 56, 70, 58, -38.7, -64, pcb); // RPi hat
    box(15, 21, 16, 49, -58, -8, steel); // ethernet
    box(15, 15, 17, 49, -38, -8, steel); // USB
    box(15, 15, 17, 49, -21, -8, steel); // USB
    // Lenses behind the windows: Oak-D SR stereo pair, Arducam fisheye above.
    const lens = (r, x, y, z) => {
        const g = new THREE.Group();
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 6, 32), black);
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 6.4, 32), mat(0x05070a, 0.05, 0.3));
        g.add(barrel, glass);
        g.position.set(x, y, z);
        root.add(g);
    };
    // Shell front: y = -37.2 at the oval, about -42 (tilted) at the round hole.
    lens(6, LENS.oakX - 10, -41, LENS.oakZ);
    lens(6, LENS.oakX + 10, -41, LENS.oakZ);
    lens(7, LENS.fishX, -46, LENS.fishZ);
    box(44, 3, 22, LENS.oakX, -45, LENS.oakZ, black); // Oak-D face behind the pair
    box(26, 3, 26, LENS.fishX, -50, LENS.fishZ, pcb); // Arducam board behind the fisheye
}
// Window centres measured on Grip_Shell_R (front view).
const LENS = { oakX: -16.8, oakZ: 28.8, fishX: -30.3, fishZ: 69 };
