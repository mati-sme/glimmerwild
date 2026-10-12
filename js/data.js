// Static game data: elements, moves, traits, species, bosses.
export const TYPES = ['leaf', 'flame', 'tide', 'frost', 'terra', 'volt', 'murk'];
export const TYPE_NAMES = { leaf: 'Leaf', flame: 'Flame', tide: 'Tide', frost: 'Frost', terra: 'Terra', volt: 'Volt', murk: 'Murk', plain: 'Plain' };
export const TYPE_COLORS = { leaf: '#58b848', flame: '#e8582c', tide: '#3c80e0', frost: '#7fcfe8', terra: '#b8884c', volt: '#e8c818', murk: '#8050a8', plain: '#a0a0a0' };
// attacker type -> defender types it hits for x2 (reverse relation is x0.5)
export const TYPE_STRONG = {
  flame: ['leaf', 'frost'], tide: ['flame', 'terra'], leaf: ['tide', 'terra'], frost: ['leaf', 'volt'],
  terra: ['flame', 'volt'], volt: ['tide', 'murk'], murk: ['leaf', 'tide'],
};

const MOVE_NAMES = {
  leaf: ['Leaf Flick', 'Vine Lash', 'Bloom Burst'],
  flame: ['Ember Spit', 'Fire Fang', 'Inferno Roar'],
  tide: ['Splash Jet', 'Bubble Beam', 'Tidal Crash'],
  frost: ['Frost Nip', 'Ice Shard', 'Blizzard'],
  terra: ['Pebble Toss', 'Rock Slam', 'Quake Stomp'],
  volt: ['Spark', 'Zap Fang', 'Thunder Rush'],
  murk: ['Gloom Jab', 'Shadow Claw', 'Night Wave'],
};
export const MOVES = { plain: { id: 'plain', name: 'Tackle', type: 'plain', power: 40, acc: 100 } };
for (const t of TYPES) {
  [[40, 100], [62, 95], [88, 90]].forEach(([power, acc], i) => {
    MOVES[t + (i + 1)] = { id: t + (i + 1), name: MOVE_NAMES[t][i], type: t, power, acc };
  });
}

export const TRAITS = {
  Swift: { mult: { spd: 1.3 }, desc: 'Faster' },
  Sturdy: { mult: { hp: 1.15, def: 1.15 }, desc: 'Tougher' },
  Fierce: { mult: { atk: 1.25 }, desc: 'Hits harder' },
  Bright: { mult: {}, desc: '+25% XP' },
  Lucky: { mult: {}, desc: 'More crits' },
  Titan: { mult: { hp: 1.35, atk: 1.2, def: 1.2, spd: 1.1 }, desc: 'Boss power' },
};
export const TRAIT_LIST = ['Swift', 'Sturdy', 'Fierce', 'Bright', 'Lucky'];

// Biomes
export const BIOME = { WATER: 0, SHORE: 1, MEADOW: 2, FOREST: 3, DESERT: 4, SNOW: 5, SWAMP: 6, VOLCANO: 7 };
export const BIOME_NAMES = ['Deep Water', 'Shore', 'Meadow', 'Whisperwood', 'Sunscar Desert', 'Frostfell', 'Murkmire', 'Cinder Peaks'];
export const BIOME_KEYS = ['water', 'shore', 'meadow', 'forest', 'desert', 'snow', 'swamp', 'volcano'];

// gene feature ids: 0 none 1 ears 2 horn 3 tail 4 wings 5 spikes 6 fins 7 antennae 8 sprout 9 crest
// body: 0 blob 1 tall 2 wide 3 pear 4 block ; eye: 0 dot 1 big 2 angry 3 sleepy 4 cyclops ; pat: 0 none 1 belly 2 stripes 3 spots
const sp = (id, name, types, base, body, f1, f2, eye, pat, mouth, c1, c2, biomes, cr) =>
  ({ id, name, types, base, g: { body, f1, f2, eye, pat, mouth, c1, c2 }, biomes, cr });

export const SPECIES = [
  sp('budlet', 'Budlet', ['leaf'], [48, 42, 44, 46], 0, 8, 0, 1, 1, 1, [110, 55, 50], [60, 60, 75], ['meadow'], 0.8),
  sp('thistlefox', 'Thistlefox', ['leaf'], [42, 55, 38, 66], 1, 1, 3, 2, 2, 1, [95, 45, 45], [40, 70, 70], ['meadow', 'forest'], 0.6),
  sp('pondle', 'Pondle', ['tide'], [58, 40, 48, 44], 3, 6, 0, 1, 1, 1, [205, 65, 55], [50, 40, 85], ['meadow', 'shore'], 0.75),
  sp('zapkin', 'Zapkin', ['volt'], [40, 52, 36, 72], 0, 7, 3, 1, 3, 1, [52, 90, 58], [30, 80, 50], ['meadow'], 0.65),
  sp('mosswag', 'Mosswag', ['leaf', 'terra'], [62, 52, 58, 30], 2, 5, 3, 3, 3, 0, [100, 35, 38], [35, 45, 50], ['forest'], 0.55),
  sp('barkling', 'Barkling', ['leaf', 'murk'], [55, 58, 50, 38], 4, 2, 0, 2, 2, 1, [28, 40, 34], [120, 40, 40], ['forest'], 0.5),
  sp('glowmoth', 'Glowmoth', ['volt', 'leaf'], [40, 38, 34, 68], 1, 4, 7, 1, 1, 0, [70, 70, 55], [48, 95, 70], ['forest'], 0.5),
  sp('duneskit', 'Duneskit', ['terra'], [50, 50, 40, 62], 2, 1, 3, 0, 1, 1, [38, 60, 62], [30, 50, 82], ['desert'], 0.7),
  sp('cactorb', 'Cactorb', ['leaf', 'terra'], [60, 44, 64, 26], 0, 5, 8, 3, 2, 0, [135, 50, 38], [330, 60, 70], ['desert'], 0.6),
  sp('scorchip', 'Scorchip', ['flame', 'terra'], [46, 62, 42, 54], 3, 2, 3, 2, 3, 2, [22, 75, 55], [45, 90, 62], ['desert'], 0.45),
  sp('frostnub', 'Frostnub', ['frost'], [52, 44, 50, 38], 0, 1, 0, 1, 1, 1, [195, 60, 78], [200, 30, 94], ['snow'], 0.75),
  sp('snowpuff', 'Snowpuff', ['frost', 'tide'], [66, 36, 40, 34], 0, 1, 0, 3, 0, 1, [205, 35, 92], [210, 60, 72], ['snow'], 0.7),
  sp('glaciox', 'Glaciox', ['frost', 'terra'], [58, 64, 66, 26], 4, 2, 5, 2, 2, 2, [188, 50, 62], [215, 60, 40], ['snow'], 0.4),
  sp('bogbub', 'Bogbub', ['murk', 'tide'], [64, 40, 50, 28], 2, 6, 0, 4, 3, 1, [160, 35, 34], [75, 60, 50], ['swamp'], 0.65),
  sp('murkle', 'Murkle', ['murk'], [44, 56, 34, 64], 1, 1, 3, 2, 0, 2, [272, 40, 32], [300, 60, 60], ['swamp'], 0.55),
  sp('sporelet', 'Sporelet', ['leaf', 'murk'], [50, 46, 40, 44], 3, 8, 0, 1, 3, 1, [300, 35, 52], [55, 70, 80], ['swamp'], 0.7),
  sp('cinderpup', 'Cinderpup', ['flame'], [44, 60, 36, 66], 1, 1, 3, 2, 1, 1, [12, 80, 52], [45, 95, 65], ['volcano'], 0.6),
  sp('magmaw', 'Magmaw', ['flame', 'terra'], [70, 66, 62, 22], 4, 5, 0, 2, 2, 2, [8, 70, 34], [35, 100, 56], ['volcano'], 0.35),
  sp('emberwing', 'Emberwing', ['flame', 'volt'], [46, 58, 40, 76], 0, 4, 9, 1, 1, 0, [28, 90, 56], [52, 100, 70], ['volcano'], 0.4),
  sp('reefling', 'Reefling', ['tide'], [52, 46, 46, 56], 3, 6, 3, 1, 1, 1, [188, 65, 52], [12, 70, 76], ['shore'], 0.75),
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const STARTERS = ['budlet', 'cinderpup', 'pondle'];

export const BOSSES = [
  { id: 'b_meadow', name: 'Gran Thornwick', sp: 'thistlefox', biome: 'meadow', lv: 10, minDist: 30 },
  { id: 'b_forest', name: 'Old Mossback', sp: 'mosswag', biome: 'forest', lv: 16, minDist: 35 },
  { id: 'b_desert', name: 'Dune Sultan', sp: 'scorchip', biome: 'desert', lv: 22, minDist: 40 },
  { id: 'b_snow', name: 'Frostking Glax', sp: 'glaciox', biome: 'snow', lv: 28, minDist: 40 },
  { id: 'b_swamp', name: 'Murk Matron', sp: 'bogbub', biome: 'swamp', lv: 34, minDist: 40 },
  { id: 'b_volcano', name: 'Cinder Tyrant', sp: 'magmaw', biome: 'volcano', lv: 42, minDist: 40 },
];
