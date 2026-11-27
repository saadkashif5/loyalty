/* eslint-disable no-console -- a command-line tool; it reports what it did. */
// Vertex-clustering simplifier + quantiser for the Stamply stamper GLB.
// Shrinks the stamper model the designers export (8.5 MB, ~1M indices) into
// the one the home page loads (~1.6 MB). Vertices closer than the grid size
// are merged (split by normal direction, so creases stay sharp) and normals are
// stored as bytes (KHR_mesh_quantization, which three.js reads natively, so no
// WASM decoder is needed at runtime and the CSP stays strict).
//
// usage: node portal/scripts/optimize-stamper.mjs <in.glb> portal/public/models/stamper.glb 0.3
import fs from "node:fs";
const [, , inPath, outPath, cellArg] = process.argv;
const CELL = (+cellArg || 0.35) / 1000;
const b = fs.readFileSync(inPath);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jl).toString());
const bin = b.slice(20 + jl + 8);
function acc(i) {
  const a = j.accessors[i];
  const bv = j.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC3: 3 }[a.type];
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
  const off = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return new C(bin.buffer.slice(off, off + a.count * n * C.BYTES_PER_ELEMENT));
}
const chunks = [];
let byteLen = 0;
const bufferViews = [],
  accessors = [];
function push(arr, target, type, componentType, normalized, minmax) {
  while (byteLen % 4) {
    chunks.push(Buffer.alloc(1));
    byteLen++;
  }
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: byteLen, byteLength: buf.length, target });
  chunks.push(buf);
  byteLen += buf.length;
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  const a = { bufferView: bufferViews.length - 1, componentType, count: arr.length / n, type };
  if (normalized) a.normalized = true;
  if (minmax) Object.assign(a, minmax);
  accessors.push(a);
  return accessors.length - 1;
}
const prims = [];
let totV = 0,
  totT = 0;
for (const p of j.meshes[0].primitives) {
  const P = acc(p.attributes.POSITION),
    N = acc(p.attributes.NORMAL),
    I = acc(p.indices);
  const nv = P.length / 3;
  const key = new Map();
  const remap = new Uint32Array(nv);
  const sumP = [],
    sumN = [],
    cnt = [];
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3],
      y = P[v * 3 + 1],
      z = P[v * 3 + 2],
      nx = N[v * 3],
      ny = N[v * 3 + 1],
      nz = N[v * 3 + 2];
    // normal bucket ~ 40deg so creases survive
    const k =
      Math.round(x / CELL) +
      "," +
      Math.round(y / CELL) +
      "," +
      Math.round(z / CELL) +
      "|" +
      Math.round(nx * 1.5) +
      "," +
      Math.round(ny * 1.5) +
      "," +
      Math.round(nz * 1.5);
    let id = key.get(k);
    if (id === undefined) {
      id = cnt.length;
      key.set(k, id);
      sumP.push(0, 0, 0);
      sumN.push(0, 0, 0);
      cnt.push(0);
    }
    remap[v] = id;
    sumP[id * 3] += x;
    sumP[id * 3 + 1] += y;
    sumP[id * 3 + 2] += z;
    sumN[id * 3] += nx;
    sumN[id * 3 + 1] += ny;
    sumN[id * 3 + 2] += nz;
    cnt[id]++;
  }
  const m = cnt.length;
  const pos = new Float32Array(m * 3),
    nor = new Int8Array(m * 4);
  const min = [1e9, 1e9, 1e9],
    max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m; i++) {
    for (let c = 0; c < 3; c++) {
      pos[i * 3 + c] = sumP[i * 3 + c] / cnt[i];
      min[c] = Math.min(min[c], pos[i * 3 + c]);
      max[c] = Math.max(max[c], pos[i * 3 + c]);
    }
    const l = Math.hypot(sumN[i * 3], sumN[i * 3 + 1], sumN[i * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) nor[i * 4 + c] = Math.round((sumN[i * 3 + c] / l) * 127);
  }
  const out = [];
  const seen = new Set();
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]],
      c = remap[I[t + 1]],
      d = remap[I[t + 2]];
    if (a === c || c === d || a === d) continue;
    const s = [a, c, d].sort((u, v) => u - v).join(",");
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(a, c, d);
  }
  const idx = m < 65536 ? new Uint16Array(out) : new Uint32Array(out);
  const posA = push(pos, 34962, "VEC3", 5126, false, { min, max });
  const norA = push(nor, 34962, "VEC4", 5120, true);
  // three reads byte-stride from the view; a VEC4 int8 accessor read as normal uses itemSize 4 -> use VEC3 with stride 4 instead
  accessors[norA].type = "VEC3";
  bufferViews[accessors[norA].bufferView].byteStride = 4;
  const idxA = push(idx, 34963, "SCALAR", m < 65536 ? 5123 : 5125);
  prims.push({ attributes: { POSITION: posA, NORMAL: norA }, indices: idxA, material: p.material });
  totV += m;
  totT += out.length / 3;
  console.log("mat", p.material, nv, "->", m, "verts;", I.length / 3, "->", out.length / 3, "tris");
}
const outJ = {
  asset: { version: "2.0", generator: "Stamply stamper (optimised for web)" },
  extensionsUsed: ["KHR_mesh_quantization"],
  extensionsRequired: ["KHR_mesh_quantization"],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "Stamply stamper", mesh: 0 }],
  meshes: [{ name: "stamper", primitives: prims }],
  materials: j.materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: byteLen }],
};
while (byteLen % 4) {
  chunks.push(Buffer.alloc(1));
  byteLen++;
}
outJ.buffers[0].byteLength = byteLen;
let js = Buffer.from(JSON.stringify(outJ));
const pad = (4 - (js.length % 4)) % 4;
js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
const binBuf = Buffer.concat(chunks);
const h = Buffer.alloc(12);
h.writeUInt32LE(0x46546c67, 0);
h.writeUInt32LE(2, 4);
h.writeUInt32LE(12 + 8 + js.length + 8 + binBuf.length, 8);
const c1 = Buffer.alloc(8);
c1.writeUInt32LE(js.length, 0);
c1.writeUInt32LE(0x4e4f534a, 4);
const c2 = Buffer.alloc(8);
c2.writeUInt32LE(binBuf.length, 0);
c2.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outPath, Buffer.concat([h, c1, js, c2, binBuf]));
console.log(
  "total",
  totV,
  "verts",
  totT,
  "tris",
  (fs.statSync(outPath).size / 1e6).toFixed(2),
  "MB",
);
