import { writeFile, mkdir } from 'fs/promises'

const armors = [
  'chainmail_boots',
  'chainmail_chestplate',
  'chainmail_helmet',
  'chainmail_leggings',
  'diamond_boots',
  'diamond_chestplate',
  'diamond_helmet',
  'diamond_leggings',
  'golden_boots',
  'golden_chestplate',
  'golden_helmet',
  'golden_leggings',
  'iron_boots',
  'iron_chestplate',
  'iron_helmet',
  'iron_leggings',
  'leather_boots',
  'leather_chestplate',
  'leather_helmet',
  'leather_leggings',
  'netherite_boots',
  'netherite_chestplate',
  'netherite_helmet',
  'netherite_leggings',
  'turtle_helmet'
]

const materials = {
  blaze_rod: 0.01,
  bone: 0.02,
  coal: 0.03,
  dragon_breath: 0.04,
  echo_shard: 0.05,
  end_crystal: 0.06,
  ender_pearl: 0.07,
  experience_bottle: 0.08,
  fire_charge: 0.09,
  quartz: 0.1,
  glow_ink: 0.11,
  glowstone: 0.12,
  gunpowder: 0.13,
  heart_of_the_sea: 0.14,
  rabbit_hide: 0.15,
  honeycomb: 0.16,
  leather: 0.17,
  nautilus: 0.18,
  nether_star: 0.19,
  iron: 0.2,
  nether_brick: 0.21,
  netherite_scrap: 0.22,
  phantom_membrane: 0.23,
  prismarine: 0.24,
  prismarine_crystals: 0.25,
  purpur: 0.26,
  turtle_scute: 0.27,
  slime: 0.28,
  breeze_rod: 0.29,
  netherite: 0.3,
  armadillo_scute: 0.31,
  redstone: 0.4,
  copper: 0.5,
  gold: 0.6,
  emerald: 0.7,
  diamond: 0.8,
  lapis: 0.9,
  amethyst: 1.0
}

const armorMaterials = [
  'blaze_rod',
  'bone',
  'coal',
  'dragon_breath',
  'echo_shard',
  'end_crystal',
  'ender_pearl',
  'experience_bottle',
  'fire_charge',
  'glow_ink',
  'glowstone',
  'gunpowder',
  'heart_of_the_sea',
  'rabbit_hide',
  'honeycomb',
  'leather',
  'nautilus',
  'nether_star',
  'nether_brick',
  'netherite_scrap',
  'phantom_membrane',
  'prismarine',
  'prismarine_crystals',
  'purpur',
  'turtle_scute',
  'slime',
  'breeze_rod',
  'armadillo_scute'
]

function writeJsonWithFloats(value: any, replacer?: (number | string)[] | null, space?: string | number) {
  return JSON.stringify(value, replacer, space).replace(/"[\d]+\.\d+"/g, match => match.replace(/"/g, ''))
}

async function writeItemModels() {
  const promises: Promise<void>[] = []
  
  await mkdir(`./generator/output/assets/minecraft/models/item`, { recursive: true })

  for (const armor of armors) {
    let [armorMaterial, armorName] = armor.split('_')

    if (!armorName) {
      armorName = armorMaterial
      armorMaterial = ''
    }

    await mkdir(`./generator/output/assets/more_armor_trim/models/item`, { recursive: true })
    
    const overrides: { model: string, predicate: { trim_type: string } }[] = []

    for (const [, [material]] of Object.entries(materials).entries()) {
      // Check if number has two decimals
      const hasTwoDecimals = (materials[material] as number).toFixed(2).at(-1) !== '0'
      overrides.push({
        model: hasTwoDecimals // If number has two decimals, it means it's a new material
          ? `more_armor_trim:item/${armor}_${material}_trim`
          : `minecraft:item/${armor}_${material}_trim`,
        predicate: {
          // Restore the number to a string with the correct amount of decimals.
          // NOTE: This object will have to be stringified with writeJsonWithFloats for the decimals to be preserved
          trim_type: materials[material].toFixed(hasTwoDecimals ? 2 : 1)
        }
      })
    }

    for (const armorMaterial of armorMaterials) {
      const modelFile = `./generator/output/assets/more_armor_trim/models/item/${armor}_${armorMaterial}_trim.json`
      const modelContents = {
        parent: 'minecraft:item/generated',
        textures: {
          layer0: `minecraft:item/${armor}`,
          layer1: `more_armor_trim:trims/items/${armorName}_trim_${armorMaterial}`
        }
      }
      promises.push(writeFile(modelFile, JSON.stringify(modelContents, null, 2)))
    }

    const armorFile = `./generator/output/assets/minecraft/models/item/${armor}.json`
    const armorContents = {
      parent: 'minecraft:item/generated',
      textures: {
        layer0: `minecraft:item/${armor}`
      },
      overrides
    }
    promises.push(writeFile(armorFile, writeJsonWithFloats(armorContents, null, 2)))
  }

  return Promise.all(promises)
}

writeItemModels()