// The claude.ai version serves neither .glb nor .stl files, so its models ship base64-encoded in JSON
// bundles (assets/packed/, built by pack_models.py). modelBytes(path) returns a model file's bytes from
// its bundle; the local deck never calls it and loads the files themselves.
let index = null;
const bundles = new Map();
const B64 = new Uint8Array(128);
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c, i) => { B64[c.charCodeAt(0)] = i; });

// atob on 15 MB strings makes a second 11 MB string first; this writes the bytes straight out.
function decode(s) {
    const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
    const out = new Uint8Array((s.length / 4) * 3 - pad);
    for (let i = 0, j = 0; i < s.length; i += 4) {
        const n = (B64[s.charCodeAt(i)] << 18) | (B64[s.charCodeAt(i + 1)] << 12) | (B64[s.charCodeAt(i + 2)] << 6) | B64[s.charCodeAt(i + 3)];
        out[j++] = n >> 16;
        if (j < out.length) out[j++] = (n >> 8) & 255;
        if (j < out.length) out[j++] = n & 255;
    }
    return out.buffer;
}

export async function modelBytes(path) {
    index ??= fetch('assets/packed/index.json').then(r => r.json());
    const name = (await index)[path];
    if (!name) throw new Error(`${path}: not in the packed models`);
    if (!bundles.has(name)) bundles.set(name, fetch(`assets/packed/${name}`).then(r => r.json()));
    const files = await bundles.get(name);
    const s = files[path];
    delete files[path]; // each model is read once (callers cache the parsed result): free its text
    return decode(s);
}
