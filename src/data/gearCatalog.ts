import { Rubber, Blade } from '../types';

export const CATALOG_RUBBERS: Omit<Rubber, 'id' | 'hoursPlayed' | 'dateInstalled'>[] = [
  {
    brand: 'Butterfly',
    model: 'Dignics 09C',
    type: 'inverted',
    color: 'black',
    spongeThickness: '2.1mm',
    spongeHardness: 44,
    speed: 92,
    spin: 98,
    control: 89,
    maxRecommendedHours: 85,
    notes: 'Hybrid sticky topsheet with Spring Sponge X. Used by elite champions.'
  },
  {
    brand: 'Butterfly',
    model: 'Tenergy 05',
    type: 'inverted',
    color: 'red',
    spongeThickness: '2.1mm',
    spongeHardness: 36,
    speed: 94,
    spin: 96,
    control: 85,
    maxRecommendedHours: 75,
    notes: 'The industry benchmark for topspin and looping.'
  },
  {
    brand: 'Butterfly',
    model: 'Rozena',
    type: 'inverted',
    color: 'black',
    spongeThickness: '1.9mm',
    spongeHardness: 35,
    speed: 86,
    spin: 88,
    control: 92,
    maxRecommendedHours: 80,
    notes: 'Forgiving spring sponge rubber with high tolerance for club players.'
  },
  {
    brand: 'DHS',
    model: 'Hurricane 3 Neo (National)',
    type: 'inverted',
    color: 'black',
    spongeThickness: '2.15mm',
    spongeHardness: 40,
    speed: 88,
    spin: 99,
    control: 86,
    maxRecommendedHours: 90,
    notes: 'Tacky Chinese classic rubber for extreme brush loops and short game.'
  },
  {
    brand: 'Tibhar',
    model: 'Evolution MX-P',
    type: 'inverted',
    color: 'red',
    spongeThickness: '2.1mm',
    spongeHardness: 47.5,
    speed: 96,
    spin: 94,
    control: 82,
    maxRecommendedHours: 70,
    notes: 'High catapult tensor rubber with powerful forward trajectory.'
  },
  {
    brand: 'Yasaka',
    model: 'Rakza 7',
    type: 'inverted',
    color: 'red',
    spongeThickness: '2.0mm',
    spongeHardness: 45,
    speed: 89,
    spin: 92,
    control: 90,
    maxRecommendedHours: 85,
    notes: 'Natural rubber blend, durable and dependable for all-round attacking.'
  },
  {
    brand: 'Yasaka',
    model: 'Rakza Z',
    type: 'inverted',
    color: 'black',
    spongeThickness: 'MAX',
    spongeHardness: 47,
    speed: 88,
    spin: 96,
    control: 89,
    maxRecommendedHours: 80,
    notes: 'Sticky topsheet with hard sponge for heavy spin and short service returns.'
  },
  {
    brand: 'Nittaku',
    model: 'Fastarc G-1',
    type: 'inverted',
    color: 'black',
    spongeThickness: 'MAX',
    spongeHardness: 47.5,
    speed: 92,
    spin: 95,
    control: 88,
    maxRecommendedHours: 90,
    notes: '#1 best-selling rubber in Japan for durability, arc, and stability.'
  },
  {
    brand: 'Donic',
    model: 'Bluefire M2',
    type: 'inverted',
    color: 'red',
    spongeThickness: '2.0mm',
    spongeHardness: 45,
    speed: 90,
    spin: 93,
    control: 87,
    maxRecommendedHours: 75,
    notes: 'Porous blue sponge providing high dynamics and pleasant touch.'
  },
  {
    brand: 'Andro',
    model: 'Rasanter R48',
    type: 'inverted',
    color: 'green',
    spongeThickness: 'ULTRA MAX',
    spongeHardness: 48,
    speed: 95,
    spin: 94,
    control: 85,
    maxRecommendedHours: 75,
    notes: 'Energy Cell technology for accelerated power and green colorway.'
  },
  {
    brand: 'Victas',
    model: 'V > 15 Extra',
    type: 'inverted',
    color: 'blue',
    spongeThickness: '2.0mm',
    spongeHardness: 47.5,
    speed: 94,
    spin: 93,
    control: 86,
    maxRecommendedHours: 80,
    notes: 'Offensive weapon used by Koki Niwa, explosive counter-looping.'
  },
  {
    brand: 'Xiom',
    model: 'Vega Pro',
    type: 'inverted',
    color: 'black',
    spongeThickness: '2.0mm',
    spongeHardness: 47.5,
    speed: 87,
    spin: 91,
    control: 89,
    maxRecommendedHours: 85,
    notes: 'Carbo Sponge technology offering reliable performance and value.'
  },
  {
    brand: 'Sauer & Tröger',
    model: 'Hellfire X',
    type: 'long_pips',
    color: 'red',
    spongeThickness: 'OX (bez huby)',
    spongeHardness: 0,
    speed: 45,
    spin: 85,
    control: 94,
    maxRecommendedHours: 120,
    notes: 'Specialist long pimples for disruptive block play and spin reversal.'
  },
  {
    brand: 'Victas',
    model: 'VO > 102',
    type: 'short_pips',
    color: 'black',
    spongeThickness: '1.8mm',
    spongeHardness: 37.5,
    speed: 93,
    spin: 78,
    control: 86,
    maxRecommendedHours: 100,
    notes: 'High speed offensive short pips for fast direct counters and smash.'
  }
];

export const CATALOG_BLADES: Omit<Blade, 'id' | 'hoursPlayed' | 'dateAcquired'>[] = [
  {
    brand: 'Butterfly',
    model: 'Viscaria',
    plies: '5 drevo + 2 ALC (Arylate-Carbon)',
    weightGrams: 86,
    grip: 'FL',
    speed: 93,
    control: 87,
    notes: 'Legendary carbon blade with crisp feel and large sweet spot.'
  },
  {
    brand: 'Butterfly',
    model: 'Timo Boll ALC',
    plies: '5 drevo + 2 ALC',
    weightGrams: 87,
    grip: 'FL',
    speed: 92,
    control: 88,
    notes: 'High precision and stability for topspin play at mid-distance.'
  },
  {
    brand: 'Butterfly',
    model: 'Primorac Classic',
    plies: '5 vrstiev drevo (celodrevené)',
    weightGrams: 84,
    grip: 'FL',
    speed: 80,
    control: 95,
    notes: 'The golden standard all-wood blade for learning technique and control.'
  },
  {
    brand: 'Stiga',
    model: 'Clipper CR',
    plies: '7 vrstiev drevo',
    weightGrams: 90,
    grip: 'ST',
    speed: 90,
    control: 86,
    notes: 'Classic offensive 7-ply wood with UV-hardened surface.'
  },
  {
    brand: 'Stiga',
    model: 'Cybershape Carbon',
    plies: '5 drevo + 2 Carbon',
    weightGrams: 85,
    grip: 'FL',
    speed: 94,
    control: 86,
    notes: 'Hexagonal blade shape expanding the optimal hitting area near tip.'
  },
  {
    brand: 'DHS',
    model: 'Hurricane Long 5',
    plies: '5 drevo + 2 Aryl-Carbon (Inner)',
    weightGrams: 89,
    grip: 'FL',
    speed: 95,
    control: 85,
    notes: 'Inner carbon blade used by Ma Long. Tremendous power on full swings.'
  },
  {
    brand: 'Donic',
    model: 'Waldner Senso Carbon',
    plies: '5 drevo + 2 Carbon (Inner)',
    weightGrams: 84,
    grip: 'AN',
    speed: 86,
    control: 92,
    notes: 'Hollow handle Senso system for vibration feedback and exceptional touch.'
  },
  {
    brand: 'Yasaka',
    model: 'Ma Lin Extra Offensive',
    plies: '5 vrstiev drevo',
    weightGrams: 85,
    grip: 'FL',
    speed: 85,
    control: 90,
    notes: 'Hard walnut outer plies delivering crisp blocking and topspin drive.'
  }
];

export const INITIAL_BADGES = [
  {
    id: 'badge-starter',
    title: 'Začiatočník (Starter)',
    description: 'Začni svoju cestu a zaznamenaj prvý tréning alebo zápas.',
    icon: 'Target',
    maxProgress: 1,
    progress: 1,
    unlockedAt: '2026-09-01'
  },
  {
    id: 'badge-hours-10',
    title: '10 Hodín pri stole',
    description: 'Zaznamenaj aspoň 10 hodín tréningu s tvojím vybavením.',
    icon: 'Clock',
    maxProgress: 10,
    progress: 8
  },
  {
    id: 'badge-hours-50',
    title: 'Majster rotácie (50h)',
    description: 'Dosiahni 50 hodín tréningov a zápasov v denníku.',
    icon: 'Flame',
    maxProgress: 50,
    progress: 24
  },
  {
    id: 'badge-sstz-connected',
    title: 'SSTZ Reprezentant',
    description: 'Prepoj aplikáciu so svojím SSTZ hráčskym profilom.',
    icon: 'ShieldCheck',
    maxProgress: 1,
    progress: 1,
    unlockedAt: '2026-09-15'
  },
  {
    id: 'badge-rubber-care',
    title: 'Správca poťahov',
    description: 'Sleduj opotrebovanie a vymeň poťah v optimálnom stave.',
    icon: 'Sparkles',
    maxProgress: 1,
    progress: 1,
    unlockedAt: '2026-09-20'
  },
  {
    id: 'badge-streak-5',
    title: 'Tréningová šnúra (5 dní)',
    description: 'Trénuj 5 po sebe idúcich dní v týždni.',
    icon: 'Zap',
    maxProgress: 5,
    progress: 3
  },
  {
    id: 'badge-winrate-70',
    title: 'Elitná úspešnosť (70%+)',
    description: 'Udrž si úspešnosť v lige vyššiu ako 70% po aspoň 10 zápasoch.',
    icon: 'Trophy',
    maxProgress: 10,
    progress: 8
  }
];
