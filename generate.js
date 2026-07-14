const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

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
const armor_material_list = ['netherite', 'chainmail', 'copper', 'diamond', 'golden', 'iron', 'leather', 'turtle']
const tool_material_list = ['copper', 'diamond', 'golden', 'iron', 'netherite', 'stone', 'wooden']

fs.mkdirSync(GENERATED_MODELS_OUTPUT_PATH, { recursive: true })
fs.mkdirSync(GENERATED_TEXTURE_OUTPUT_PATH, { recursive: true })

function loadFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath)
}

function generateJsonModel(trim, item, material) {
  const model = {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: `minecraft:item/${material}_${item}_${trim}_trim`
    }
  }
  const outputPath = path.join(GENERATED_MODELS_OUTPUT_PATH, `${material}_${item}_${trim}_trim.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(model, null, 2))
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

function saveGeneratedTexture(textureBuffer, material, item, trim) {
  const outputPath = path.join(GENERATED_TEXTURE_OUTPUT_PATH, `${material}_${item}_${trim}_trim.png`)
  fs.writeFileSync(outputPath, textureBuffer)
}

async function run() {
  const itemBufferMap = new Map()

  // Chargement des textures d'armures
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
      }
    }
  }

  // Chargement des textures d'outils
  for (const tool of tool_list) {
    for (const material of tool_material_list) {
      const key = `${material}_${tool}`
      try {
        const buf = loadFile(path.join(ITEM_TEXTURE_PATH, `${material}_tool/${material}_${tool}.png`))
        itemBufferMap.set(key, buf)
      } catch (err) {
        console.warn(`Warning: Could not load texture for ${key}: ${err.message}`)
      }
    }
  }

  // Chargement des textures de trim (en conservant leurs couleurs d'origine)
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
    }
  })))

  console.log(`Chargé ${itemBufferMap.size} textures d'items et ${trimRawMap.size} textures de trim.`)

  const tasks = []

  for (const trim of trim_list) {
    // Traitement des armures
    for (const armor of armor_list) {
      const trimKey = `${armor}_${trim}`
      const trimRaw = trimRawMap.get(trimKey)
      if (!trimRaw) continue

      const { pixels: trimPixels, width, height } = trimRaw

      for (const material of armor_material_list) {
        if (armor !== 'helmet' && material === 'turtle') continue

        const itemKey = `${material}_${armor}`
        const itemBuffer = itemBufferMap.get(itemKey)
        if (!itemBuffer) continue

        tasks.push(async () => {
          const finalBuffer = await compositeAndEncode(trimPixels, itemBuffer, width, height)
          saveGeneratedTexture(finalBuffer, material, armor, trim)
          generateJsonModel(trim, armor, material)
          showProgression()
        })
      }
    }

    // Traitement des outils / armes
    for (const tool of tool_list) {
      const trimKey = `${tool}_${trim}`
      const trimRaw = trimRawMap.get(trimKey)
      if (!trimRaw) continue

      const { pixels: trimPixels, width, height } = trimRaw

      for (const material of tool_material_list) {
        const itemKey = `${material}_${tool}`
        const itemBuffer = itemBufferMap.get(itemKey)
        if (!itemBuffer) continue

        tasks.push(async () => {
          const finalBuffer = await compositeAndEncode(trimPixels, itemBuffer, width, height)
          saveGeneratedTexture(finalBuffer, material, tool, trim)
          generateJsonModel(trim, tool, material)
          showProgression()
        })
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