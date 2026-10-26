// Draco decoding on the page's own thread, for the claude.ai version of the deck. DRACOLoader fetches its
// decoder to start a worker, and that page may only fetch its own files; it can load the decoder as a
// script from a CDN, though, which defines DracoDecoderModule (the pure-JS build: no WebAssembly needed).
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let modulePending = null;
const loadModule = () => modulePending ??= new Promise(resolve => {
    // The module is promise-like: wrap it before resolving, as DRACOLoader's worker does.
    DracoDecoderModule({ onModuleLoaded: draco => resolve({ draco }) }); // eslint-disable-line no-undef
});

export class InlineDRACOLoader extends DRACOLoader {
    decodeGeometry(buffer, taskConfig) {
        return loadModule().then(({ draco }) => {
            const decoder = new draco.Decoder();
            try { return this._createGeometry(decodeGeometry(draco, decoder, new Int8Array(buffer), taskConfig)); }
            finally { draco.destroy(decoder); }
        });
    }
}

// From three.js r180 DRACOLoader's worker (DRACOWorker), unchanged but for `self` -> `globalThis`.
function decodeGeometry(draco, decoder, array, taskConfig) {
    const attributeIDs = taskConfig.attributeIDs;
    const attributeTypes = taskConfig.attributeTypes;
    let dracoGeometry;
    let decodingStatus;
    const geometryType = decoder.GetEncodedGeometryType(array);
    if (geometryType === draco.TRIANGULAR_MESH) {
        dracoGeometry = new draco.Mesh();
        decodingStatus = decoder.DecodeArrayToMesh(array, array.byteLength, dracoGeometry);
    } else if (geometryType === draco.POINT_CLOUD) {
        dracoGeometry = new draco.PointCloud();
        decodingStatus = decoder.DecodeArrayToPointCloud(array, array.byteLength, dracoGeometry);
    } else {
        throw new Error('THREE.DRACOLoader: Unexpected geometry type.');
    }
    if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
        throw new Error('THREE.DRACOLoader: Decoding failed: ' + decodingStatus.error_msg());
    }
    const geometry = { index: null, attributes: [] };
    for (const attributeName in attributeIDs) {
        const attributeType = globalThis[attributeTypes[attributeName]];
        let attribute;
        let attributeID;
        if (taskConfig.useUniqueIDs) {
            attributeID = attributeIDs[attributeName];
            attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeID);
        } else {
            attributeID = decoder.GetAttributeId(dracoGeometry, draco[attributeIDs[attributeName]]);
            if (attributeID === -1) continue;
            attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        }
        const attributeResult = decodeAttribute(draco, decoder, dracoGeometry, attributeName, attributeType, attribute);
        if (attributeName === 'color') attributeResult.vertexColorSpace = taskConfig.vertexColorSpace;
        geometry.attributes.push(attributeResult);
    }
    if (geometryType === draco.TRIANGULAR_MESH) geometry.index = decodeIndex(draco, decoder, dracoGeometry);
    draco.destroy(dracoGeometry);
    return geometry;
}

function decodeIndex(draco, decoder, dracoGeometry) {
    const numIndices = dracoGeometry.num_faces() * 3;
    const byteLength = numIndices * 4;
    const ptr = draco._malloc(byteLength);
    decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
    const index = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice();
    draco._free(ptr);
    return { array: index, itemSize: 1 };
}

function decodeAttribute(draco, decoder, dracoGeometry, attributeName, attributeType, attribute) {
    const numComponents = attribute.num_components();
    const numValues = dracoGeometry.num_points() * numComponents;
    const byteLength = numValues * attributeType.BYTES_PER_ELEMENT;
    const ptr = draco._malloc(byteLength);
    decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, getDracoDataType(draco, attributeType), byteLength, ptr);
    const array = new attributeType(draco.HEAPF32.buffer, ptr, numValues).slice();
    draco._free(ptr);
    return { name: attributeName, array, itemSize: numComponents };
}

function getDracoDataType(draco, attributeType) {
    switch (attributeType) {
        case Float32Array: return draco.DT_FLOAT32;
        case Int8Array: return draco.DT_INT8;
        case Int16Array: return draco.DT_INT16;
        case Int32Array: return draco.DT_INT32;
        case Uint8Array: return draco.DT_UINT8;
        case Uint16Array: return draco.DT_UINT16;
        case Uint32Array: return draco.DT_UINT32;
    }
}
