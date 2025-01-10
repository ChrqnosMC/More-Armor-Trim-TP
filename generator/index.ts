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

const materials = [
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

async function writeItemModels() {
  const promises: Promise<void>[] = []

  for (const armor of armors) {
    let [armorMaterial, armorName] = armor.split('_')

    if (!armorName) {
      armorName = armorMaterial
      armorMaterial = ''
    }

    await mkdir(`./generator/output/assets/more_armor_trim/models/item`, { recursive: true })

    for (const material of materials) {
      const modelFile = `./generator/output/assets/more_armor_trim/models/item/${armor}_${material}_trim.json`
      const modelContents = {
        parent: 'minecraft:item/generated',
        textures: {
          layer0: `minecraft:item/${armor}`,
          layer1: `more_armor_trim:trims/items/${armorName}_trim_${material}`
        }
      }
      promises.push(writeFile(modelFile, JSON.stringify(modelContents, null, 2)))
    }
  }

  return Promise.all(promises)
}

writeItemModels()