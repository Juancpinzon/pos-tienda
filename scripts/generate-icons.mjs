// Genera los iconos PWA con fondo navy (#1E3A5F) sin dependencias externas.
// Uso: node scripts/generate-icons.mjs

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

function uint32BE(n) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(n, 0)
  return buf
}

// Tabla CRC32 para chunks PNG
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const byte of buf) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xFF]
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const combined = Buffer.concat([t, data])
  return Buffer.concat([uint32BE(data.length), t, data, uint32BE(crc32(combined))])
}

function solidPNG(size, r, g, b) {
  // Scanline: filtro 0 + RGB por píxel (todos el mismo color)
  const scanline = Buffer.alloc(1 + size * 3)
  scanline[0] = 0
  for (let x = 0; x < size; x++) {
    scanline[1 + x * 3]     = r
    scanline[1 + x * 3 + 1] = g
    scanline[1 + x * 3 + 2] = b
  }
  // Todas las filas idénticas
  const raw = Buffer.concat(Array.from({ length: size }, () => scanline))

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', Buffer.concat([uint32BE(size), uint32BE(size), Buffer.from([8, 2, 0, 0, 0])])),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Navy #1E3A5F → RGB(30, 58, 95)
const [r, g, b] = [0x1E, 0x3A, 0x5F]

mkdirSync('./public/icons', { recursive: true })
writeFileSync('./public/icons/icon-192.png', solidPNG(192, r, g, b))
writeFileSync('./public/icons/icon-512.png', solidPNG(512, r, g, b))
console.log('✓ icon-192.png y icon-512.png generados con fondo navy #1E3A5F')
