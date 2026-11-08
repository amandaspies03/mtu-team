// Resources hub content. Written from the team's own briefs, lesson plans and match books.
// The repo is public: no names, phone numbers, emails or internal links in here.
//
// Guide bodies use a tiny markdown subset: "## " headings, "- " bullets, "1. " numbered steps,
// "| a | b |" table rows, "> " callouts, and blank lines between paragraphs.

export type Guide = { id: string; title: string; summary: string; body: string };

export type ResourceCategory = {
  id: string;
  title: string;
  description: string;
  icon: 'crosshair' | 'backpack' | 'trophy' | 'shield' | 'user' | 'info';
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
      guides: [
        {
          id: 'fundamentals',
          title: 'The marksmanship fundamentals',
          summary: 'The three things that matter most, and the ones that come next.',
          body: `Shooting is a mental and a physical sport. Everything we coach comes back to a short list of fundamentals.

## Primary
- **Sight alignment** — rear sight centered and level, front sight centered in it. Sight alignment matters more than sight picture.
- **Consistent cheek weld** (rifle) — the same reference point on the stock in every position. A common anchor is nose on the charging handle, but every shooter is different.
- **Trigger control** — slow, steady pressure until the shot surprises you.

## Secondary
- Sight picture and wobble
- Positions and stability
- Natural point of aim
- Breathing
- Ammunition differences

## Why alignment beats picture
Sight alignment errors are angular, so they grow with distance. A tiny tilt at 25 yards is a big miss at 500. If you have to choose, keep the sights aligned and accept a little wobble in the picture.

## A few numbers worth knowing
- 1 minute of angle (MOA) is about 1 inch per 100 yards.
- Sights, scopes and wind calls are all measured in MOA.

> Shoot through the center of your glasses lens — even safety glasses. Looking through the edge bends light and throws off your sight alignment, with pistol and rifle alike.`,
        },
        {
          id: 'pistol-grip-sights',
          title: 'Pistol grip, stance and the M18 sights',
          summary: 'Build a grip you can repeat, and aim the dot the right way.',
          body: `## Grip
- Get a consistent firing grip, with the support hand filling as much open space on the frame as possible. It may feel uncomfortable at first.
- Lock your wrists. Loose wrists soak up the energy the slide needs to cycle (that's where most new-shooter stovepipes come from).
- Keep the same grip pressure through the whole shot — don't squeeze harder as the trigger breaks.
- No "teacup" grip (support hand cupped under the magazine). That's a revolver habit.
- Too high is possible: if a thumb or finger brushes the slide, it slows it down.

## Stance
- Balanced, with a slight forward lean, like a fighting stance. That lean helps you manage recoil.
- Fighting (bladed) stance and square stance both work. Pick the one you can repeat accurately.
- Recoil should travel up and back through your whole body, not pivot at your wrists, elbows or hips.

## Sight alignment on the SIG M18
The M18 uses a **cover-dot** front sight:
- The front dot covers the spot you want to hit.
- Don't hold the dot under the target like you would with other sight systems.
- Keep your focus on the front sight, centered and level in the rear notch.

> What works for you is what you can do consistently and accurately. Try options with an instructor, then stick with one.`,
        },
        {
          id: 'trigger-control',
          title: 'Trigger control and follow-through',
          summary: 'Find the wall, press straight back, and stay on the trigger.',
          body: `1. Take up the slack until you feel the **trigger wall**.
2. Press straight back with smooth, steady pressure. Curling your finger in an arc pulls the muzzle down before the shot breaks.
3. Let the shot surprise you. Don't pre-react to the recoil.
4. **Follow through** — eyes open, sights on target, keep pressing as the bullet leaves the barrel.
5. Release only to the **reset** point, then take the slack up again.
6. Don't lift your finger completely off the trigger between shots. The second you do, you lose your consistency.

## Finger placement
Tip of the finger or closer to the first joint is shooter preference. Experiment, then be consistent.

## Breathing
- Don't hold your breath — it causes fatigue and blurry vision.
- One technique: in through the nose for 4 seconds, out through the mouth for 4, pause for 4. Your muscles are most relaxed in the pause after you exhale.
- Slow fire: take your time, relax, breathe. Rapid fire: keep a steady breathing rhythm so you stay oxygenated.`,
        },
        {
          id: 'reading-targets',
          title: 'Reading your target',
          summary: 'Low-left groups, big groups, and what to do about them.',
          body: `Every shooter, new or experienced, has something to fix every time they shoot. Your target tells you what it is.

## Low left (right-handed) / low right (left-handed)
Shots land low and to your support side, and the muzzle dips just before the shot.

Common causes:
- Anticipating recoil
- Jerking or slapping the trigger
- Tightening the firing hand during the press
- Poor trigger finger placement
- Closing your eyes as the shot breaks
- Lifting the finger off the trigger between shots

Fixes:
- Run the Trigger Wall drill and the One Hot, One Not drill
- Keep sight alignment all the way through the press
- Hold the same grip pressure through the whole shot
- Stay on the trigger the entire time

## "Shotgunning" — big, scattered groups
Common causes:
- Inconsistent grip and sight alignment
- Moving the trigger finger around
- Moving during the press
- No follow-through

Fixes: slow down and go through your process every shot. Re-establish your grip, dry fire the fundamentals, and use the Trigger Wall drill to isolate the trigger.

> Dry fire. This is a perishable skill — two range days a month isn't enough on its own.`,
        },
        {
          id: 'pistol-drills',
          title: 'Pistol practice drills',
          summary: 'The drills we run at practice, and what each one builds.',
          body: `| Drill | What it builds |
| Trigger Wall | Learning where the trigger breaks |
| One Hot, One Not | Follow-through and anticipation |
| Dot Torture | Accuracy under deliberate fire |
| Reload Drill | Efficient weapon manipulation |
| Holster Draw | Clean presentation from the holster |
| Independent Practice | Your own weakest area |

## Trigger Wall — 10 yards, 17 rounds
From low ready, come up on target and take the slack to the wall. Hold it there. When the timer beeps (random delay), press through smoothly. Reset to the wall without lifting your finger and wait for the next beep.

## Dot Torture — 5 yards, 10 rounds
One shot per dot, at your own pace, without breaking stance or reshooting a missed dot. Don't chase your hits — keep your focus on the sights and analyze the target when you're done. Every dot is its own test.

## Reload Drill — 10 yards, 20 rounds
Start with one round chambered and an empty magazine in the gun, loaded magazine in your pouch. Fire one, reload, fire one. Bring the pistol into your workspace so you can see the magazine well in your peripheral vision, and set your firing grip before you go back to the target. Slow is smooth, smooth is fast.

## Holster Draw — 15 yards, 17 rounds
Hands up and away from the holster. On "fire," draw, take off safe, fire one, safe, reholster, reset. The goal is a good grip in the holster and sights flat as you push out.`,
        },
        {
          id: 'pistol-positions',
          title: 'Kneeling, prone and moving between targets',
          summary: 'Position work for the EIC and the other pistol matches.',
          body: `## Kneeling
- Sit back on your feet. Sitting straight up on your knees is very unstable.
- Keep the same slight forward lean and the same grip you use standing.
- On the start signal, set your firing grip while the pistol is still in the holster, get into position, then draw. A good first grip sets the pace for the whole stage.

## Prone
- Get your body in line behind the pistol.
- Move into and out of prone safely, and keep the muzzle off the ground.
- **Never holster in the prone position.** Rise first, after you've been cleared.

## Transitions
- Lead with your eyes, then drive the pistol to the next target.
- Don't overtravel. Get an acceptable sight picture before you fire.
- After every movement, re-establish grip, stance and sight picture.

## Rapid fire
- Keep watching the sights through recoil.
- Reset the trigger between shots and find a steady cadence.
- Acceptable accuracy beats speed. Control recoil without over-gripping.`,
        },
        {
          id: 'rifle-positions',
          title: 'Rifle positions and conditions',
          summary: 'Standing, kneeling, sitting and prone, plus weather effects.',
          body: `Positional shooting depends on your own body and mechanics. Find what works, then practice it until it's repeatable.

- **Standing** — the least stable; minimize wobble with good bone support.
- **Kneeling** — a canted foot under you helps. Not as stable as it looks.
- **Sitting** — tip from a teammate's data book: put your support elbow in the pocket of your knee.
- **Prone** — the most stable. Anchor your position well.

General rules:
- More contact with the ground or your body means more stability.
- A stable position may feel uncomfortable at first.
- Everyone wobbles. Accept the best wobble area you can get and break the shot smoothly inside it.

## Weather and your wind call
- Temperature or altitude **up** → wind adjustments **down**
- Temperature or altitude **down** → wind adjustments **up**
- Humidity or barometric pressure **up** → wind adjustments **up**
- Humidity or barometric pressure **down** → wind adjustments **down**`,
        },
        {
          id: 'dry-fire',
          title: 'Dry fire at home',
          summary: 'Cheap, safe reps between practices.',
          body: `Two range days a month won't make you a good shooter by themselves. Dry fire fills the gap.

- If you don't have an M16- or M18-pattern firearm, an airsoft or BB version works. The trigger will feel different, but the grip, sights and manipulation carry over.
- Treat a training gun like a real one, every time.
- Good things to dry fire: trigger wall presses, holster draws, reloads, and getting into kneeling and prone.
- Ask the staff about the team's MantisX challenge — search "184th MTU" in the app.`,
        },
      ],
    },
    {
      id: 'equipment',
      title: 'Equipment',
      description: 'What to bring, how to set it up, and how to take care of it.',
      icon: 'backpack',
      guides: [
        {
          id: 'what-to-buy',
          title: 'What the team provides vs. what to buy',
          summary: 'You don’t need to buy anything to compete.',
          body: `You don't need to buy anything to compete with the MTU. This is a starting point if you want to upgrade.

| Item | Team provides? | Worth buying? |
| Pistols and rifles | Yes | — |
| Magazines | Yes | Optional: extra PMAGs save loading time |
| Holster | Yes | Optional: one that fits your draw |
| Eye protection (clear) | Yes | Optional: tinted ballistic glasses for outdoor matches |
| Ear protection | Yes | Optional: electronic ear pro |
| Helmet | Through LRS | Optional — no bump helmets at matches |
| Canteen | Yes | Optional: 3 L+ hydration bladder |
| Gear belt | No | **The first upgrade to consider** |
| Plate carrier | Plates through LRS | Lightweight carrier if you'll shoot Nationals |
| Gloves | No | Optional |

> Don't spend $200 on sunglasses. Gear gets lost and left on ranges.`,
        },
        {
          id: 'gear-belt',
          title: 'Setting up a gear belt',
          summary: 'The single best upgrade for match efficiency.',
          body: `Most matches have you load 4 rifle magazines and 4 pistol magazines. Where you carry them makes a big difference.

## Recommended layout
- Rifle mags on a plate carrier or LBV
- Pistol mags, holster, IFAK and a dump pouch on the gear belt

## Choosing a belt
A gear belt has two jobs: hold your pants up and hold your gear. Most modern belts are a two-belt system:
- An inner Velcro belt that goes through your belt loops
- An outer belt with all your gear on it that Velcros over the inner one and closes with a cobra-style buckle

That lets you take off all your gear at once while your pants stay up. Look at MOLLE attachment, how the size fits your belt loops, how easy it is on and off, and whether it's comfortable all day. Expect $30 to $150+.

## Tips
- Space is limited — measure your belt space before buying pouches.
- Zip-tie or fully secure your gear. You'll run and go prone at matches, and loose gear disappears.`,
        },
        {
          id: 'protection-hydration',
          title: 'Eye, ear and hydration',
          summary: 'Match requirements and what we recommend.',
          body: `## Eye protection
**Required at every match.** Clear, or non-reflective dark lenses. The team has clear glasses. For outdoor matches, tinted ballistic-rated glasses from a hardware store or online work well.

## Ear protection
**Required at every match.** The team provides it. Foam plugs are actually some of the best protection, and plugs under muffs is better still. If you buy your own, electronic hearing-enhancement muffs or buds run from about $50 to several hundred.

## Hydration
**Required: a water source on your person during the match** — a canteen or a backpack-style bladder. The team has canteens. If you buy one, a 3-liter or larger bladder in OCP or coyote brown is the recommendation.`,
        },
        {
          id: 'armor-helmet-gloves',
          title: 'Plate carrier, helmet and gloves',
          summary: 'What Nationals requires and what to look for.',
          body: `## Plate carrier
- Not required for most matches, but **required with plates at Nationals.**
- Many experienced shooters use a plate carrier instead of an LBV.
- Get a lightweight one — Nationals is a week long. Make sure it fits a 10×12" (full-size) plate.
- Plates can come from LRS.

## Helmet
- LRS provides helmets. Issued helmets are heavier, so adjust yours and wear it in short increments beforehand to avoid headaches and neck fatigue.
- **Bump helmets (with holes in the top) are not allowed at competitions.**

## Gloves
- Not required, but they can help grip and control.
- Get a snug fit (often a size smaller) with some venting — match weather is usually hot.
- If you'll wear them at matches, train in them regularly.`,
        },
        {
          id: 'magazines',
          title: 'Magazines',
          summary: 'Team mags are fine; extras save time.',
          body: `The team provides magazines. Extra rifle magazines mean less time loading on the line and can cut down on misfeeds.

- Magpul PMAGs are cheap (around $15) and reliable.
- Pistol magazines rarely cause problems, and the team has plenty.
- An overloaded or tightly packed rifle magazine can cause double feeds. Know your mag's real capacity.`,
        },
        {
          id: 'data-book',
          title: 'Keeping a data book',
          summary: 'Write down every string so you can see what to fix.',
          body: `A data book turns practice into progress. For every session, record:

- **Shooter and weapon** (your weapon number)
- **Date and time**
- **Conditions** — temperature, light (sun in your eyes? backlit?), wind speed and direction
- **How you felt** — tired, sore, rushed
- **Score by position** — Xs, 10s, 9s, 8s and so on, then the total
- **Notes per position** — what felt stable, what didn't, what went wrong
- **Overall notes** — what to work on and anything to buy or adjust

Example notes from a teammate's book: "heavy wind gusts, probably didn't anchor position well," "felt really stable, left elbow in pocket of knee," "threw one shot off paper — glasses kept slipping, buy glasses straps."

> Ask the staff for printed data book pages and plotting targets.`,
        },
        {
          id: 'zeroing',
          title: 'Zero: mechanical vs. true',
          summary: 'Record your adjustments so you can get back to them.',
          body: `- **Mechanical zero** — front and rear sights in their flush or neutral position, ready to adjust for the shooter.
- **True zero** — your adjustments from mechanical zero for your eye and your weapon.

Write down your true zero in your data book with the date, for example "front sight elevation: 5 clicks down" and "rear sight: 4 clicks right." If your weapon number changes or someone else shoots it, you can get back to your zero quickly.`,
        },
      ],
    },
    {
      id: 'match-guides',
      title: 'Match Guides',
      description: 'Courses of fire, scoring, and what to expect at each match the team shoots.',
      icon: 'trophy',
      guides: [
        {
          id: 'pistol-eic',
          title: 'Combat Pistol EIC (PI2210)',
          summary: '40 rounds, 4 stages, 200 points.',
          body: `M17/M18 pistol, 40 rounds, 4 stages on a known-distance range, 4 EIC targets. Two 5-round magazines per stage.

| Stage | Distance | Position | Time | Sequence |
| 1 | 30 yd | Standing | 60 s | 5 on T1, reload, 5 on T2 |
| 2 | 25 yd | Kneeling, then prone | 45 s | 5 kneeling on T3, reload, 5 prone on T4 |
| 3 | 20 yd | Standing | 20 s | 5 on T1, reload, 5 on T2 |
| 4 | 15 yd | Standing | 15 s | 5 on T3, reload, 5 on T4 |

Each stage is worth 50 points.

## Things to know
- This is a **no-alibi** match. If you have a malfunction, clear it with immediate action and keep going.
- **Do not holster in the prone position.**
- Fill two 5-round mags between stages. If you're filling mags, take a knee and stand when ready.
- The time drops fast in stages 3 and 4. Practice your reloads.

> The full tower commands and a stage timer are on the Match day page.`,
        },
        {
          id: 'rifle-eic',
          title: 'Rifle EIC',
          summary: '50 rounds at 25 yards, 4 positions, 500 points.',
          body: `M16/M4-series rifle, 50 rounds, all at 25 yards, one target per stage.

| Stage | Position | Shots | Time |
| 1 | Standing | 10 | 60 s |
| 2 | Kneeling | 10 | 45 s |
| 3 | Sitting | 10 | 45 s |
| 4 | Prone | 20 | 60 s |

## Things to know
- No-alibi match. Apply immediate or remedial action and keep going.
- Weapons on safe with no round chambered during all movement.
- Command to listen for: "WATCH, MOVE, AND SHOOT."
- Prone is 20 rounds in 60 seconds — know how you'll reload before you get there.

> The full tower commands and a stage timer are on the Match day page.`,
        },
        {
          id: 'anti-body-armor',
          title: 'Pistol Anti-Body Armor (PI2250)',
          summary: '36 rounds, 2 stages, 180 points. Face hits required.',
          body: `M17/M18 pistol, 36 rounds, 4 Figure 11 targets at 15 yards. Simulates engaging a combatant wearing body armor, then rapid multi-target engagements.

## Stage 1 — anti-body armor (60 points)
- 4 exposures of 4 seconds, at least 7 seconds apart. **Draw from the holster every exposure.**
- Each exposure: 2 shots to the torso, then 1 to the face, one target per exposure, left to right.

## Stage 2 — quick-fire multi-target (120 points)
- Two 12-round magazines. 4 exposures of 7, 6, 5 and 4 seconds.
- Exposures 1 and 2: one shot each on T1–T4, then two more on T1.
- Exposures 3 and 4: two shots each on T2, T3 and T4.

## Scoring the face
- **No hit in the facial area = no score on that target.**
- The facial area runs from below the chin up to the helmet brim, and the brim counts.
- Facial hits are 5 points. Extra facial hits are 2 points each.`,
        },
        {
          id: 'reflexive-fire',
          title: 'Rifle Reflexive Fire (RI3020)',
          summary: '36 rounds, 2 stages, 180 points. Close-quarters engagements.',
          body: `M16/M4-series rifle, 36 rounds, 4 Figure 11 targets at 25 yards, standing from the low ready.

## Stage 1 (60 points)
- One 12-round mag. 4 exposures of 4 seconds, at least 7 seconds apart.
- Each exposure: 2 to the torso, 1 to the face, left to right.
- Must have a facial hit to score the target.

## Stage 2 (120 points)
- Two 12-round mags. 4 exposures of 7, 6, 5 and 4 seconds.
- Exposures 1 and 2: one shot each on T1–T4, then two more on T1.
- Exposures 3 and 4: two shots each on T2, T3 and T4.

## Things to know
- Return to the low ready after every exposure, weapon on safe.
- Block officers watch for **late shots** and will tell you which exposure they happened in.`,
        },
        {
          id: 'scoring',
          title: 'Scorecards and scoring etiquette',
          summary: 'How scoring works on the line.',
          body: `1. After a stage, hand your scorecard to the shooter on your right. The shooter on the end is scored by a block officer or range staff.
2. Move downrange and score the targets.
3. **Don't repair (paste) targets until the score is verified** by both the shooter and the scorer.
4. Once the score is confirmed, paste the targets and return to the line.

## Ties and Xs
Ties are broken by X count, so keep an accurate count of Xs on every string.

## Team rule
Don't shoot next to a teammate. Tower commands at most matches tell you to check before relays line up.`,
        },
        {
          id: 'tag-match',
          title: 'Kansas TAG Match',
          summary: 'The state match: teams of four, lots of match types.',
          body: `The Kansas Adjutant General's marksmanship competition is our state match, held each spring. It's where the Governor's Twenty is earned.

## Teams
- Teams of four, with a designated team captain.
- Each team is two "old" (experienced) and two "new" shooters. Check the year's program for the exact definitions.
- A three-person team can shoot but isn't eligible for team awards. If you don't have a team, you'll be placed on one.
- **Everyone must pre-register** (recent years used PractiScore). No walk-ons.

## Matches you'll see
Recent programs included: EIC rifle and pistol, Reflexive Fire / Anti-Body Armor, Reflexive Fire (NVG), Last Supper, Figure It Out (pistol and rifle), Heritage, Overrun, and Rifle Falling Plate. Shotgun, M14 and M249 are provided where a match needs them.

## Bring
- **5 pistol magazines and 5 rifle magazines**
- Your holster
- Food and water — no meals are provided and there's no formal lunch break

> The match program changes every year. Read the current one before you go.`,
        },
        {
          id: 'team-matches',
          title: 'Team matches: Heritage, Overrun, Last Supper',
          summary: 'What the fun ones look like.',
          body: `## Heritage Match (240 points)
All iron sights, with an M16A2, M4, M14 and M249 per team. Two teams go head to head: on "fire," run from the base of the hill to the line and knock down targets from 100 to 800 yards in 2 minutes. 10 points per target, and targets reset if you clear your lane. The team captain assigns who shoots what.

## Overrun (145 points)
Starts inside a vehicle. Three shooters exit to steel with pistols and one runs the shotgun on cans. Then everyone grabs rifles from the trunk and engages steel at 200 yards from behind barriers, finishing with a single shot on the "matrix" target code you were given at the start (for example A4). Fastest team to clear everything wins.

## Last Supper (50 per shooter, 200 per team)
Pistols, 10 rounds each, 3-second exposures. The tower calls a dot (for example A4) and you put two hits on it.
- 10 yd — non-dominant hand only
- 15 yd — dominant hand only
- 20 yd — standing to kneeling
- 25 yd — standing to prone`,
        },
        {
          id: 'match-calendar',
          title: 'The matches we shoot',
          summary: 'State, regional, national and invitational matches.',
          body: `Dates change every year — check the Calendar for this year's.

| Match | Where | Usually |
| Kansas TAG (state) | KSTC range complex (Salina/Lindsborg area), KS | April |
| Winston P. Wilson (WPW) — Nationals | Camp Robinson, AR | April–May |
| CNGB Postal | Camp Robinson, AR | June |
| MAC 5 (regional) | Camp Greenlief, NE | Summer |
| MAC 6 (regional) | Camp Guernsey, WY | Summer |
| 184th Invitational | Kansas | May–June |

- EIC badges are earned at regional and national matches.
- The 184th Invitational registers through PractiScore. Make a free account first, then sign up from the match's registration link. If you don't have a full team, register anyway — we'll group you at the match.
- Matches require DTS authorization in addition to orders.`,
        },
      ],
    },
    {
      id: 'range-safety',
      title: 'Range & Safety',
      description: 'Range commands, safety rules, and what to do when something goes wrong.',
      icon: 'shield',
      guides: [
        {
          id: 'safety-rules',
          title: 'Weapons safety rules',
          summary: 'The rules that never change.',
          body: `1. Treat every firearm as if it were loaded.
2. Never point a firearm at anything you're not willing to destroy.
3. Keep your finger straight and off the trigger until your sights are on target and you're ready to fire.
4. Keep the weapon on safe until you're ready to fire.
5. Know your target, your line of fire, and what's behind and beyond it.

## On our range
- Everyone on the range is responsible for safety. **Anyone may call "CEASE FIRE!"** if they see an unsafe condition.
- Follow all RSO commands. Don't load until instructed.
- Don't touch firearms on a cold range unless instructed.
- Eye and hearing protection are mandatory for everyone — shooting or not.
- If in doubt, ask.`,
        },
        {
          id: 'safe-condition',
          title: 'Safe condition and clearing',
          summary: 'What “safe” looks like for the rifle and the pistol.',
          body: `## Rifle in safe condition
- On safe
- Magazine removed
- Bolt locked to the rear, chamber empty
- Empty chamber indicator inserted, if available (competition)

## Pistol in safe condition
- On safe
- Magazine removed
- Chamber empty
- Holstered or grounded

## Clearing an M16-type rifle
1. Selector on SAFE.
2. Remove the magazine.
3. Lock the bolt open with the bolt catch.
4. Visually check the chamber, that the magazine well can't feed a round, and that nothing is stuck on the bolt face.
5. Still on safe, let the bolt go forward by pressing the upper part of the bolt catch.

## Clearing a pistol
1. On safe (or decocked).
2. Remove the magazine.
3. Lock the slide to the rear.
4. Check the chamber, the magazine well, and the bolt face for rounds.`,
        },
        {
          id: 'range-commands',
          title: 'Range commands',
          summary: 'What the RSO and tower will say, and what it means.',
          body: `| Command | What it means |
| Range is hot | Firearms may be handled per the course of fire |
| Range is cold | No handling. Actions open, mags out, on safe, grounded or holstered |
| Lock | Insert the magazine |
| Load | Send the bolt forward or rack the slide to chamber a round |
| Watch and shoot / Watch, move and shoot | Get ready for the start signal |
| If finished, unload and show clear | Mag out, chamber clear, on safe. Wait for the RSO to clear you |
| Cease fire | Stop shooting immediately, muzzle in a safe direction, wait |

At practice, when you finish a string: slide or bolt locked back, on safe, pointed downrange, **hand raised**, and wait to be cleared off the line.

> Match tower commands for all four match-day matches are on the Match day page.`,
        },
        {
          id: 'medical-plan',
          title: 'Medical emergency plan',
          summary: 'Who does what if someone gets hurt.',
          body: `The RSO manages the medical emergency plan. Before training starts, the RSO identifies:
- Primary and secondary medical responders
- Primary and secondary 911/EMS callers
- Someone to meet and guide emergency responders
- Where the trauma kit / IFAK is

## If something happens
1. Call **"CEASE FIRE!"** immediately.
2. Unload, open actions, on safe, ground or holster weapons.
3. Confirm the line and the area are safe before anyone moves downrange or helps.
4. The RSO takes control of the range and directs everyone.
5. Designated responders treat the casualty. Everyone else helps only when directed.
6. The designated caller contacts 911/EMS with the range location and what happened.
7. The designated guide meets and directs responders to the casualty.
8. Keep the trauma kit visible and within reach.

Training doesn't resume until the emergency is over and the RSO says it's safe.`,
        },
        {
          id: 'rifle-malfunctions',
          title: 'Rifle malfunctions (M16A4)',
          summary: 'Tap, rack, reassess — and when not to.',
          body: `## Immediate action
1. **Tap** — tap the magazine to make sure it's seated.
2. **Rack** — pull the charging handle back sharply and release it cleanly.
3. **Reassess** — make sure it's still safe and still necessary to fire, then attempt to fire.

## Stovepipe (failure to eject)
The case is pinned in the ejection port by the bolt. Tap-rack-reassess with the ejection port tilted down clears most of them. If not, clear the brass by hand through the magazine well, reseat the mag and chamber a round.

## Double feed
1. Lock the bolt to the rear to take spring pressure off.
2. Rip the magazine out.
3. Rack two or three times. Dig out stuck rounds through the mag well if needed.
An overloaded magazine is a common cause.

## Failure to feed / chamber
Usually a magazine not fully seated — tap and tug down to check. A worn follower or too many rounds can also tilt the feed. If it keeps happening, the rifle has a real problem; tell the RSO.

## Bolt override (brass above the bolt)
The charging handle won't move. Remove the magazine, hold the charging handle and bump the buttstock on something solid to get the bolt back, then clear the brass with a tool.

## Failure to extract — serious
A case is left in the chamber, and the next round can be forced into it. Lock the bolt to the rear, on safe, remove the mag and loose rounds, and bump the buttstock on a firm surface to free it. Get the RSO.

> **Weak recoil or a "pop" instead of a bang: STOP. Don't use immediate action.** Lock the bolt back, on safe, mag out, and check the barrel. A bullet stuck in the barrel isn't a field fix.`,
        },
        {
          id: 'pistol-malfunctions',
          title: 'Pistol malfunctions',
          summary: 'Squib loads, stovepipes and double feeds.',
          body: `## Squib load — dangerous
The primer fires but the bullet doesn't leave the barrel. Firing another round into a blocked barrel can destroy the pistol and badly injure you.

**A delayed shot or an unusual sound is a squib until proven otherwise.**
1. Stop firing immediately.
2. Keep the muzzle pointed in a safe direction.
3. Tell the RSO you suspect a squib.
4. Don't fire again. The RSO checks the barrel before the pistol goes back into service.

## Stovepipe
The empty case sticks straight up out of the ejection port. It's the most common malfunction for new shooters, usually from a loose wrist or a grip so high it drags on the slide. Dirty guns, weak ammo and worn parts can cause it too.
1. Muzzle downrange, finger off the trigger.
2. Lock the slide to the rear to clear the case.
3. Make sure the barrel is clear.
4. Release the slide to chamber a round.
5. Re-establish your grip, then continue.

## Double feed
The empty case doesn't fully extract and a live round feeds in behind it. Causes include dirty or damaged magazines, a broken or dirty extractor, and a weak grip. Lock the slide back, remove the magazine, clear the chamber, reload.`,
        },
        {
          id: 'range-etiquette',
          title: 'Range etiquette',
          summary: 'Leave the range better than we found it.',
          body: `- Shoot only range-approved targets (paper). Only ceramic rounds on steel.
- Don't shoot posts, supports or target frames.
- Put everything back: target stands, rests and blocks, 2×4s.
- Police brass and trash, and pull all target paper.
- We're guests on the ranges we use. Leave them better than we found them.`,
        },
      ],
    },
    {
      id: 'new-shooters',
      title: 'New Shooters',
      description: 'Start here: how the team works, joining, and getting ready for your first practice.',
      icon: 'user',
      guides: [
        {
          id: 'about-mtu',
          title: 'How the MTU works',
          summary: 'What the team is for and who can join.',
          body: `The 184th Marksmanship Training Unit is dedicated to marksmanship training — keeping our most basic combat skill sharp. Most Airmen don't live-fire again after basic training unless they deploy. The intent is for **everyone to compete.**

## Who can join
- You must have completed Basic Training.
- You can't be in violation of the Lautenberg Amendment (no conviction for a crime of domestic violence).
- It's a real time commitment. Practices and matches can fall after duty hours, on weekends and on holidays.

## Team weapons
- M18 pistols
- M16A2s with A4 uppers, and M4s
- M14s (not used in competition)

## How it fits together
The team works under the wing and state marksmanship programs, the National Guard Marksmanship Training Center, and the Marksmanship Advisory Council (MAC) regions.

## Everyone helps
All shooters help run practices in some way. Full-time Airmen are especially important for transportation, vault access, ammo and equipment.`,
        },
        {
          id: 'joining',
          title: 'Joining and what we expect',
          summary: 'The membership agreement in plain language.',
          body: `New members sign a membership agreement. It covers:

- A **one-year commitment** to the MTU.
- Attending **at least 3 practices per quarter.**
- Shooting **at least 1 match a year** (TAG, Regionals/MAC, or Nationals).
- Meeting Air Force standards: fitness standards, good standing in your squadron, and staying on track with upgrade training.
- Being in a **military status** for every practice and match (see Orders and 336s).

Your supervisor signs it too, and team leadership approves it.

## As a new shooter
- Stay in good standing with your unit.
- Make safety your first priority at practices and matches.
- Ask for instruction from the coaches and experienced shooters — that's what they're there for.`,
        },
        {
          id: 'first-practice',
          title: 'Your first practice',
          summary: 'What to expect and what to bring.',
          body: `## Before
- Your orders must be done and printed before practice day (see Orders and 336s).
- RSVP on this site so staff can plan ammo and transportation.

## What to bring
- Printed copy of your orders
- Water
- Weather-appropriate clothes — most practices are outdoors
- Your own gear if you have it (belt, glasses, ear pro). The team covers the rest.

## How practice runs
1. **Safety brief** — safety rules, range commands, and the medical emergency plan with assigned roles.
2. **Instruction** — coaches teach the fundamentals or the match skills for the day.
3. **Drills** — structured drills that build on the instruction (see Pistol practice drills).
4. **Independent practice** — work on your weakest area with coaching.
5. **Cleanup** — police brass, pull targets, put the range back.

Bring questions. Every shooter on the team started where you are.`,
        },
        {
          id: 'orders-336',
          title: 'Orders and 336s',
          summary: 'You must be in a military status to practice. Here’s how.',
          body: `You must be in a military status (orders) to practice or compete with the team. **Technician status doesn't count** — it isn't tech duty.

## Status options
- **ST (preferred for Traditionals and Technicians)** — 1/30th pay plus allowances and an AD duty point. Days depend on wing availability, so plan ahead.
- AT, RSD, or points/no pay — with supervisor approval.
- AGRs, Title 32 and Title 10 members are already in status.

## Key rules
- Orders must be complete **before** practice day. **No VOCO orders.**
- **Bring printed proof of your orders.** No orders, no weapons.
- Orders can't be created after the fact. If they aren't approved in time, you can't shoot.
- MTU staff can't look up your orders. Making sure they're done is on you and your supervisor.
- No travel pay for practices (no DTS). Matches need DTS authorization in addition to orders.
- Practices are an 8-hour duty period.

## ST routing, step by step
1. Email your supervisor and the MTU NCOIC with the practices you can attend.
2. The NCOIC updates the MTU AT/ST tracker.
3. Fill out the ANG 336 from the MTU ST template, get your supervisor's signature, and send it to the NCOIC for day allocation.
4. The authorizing official signs and sends it to your CSS, who drafts the orders in AROWS.
5. Make sure your orders are cut **at least 2 weeks before** practice, and print them.
6. After practice, sign the order in AROWS so it processes for pay.

## Good to know
- Turn 336s in early. Unused ST days can be pulled back later in the year.
- If a practice is cancelled, cancel the 336 through your CSS and let the MTU know.`,
        },
      ],
    },
    {
      id: 'extra-information',
      title: 'Extra Information',
      description: 'Badges, awards, and other good-to-know information.',
      icon: 'info',
      guides: [
        {
          id: 'eic-badges',
          title: 'EIC points and badges',
          summary: 'How Excellence-in-Competition points add up to Distinguished.',
          body: `Excellence-in-Competition (EIC) matches award credit points toward the Distinguished Rifleman and Distinguished Pistol Shot badges. Rifle and pistol are tracked separately.

## How points are earned
- Shooters are ranked by score.
- Points go to the **top 10% of eligible non-distinguished shooters.**
- A match needs at least 10 eligible non-distinguished competitors for points to count.
- State championships award up to 4 points. Higher-level matches award more.

## The badges
| Badge | Credit points |
| Bronze EIC | First points earned (4 pts) |
| Bronze with wreath | 6 pts |
| Silver EIC with wreath | 20 pts |
| Distinguished | 30 pts |

Once you're Distinguished with a weapon, you're no longer eligible for EIC points with it.

> Point values and badge rules come from the Army EIC program (AR 350-66) and the Air Force guidance referenced in the team brief. Check with staff for the current Air Force rules.`,
        },
        {
          id: 'governors-twenty',
          title: "The Governor's Twenty",
          summary: 'The top 20 shooters at the state match.',
          body: `The Governor's Twenty recognizes the top 10 pistol shooters and the top 10 rifle shooters at the Kansas TAG Match.

In FY23, MTU shooters earned 10 of the 20 spots.`,
        },
        {
          id: 'match-travel',
          title: 'Traveling to matches',
          summary: 'Orders, DTS, and what to pack.',
          body: `- Matches require **orders and a DTS authorization.** Start early.
- Nationals (WPW) is a week long. Pack light where you can, and remember plates are required there.
- Bring your own food for long range days — meals often aren't provided.
- Read the match program before you go: check-in times, required equipment, and the courses of fire.
- Bring spare magazines and pack your gear so nothing falls off when you run or go prone.`,
        },
      ],
    },
  ],
};
