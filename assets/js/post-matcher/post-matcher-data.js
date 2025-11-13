const skuCatalog = [
  { sku: 'Post-3X', name: '3X Milling Post Processor', price: 1500, tier: 1, description: 'Standard 3-axis milling posts for VMC/HMC machines without rotary interpolation.' },
  { sku: 'Post-4X', name: '4X Milling Post Processor', price: 2000, tier: 2, description: '4-axis simultaneous or HMC B-axis capable machines.' },
  { sku: 'Post-5X', name: '5X Milling Post Processor', price: 2500, tier: 3, description: 'True simultaneous 5-axis trunnion or head/table machines.' },
  { sku: 'Post-MT1', name: 'Mill-Turn 1 Channel Post Processor', price: 2000, tier: 3, description: 'Live-tool or Y-axis lathes running a single channel.' },
  { sku: 'Post-MT2', name: 'Mill-Turn 2 Channel Post Processor', price: 4000, tier: 4, description: 'Twin spindle or twin channel mill-turn platforms with synchronization.' },
  { sku: 'Post-MT3', name: 'Mill-Turn 3+ Channel Post Processor', price: 6000, tier: 5, description: '3+ channel, twin turret twin spindle (TTTS) or complex multitasking centers.' },
  { sku: 'Post-Swiss', name: 'Swiss Basic Post Processor', price: 2500, tier: 4, description: 'Sliding headstock machines with a single main channel.' },
  { sku: 'Post-Swiss-Adv', name: 'Swiss Advanced Post Processor', price: 4500, tier: 5, description: 'Swiss machines with B-axis or dual channels requiring synchronization.' },
  { sku: 'Post-Swiss-3Ch', name: 'Swiss 3+ Channel Post Processor', price: 7000, tier: 5, description: 'Swiss or multi-spindle systems with three or more programmable channels.' },
  { sku: 'Post-Turn', name: 'Turning Post Processor', price: 1000, tier: 1, description: 'Basic 2-axis turning centers without live tooling.' }
];

const skuMap = Object.fromEntries(skuCatalog.map(item => [item.sku, item]));

export const tierDefinitions = {
  1: { label: 'Tier 1', description: '3-axis mills or 2-axis lathes. No rotary interpolation or live tool complexity.' },
  2: { label: 'Tier 2', description: '4-axis mills or C-axis live tool lathes without Y-axis.' },
  3: { label: 'Tier 3', description: 'True 5-axis mills or Y-axis single-channel mill-turn machines.' },
  4: { label: 'Tier 4', description: 'Twin spindle/twin channel configurations requiring synchronization.' },
  5: { label: 'Tier 5', description: 'Swiss-type or 3+ channel multitasking platforms.' }
};

const manufacturerConfigs = [
  {
    name: 'Haas',
    country: 'USA',
    website: 'haascnc.com',
    machines: [
      { model: 'VF-1', type: '3x-mill', sku: 'Post-3X', keywords: ['vf', 'vmc'] },
      { model: 'VF-2', type: '3x-mill', sku: 'Post-3X', keywords: ['vf', 'vmc'] },
      { model: 'VF-2SS', type: '3x-mill', sku: 'Post-3X', keywords: ['vf', 'vmc', 'high speed'] },
      { model: 'VF-3', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VF-4', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VF-6', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VF-9', type: '3x-mill', sku: 'Post-3X' },
      { model: 'Mini Mill 2', type: '3x-mill', sku: 'Post-3X', keywords: ['mini mill'] },
      { model: 'VM-3', type: '3x-mill', sku: 'Post-3X', keywords: ['mold', 'vm'] },
      { model: 'EC-400', type: '4x-mill', sku: 'Post-4X', keywords: ['ec', 'horizontal'], axes: { linear: 'XYZ', rotary: 'B', simultaneous: 4 } },
      { model: 'EC-500', type: '4x-mill', sku: 'Post-4X', axes: { linear: 'XYZ', rotary: 'B', simultaneous: 4 } },
      { model: 'UMC-500', type: '5x-mill', sku: 'Post-5X', axes: { linear: 'XYZ', rotary: 'BC', simultaneous: 5 } },
      { model: 'UMC-750', type: '5x-mill', sku: 'Post-5X', axes: { linear: 'XYZ', rotary: 'BC', simultaneous: 5 } },
      { model: 'UMC-1000', type: '5x-mill', sku: 'Post-5X', axes: { linear: 'XYZ', rotary: 'BC', simultaneous: 5 } },
      { model: 'ST-10', type: 'lathe', sku: 'Post-Turn', axes: { linear: 'XZ', rotary: null, simultaneous: 2 } },
      { model: 'ST-15', type: 'lathe', sku: 'Post-Turn', axes: { linear: 'XZ', rotary: null, simultaneous: 2 } },
      { model: 'ST-20', type: 'mill-turn', sku: 'Post-MT1', axes: { linear: 'XZY', rotary: 'C', simultaneous: 4 }, features: ['live tooling'] },
      { model: 'ST-30', type: 'mill-turn', sku: 'Post-MT1', axes: { linear: 'XZY', rotary: 'C', simultaneous: 4 }, features: ['live tooling'] },
      { model: 'ST-35Y', type: 'mill-turn', sku: 'Post-MT1', axes: { linear: 'XZY', rotary: 'C', simultaneous: 4 }, features: ['y-axis'] },
      { model: 'ST-40', type: 'mill-turn', sku: 'Post-MT1', axes: { linear: 'XZY', rotary: 'C', simultaneous: 4 } },
      { model: 'DS-30Y', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XZY', rotary: 'CC2', simultaneous: 6 }, channels: 2, features: ['dual spindle', 'y-axis'] }
    ]
  },
  {
    name: 'DMG MORI',
    country: 'Germany/Japan',
    website: 'dmgmori.com',
    machines: [
      { model: 'DMP 70', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DMC 635V', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DMF 260', type: '3x-mill', sku: 'Post-3X' },
      { model: 'NHX 4000', type: '4x-mill', sku: 'Post-4X', axes: { linear: 'XYZ', rotary: 'B', simultaneous: 4 } },
      { model: 'NHX 5000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'CMX 50 U', type: '5x-mill', sku: 'Post-5X', axes: { linear: 'XYZ', rotary: 'AC', simultaneous: 5 } },
      { model: 'DMU 50', type: '5x-mill', sku: 'Post-5X' },
      { model: 'DMU 65', type: '5x-mill', sku: 'Post-5X' },
      { model: 'DMU 75 monoBLOCK', type: '5x-mill', sku: 'Post-5X' },
      { model: 'NTX 1000', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'CC2', simultaneous: 7 }, channels: 2, features: ['b-axis', 'dual spindle'] },
      { model: 'NTX 2000', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'CC2', simultaneous: 7 }, channels: 2 },
      { model: 'NTX 3000', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'CC2B', simultaneous: 8 }, channels: 2 },
      { model: 'CTX beta 800', type: 'mill-turn', sku: 'Post-MT1', axes: { linear: 'XZY', rotary: 'C', simultaneous: 4 }, features: ['y-axis'] },
      { model: 'CTX gamma 2000', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'CC2', simultaneous: 7 }, channels: 2 },
      { model: 'NLX 2500', type: 'lathe', sku: 'Post-Turn' },
      { model: 'NLX 3000', type: 'lathe', sku: 'Post-Turn' },
      { model: 'CLX 350', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'CLX 450', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'SPRINT 32-8', type: 'swiss', sku: 'Post-Swiss-Adv', axes: { linear: 'X1Y1Z1/X2Z2', rotary: 'C/C2', simultaneous: 8 }, channels: 2 }
    ]
  },
  {
    name: 'Mazak',
    country: 'Japan',
    website: 'mazakusa.com',
    machines: [
      { model: 'VCN-530C', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VCN-700', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VTC-300C', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VARIAXIS i-300', type: '5x-mill', sku: 'Post-5X', axes: { linear: 'XYZ', rotary: 'BC', simultaneous: 5 } },
      { model: 'VARIAXIS i-500', type: '5x-mill', sku: 'Post-5X' },
      { model: 'VARIAXIS i-600', type: '5x-mill', sku: 'Post-5X' },
      { model: 'HCN-4000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'HCN-5000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'Quick Turn 150', type: 'lathe', sku: 'Post-Turn' },
      { model: 'Quick Turn 250', type: 'mill-turn', sku: 'Post-MT1', features: ['c-axis'] },
      { model: 'Quick Turn 350', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Integrex i-200', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'BC2', simultaneous: 8 }, channels: 2, features: ['b-axis'] },
      { model: 'Integrex i-300', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'BC2', simultaneous: 8 }, channels: 2 },
      { model: 'Integrex e-500H', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'BC2', simultaneous: 8 }, channels: 2 }
    ]
  },
  {
    name: 'Okuma',
    country: 'Japan',
    website: 'okuma.com',
    machines: [
      { model: 'GENOS M560-V', type: '3x-mill', sku: 'Post-3X' },
      { model: 'GENOS M660-V', type: '3x-mill', sku: 'Post-3X' },
      { model: 'MB-4000H', type: '4x-mill', sku: 'Post-4X' },
      { model: 'MB-5000H', type: '4x-mill', sku: 'Post-4X' },
      { model: 'MU-4000V', type: '5x-mill', sku: 'Post-5X' },
      { model: 'MU-6300V', type: '5x-mill', sku: 'Post-5X' },
      { model: 'LB3000EX', type: 'mill-turn', sku: 'Post-MT1', features: ['y-axis optional'] },
      { model: 'LB4000EX', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'MULTUS B300', type: 'mill-turn', sku: 'Post-MT2', axes: { linear: 'XYZ', rotary: 'BC2', simultaneous: 8 }, channels: 2, features: ['b-axis head'] },
      { model: 'MULTUS B400', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'Captain L370', type: 'lathe', sku: 'Post-Turn' },
      { model: 'LU7000 EX', type: 'mill-turn', sku: 'Post-MT2', features: ['twin turret'], channels: 2 }
    ]
  },
  {
    name: 'Makino',
    country: 'Japan',
    website: 'makino.com',
    machines: [
      { model: 'F3', type: '3x-mill', sku: 'Post-3X' },
      { model: 'F5', type: '3x-mill', sku: 'Post-3X' },
      { model: 'a51nx', type: '4x-mill', sku: 'Post-4X' },
      { model: 'a61nx', type: '4x-mill', sku: 'Post-4X' },
      { model: 'D200Z', type: '5x-mill', sku: 'Post-5X' },
      { model: 'D500', type: '5x-mill', sku: 'Post-5X' },
      { model: 'PS95', type: '4x-mill', sku: 'Post-4X' },
      { model: 'PS105', type: '4x-mill', sku: 'Post-4X' }
    ]
  },
  {
    name: 'Doosan',
    country: 'South Korea',
    website: 'doosanmachinetools.com',
    machines: [
      { model: 'DNM 4500', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DNM 5700', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DNM 6700', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VC 510', type: '3x-mill', sku: 'Post-3X' },
      { model: 'NHP 4000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'NHP 5000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'Puma 2100', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Puma 2600', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Puma 3100', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Lynx 2100', type: 'lathe', sku: 'Post-Turn' },
      { model: 'Lynx 2600', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'SMX 2600', type: 'mill-turn', sku: 'Post-MT2', channels: 2 }
    ]
  },
  {
    name: 'Hyundai WIA',
    country: 'South Korea',
    website: 'hyundai-wia.com',
    machines: [
      { model: 'KF5600', type: '3x-mill', sku: 'Post-3X' },
      { model: 'KF7600', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VX650', type: '3x-mill', sku: 'Post-3X' },
      { model: 'XF6300', type: '5x-mill', sku: 'Post-5X' },
      { model: 'HS5000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'L210A', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'L230LMS', type: 'mill-turn', sku: 'Post-MT1', features: ['sub-spindle optional'] },
      { model: 'L230LMSA', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'L400LMA', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'SE2200', type: 'lathe', sku: 'Post-Turn' },
      { model: 'HD2200A', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Hurco',
    country: 'USA',
    website: 'hurco.com',
    machines: [
      { model: 'VM10i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMX30i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMX42i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMX84i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'BX30Ui', type: '5x-mill', sku: 'Post-5X' },
      { model: 'BX50Ti', type: '5x-mill', sku: 'Post-5X' },
      { model: 'TM8i', type: 'lathe', sku: 'Post-Turn' },
      { model: 'TMX8i', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Brother',
    country: 'Japan',
    website: 'brother-usa.com',
    machines: [
      { model: 'S500X1', type: '3x-mill', sku: 'Post-3X' },
      { model: 'S700X1', type: '3x-mill', sku: 'Post-3X' },
      { model: 'R450X2', type: '3x-mill', sku: 'Post-3X' },
      { model: 'R650X2', type: '3x-mill', sku: 'Post-3X' },
      { model: 'M140X2', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'M300X3', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'W1000Xd', type: '3x-mill', sku: 'Post-3X' }
    ]
  },
  {
    name: 'Matsuura',
    country: 'Japan',
    website: 'matsuura.com',
    machines: [
      { model: 'MX-330', type: '5x-mill', sku: 'Post-5X' },
      { model: 'MX-520', type: '5x-mill', sku: 'Post-5X' },
      { model: 'MX-850', type: '5x-mill', sku: 'Post-5X' },
      { model: 'H.Plus-300', type: '4x-mill', sku: 'Post-4X' },
      { model: 'H.Plus-405', type: '4x-mill', sku: 'Post-4X' },
      { model: 'MAM72-100H', type: '5x-mill', sku: 'Post-5X' },
      { model: 'MAM72-52V', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'AWEA',
    country: 'Taiwan',
    website: 'awea.com.tw',
    machines: [
      { model: 'BM-850', type: '3x-mill', sku: 'Post-3X' },
      { model: 'BM-1200', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FV-1600', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VP3012', type: '3x-mill', sku: 'Post-3X' },
      { model: 'AF-1000', type: '5x-mill', sku: 'Post-5X' },
      { model: 'LP-4025', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Kitamura',
    country: 'Japan',
    website: 'kitamura-machinery.com',
    machines: [
      { model: 'Mycenter 3X', type: '3x-mill', sku: 'Post-3X' },
      { model: 'Mycenter 4XiF', type: '4x-mill', sku: 'Post-4X' },
      { model: 'Mycenter XD', type: '5x-mill', sku: 'Post-5X' },
      { model: 'HX250G', type: '4x-mill', sku: 'Post-4X' },
      { model: 'HX400iG', type: '4x-mill', sku: 'Post-4X' },
      { model: 'Bridgecenter-8', type: '3x-mill', sku: 'Post-3X' },
      { model: 'MedCenter5AX', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'Fadal',
    country: 'USA',
    website: 'fadal.com',
    machines: [
      { model: 'VMC-2516', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMC-3016', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMC-4020', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMC-6030', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMC-8030', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FL-10', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'FG-5', type: 'lathe', sku: 'Post-Turn' }
    ]
  },
  {
    name: 'Johnford',
    country: 'Taiwan',
    website: 'johnford.com',
    machines: [
      { model: 'VMC-850', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VMC-1100', type: '3x-mill', sku: 'Post-3X' },
      { model: 'Double Column VMC', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DMC-2100', type: '4x-mill', sku: 'Post-4X' },
      { model: 'ST-40', type: 'lathe', sku: 'Post-Turn' },
      { model: 'HT-420', type: 'mill-turn', sku: 'Post-MT2', channels: 2 }
    ]
  },
  {
    name: 'Milltronics',
    country: 'USA',
    website: 'milltronicscnc.com',
    machines: [
      { model: 'VM16', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VM30', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VM4020', type: '3x-mill', sku: 'Post-3X' },
      { model: 'XP1330', type: '3x-mill', sku: 'Post-3X' },
      { model: 'ML22', type: 'lathe', sku: 'Post-Turn' },
      { model: 'SL10', type: 'lathe', sku: 'Post-Turn' },
      { model: 'BR40', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Citizen',
    country: 'Japan',
    website: 'citizen-usa.com',
    machines: [
      { model: 'L20', type: 'swiss', sku: 'Post-Swiss', axes: { linear: 'X1Y1Z1', rotary: 'C', simultaneous: 7 } },
      { model: 'L32', type: 'swiss', sku: 'Post-Swiss', axes: { linear: 'X1Y1Z1', rotary: 'C', simultaneous: 7 } },
      { model: 'M32', type: 'swiss', sku: 'Post-Swiss-Adv', axes: { linear: 'X1Y1Z1/X2Z2', rotary: 'C/C2', simultaneous: 8 }, channels: 2 },
      { model: 'A32', type: 'swiss', sku: 'Post-Swiss', axes: { linear: 'X1Y1Z1', rotary: 'C', simultaneous: 7 } },
      { model: 'B12', type: 'swiss', sku: 'Post-Swiss', axes: { linear: 'X1Z1', rotary: 'C', simultaneous: 6 } },
      { model: 'BNJ-42SY6', type: 'swiss', sku: 'Post-Swiss-Adv', channels: 2 },
      { model: 'BNE-51MSY', type: 'swiss', sku: 'Post-Swiss-Adv', channels: 2 },
      { model: 'BW329Z', type: 'swiss', sku: 'Post-Swiss-3Ch', channels: 3 }
    ]
  },
  {
    name: 'Star',
    country: 'Japan',
    website: 'star-su.com',
    machines: [
      { model: 'SR-20RIV', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'SR-32JIII', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'SB-16', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'ECAS-20T', type: 'swiss', sku: 'Post-Swiss-Adv', channels: 2 },
      { model: 'SV-32', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'ST-38', type: 'swiss', sku: 'Post-Swiss-Adv', features: ['b-axis'] },
      { model: 'SW-12RII', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'SP-20', type: 'swiss', sku: 'Post-Swiss' }
    ]
  },
  {
    name: 'Tsugami',
    country: 'Japan',
    website: 'tsugami.com',
    machines: [
      { model: 'B0125', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'B0205-III', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'B038T', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'SS26', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'SS32', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'M08SY', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'M08SY-II', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'S206-II', type: 'swiss', sku: 'Post-Swiss-Adv' }
    ]
  },
  {
    name: 'Tornos',
    country: 'Switzerland',
    website: 'tornos.com',
    machines: [
      { model: 'SwissDECO 36', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'EvoDECO 32', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'SwissNano 7', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'GT 32', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'SXT 16', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'MultiSwiss 8x26', type: 'swiss', sku: 'Post-Swiss-3Ch', channels: 3 },
      { model: 'MultiSwiss 6x32', type: 'swiss', sku: 'Post-Swiss-3Ch', channels: 3 }
    ]
  },
  {
    name: 'Index',
    country: 'Germany',
    website: 'index-traub.com',
    machines: [
      { model: 'G200', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'G220', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'C100', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'C200', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'MS22', type: 'mill-turn', sku: 'Post-MT3', channels: 3 },
      { model: 'MS32', type: 'mill-turn', sku: 'Post-MT3', channels: 3 },
      { model: 'MS40', type: 'mill-turn', sku: 'Post-MT3', channels: 3 },
      { model: 'ABC 65', type: 'lathe', sku: 'Post-Turn' }
    ]
  },
  {
    name: 'Hanwha',
    country: 'South Korea',
    website: 'hanwha-machinery.com',
    machines: [
      { model: 'XD20II', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'XD38II', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'XE20', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'XE35', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'XP12', type: 'swiss', sku: 'Post-Swiss' },
      { model: 'STL38H', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'HDE32', type: 'swiss', sku: 'Post-Swiss-Adv' },
      { model: 'XD35V', type: 'swiss', sku: 'Post-Swiss-Adv' }
    ]
  },
  {
    name: 'Hermle',
    country: 'Germany',
    website: 'hermle-usa.com',
    machines: [
      { model: 'C12U', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C22U', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C32U', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C42U', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C52U', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C250', type: '5x-mill', sku: 'Post-5X' },
      { model: 'C400', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'Chiron',
    country: 'Germany',
    website: 'chiron-group.com',
    machines: [
      { model: 'FZ 12', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FZ 15 W', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FZ 18 S', type: '3x-mill', sku: 'Post-3X' },
      { model: 'DZ 22 W', type: '5x-mill', sku: 'Post-5X' },
      { model: 'Mill 2000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'Micro5', type: '5x-mill', sku: 'Post-5X' },
      { model: 'DZ 25 P', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'Grob',
    country: 'Germany',
    website: 'grobgroup.com',
    machines: [
      { model: 'G150', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G350', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G350a', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G440', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G550', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G750', type: '5x-mill', sku: 'Post-5X' },
      { model: 'G840', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'Mitsui Seiki',
    country: 'Japan',
    website: 'mitsuiseiki.com',
    machines: [
      { model: 'HU100A', type: '5x-mill', sku: 'Post-5X' },
      { model: 'HS6A', type: '5x-mill', sku: 'Post-5X' },
      { model: 'VL30-5X', type: '5x-mill', sku: 'Post-5X' },
      { model: 'Vertex 55X-H', type: '5x-mill', sku: 'Post-5X' },
      { model: 'GSE 500', type: '4x-mill', sku: 'Post-4X' },
      { model: 'GSE 650', type: '4x-mill', sku: 'Post-4X' }
    ]
  },
  {
    name: 'Nakamura-Tome',
    country: 'Japan',
    website: 'nakamura-tome.co.jp',
    machines: [
      { model: 'WT-150', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'WT-300', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'WY-150', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'WY-250', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'NTY-3', type: 'mill-turn', sku: 'Post-MT3', channels: 3 },
      { model: 'NTRX-300', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'AS200', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'SC-100X2', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Hardinge',
    country: 'USA',
    website: 'hardinge.com',
    machines: [
      { model: 'GX 600', type: '3x-mill', sku: 'Post-3X' },
      { model: 'GX 1000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'Bridgeport XR1000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'T51 SP', type: 'lathe', sku: 'Post-Turn' },
      { model: 'HLV-H', type: 'lathe', sku: 'Post-Turn' },
      { model: 'GT-27SP', type: 'lathe', sku: 'Post-Turn' },
      { model: 'Conquest H51', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Elite GT', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'OKK',
    country: 'Japan',
    website: 'okk.co.jp',
    machines: [
      { model: 'VM7III', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VM9III', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VP6000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'VB53', type: '3x-mill', sku: 'Post-3X' },
      { model: 'HM1000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'HM1600', type: '4x-mill', sku: 'Post-4X' },
      { model: 'HM-X6000', type: '4x-mill', sku: 'Post-4X' },
      { model: 'MCH800', type: '4x-mill', sku: 'Post-4X' }
    ]
  },
  {
    name: 'Takamaz',
    country: 'Japan',
    website: 'takamaz.com',
    machines: [
      { model: 'XW-60', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'XW-130', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'XWT-8', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'XD-10', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'XWG-3', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'XW-200', type: 'mill-turn', sku: 'Post-MT2', channels: 2 }
    ]
  },
  {
    name: 'Fuji',
    country: 'Japan',
    website: 'fujiseiko.co.jp',
    machines: [
      { model: 'ANW-41', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'CSD-300', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'CSD-400', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'TN300II', type: 'mill-turn', sku: 'Post-MT2', channels: 2 },
      { model: 'ACUFLEX 400S', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Gyroflex 400', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'Gyroflex 550', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Smart',
    country: 'Taiwan',
    website: 'smartcnc.com.tw',
    machines: [
      { model: 'SNV-1000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'SVC-1500', type: '3x-mill', sku: 'Post-3X' },
      { model: 'SM1200', type: '3x-mill', sku: 'Post-3X' },
      { model: 'NL2000', type: 'lathe', sku: 'Post-Turn' },
      { model: 'NL2000BSY', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  },
  {
    name: 'Feeler',
    country: 'Taiwan',
    website: 'feeler.com.tw',
    machines: [
      { model: 'FV-1000', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FTC-450L', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FTC-560L', type: '3x-mill', sku: 'Post-3X' },
      { model: 'FT-250SY', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'FDC-2000', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'FDC-2500', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'U600', type: '5x-mill', sku: 'Post-5X' }
    ]
  },
  {
    name: 'Leadwell',
    country: 'Taiwan',
    website: 'leadwell.com',
    machines: [
      { model: 'V-60i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'V-80i', type: '3x-mill', sku: 'Post-3X' },
      { model: 'MCV-1300B', type: '3x-mill', sku: 'Post-3X' },
      { model: 'LTC-65CL', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'LTC-65CXL', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'LTC-85SMY', type: 'mill-turn', sku: 'Post-MT1', features: ['y-axis'] },
      { model: 'BC-600', type: 'lathe', sku: 'Post-Turn' }
    ]
  },
  {
    name: 'Chevalier',
    country: 'Taiwan',
    website: 'chevalier.com',
    machines: [
      { model: 'FVM-4024', type: '3x-mill', sku: 'Post-3X' },
      { model: 'SMART-IV 2416', type: '3x-mill', sku: 'Post-3X' },
      { model: 'QP2033', type: '3x-mill', sku: 'Post-3X' },
      { model: 'QP2560', type: '3x-mill', sku: 'Post-3X' },
      { model: 'QP5X-400', type: '5x-mill', sku: 'Post-5X' },
      { model: 'FCL-32Y', type: 'mill-turn', sku: 'Post-MT1' },
      { model: 'FNL-250Y', type: 'mill-turn', sku: 'Post-MT1' }
    ]
  }
];

const machineDatabase = buildDatabase(manufacturerConfigs);
const machineIndex = flattenMachines(machineDatabase);
const machineMap = new Map(machineIndex.map(machine => [machine.id, machine]));

function buildDatabase(configs) {
  const manufacturers = {};
  configs.forEach(config => {
    manufacturers[config.name] = {
      country: config.country,
      website: config.website,
      machines: buildMachinesForManufacturer(config)
    };
  });
  return {
    version: '1.0',
    lastUpdated: '2025-01-15',
    manufacturers
  };
}

function buildMachinesForManufacturer(config) {
  return config.machines.map(machine => {
    const skuInfo = skuMap[machine.sku] || { name: machine.sku, price: 0, tier: 1 };
    const tier = machine.tier ?? skuInfo.tier ?? 1;
    return {
      id: `${slugify(config.name)}-${slugify(machine.model)}`,
      manufacturer: config.name,
      country: config.country,
      website: config.website,
      model: machine.model,
      fullName: `${config.name} ${machine.model}`.trim(),
      type: machine.type,
      sku: machine.sku,
      skuName: skuInfo.name,
      price: skuInfo.price,
      tier,
      axes: machine.axes ?? deriveDefaultAxes(machine.type),
      channels: machine.channels ?? 1,
      features: machine.features ?? [],
      keywords: machine.keywords ?? [],
      normalizedModel: slugify(machine.model),
      normalizedFullName: slugify(`${config.name} ${machine.model}`),
      notes: machine.notes ?? ''
    };
  });
}

function flattenMachines(database) {
  return Object.values(database.manufacturers).flatMap(entry => entry.machines);
}

function deriveDefaultAxes(type) {
  switch (type) {
    case '4x-mill':
      return { linear: 'XYZ', rotary: 'B', simultaneous: 4 };
    case '5x-mill':
      return { linear: 'XYZ', rotary: 'BC', simultaneous: 5 };
    case 'mill-turn':
      return { linear: 'XZY', rotary: 'C', simultaneous: 4 };
    case 'swiss':
      return { linear: 'X1Y1Z1', rotary: 'C', simultaneous: 7 };
    case 'lathe':
      return { linear: 'XZ', rotary: null, simultaneous: 2 };
    default:
      return { linear: 'XYZ', rotary: null, simultaneous: 3 };
  }
}

function slugify(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getAllMachines() {
  return machineIndex.slice();
}

export function getSkuByCode(code) {
  return skuMap[code] ?? null;
}

export function getManufacturers() {
  return Object.entries(machineDatabase.manufacturers).map(([name, info]) => ({
    name,
    country: info.country,
    website: info.website,
    machineCount: info.machines.length
  }));
}

export function getMachineById(id) {
  return machineMap.get(id) ?? null;
}

export function filterMachines({ manufacturer = 'all', tier = 'all', search = '' } = {}) {
  const normalizedManufacturer = manufacturer.toLowerCase();
  const normalizedTier = tier.toLowerCase();
  const normalizedSearch = search.trim().toLowerCase();
  return machineIndex
    .filter(machine => {
      const manufacturerMatch =
        normalizedManufacturer === 'all' ||
        machine.manufacturer.toLowerCase() === normalizedManufacturer;
      const tierMatch =
        normalizedTier === 'all' ||
        String(machine.tier).toLowerCase() === normalizedTier;
      const searchMatch =
        !normalizedSearch ||
        machine.fullName.toLowerCase().includes(normalizedSearch) ||
        machine.model.toLowerCase().includes(normalizedSearch) ||
        machine.manufacturer.toLowerCase().includes(normalizedSearch) ||
        machine.keywords.some(keyword =>
          keyword?.toLowerCase().includes(normalizedSearch)
        );
      return manufacturerMatch && tierMatch && searchMatch;
    })
    .sort((a, b) => {
      if (a.manufacturer === b.manufacturer) {
        return a.model.localeCompare(b.model, undefined, { numeric: true });
      }
      return a.manufacturer.localeCompare(b.manufacturer);
    });
}

export function getTierOptions() {
  return Object.entries(tierDefinitions).map(([value, data]) => ({
    value,
    label: data.label
  }));
}

export { skuCatalog, machineDatabase };
