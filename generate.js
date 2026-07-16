const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const PALETTE_PATH = path.join(__dirname, 'textures/trims/color_palettes')
const PALETTE_TEMPLATE_PATH = path.join(__dirname, 'textures/trims/color_palettes/trim_palette.png')
const TRIM_TEXTURE_PATH = path.join(__dirname, 'textures/trims/items')
const ITEM_TEXTURE_PATH = path.join(__dirname, 'textures/item')
const GENERATED_MODELS_OUTPUT_PATH = path.join(__dirname, 'generated_models')
const GENERATED_RECIPES_OUTPUT_PATH = path.join(__dirname, 'generated_recipes')
const GENERATED_RECIPES2_OUTPUT_PATH = path.join(__dirname, 'generated_recipes2')
const GENERATED_TEXTURE_OUTPUT_PATH = path.join(__dirname, 'generated_textures')

const CONCURRENCY_LIMIT = 16

const trim_list = [
  'bolt', 'coast', 'dune', 'eye', 'flow', 'host', 'raiser', 'rib', 'sentry',
  'shaper', 'silence', 'snout', 'spire', 'tide', 'vex', 'ward', 'wayfinder', 'wild'
]
const armor_list = ['chestplate', 'boots', 'helmet', 'leggings']
const tool_list = ['axe', 'hoe', 'pickaxe', 'shovel', 'spear', 'spear_in_hand', 'sword']
const armor_material_list = ['netherite', 'chainmail', 'copper', 'diamond', 'golden', 'iron', 'leather', 'turtle']
const tool_material_list = ['copper', 'diamond', 'golden', 'iron', 'netherite', 'stone', 'wooden']

const palette_list = fs.readdirSync(PALETTE_PATH).map(file => path.parse(file).name)
const palette_ids = {
  'amethyst': 'amethyst_shard',
  'armadillo_scute': 'armadillo_scute',
  'blaze_rod': 'blaze_rod',
  'bone': 'bone',
  'breeze_rod': 'breeze_rod',
  'coal': 'coal',
  'copper_darker': 'copper_ingot',
  'copper': 'copper_ingot',
  'diamond_darker': 'diamond',
  'diamond': 'diamond',
  'dragon_breath': 'dragon_breath',
  'echo_shard': 'echo_shard',
  'emerald': 'emerald',
  'end_crystal': 'end_crystal',
  'ender_pearl': 'ender_pearl',
  'experience_bottle': 'experience_bottle',
  'fire_charge': 'fire_charge',
  'glow_ink': 'glow_ink_sac',
  'glowstone': 'glowstone_dust',
  'gold_darker': 'gold_ingot',
  'gold': 'gold_ingot',
  'gunpowder': 'gunpowder',
  'heart_of_the_sea': 'heart_of_the_sea',
  'honeycomb': 'honeycomb',
  'iron_darker': 'iron_ingot',
  'iron': 'iron_ingot',
  'lapis': 'lapis_lazuli',
  'leather': 'leather',
  'nautilus': 'nautilus_shell',
  'nether_brick': 'nether_brick',
  'nether_star': 'nether_star',
  'netherite_darker': 'netherite_ingot',
  'netherite_scrap': 'netherite_scrap',
  'netherite': 'netherite_ingot',
  'phantom_membrane': 'phantom_membrane',
  'prismarine_crystals': 'prismarine_crystals',
  'prismarine_shard': 'prismarine_shard',
  'purpur': 'popped_chorus_fruit',
  'quartz': 'quartz',
  'rabbit_hide': 'rabbit_hide',
  'redstone': 'redstone',
  'resin': 'resin_brick',
  'slime': 'slime_ball',
  'turtle_scute': 'turtle_scute'
}

fs.mkdirSync(GENERATED_MODELS_OUTPUT_PATH, { recursive: true })
fs.mkdirSync(GENERATED_RECIPES_OUTPUT_PATH, { recursive: true })
fs.mkdirSync(GENERATED_RECIPES2_OUTPUT_PATH, { recursive: true })
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

// Nettoie le nom de la palette pour le nom du fichier (retire _darker)
function getCleanPaletteName(palette) {
  return palette.endsWith('_darker') ? palette.replace('_darker', '') : palette;
}

function generateJsonModel(trim, palette, item, material) {
  const cleanPalette = getCleanPaletteName(palette)
  const model = {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: `minecraft:item/${material}_${item}_${trim}_trim_${cleanPalette}`
    }
  }
  const outputPath = path.join(GENERATED_MODELS_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${cleanPalette}.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(model, null, 2))
}

function generateFirstRecipe(trim, trim_index, palette, palette_item, item, material) {
  const cleanPalette = getCleanPaletteName(palette)
  const recipe = {
    type: 'minecraft:smithing_transform',
    base: {
      item: `minecraft:${material}_${item}`
    },
    addition: {
      item: `minecraft:${palette_item}`
    },
    template: {
      item: `minecraft:${trim}_armor_trim_smithing_template`
    },
    result: {
      id: `minecraft:${material}_${item}`,
      components: {
        'minecraft:trim': {
          material: `minecraft:${cleanPalette}`, // Suffixe _darker retiré ici
          pattern: `minecraft:${trim}`,
          show_in_tooltip: true
        },
        'minecraft:custom_model_data': trim_index + 1
      }
    }
  }
  const outputPath = path.join(GENERATED_RECIPES_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${cleanPalette}_smithing.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2))
}

function generateSecondRecipe(trim, trim_index, palette, palette_item, item, material) {
  const cleanPalette = getCleanPaletteName(palette)
  const recipe = {
    type: 'minecraft:smithing_transform',
    base: `minecraft:${material}_${item}`,
    addition: `minecraft:${palette_item}`,
    template: `minecraft:${trim}_armor_trim_smithing_template`,
    result: {
      id: `minecraft:${material}_${item}`,
      components: {
        'minecraft:trim': {
          material: `minecraft:${cleanPalette}`, // Suffixe _darker retiré ici
          pattern: `minecraft:${trim}`,
          show_in_tooltip: true
        },
        'minecraft:custom_model_data': trim_index + 1 
      }
    }
  }
  const outputPath = path.join(GENERATED_RECIPES2_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${cleanPalette}_smithing.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2))
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
  const out = Buffer.from(data)

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
  const cleanPalette = getCleanPaletteName(palette)
  const outputPath = path.join(GENERATED_TEXTURE_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${cleanPalette}.png`)
  fs.writeFileSync(outputPath, textureBuffer)
}

async function run() {
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
      if (material === 'turtle' && armor !== 'helmet') continue
      try {
        const buf = material === 'turtle'
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
          if (armor !== 'helmet' && material === 'turtle') continue

          const isDarker = palette.endsWith('_darker')
          if (isDarker && !palette.startsWith(material)) continue
          if (!isDarker && palette === material && palette !== 'leather') continue

          const itemKey = `${material}_${armor}`
          const itemBuffer = itemBufferMap.get(itemKey)
          if (!itemBuffer) continue

          const { width, height } = trimRaw
          tasks.push(async () => {
            const finalBuffer = await compositeAndEncode(recoloredTrimPixels, itemBuffer, width, height)
            saveGeneratedTexture(finalBuffer, material, armor, trim, palette)
            generateJsonModel(trim, palette, armor, material)
            generateFirstRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], armor, material)
            generateSecondRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], armor, material)
            showProgression()
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
            generateFirstRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], tool, material)
            generateSecondRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], tool, material)
            showProgression()
          })
        }
      }
    }
  }

  const showProgression = () => {
    completedTasks++
    if (completedTasks === 0) return
    if (completedTasks % 100 > 0) return
    console.log(`Progression: ${completedTasks}/${tasks.length}`)
  }

  console.log(`Génération de ${tasks.length} textures et modèles...`)
  let completedTasks = 0
  await runConcurrent(tasks, CONCURRENCY_LIMIT)
  console.log('Génération terminée.')
}

run()