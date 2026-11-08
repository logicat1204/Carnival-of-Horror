import * as THREE from 'three'
import { seededRandom } from '../../shared/math'

/** Procedural textures keep the MVP free of binary asset dependencies. */

function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear el contexto 2D para texturas procedurales.')
  return context
}

function finishTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 4
  return texture
}

export function makeStripeTexture(colorA: string, colorB: string, stripes = 10): THREE.CanvasTexture {
  const ctx = canvas2d(512, 512)
  ctx.fillStyle = colorB
  ctx.fillRect(0, 0, 512, 512)
  const stripeWidth = 512 / stripes
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = colorA
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, 512)
  }
  // Vertical grime and fold lines.
  const random = seededRandom(stripes * 977 + colorA.length)
  ctx.globalAlpha = 0.18
  for (let i = 0; i < 70; i++) {
    const x = random() * 512
    ctx.fillStyle = random() > 0.5 ? '#000000' : '#ffffff'
    ctx.fillRect(x, 0, 1 + random() * 2, 512)
  }
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = '#120d0b'
    ctx.fillRect(0, random() * 512, 512, 1 + random() * 3)
  }
  return finishTexture(ctx.canvas, 1, 1)
}

export function makeDirtTexture(base: string, grit: string, size = 512): THREE.CanvasTexture {
  const ctx = canvas2d(size, size)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  const random = seededRandom(1949)
  for (let i = 0; i < 2600; i++) {
    const x = random() * size
    const y = random() * size
    const r = 0.4 + random() * 2.6
    ctx.globalAlpha = 0.05 + random() * 0.22
    ctx.fillStyle = random() > 0.42 ? grit : '#050403'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = '#0a0806'
  ctx.lineWidth = 1
  for (let i = 0; i < 40; i++) {
    ctx.beginPath()
    let x = random() * size
    let y = random() * size
    ctx.moveTo(x, y)
    for (let step = 0; step < 5; step++) {
      x += (random() - 0.5) * 60
      y += (random() - 0.5) * 60
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  return finishTexture(ctx.canvas, 10, 10)
}

export function makeGravelTexture(base: string, light: string): THREE.CanvasTexture {
  const ctx = canvas2d(512, 512)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  const random = seededRandom(771)
  for (let i = 0; i < 1800; i++) {
    ctx.globalAlpha = 0.12 + random() * 0.4
    ctx.fillStyle = random() > 0.5 ? light : '#14110d'
    const radius = 0.5 + random() * 3.2
    ctx.beginPath()
    ctx.ellipse(random() * 512, random() * 512, radius, radius * 0.6, random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  return finishTexture(ctx.canvas, 6, 6)
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(512, 512)
  ctx.fillStyle = '#5a3d27'
  ctx.fillRect(0, 0, 512, 512)
  const random = seededRandom(311)
  for (let plank = 0; plank < 8; plank++) {
    const y = plank * 64
    ctx.fillStyle = plank % 2 === 0 ? '#61442c' : '#523722'
    ctx.fillRect(0, y, 512, 62)
    ctx.strokeStyle = '#2f1e13'
    ctx.lineWidth = 3
    ctx.strokeRect(0, y, 512, 64)
    for (let grain = 0; grain < 18; grain++) {
      ctx.globalAlpha = 0.1 + random() * 0.18
      ctx.strokeStyle = random() > 0.5 ? '#2d1b10' : '#8a6542'
      ctx.lineWidth = 1
      ctx.beginPath()
      const gy = y + 5 + random() * 52
      ctx.moveTo(0, gy)
      ctx.bezierCurveTo(150, gy + (random() - 0.5) * 8, 350, gy + (random() - 0.5) * 8, 512, gy)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = '#241710'
    ctx.beginPath()
    ctx.arc(20 + random() * 20, y + 20 + random() * 24, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  return finishTexture(ctx.canvas, 1, 1)
}

export function makeSignTexture(text: string, accent: string): THREE.CanvasTexture {
  const ctx = canvas2d(512, 148)
  ctx.fillStyle = '#17100d'
  ctx.fillRect(0, 0, 512, 148)
  ctx.strokeStyle = accent
  ctx.lineWidth = 6
  ctx.strokeRect(9, 9, 494, 130)
  ctx.strokeStyle = '#3a2a1e'
  ctx.lineWidth = 2
  ctx.strokeRect(20, 20, 472, 108)
  ctx.fillStyle = accent
  ctx.font = 'bold 52px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.toUpperCase(), 256, 76, 452)
  // Age the sign.
  const random = seededRandom(text.length * 131)
  ctx.globalAlpha = 0.22
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = random() > 0.5 ? '#000000' : '#d9c8a6'
    ctx.fillRect(random() * 512, random() * 148, 2 + random() * 14, 1 + random() * 2)
  }
  return finishTexture(ctx.canvas, 1, 1)
}

export function makeGlowTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(128, 128)
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,235,190,1)')
  gradient.addColorStop(0.25, 'rgba(255,196,112,0.65)')
  gradient.addColorStop(0.6, 'rgba(255,150,70,0.18)')
  gradient.addColorStop(1, 'rgba(255,120,30,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return finishTexture(ctx.canvas, 1, 1)
}

export function makeTentValanceTexture(colorA: string, colorB: string): THREE.CanvasTexture {
  const ctx = canvas2d(512, 128)
  ctx.fillStyle = colorA
  ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = colorB
  for (let i = 0; i < 16; i++) {
    if (i % 2 === 0) continue
    ctx.beginPath()
    ctx.moveTo(i * 32, 128)
    ctx.lineTo(i * 32 + 16, 70)
    ctx.lineTo(i * 32 + 32, 128)
    ctx.closePath()
    ctx.fill()
  }
  return finishTexture(ctx.canvas, 1, 1)
}
