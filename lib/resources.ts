// Resources hub content. Each category is a tile; guides get added to `guides` as they're written.

export type Guide = { id: string; title: string; summary: string; body?: string };

export type ResourceCategory = {
  id: string;
  title: string;
  description: string;
  icon: 'crosshair' | 'backpack' | 'trophy' | 'shield' | 'user' | 'info';
  /** Planned topics, shown as chips until guides are written. */
  topics: string[];
  guides: Guide[];
};

export const RESOURCES: { heading: string; introduction: string; notice: string; categories: ResourceCategory[] } = {
  heading: 'MTU Resources',
  introduction: 'Shooting tips, gear advice, match guides and everything else a 184th MTU shooter needs to know, in one place.',
  notice: 'These guides are team training aids. Follow your range SOPs, the match program, and range safety staff — they always take priority.',
  categories: [
    {
      id: 'shooting-tips',
      title: 'Shooting Tips',
      description: 'Fundamentals, drills, and fixes for the most common problems on the line.',
      icon: 'crosshair',
      topics: ['Grip and stance', 'Sight alignment and picture', 'Trigger control', 'Breathing and follow-through', 'Pistol drills', 'Rifle positions', 'Diagnosing your target'],
      guides: [],
    },
    {
      id: 'equipment',
      title: 'Equipment',
      description: 'What to bring, how to set it up, and how to take care of it.',
      icon: 'backpack',
      topics: ['Gear checklist', 'Holsters and belts', 'Optics and zeroing', 'Magazines', 'Shooting mats and data books', 'Cleaning and maintenance'],
      guides: [],
    },
    {
      id: 'match-guides',
      title: 'Match Guides',
      description: 'Courses of fire, scoring, and what to expect at each match the team shoots.',
      icon: 'trophy',
      topics: ['Pistol EIC', 'Rifle EIC', 'Anti-body armor', 'Reflexive fire', 'Scoring and X counts', 'TAG Match', 'Regionals and Nationals'],
      guides: [],
    },
    {
      id: 'range-safety',
      title: 'Range & Safety',
      description: 'Range commands, safety rules, and what to do when something goes wrong.',
      icon: 'shield',
      topics: ['Tower commands', 'Range safety rules', 'Malfunctions and clearing', 'Medical emergencies', 'Range locations and rules'],
      guides: [],
    },
    {
      id: 'new-shooters',
      title: 'New Shooters',
      description: 'Start here: how the team works, tryouts, and getting ready for your first practice.',
      icon: 'user',
      topics: ['How the MTU works', 'Tryouts', 'Your first practice', 'Orders and 336s', 'Earning EIC points'],
      guides: [],
    },
    {
      id: 'extra-information',
      title: 'Extra Information',
      description: 'Everything else: badges, awards, travel, and team history.',
      icon: 'info',
      topics: ['EIC badges', 'German Armed Forces badge', 'Awards and recognition', 'Travel to matches', 'Team history'],
      guides: [],
    },
  ],
};
