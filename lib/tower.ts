// Condensed from the 2024 MTU Match Call Booklet (Rifle EIC, Pistol EIC, Reflexive Fire, Anti-Body Armor).

export type Stage = {
  name: string;
  distance: string;
  position: string;
  shots: string;
  /** Seconds for each exposure, fired in order. */
  exposures: number[];
  /** Minimum seconds between exposures. */
  interval?: number;
  sequence: string;
  commands: string[];
  afterStage: string[];
};

export type MatchCall = {
  code: string;
  title: string;
  weapon: 'Pistol' | 'Rifle';
  rounds: number;
  maxPoints: number;
  safetyBrief: string;
  setup: string[];
  stages: Stage[];
  closing: string[];
};

const PISTOL_LOAD = [
  'SHOOTERS… UNHOLSTER…',
  'SECURE A MAGAZINE… LOAD… MAKE READY…',
  'WEAPON ON SAFE OR DECOCKED… (block officers check safeties)',
  'REHOLSTER…',
  'WATCH AND SHOOT. WATCH AND SHOOT. (3-second pause)',
  'FIRE.',
];
const PISTOL_CLEAR = [
  'CEASE FIRE, CEASE FIRE, CEASE FIRE.',
  'BLOCK OFFICERS, INSPECT AND CLEAR ALL WEAPONS AND MAGAZINES. COLLECT UNUSED AMMO.',
  'Slides forward, weapon on safe. HOLSTER AFTER YOU HAVE BEEN CLEARED BY YOUR BLOCK OFFICER.',
  'IS THE FIRING LINE CLEAR? … THE FIRING LINE IS CLEAR.',
];
const RIFLE_LOAD = [
  'SECURE A MAGAZINE… LOAD… MAKE READY.',
  'SHOOTERS ASSUME THE LOW READY POSITION.',
  'YOU MUST RETURN TO THE LOW READY AFTER EACH EXPOSURE.',
  'WATCH AND SHOOT, WATCH AND SHOOT.',
  'FIRE. … (horn) … WEAPON ON SAFE, RETURN TO THE LOW READY.',
];
const RIFLE_CLEAR = [
  'CEASE FIRE… CEASE FIRE… CEASE FIRE.',
  'BLOCK OFFICERS, INSPECT AND CLEAR ALL WEAPONS AND MAGAZINES. ENSURE ALL WEAPONS ARE GREEN AND CLEAR. COLLECT UNUSED AMMO.',
  'SHOOTERS, GROUND YOUR WEAPONS AFTER YOU HAVE BEEN CLEARED BY YOUR BLOCK OFFICER.',
  'BLOCK OFFICERS, NOTIFY SHOOTERS OF LATE SHOTS AND THE EXPOSURE IN WHICH THEY OCCURRED.',
  'BLOCK OFFICERS, SIGNAL WHEN THE LINE IS CLEAR.',
];

const RIFLE_EIC_LOAD = [
  'SECURE A MAGAZINE… LOAD… MAKE READY.',
  'WEAPONS ON SAFE…',
  'WATCH, MOVE, AND SHOOT. WATCH, MOVE, AND SHOOT.',
];
const RIFLE_EIC_CLEAR = [
  'CEASE FIRE… CEASE FIRE… CEASE FIRE.',
  'BLOCK OFFICERS, INSPECT AND CLEAR ALL WEAPONS AND MAGAZINES. ENSURE ALL WEAPONS ARE GREEN AND CLEAR. COLLECT UNUSED AMMO.',
  'IS THE FIRING LINE CLEAR? CLEAR ON THE RIGHT? CLEAR ON THE LEFT? THE FIRING LINE IS CLEAR.',
];

const PISTOL_BRIEF =
  'THIS IS YOUR SAFETY BRIEFING. FOLLOW ALL COMMANDS FROM THE TOWER. KEEP YOUR WEAPON POINTED DOWN RANGE WHEN UNHOLSTERED. DO NOT LOAD YOUR WEAPON UNTIL INSTRUCTED TO DO SO. DO NOT HOLSTER YOUR WEAPON UNTIL CLEARED BY A RANGE SAFETY. IF YOU HAVE A MALFUNCTION, YOU MUST APPLY IMMEDIATE ACTION, PROPERLY AND IN A TIMELY FASHION. THIS IS A NO ALIBI MATCH. EVERYONE IS A SAFETY. IF YOU SEE AN UNSAFE ACT, YOU MAY CALL A CEASE-FIRE. IF YOUR WEAPON CANNOT BE CLEARED SAFELY, STOP AND ENSURE THE LINE SAFETY IS AWARE OF THE PROBLEM AND THEY WILL ASSIST YOU.';

export const MATCH_CALLS: MatchCall[] = [
  {
    code: 'PI2210',
    title: 'Combat Pistol EIC',
    weapon: 'Pistol',
    rounds: 40,
    maxPoints: 200,
    safetyBrief: PISTOL_BRIEF + ' DO NOT HOLSTER IN THE PRONE POSITION.',
    setup: [
      'RELAY # TO THE FIRING LINE. ENSURE YOU ARE NOT NEXT TO A TEAM MEMBER. GROUND YOUR RIFLE BEHIND THE 30 YARD LINE.',
      'WEAPON IN YOUR HOLSTER AND LATCHED, SLIDE FORWARD, CHAMBER EMPTY, SAFETY ON. DO NOT HANDLE YOUR WEAPON.',
      'YOU WILL FIRE 40 ROUNDS IN FOUR STAGES. FOUR TARGETS; TWO 5-ROUND MAGAZINES PER STAGE.',
      'IS THE FIRING LINE CLEAR? … SHOOTERS, MOVE DOWN RANGE AND PLACE YOUR TARGETS. (pasters, staplers, plugs on the range)',
      'RETURN TO THE 30 YARD LINE. IS THE DOWN RANGE AREA CLEAR? BLOCK OFFICERS SIGNAL WHEN READY.',
    ],
    stages: [
      { name: 'Stage 1', distance: '30 yd', position: 'Standing', shots: '10 (2 × 5-rd mags)', exposures: [60],
        sequence: '5 rounds on target 1, reload, 5 rounds on target 2.', commands: PISTOL_LOAD,
        afterStage: [...PISTOL_CLEAR, 'FILL TWO MAGAZINES OF FIVE ROUNDS EACH. TAKE A KNEE, STAND WHEN READY.', 'MOVE TO THE 25 YARD LINE.'] },
      { name: 'Stage 2', distance: '25 yd', position: 'Kneeling to prone', shots: '10 (2 × 5-rd mags)', exposures: [45],
        sequence: '5 rounds kneeling on target 3, reload, 5 rounds prone on target 4.', commands: PISTOL_LOAD,
        afterStage: ['CEASE FIRE, CEASE FIRE, CEASE FIRE.', 'DO NOT HOLSTER IN THE PRONE POSITION. I SAY AGAIN, DO NOT HOLSTER IN THE PRONE POSITION.',
          'BLOCK OFFICERS, INSPECT AND CLEAR ALL WEAPONS AND MAGAZINES AND HAVE THE SHOOTER RISE BEFORE HOLSTERING.',
          'IS THE FIRING LINE CLEAR? … THE FIRING LINE IS CLEAR.', 'FILL TWO MAGAZINES OF FIVE ROUNDS EACH.',
          'HAND YOUR SCORECARDS TO THE SHOOTER ON YOUR RIGHT. MOVE DOWN RANGE AND SCORE. DO NOT REPAIR UNTIL SCORE IS VERIFIED.', 'RETURN TO THE 20 YARD LINE.'] },
      { name: 'Stage 3', distance: '20 yd', position: 'Standing', shots: '10 (2 × 5-rd mags)', exposures: [20],
        sequence: '5 rounds on target 1, reload, 5 rounds on target 2.', commands: PISTOL_LOAD,
        afterStage: [...PISTOL_CLEAR, 'FILL TWO MAGAZINES OF FIVE ROUNDS EACH.', 'MOVE TO THE 15 YARD LINE.'] },
      { name: 'Stage 4', distance: '15 yd', position: 'Standing', shots: '10 (2 × 5-rd mags)', exposures: [15],
        sequence: '5 rounds on target 3, reload, 5 rounds on target 4.', commands: PISTOL_LOAD,
        afterStage: [...PISTOL_CLEAR, 'SHOOTERS POLICE THE BRASS ON ALL YARD LINES.'] },
    ],
    closing: [
      'THIS COMPLETES THE FIRING FOR MATCH PI2210 (EIC).',
      'HAND YOUR SCORECARDS TO THE SHOOTER ON YOUR RIGHT. FAR-END SHOOTER HANDS SCORECARD TO RANGE STAFF.',
      'REMOVE ALL TARGETS, RETRIEVE EQUIPMENT AT THE 30 YARD LINE, EXIT TO THE LEFT AND PROCEED TO THE SCORING AREA.',
    ],
  },
  {
    code: 'RIFLE EIC',
    title: 'Rifle EIC',
    weapon: 'Rifle',
    rounds: 50,
    maxPoints: 500,
    safetyBrief:
      'THIS IS YOUR SAFETY BRIEFING. KEEP YOUR WEAPONS POINTED DOWN RANGE AT ALL TIMES. FOLLOW ALL COMMANDS FROM CENTER LINE. DO NOT LOAD YOUR WEAPON UNTIL INSTRUCTED TO DO SO. THIS IS A NO ALIBI MATCH. IF YOU HAVE A MALFUNCTION, YOU MUST APPLY IMMEDIATE OR REMEDIAL ACTION PROPERLY AND IN A TIMELY FASHION. IF THE WEAPON CANNOT BE CLEARED SAFELY, STOP AND ENSURE THAT THE LINE SAFETY KNOWS OF THE PROBLEM AND CAN GET THE WEAPON CLEARED SAFELY. BLOCK OFFICERS AND SHOOTERS, ENSURE WEAPONS ARE ON SAFE AND WITHOUT A ROUND IN THE CHAMBER DURING ALL MOVEMENT STAGES.',
    setup: [
      'Ensure each shooter has one 10-round magazine loaded for Stage 1.',
      'Allow 5 seconds between each command.',
    ],
    stages: [
      { name: 'Stage 1', distance: '25 yd', position: 'Standing', shots: '10 (1 mag)', exposures: [60],
        sequence: '10 shots to target #1.', commands: RIFLE_EIC_LOAD, afterStage: RIFLE_EIC_CLEAR },
      { name: 'Stage 2', distance: '25 yd', position: 'Kneeling', shots: '10', exposures: [45],
        sequence: '10 shots to target #2.', commands: RIFLE_EIC_LOAD, afterStage: RIFLE_EIC_CLEAR },
      { name: 'Stage 3', distance: '25 yd', position: 'Sitting', shots: '10', exposures: [45],
        sequence: '10 shots to target #3.', commands: RIFLE_EIC_LOAD, afterStage: RIFLE_EIC_CLEAR },
      { name: 'Stage 4', distance: '25 yd', position: 'Prone', shots: '20', exposures: [60],
        sequence: '20 shots to target #4.', commands: RIFLE_EIC_LOAD, afterStage: RIFLE_EIC_CLEAR },
    ],
    closing: ['This completes the firing for the Rifle EIC.'],
  },
  {
    code: 'PI2250',
    title: 'Pistol Anti-Body Armor',
    weapon: 'Pistol',
    rounds: 36,
    maxPoints: 180,
    safetyBrief: PISTOL_BRIEF,
    setup: [
      'RELAY # GROUND YOUR RIFLE ON THE 30 YARD LINE AND MOVE TO THE 15 YARD LINE. DO NOT SHOOT NEXT TO A TEAM MEMBER.',
      'WEAPON IN YOUR HOLSTER AND LATCHED, SLIDE FORWARD, CHAMBER EMPTY, SAFETY ON.',
      'MOVE DOWN RANGE AND HANG YOUR TARGETS (4 × Fig 11). RETURN TO THE 15 YARD LINE.',
      'Range officer takes roll call and confirms medical personnel are standing by.',
    ],
    stages: [
      { name: 'Stage 1 – Anti-body armor', distance: '15 yd', position: 'Standing, draw each exposure', shots: '12', exposures: [4, 4, 4, 4], interval: 7,
        sequence: 'Each exposure: 2 to the torso, 1 to the face, one target per exposure, left to right. No facial hit = no score on that target. Facial hits 5 pts; extra facial hits 2 pts.',
        commands: [...PISTOL_LOAD.slice(0, 4), 'ASSUME THE STAGE STARTING POSITION.', 'WATCH AND SHOOT, WATCH AND SHOOT.', 'FIRE. (4 sec, horn) — wait at least 7 sec — repeat ×4'],
        afterStage: [...PISTOL_CLEAR, 'MOVE DOWN RANGE, PASS SCORECARDS TO THE RIGHT. SCORE AND REPAIR QUICKLY. NO HEAD SHOT = NO SCORE FOR THAT TARGET.', 'RETURN TO THE 15 YARD LINE.'] },
      { name: 'Stage 2 – Quick-fire multi-target', distance: '15 yd', position: 'Standing', shots: '24 (2 × 12-rd mags)', exposures: [7, 6, 5, 4], interval: 7,
        sequence: 'Exp 1 (7s) & 2 (6s): one shot each on T1–T4, then two more on T1. Exp 3 (5s) & 4 (4s): two shots each on T2, T3, T4.',
        commands: [...PISTOL_LOAD.slice(0, 4), 'ASSUME THE STAGE STARTING POSITION.', 'WATCH AND SHOOT, WATCH AND SHOOT.', 'FIRE 7 … FIRE 6 … FIRE 5 … FIRE 4 (horn each, ≥7 sec between)'],
        afterStage: [...PISTOL_CLEAR, 'SHOOTERS… POLICE THE BRASS. (30 sec – 1 min)'] },
    ],
    closing: [
      'HAND YOUR SCORECARDS TO THE SHOOTER ON YOUR RIGHT. END SHOOTER IS SCORED BY RANGE STAFF.',
      'COLLECT YOUR TARGETS, RIFLE AND EQUIPMENT AT THE 30 YARD LINE, EXIT TO THE LEFT AND PROCEED TO THE SCORING AREA.',
      'NEXT RELAY TO THE FIRING LINE.',
    ],
  },
  {
    code: 'RI3020',
    title: 'Rifle Reflexive Fire',
    weapon: 'Rifle',
    rounds: 36,
    maxPoints: 180,
    safetyBrief:
      'THIS IS YOUR SAFETY BRIEFING. KEEP YOUR WEAPONS POINTED DOWN RANGE AT ALL TIMES. FOLLOW ALL COMMANDS FROM CENTER LINE. DO NOT LOAD YOUR WEAPON UNTIL INSTRUCTED TO DO SO. IF YOU HAVE A MALFUNCTION, YOU MUST APPLY IMMEDIATE OR REMEDIAL ACTION PROPERLY AND IN A TIMELY FASHION. IF THE WEAPON CANNOT BE CLEARED SAFELY, STOP AND ENSURE THAT THE LINE SAFETY KNOWS OF THE PROBLEM AND CAN GET THE WEAPON CLEARED SAFELY. BLOCK OFFICERS AND SHOOTERS, ENSURE WEAPONS ARE ON SAFE.',
    setup: [
      'SHOOTERS, WEAPON ON SAFE, BOLT TO THE REAR, SAFETY BLOCK INSERTED. GROUND YOUR WEAPONS.',
      'GO FORWARD, PUT UP YOUR TARGETS (4 × Fig 11) AND RETURN TO THE 50 YARD LINE.',
      'BLOCK OFFICERS, SIGNAL WHEN READY. SHOOTERS RECOVER YOUR WEAPONS.',
    ],
    stages: [
      { name: 'Stage 1 – Anti-body armor', distance: '25 yd', position: 'Standing from low ready', shots: '12 (1 mag)', exposures: [4, 4, 4, 4], interval: 7,
        sequence: 'Each exposure: 2 to the torso, 1 to the face, left to right. Must have a facial hit to score the target. BLOCK OFFICERS, WATCH CLOSELY FOR LATE SHOTS.',
        commands: RIFLE_LOAD, afterStage: [...RIFLE_CLEAR, 'SHOOTERS, GO FORWARD QUICKLY. SCORE AND REPAIR TARGETS. PASS SCORECARDS TO THE LEFT.', 'RETURN TO THE 25 YARD LINE.'] },
      { name: 'Stage 2 – Quick-fire multi-target', distance: '25 yd', position: 'Standing from low ready', shots: '24 (2 × 12-rd mags)', exposures: [7, 6, 5, 4], interval: 10,
        sequence: 'Exp 1 (7s) & 2 (6s): one shot each on T1–T4, then two more on T1. Exp 3 (5s) & 4 (4s): two shots each on T2, T3, T4.',
        commands: RIFLE_LOAD, afterStage: [...RIFLE_CLEAR, 'SHOOTERS, POLICE THE BRASS. (2 min)'] },
    ],
    closing: [
      'SHOOTERS, GO FORWARD AND REMOVE YOUR TARGETS FROM THE TARGET FRAME.',
      'RECOVER YOUR WEAPONS, EXIT THE RANGE AND PROCEED TO THE SCORING AREA.',
    ],
  },
];

// ---- How to score (from the NGMTC scorecards in the Match Call Booklet) ----

export type Scoring = {
  target?: { src: string; caption: string };
  scorecard: { src: string; caption: string };
  table?: string[][];
  steps: string[];
  notes: string[];
};

const FIG11_STEPS_STAGE1 = [
  'Stage 1 (anti-body armor): for each target, first check for a hit in the facial area. No facial hit = that target scores zero, even with body hits.',
  'If the target has a facial hit, write the facial hits in the "Facial Area" row (×5) and the body hits in the ring rows: 5, 4, 3, 2.',
  'Count a maximum of 3 hits per target. Extra facial hits beyond the first are worth only 2 points each.',
  'Multiply each row by its factor and add them up for the Stage 1 sub total (max 60).',
];
const FIG11_STEPS_STAGE2 = [
  'Stage 2 (quick-fire): no facial requirement. Record body hits by ring — 5, 4, 3, 2 — and fill in "hits per target."',
  'Count a maximum of 6 hits per target.',
  'Multiply each row by its factor and add them up for the Stage 2 sub total (max 120).',
  'Add both sub totals, then subtract 5 points for each late shot or penalty. Max total 180.',
];
const FIG11_TABLE = [['Zone', 'Points'], ['Facial area (required in Stage 1)', '5'], ['Extra facial hits (Stage 1)', '2 each'], ['Body ring 5', '5'], ['Body ring 4', '4'], ['Body ring 3', '3'], ['Body ring 2', '2']];
const SIGN_OFF = 'The scorer prints their name and signs to certify the score; the shooter signs to concur. Don\'t paste targets until both agree.';

export const MATCH_SCORING: Record<string, Scoring> = {
  PI2210: {
    scorecard: { src: '/match/scorecard-pi2210.png', caption: 'NGMTC Form PI2210 scorecard' },
    table: [['Ring', 'Points'], ['X', '5 (also counted as an X)'], ['5', '5'], ['4', '4'], ['3', '3'], ['2', '2']],
    steps: [
      'After Stage 2, pass your scorecard to the shooter on your right. The far-end shooter is scored by a block officer.',
      'For each target (1–4), write how many hits are in each ring: X, 5, 4, 3, 2. A target counts a maximum of 5 hits per block.',
      'Add across each row into "Hits," multiply by the factor (X ×5, 5 ×5, 4 ×4, 3 ×3, 2 ×2), and add the rows for the Stages 1 & 2 sub total (max 100).',
      'Verify with the shooter, then paste the targets. Repeat the same process in the Stages 3 & 4 block after the last stage (max 100).',
      'Subtract 5 points for each late shot or penalty.',
      'Write the total with the number of Xs, e.g. "176-6X." Max 200.',
    ],
    notes: ['Ties are broken by X count.', SIGN_OFF],
  },
  'RIFLE EIC': {
    target: { src: '/match/target-rifle-eic.png', caption: '25 yd Rifle EIC combat target' },
    scorecard: { src: '/match/scorecard-rifle-eic.png', caption: 'NGMTC Form RI3210 scorecard' },
    table: [['Ring', 'Points'], ['Center (X)', '10, and counted as an X'], ['9', '9'], ['8', '8'], ['7', '7'], ['6', '0 — a 6 counts as a miss'], ['Off the target', '0 (visible misses are marked)']],
    steps: [
      'Each stage has its own row on the card: Stage 1 standing, 2 kneeling, 3 sitting, and Stage 4 prone across two rows (20 shots).',
      'Write the value of every shot in its own box (7–10 by ring; a 6 or anything outside it is a miss and scores 0). A shot touching a line gets the higher ring.',
      'Add each row into "Total."',
      'Count every hit in the center ring and write it in "Total # of X\'s."',
      'Add the stage totals for the match total, written with the X count, e.g. "474-32X."',
    ],
    notes: [
      'The team scores Rifle EIC out of 500 (50 shots × 10). The printed RI3210 card says "max possible score 250" — ask the match director which scale the match is using.',
      'Ties are broken by X count.',
      SIGN_OFF,
    ],
  },
  PI2250: {
    scorecard: { src: '/match/scorecard-pi2250.png', caption: 'NGMTC Form PI2250 scorecard' },
    table: FIG11_TABLE,
    steps: [...FIG11_STEPS_STAGE1, ...FIG11_STEPS_STAGE2],
    notes: ['PT2350 is a paper match built from the combined PI2250 scores.', SIGN_OFF],
  },
  RI3020: {
    scorecard: { src: '/match/scorecard-ri3020.png', caption: 'NGMTC Form RI3020 scorecard' },
    table: FIG11_TABLE,
    steps: [...FIG11_STEPS_STAGE1, ...FIG11_STEPS_STAGE2],
    notes: ['Block officers tell shooters about late shots and which exposure they happened in — those come off at 5 points each.', SIGN_OFF],
  },
};
