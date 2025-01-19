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
  'quartz',
  'iron',
  'netherite',
  'redstone',
  'copper',
  'gold',
  'emerald',
  'diamond',
  'lapis',
  'amethyst',
  'resin',
  // <11
  'armadillo_scute',
  'blaze_rod',
  'bone',
  'breeze_rod',
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
  'honeycomb',
  'leather',
  'nautilus',
  'nether_brick',
  'nether_star',
  'netherite_scrap',
  'phantom_membrane',
  'prismarine_crystals',
  'prismarine',
  'purpur',
  'rabbit_hide',
  'slime',
  'turtle_scute'
]

async function writeItemModels() {
  const promises: Promise<void>[] = []
  
  await mkdir(`./generator/output/assets/minecraft/items`, { recursive: true })

  const leatherFallback = {
    tints: [
      {
        type: `minecraft:dye`,
        default: -6265536
      }
    ]
  }

  for (const armor of armors) {
    let [armorMaterial, armorName] = armor.split('_')

    if (!armorName) {
      armorName = armorMaterial
      armorMaterial = ''
    }
    
    const customModelDataCases: { model: { type: string, model: string }, when: string }[] = []

    for (const [materialIndex, material] of materials.entries()) {
        customModelDataCases.push({
        model: {
          type: `minecraft:model`,
          model: materialIndex < 11 ? `minecraft:item/${armor}_${material}_trim` : `more_armor_trim:item/${armor}_${material}_trim`,
          ...(armorMaterial === 'leather' ? leatherFallback : {})
        },
        when: materialIndex < 11 ? `minecraft:${material}` : `more_armor_trim:${material}`
      })
    }

    const armorFile = `./generator/output/assets/minecraft/items/${armor}.json`
    const armorContents = {
      model: {
        type: 'minecraft:select',
        cases: customModelDataCases,
        fallback: {
          type: `minecraft:model`,
          model: `minecraft:item/${armor}`,
          ...(armorMaterial === 'leather' ? leatherFallback : {})
        },
        property: `minecraft:trim_material`
      }
    }
    promises.push(writeFile(armorFile, JSON.stringify(armorContents, null, 2)))
  }

  return Promise.all(promises)
}

writeItemModels()