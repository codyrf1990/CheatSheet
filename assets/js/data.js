export const headerLinks = [
  {
    label: 'Main Support Site',
    href: 'https://solidcam.com/subscription/technical-support/',
    intent: 'support',
    description: 'Official support hub: subscription support info, articles, downloads and contacts.'
  },
  {
    label: 'Support Ticket Site',
    href: 'https://solidcamsupport.com/',
    intent: 'support',
    description: 'Submit and track technical support tickets for SolidCAM.'
  },
  {
    label: 'SolidCAM University',
    href: 'https://www.youtube.com/c/SolidCAMUniversity',
    intent: 'university',
    description: 'Official YouTube channel: tutorials, webinars, tips and demos.'
  },
  {
    label: 'SolidCAM Academy',
    href: 'https://elearning-solidcam.talentlms.com/',
    intent: 'academy',
    description: 'Self‑paced eLearning (LMS) with structured courses and progress tracking.'
  },
  {
    label: 'SolidCAM ChatBot',
    href: 'https://www.solidcamchat.com/',
    intent: 'chatbot',
    description: 'Chat assistant for quick answers and links to resources.'
  }
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
          'Profile/Pocket 2.5D Rest Material',
          'SolidCAM Mill 2.5D',
          'Pocket Recognition',
          'Chamfer Recognition',
          'Hole+Drill Recognition',
          'SC Mill 3D',
          'C-axes (Wrap)',
          '4-axes Indexial',
          '5-axes Indexial',
          'Multi-Depth Drill'
        ]
      }
    ],
    looseBits: [
      'HSS'
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
        label: 'SIM5X',
        masterId: 'sc-mill-5axis-sim5x',
        bits: [
          'Sim5x',
          'Swarf machining',
          '5x Drill',
          'Contour 5x',
          'Convert5X',
          'Auto 3+2 Roughing',
          'Screw Machining (Rotary)'
        ]
      }
    ],
    looseBits: [
      'Sim4x',
      'Multiaxis Roughing'
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
      '25M-Maint',
      'EdgeBreak-Maint',
      'EdgeTrim-Maint',
      'HSM-Maint',
      'HSS-Maint',
      'iMach2D-Maint',
      'iMach3D-Maint',
      'Lic-Net-Maint',
      'MachSim-Maint',
      'MTS-Maint',
      'Multiaxis-Maint',
      'Multiblade-Maint',
      'NPD-Maint',
      'Port-Maint',
      'Probe-Maint',
      'SC-Mill-3D-Maint',
      'SC-Mill-5Axis-Maint',
      'SC-Mill-Adv-Maint',
      'SC-Mill-Maint',
      'SC-Turn-Maint',
      'Sim4x-Maint',
      'Sim5x-Maint',
      'SolidShop-Editor-Maint',
      'SolidShop-Sim-Maint',
      'Swiss-Maint',
      'Turn-Maint',
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
