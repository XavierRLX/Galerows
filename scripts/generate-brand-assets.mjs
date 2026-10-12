import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import opentype from 'opentype.js'

// Canonical artwork. All exported assets come from this geometry, never the concept PNG.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'public/assets/brand')
await fs.mkdir(output, { recursive: true })
const colors = { ink: '#101014', lime: '#D2F86A', lavender: '#B8A0FF', white: '#F5F3EF' }
const front = 'M196 38H86Q64 38 64 60V208Q64 230 86 230H196Q218 230 218 208V140Q218 122 200 122H149Q138 122 138 133V151Q138 162 149 162H174V184H126Q106 184 106 164V108Q106 88 126 88H218V60Q218 38 196 38Z'
const symbol = (mono, id = 'cards') => `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/><rect x="57" y="31" width="168" height="206" rx="29" transform="rotate(-9 141 134)" fill="black"/></mask></defs><rect x="23" y="22" width="156" height="192" rx="24" transform="rotate(-17 101 118)" fill="${mono || colors.lavender}" mask="url(#${id})"/><path d="${front}" transform="rotate(-9 141 134)" fill="${mono || colors.lime}"/>`
const svg = (body, w = 256, h = w, label = 'Galerows — Jogos da galera') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">${body}</svg>`
const mark = svg(symbol())
const icon = (scale = .78, round = false) => svg(`<${round ? 'circle cx="128" cy="128" r="128"' : 'rect width="256" height="256"'} fill="${colors.lavender}"/><g transform="translate(${128 * (1 - scale)} ${128 * (1 - scale)}) scale(${scale})">${symbol(colors.ink)}</g>`)
const adaptive = svg(`<g transform="translate(61.44 61.44) scale(.52)">${symbol(colors.ink)}</g>`)

const heading = opentype.parse(Uint8Array.from(await fs.readFile(path.join(root, 'public/assets/fonts/bricolage-800.ttf'))).buffer)
const body = opentype.parse(Uint8Array.from(await fs.readFile(path.join(root, 'public/assets/fonts/dm-sans-700.ttf'))).buffer)
function text(font, content, x, y, size, fill, tracking = 0) {
  const pieces = []
  for (const char of content) {
    const p = font.getPath(char, x, y, size)
    p.fill = fill
    pieces.push(p.toSVG(2))
    x += font.getAdvanceWidth(char, size) + tracking
  }
  return { svg: pieces.join(''), x }
}
function lockup(mono) {
  const word = text(heading, 'galerows', 178, 109, 103, mono || colors.white, -3.5)
  return svg(`<g transform="translate(0 3) scale(.67)">${symbol(mono)}</g>${word.svg}${text(heading, '.', word.x + 1, 109, 103, mono || colors.lime).svg}${text(body, 'JOGOS DA GALERA', 184, 150, 26, mono || colors.white, 7).svg}`, 710, 178)
}
const sources = {
  'galerows-mark.svg': mark,
  'galerows-mark-dark.svg': svg(symbol(colors.ink)),
  'galerows-mark-light.svg': svg(symbol(colors.white)),
  'galerows-logo.svg': lockup(),
  'galerows-logo-dark.svg': lockup(colors.ink),
  'galerows-logo-light.svg': lockup(colors.white),
  'galerows-app-icon.svg': icon(),
  'galerows-adaptive-foreground.svg': adaptive,
}
for (const [name, content] of Object.entries(sources)) await fs.writeFile(path.join(output, name), content)
async function png(source, destination, width, height = width, opaque = false) {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  let image = sharp(Buffer.from(source), { density: 288 }).resize(width, height)
  if (opaque) image = image.flatten({ background: colors.lavender }).removeAlpha()
  await image.png().toFile(destination)
}
await png(icon(), path.join(output, 'galerows-app-icon-1024.png'), 1024, 1024, true)
await png(icon(), path.join(output, 'galerows-app-icon-512.png'), 512, 512, true)
await png(icon(), path.join(output, 'galerows-app-icon-192.png'), 192, 192, true)
await png(icon(.64), path.join(output, 'galerows-maskable-512.png'), 512, 512, true)
await png(icon(), path.join(root, 'public/apple-touch-icon.png'), 180, 180, true)
await png(icon(), path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), 1024, 1024, true)
await sharp(Buffer.from(icon())).resize(512).webp({ lossless: true }).toFile(path.join(root, 'public/icon-galerows.webp'))
// Favicons omit the secondary card for a clean 16px silhouette.
await fs.writeFile(path.join(root, 'public/favicon.svg'), svg(`<rect width="256" height="256" rx="52" fill="${colors.lavender}"/><g transform="translate(13 13) scale(.9)"><path d="${front}" transform="rotate(-9 141 134)" fill="${colors.ink}"/></g>`))
for (const size of [16, 32, 48]) await png(await fs.readFile(path.join(root, 'public/favicon.svg'), 'utf8'), path.join(output, `favicon-${size}.png`), size)

const res = path.join(root, 'android/app/src/main/res')
for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const dir = path.join(res, `mipmap-${density}`)
  await png(icon(.70), path.join(dir, 'ic_launcher.png'), 48 * scale, 48 * scale, true)
  await png(icon(.70, true), path.join(dir, 'ic_launcher_round.png'), 48 * scale)
  await png(adaptive, path.join(dir, 'ic_launcher_foreground.png'), 108 * scale)
  await png(adaptive, path.join(dir, 'ic_launcher_monochrome.png'), 108 * scale)
}
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  const layers = (mono) => `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>${mono ? '\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>' : ''}\n</adaptive-icon>\n`
  for (const [version, monochrome] of [[26, false], [33, true]]) {
    const dir = path.join(res, `mipmap-anydpi-v${version}`)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, `${name}.xml`), layers(monochrome))
  }
}
await fs.writeFile(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">${colors.lavender}</color></resources>\n`)

// Preserve each splash canvas size; only replace its stock artwork.
const splash = (width, height) => {
  const size = Math.min(width, height) * .24
  return svg(`<rect width="${width}" height="${height}" fill="${colors.ink}"/><g transform="translate(${(width - size) / 2} ${(height - size) / 2}) scale(${size / 256})">${symbol()}</g>`, width, height)
}
for (const dir of await fs.readdir(res)) {
  if (!dir.startsWith('drawable')) continue
  const file = path.join(res, dir, 'splash.png')
  try {
    const { width, height } = await sharp(file).metadata()
    await png(splash(width, height), `${file}.new.png`, width, height)
    await fs.rename(`${file}.new.png`, file)
  } catch (error) { if (error.code !== 'ENOENT' && !error.message.includes('Input file is missing')) throw error }
}
const iosSplash = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
for (const name of (await fs.readdir(iosSplash)).filter((name) => name.endsWith('.png'))) {
  const file = path.join(iosSplash, name)
  const { width, height } = await sharp(file).metadata()
  await png(splash(width, height), `${file}.new.png`, width, height)
  await fs.rename(`${file}.new.png`, file)
}

// Review sheet includes exact exported art and actual-size small marks.
const sizes = [16, 24, 32, 48]
let small = ''
for (const [index, size] of sizes.entries()) small += `<g transform="translate(${790 + index * 85} 659) scale(${size / 256})">${symbol(undefined, `small-${size}`)}</g>${text(body, `${size}px`, 788 + index * 85, 730, 13, colors.white).svg}`
const sheet = svg(`<rect width="1200" height="800" fill="${colors.ink}"/>${text(body, 'GALEROWS / IDENTIDADE VISUAL', 55, 54, 14, colors.white, 3).svg}<svg x="85" y="153" width="1030" height="258" viewBox="0 0 710 178">${lockup().match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1].replaceAll('cards', 'main-cards')}</svg><path d="M0 470H1200" stroke="#ffffff33"/><rect y="471" width="410" height="329" fill="${colors.white}"/><g transform="translate(130 514) scale(.58)">${symbol(colors.ink, 'mono')}</g>${text(body, 'VERSÃO MONOCROMÁTICA', 54, 741, 12, colors.ink, 2).svg}<svg x="473" y="530" width="170" height="170" viewBox="0 0 256 256">${icon().match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1].replaceAll('cards', 'app-cards')}</svg>${text(body, 'ÍCONE DO APP', 476, 741, 12, colors.white, 2).svg}${text(body, 'REDUÇÕES REAIS', 788, 548, 12, colors.white, 2).svg}${small}`, 1200, 800)
await fs.writeFile(path.join(root, 'docs/brand/identidade-final.svg'), sheet)
await png(sheet, path.join(root, 'docs/brand/identidade-final.png'), 1200, 800)
console.log('Brand SVGs, web icons, Android/iOS icons, splash screens and review sheet exported.')
