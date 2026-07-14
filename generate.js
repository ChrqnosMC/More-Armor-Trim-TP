const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const PALETTE_PATH = path.join(__dirname, 'textures/trims/color_palettes')
const PALETTE_TEMPLATE_PATH = path.join(__dirname, 'textures/trims/color_palettes/trim_palette.png')
const TRIM_TEXTURE_PATH = path.join(__dirname, 'textures/trims/items')
const ITEM_TEXTURE_PATH = path.join(__dirname, 'textures/item')
const GENERATED_MODELS_OUTPUT_PATH = path.join(__dirname, 'generated_models')
const GENERATED_RECIPES_OUTPUT_PATH = path.join(__dirname, 'generated_recipes')
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

// Nettoie le nom de la palette pour le nom du fichier (retire _darker)
function getCleanPaletteName(palette) {
  return palette.endsWith('_darker') ? palette.replace('_darker', '') : palette;
}

// Détermine si un matériau de palette est Vanilla (doit utiliser le namespace minecraft)
function getNamespaceForPalette(palette) {
  const cleanPalette = getCleanPaletteName(palette);
  const vanillaMaterials = [
    'amethyst', 'diamond', 'emerald', 'copper', 'iron', 
    'gold', 'resin', 'redstone', 'lapis', 'quartz', 'netherite'
  ];
  return vanillaMaterials.includes(cleanPalette) ? 'minecraft' : 'more_item_materials';
}

function generateJsonModel(trim, palette, item, material) {
  const cleanPalette = getCleanPaletteName(palette)
  const namespace = getNamespaceForPalette(palette)
  
  const model = {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: `minecraft:item/${material}_${item}_${trim}_trim`,
      layer1: `${namespace}:trims/items/${item}_trim_${trim}_${cleanPalette}`
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
      id: `minecraft:${material}_${item}`
    }
  }
  const outputPath = path.join(GENERATED_RECIPES_OUTPUT_PATH, `${material}_${item}_${trim}_trim_${cleanPalette}_smithing.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2))
}

// Retire les pixels du trim de l'item de base (Soustraction de pixels)
async function subtractTrimFromItem(itemBuffer, trimRaw, width, height) {
  const { data } = await sharp(itemBuffer).raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  const trimPixels = trimRaw.pixels

  for (let i = 0; i < out.length; i += 4) {
    const trimAlpha = trimPixels[i + 3]
    // Si le pixel du trim est visible (non transparent), on le retire de l'item
    if (trimAlpha > 0) {
      // Pour une suppression brute, on met l'alpha de l'item de base à 0
      out[i + 3] = 0
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

function saveGeneratedTexture(textureBuffer, material, item, trim) {
  const outputPath = path.join(GENERATED_TEXTURE_OUTPUT_PATH, `${material}_${item}_${trim}_trim.png`)
  fs.writeFileSync(outputPath, textureBuffer)
}

async function run() {
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
  const generatedTexturesSet = new Set() // Empêche de régénérer plusieurs fois la même texture d'item "découpé"

  for (const trim of trim_list) {
    for (const palette of palette_list) {
      const paletteRaw = paletteRawMap.get(palette)
      if (!paletteRaw) continue

      // --- TRAITEMENT DES ARMURES ---
      for (const armor of armor_list) {
        const trimKey = `${armor}_${trim}`
        const trimRaw = trimRawMap.get(trimKey)
        if (!trimRaw) continue

        for (const material of armor_material_list) {
          if (armor !== 'helmet' && material === 'turtle') continue

          const isDarker = palette.endsWith('_darker')
          if (isDarker && !palette.startsWith(material)) continue
          if (!isDarker && palette === material && palette !== 'leather') continue

          const itemKey = `${material}_${armor}`
          const itemBuffer = itemBufferMap.get(itemKey)
          if (!itemBuffer) continue

          const { width, height } = trimRaw
          const textureUniqueKey = `${material}_${armor}_${trim}`

          tasks.push(async () => {
            // Ne génère la texture que si elle n'a pas déjà été faite (pour une autre palette)
            if (!generatedTexturesSet.has(textureUniqueKey)) {
              generatedTexturesSet.add(textureUniqueKey)
              const finalBuffer = await subtractTrimFromItem(itemBuffer, trimRaw, width, height)
              saveGeneratedTexture(finalBuffer, material, armor, trim)
            }
            
            generateJsonModel(trim, palette, armor, material)
            generateFirstRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], armor, material)
            showProgression()
          })
        }
      }

      // --- TRAITEMENT DES OUTILS ---
      for (const tool of tool_list) {
        const trimKey = `${tool}_${trim}`
        const trimRaw = trimRawMap.get(trimKey)
        if (!trimRaw) continue

        for (const material of tool_material_list) {
          const isDarker = palette.endsWith('_darker')
          if (isDarker && !palette.startsWith(material)) continue
          if (!isDarker && palette === material) continue

          const itemKey = `${material}_${tool}`
          const itemBuffer = itemBufferMap.get(itemKey)
          if (!itemBuffer) continue

          const { width, height } = trimRaw
          const textureUniqueKey = `${material}_${tool}_${trim}`

          tasks.push(async () => {
            // Ne génère la texture que si elle n'a pas déjà été faite (pour une autre palette)
            if (!generatedTexturesSet.has(textureUniqueKey)) {
              generatedTexturesSet.add(textureUniqueKey)
              const finalBuffer = await subtractTrimFromItem(itemBuffer, trimRaw, width, height)
              saveGeneratedTexture(finalBuffer, material, tool, trim)
            }
            
            generateJsonModel(trim, palette, tool, material)
            generateFirstRecipe(trim, trim_list.indexOf(trim), palette, palette_ids[palette], tool, material)
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

  console.log(`Génération de ${tasks.length} configurations de modèles...`)
  let completedTasks = 0
  await runConcurrent(tasks, CONCURRENCY_LIMIT)
  console.log('Génération terminée.')
}

run()