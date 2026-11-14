// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Generates assets/icon.ico (multi-size, PNG-compressed) and assets/icon.png
 * (512x512, used by Linux packages) without any image libraries.
 *   node scripts/make-icon.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZE = 512;
const SS = 4; // supersampling factor

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius && x >= left && x <= right && y >= top && y <= bottom;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSq);
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function render(size) {
  const big = size * SS;
  const pixels = new Float32Array(size * size * 4);

  const radius = big * 0.22;
  const margin = big * 0.03;
  const checkWidth = big * (size <= 24 ? 0.12 : 0.085);
  const points = [
    [big * 0.27, big * 0.53],
    [big * 0.43, big * 0.69],
    [big * 0.74, big * 0.34]
  ];

  for (let y = 0; y < big; y += 1) {
    for (let x = 0; x < big; x += 1) {
      const bg = insideRoundedRect(x, y, margin, margin, big - margin, big - margin, radius);
      if (!bg) continue;

      const t = y / big;
      const r = Math.round(59 + (29 - 59) * t);
      const g = Math.round(130 + (78 - 130) * t);
      const b = Math.round(246 + (216 - 246) * t);

      let pixel = [r, g, b, 255];

      const d1 = distanceToSegment(x, y, points[0][0], points[0][1], points[1][0], points[1][1]);
      const d2 = distanceToSegment(x, y, points[1][0], points[1][1], points[2][0], points[2][1]);
      const d = Math.min(d1, d2);
      if (d <= checkWidth / 2) {
        pixel = [255, 255, 255, 255];
      }

      const index = (Math.floor(y / SS) * size + Math.floor(x / SS)) * 4;
      pixels[index] += pixel[0];
      pixels[index + 1] += pixel[1];
      pixels[index + 2] += pixel[2];
      pixels[index + 3] += pixel[3];
    }
  }

  const samples = SS * SS;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    rgba[i * 4] = Math.round(pixels[i * 4] / samples);
    rgba[i * 4 + 1] = Math.round(pixels[i * 4 + 1] / samples);
    rgba[i * 4 + 2] = Math.round(pixels[i * 4 + 2] / samples);
    rgba[i * 4 + 3] = Math.round(pixels[i * 4 + 3] / samples);
  }
  return rgba;
}

/* ------------------------------- PNG ------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function toPng(rgba, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const icoImages = ICO_SIZES.map((size) => ({ size, png: toPng(render(size), size) }));
const ico = toIco(icoImages);
const png = toPng(render(PNG_SIZE), PNG_SIZE);

const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'icon.png'), png);
fs.writeFileSync(path.join(assets, 'icon.ico'), ico);

console.log(`assets/icon.ico: ${(ico.length / 1024).toFixed(1)} KB (${ICO_SIZES.join(', ')})`);
console.log(`assets/icon.png: ${(png.length / 1024).toFixed(1)} KB (${PNG_SIZE}x${PNG_SIZE})`);
