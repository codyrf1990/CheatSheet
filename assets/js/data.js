export const headerLinks = [
  { label: 'Main Support Site', href: 'https://solidcam.com/subscription/technical-support/', intent: 'support' },
  { label: 'Support Ticket Site', href: 'https://solidcamsupport.com/', intent: 'support' },
  { label: 'SolidCAM University', href: 'https://www.youtube.com/c/SolidCAMUniversity', intent: 'university' },
  { label: 'SolidCAM Academy', href: 'https://elearning-solidcam.talentlms.com/', intent: 'academy' },
  { label: 'SolidCAM ChatBot', href: 'https://www.solidcamchat.com/', intent: 'chatbot' }
];

export const packages = [
  {
    code: 'SC-Mill',
    maintenance: 'SC-Mill-Maint',
    description: 'Core milling bundle for indexed rotary work.',
    groups: [
      {
        label: '25M',
        masterId: 'sc-mill-25m',
        bits: [
          'Modeler',
          'Machinist',
          'SolidCAM Mill 2D',
          'SolidCAM Mill 2.5D',
          'Profile/Pocket 2.5D Rest Material',
          '4-axes Indexial',
          '5-axes Indexial',
          'C-axes (Wrap)',
          'Hole+Drill Recognition',
          'Pocket Recognition',
          'Chamfer recognition'
        ]
      }
    ],
    looseBits: [
      'HSS',
      'Multi-Depth Drill'
    ]
  },
  {
    code: 'SC-Turn',
    maintenance: 'SC-Turn-Maint',
    description: 'Turning foundation with back spindle support.',
    looseBits: [
      'SolidCAM Turning',
      'Backspindle'
    ]
  },
  {
    code: 'SC-Mill-Adv',
    maintenance: 'SC-Mill-Adv-Maint',
    description: 'Advanced milling add-on (iMachining 2D, Edge Breaking, Machine Simulation).',
    looseBits: [
      'iMach2D',
      'Machine Simulation',
      'Edge Breaking'
    ]
  },
  {
    code: 'SC-Mill-3D',
    maintenance: 'SC-Mill-3D-Maint',
    description: '3D iMachining and HSM (requires iMach2D).',
    looseBits: [
      'HSM',
      'iMach3D'
    ]
  },
  {
    code: 'SC-Mill-5Axis',
    maintenance: 'SC-Mill-5Axis-Maint',
    description: 'Full simultaneous 4/5 axis toolkit.',
    groups: [
      {
        label: 'Sim5x',
        masterId: 'sc-mill-5axis-sim5x',
        bits: [
          'Simultaneous 5x',
          'Auto 3+2 Roughing',
          'Screw Machining (Rotary)',
          'Convert5X',
          '5x Drill',
          'Swarf machining',
          'Contour 5x'
        ]
      }
    ],
    looseBits: [
      'Sim4x',
      'Multiaxis - Multiaxis Roughing'
    ]
  }
];

export const panels = [
  {
    id: 'standalone-modules',
    title: 'Standalone Modules',
    editable: true,
    items: [
      '25M',
      'Convert5X',
      'EdgeBreak',
      'EdgeTrim',
      'HSM',
      'iMach2d',
      'iMach3D',
      'MachSim',
      'MTS',
      'Multiaxis',
      'Multiblade',
      'Port',
      'Probe',
      'Sim4x',
      'Sim5x',
      'Swiss',
      'turn',
      'Vericut'
    ]
  },
  {
    id: 'maintenance-skus',
    title: 'Maintenance SKUs',
    editable: true,
    items: [
      'Convert5X-Maint',
      'EdgeBreak-Maint',
      'EdgeTrim-Maint',
      'HSM-Maint',
      'iMach2d-Maint',
      'iMach3d-Maint',
      'MachSim-Maint',
      'MTS-Maint',
      'Multiaxis-Maint',
      'Multiblade-Maint',
      'Port-Maint',
      'Probe-Maint',
      'SC-Mill-3D-Maint',
      'SC-Mill-5Axis-Maint',
      'SC-Mill-Adv-Maint',
      'SC-Mill-Maint',
      'SC-Turn-Maint',
      'SolidShop-Sim-maint',
      'Sim4x-Maint',
      'Sim5x-Maint',
      'SolidShop-Editor-maint',
      'Swiss-Maint',
      '25M-Maint',
      'turn-maint',
      'NPD-Maint',
      'Vericut-Maint'
    ]
  },
  {
    id: 'solidworks-maintenance',
    title: 'SolidWorks Maintenance',
    editable: true,
    items: [
      'SW-P-Maint',
      'SW-PA-Maint',
      'SW-Pro-Maint',
      'SW-Pro-Net-Maint',
      'SW-Std-Maint',
      'SW-Std-Net-Maint',
      'SW-Info-Maint'
    ]
  }
];
