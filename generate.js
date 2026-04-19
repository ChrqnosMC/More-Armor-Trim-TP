const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const PALETTE_PATH = path.join(__dirname, 'textures/trims/color_palettes')
const PALETTE_TEMPLATE_PATH = path.join(__dirname, 'textures/trims/color_palettes/trim_palette.png')
const TRIM_TEXTURE_PATH = path.join(__dirname, 'textures/trims/items')
const ITEM_TEXTURE_PATH = path.join(__dirname, 'textures/item')
const GENERATED_MODELS_OUTPUT_PATH = path.join(__dirname, 'generated_models')
const GENERATED_TEXTURE_OUTPUT_PATH = path.join(__dirname, 'generated_textures')

const CONCURRENCY_LIMIT = 16

const trim_list = [
  'bolt', 'coast', 'dune', 'eye', 'flow', 'host', 'raiser', 'rib', 'sentry',
  'shaper', 'silence', 'snout', 'spire', 'tide', 'vex', 'ward', 'wayfinder', 'wild'
]
const armor_list = ['chestplate', 'boots', 'helmet', 'leggings']
const tool_list = ['axe', 'hoe', 'pickaxe', 'shovel', 'spear', 'spear_in_hand', 'sword']
const armor_material_list = ['netherite', 'chainmail', 'copper', 'diamond', 'golden', 'iron', 'leather', 'turtle_shell']
const tool_material_list = ['copper', 'diamond', 'golden', 'iron', 'netherite', 'stone', 'wooden']

const palette_list = fs.readdirSync(PALETTE_PATH).map(file => path.parse(file).name)

fs.mkdirSync(GENERATED_MODELS_OUTPUT_PATH, { recursive: true })
fs.mkdirSync(GENERATED_TEXTURE_OUTPUT_PATH, { recursive: true })

function loadFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath)
}

async function extractRawPixels(imageBuffer) {
  const { data, info } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true })
  return { pixels: new Uint8Array(data.buffer), width: info.width, height: info.height, channels: info.channels || 3 }
}

function buildPaletteIndexMap(templatePixels, channels) {
  const paletteIndexMap = new Map()
  const total = templatePixels.length / channels
  for (let i = 0; i < total; i++) {
    const base = i * channels
    const key = (templatePixels[base] << 16) | (templatePixels[base + 1] << 8) | templatePixels[base + 2]
    if (!paletteIndexMap.has(key)) paletteIndexMap.set(key, i)
  }
  return paletteIndexMap
}

function generateJsonModel(trim, palette, item, material) {
  const model = {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: `minecraft:item/${material}_${item}_${trim}_trim_${palette}`
    }
  }
  const outputPath = path.join(GENERATED_MODELS_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${palette}.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(model, null, 2))
}

async function applyPaletteToTrim(trimRaw, paletteRaw, templateIndexMap) {
  const src = trimRaw.pixels
  const palSrc = paletteRaw.pixels
  const palChannels = paletteRaw.channels

  const width = trimRaw.width
  const height = trimRaw.height
  const out = Buffer.allocUnsafe(width * height * 4)

  for (let i = 0, o = 0; i < src.length; i += 4, o += 4) {
    const r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3]
    const key = (r << 16) | (g << 8) | b
    const idx = templateIndexMap.get(key)
    if (idx === undefined) {
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a
    } else {
      const palBase = idx * palChannels
      out[o] = palSrc[palBase]
      out[o + 1] = palSrc[palBase + 1]
      out[o + 2] = palSrc[palBase + 2]
      out[o + 3] = a
    }
  }
  return out
}

async function compositeAndEncode(trimPixels, itemBuffer, width, height) {
  const { data } = await sharp(itemBuffer).raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data) // Copie des données de l'item

  for (let i = 0; i < trimPixels.length; i += 4) {
    const ta = trimPixels[i + 3]
    if (ta === 0) continue
    if (ta === 255) {
      out[i] = trimPixels[i]
      out[i + 1] = trimPixels[i + 1]
      out[i + 2] = trimPixels[i + 2]
      out[i + 3] = 255
    } else {
      const ia = out[i + 3]
      const a = ta / 255
      out[i] = Math.round(trimPixels[i] * a + out[i] * (1 - a))
      out[i + 1] = Math.round(trimPixels[i + 1] * a + out[i + 1] * (1 - a))
      out[i + 2] = Math.round(trimPixels[i + 2] * a + out[i + 2] * (1 - a))
      out[i + 3] = Math.min(255, ta * ia)
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

async function runConcurrent(tasks, limit) {
  const results = []
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

function saveGeneratedTexture(textureBuffer, material, item, trim, palette) {
  const outputPath = path.join(GENERATED_TEXTURE_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${palette}.png`)
  fs.writeFileSync(outputPath, textureBuffer)
}

async function run() {
  // Récupère les pixels du modèle de palette de couleurs
  const color_palette_template_buffer = fs.readFileSync(PALETTE_TEMPLATE_PATH)
  const templateRaw = await extractRawPixels(color_palette_template_buffer)
  const templateIndexMap = buildPaletteIndexMap(templateRaw.pixels, templateRaw.channels)

  const paletteRawMap = new Map()
  await Promise.all(palette_list.filter(p => p !== 'trim_palette').map(async palette => {
    const buf = loadFile(path.join(PALETTE_PATH, `${palette}.png`))
    paletteRawMap.set(palette, await extractRawPixels(buf))
  }))

  const itemBufferMap = new Map()
  
  for (const armor of armor_list) {
    for (const material of armor_material_list) {
      const key = `${material}_${armor}`
      if (material === 'turtle_shell' && armor !== 'helmet') continue
            try {
        const buf = material === 'turtle_shell'
          ? loadFile(path.join(ITEM_TEXTURE_PATH, 'turtle_helmet.png'))
          : loadFile(path.join(ITEM_TEXTURE_PATH, `${material}_armor/${material}_${armor}.png`))
        itemBufferMap.set(key, buf)
      } catch (err) {
        console.warn(`Warning: Could not load texture for ${key}: ${err.message}`)
        console.error(err)
      }
    }
  }

  for (const tool of tool_list) {
    for (const material of tool_material_list) {
      const key = `${material}_${tool}`
      try {
        const buf = loadFile(path.join(ITEM_TEXTURE_PATH, `${material}_tool/${material}_${tool}.png`))
        itemBufferMap.set(key, buf)
      } catch (err) {
        console.warn(`Warning: Could not load texture for ${key}: ${err.message}`)
        console.error(err)
      }
    }
  }

  const trimRawMap = new Map()
  const allItems = [...armor_list, ...tool_list]

  await Promise.all(trim_list.flatMap(trim => allItems.map(async item => {
    const key = `${item}_${trim}`
    try {
      const buf = loadFile(path.join(TRIM_TEXTURE_PATH, `${item}_trim/${trim}.png`))
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      trimRawMap.set(key, { pixels: new Uint8Array(data.buffer), width: info.width, height: info.height, channels: 4 })
    } catch (err) {
      console.warn(`Warning: Could not load trim texture for ${key}: ${err.message}`)
      console.error(err)
    }
  })))

  console.log(`Chargé ${paletteRawMap.size} palettes, ${itemBufferMap.size} textures d'items et ${trimRawMap.size} textures de trim.`)

  const tasks = []
  const activePalettes = palette_list.filter(p => p !== 'trim_palette')

  for (const trim of trim_list) {
    for (const palette of palette_list) {
      const paletteRaw = paletteRawMap.get(palette)
      if (!paletteRaw) continue

      const paletteCache = new Map()

      for (const armor of armor_list) {
        const trimKey = `${armor}_${trim}`
        const trimRaw = trimRawMap.get(trimKey)
        if (!trimRaw) continue

        if (!paletteCache.has(armor)) {
          paletteCache.set(armor, applyPaletteToTrim(trimRaw, paletteRaw, templateIndexMap))
        }
        const recoloredTrimPixels = await paletteCache.get(armor)

        for (const material of armor_material_list) {
          if (armor !== 'helmet' && material === 'turtle_shell') continue

          const isDarker = palette.endsWith('_darker')
          if (isDarker && !palette.startsWith(material)) continue
          if (!isDarker && palette === material) continue

          const itemKey = `${material}_${armor}`
          const itemBuffer = itemBufferMap.get(itemKey)
          if (!itemBuffer) continue

          const { width, height } = trimRaw
          tasks.push(async () => {
            const finalBuffer = await compositeAndEncode(recoloredTrimPixels, itemBuffer, width, height)
            saveGeneratedTexture(finalBuffer, material, armor, trim, palette)
            generateJsonModel(trim, palette, armor, material)
          })
        }
      }

      paletteCache.clear()

      for (const tool of tool_list) {
        const trimKey = `${tool}_${trim}`
        const trimRaw = trimRawMap.get(trimKey)
        if (!trimRaw) continue

        if (!paletteCache.has(tool)) {
          paletteCache.set(tool, applyPaletteToTrim(trimRaw, paletteRaw, templateIndexMap))
        }
        const recoloredTrimPixels = await paletteCache.get(tool)

        for (const material of tool_material_list) {
          const isDarker = palette.endsWith('_darker')
          if (isDarker && !palette.startsWith(material)) continue
          if (!isDarker && palette === material) continue

          const itemKey = `${material}_${tool}`
          const itemBuffer = itemBufferMap.get(itemKey)
          if (!itemBuffer) continue

          const { width, height } = trimRaw
          tasks.push(async () => {
            const finalBuffer = await compositeAndEncode(recoloredTrimPixels, itemBuffer, width, height)
            saveGeneratedTexture(finalBuffer, material, tool, trim, palette)
            generateJsonModel(trim, palette, tool, material)
          })
        }
      }
    }
  }

  console.log(`Génération de ${tasks.length} textures et modèles...`)
  await runConcurrent(tasks, CONCURRENCY_LIMIT)
  console.log('Génération terminée.')
}

run()