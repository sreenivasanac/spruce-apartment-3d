// SINGLE SOURCE OF TRUTH — every number here is in INCHES (plan space).
// Plan space: x = plan-right (compass SOUTH), y = plan-down (compass WEST, toward the deck),
// origin = outer top-left corner of spruce_layout.png. Elevations are inches above finished floor.
// World space (three.js): X = x*IN, Y = up, Z = y*IN. Convert exactly once, via m().
// Derivations + photo citations: docs/spec.md.

export const IN = 0.0254;
export const m = (inches) => inches * IN;
export const FT = 12;

// ---------------------------------------------------------------- envelope
export const ENV = {
  w: 316.5, // x extent (26'4.5")
  d: 307, //   y extent (25'7")  -> 316.5*307/144 = 675 sq ft (listing: 676)
  extWall: 6,
  intWall: 4.5,
  ceiling: 96, // user-confirmed 8'
  kitchenCeiling: 90, // dropped kitchen ceiling, IMG_3934/3946
  door: { h: 80, casing: 2.5, casingT: 0.6, slabT: 1.4 },
  baseboard: { h: 5.25, t: 0.6 },
  eye: 67, // 5'7" walk-mode eye height
};

// Key grid lines (interior faces unless noted)
export const X = {
  northInt: 6, //         inside face of plan-left exterior wall
  bathE: 66, //           bath / tub alcove far side (60" tub)
  coatClosetW: 73, //     coat closet + W/D back
  hallWallA: 101, //      wall holding coat-closet doors, W/D door, bedroom door (faces 101..105.5)
  hallWallB: 105.5,
  entryA: 107, entryB: 143, // 36" entry door opening
  bedLivA: 148, bedLivB: 152.5, // bedroom | living wall
  stubA: 220.5, stubB: 225, //    kitchen stub walls
  southInt: 310.5, //     inside face of plan-right exterior wall
};
export const Y = {
  eastInt: 6, //          inside face of entry (plan-top) wall
  tubFront: 36,
  bathS: 66, bathWallB: 70.5,
  coatClosetS: 58.5, wdN: 63, wdS: 93, wdWallB: 97.5,
  bedDoorA: 97.5, bedDoorB: 128,
  vanityA: 70.5, vanityB: 108,
  linenA: 112.5, linenB: 152,
  bedClosetWallA: 128, bedClosetA: 132.5, bedClosetDoors: 156.5,
  bedroomN: 156.5,
  stubTopEnd: 40, stubBotStart: 106,
  penA: 110, penB: 135.5, ponyB: 140, // peninsula counter / pony wall
  westInt: 301, //        inside face of deck-side exterior wall
  deckOuter: 373,
};

// Rooms (interior rectangles, for floors / labels / area check). [x0,y0,x1,y1]
export const ROOMS = {
  living: { r: [152.5, 140, 310.5, 301], label: 'Living 13\'2" x 13\'5"', floor: 'lvp' },
  dining: { r: [105.5, 6, 220.5, 140], label: 'Dining / Entry', floor: 'lvp' },
  kitchen: { r: [225, 6, 310.5, 135.5], label: 'Kitchen', floor: 'lvp' },
  bedroom: { r: [6, 156.5, 148, 301], label: 'Bedroom 11\'10" x 12\'', floor: 'carpet' },
  hall: { r: [28, 70.5, 101, 128], label: 'Hall', floor: 'lvp' },
  bedEntry: { r: [38.5, 128, 71.5, 156.5], label: '', floor: 'lvp' },
  bath: { r: [6, 6, 66, 66], label: 'Bath', floor: 'lvp' },
  vanity: { r: [6, 70.5, 28, 108], label: '', floor: 'lvp' },
  linen: { r: [6, 112.5, 34, 152], label: 'Closet', floor: 'lvp' },
  coat: { r: [73, 6, 101, 58.5], label: 'Closet', floor: 'lvp' },
  wd: { r: [70.5, 63, 101, 93], label: 'W/D', floor: 'lvp' },
  bedCloset: { r: [76, 132.5, 148, 156.5], label: 'Closet', floor: 'carpet' },
  deck: { r: [152.5, 307, 316.5, 373], label: 'Deck', floor: 'deck' },
};

// Walls: axis 'x' = runs along x at y=c (c = low face), axis 'y' = runs along y at x=c.
// t = thickness, a..b = extent, h = height (default ceiling), openings: {a,b,sill,head,id}
export const WALLS = [
  // exterior
  { id: 'ext-east', axis: 'x', c: 0, t: 6, a: 0, b: 316.5, openings: [{ id: 'entry', a: 107, b: 143, sill: 0, head: 80 }] },
  { id: 'ext-west', axis: 'x', c: 301, t: 6, a: 0, b: 316.5, openings: [
    { id: 'bedWindow', a: 40, b: 112, sill: 36, head: 84 },
    { id: 'slider', a: 180, b: 276, sill: 0, head: 80 },
  ] },
  { id: 'ext-north', axis: 'y', c: 0, t: 6, a: 0, b: 307, openings: [] },
  { id: 'ext-south', axis: 'y', c: 310.5, t: 6, a: 0, b: 307, openings: [] },
  // bath
  { id: 'bath-e', axis: 'y', c: 66, t: 7, a: 6, b: 66, openings: [] }, // plumbing wall bath|coat closet
  { id: 'bath-s', axis: 'x', c: 66, t: 4.5, a: 6, b: 73, openings: [{ id: 'bathDoor', a: 36, b: 64, sill: 0, head: 80 }] },
  // coat closet / WD / bedroom-door wall (x = 101..105.5)
  { id: 'hall-wall', axis: 'y', c: 101, t: 4.5, a: 6, b: 128, openings: [
    { id: 'coatCloset', a: 8, b: 56, sill: 0, head: 80 },
    { id: 'wdDoor', a: 64, b: 92, sill: 0, head: 80 },
    { id: 'bedDoor', a: 97.5, b: 127.5, sill: 0, head: 80 },
  ] },
  { id: 'coat-s', axis: 'x', c: 58.5, t: 4.5, a: 73, b: 101, openings: [] },
  { id: 'wd-w', axis: 'y', c: 66, t: 4.5, a: 63, b: 97.5, openings: [] }, // W/D back wall (x 66..70.5)
  { id: 'wd-s', axis: 'x', c: 93, t: 4.5, a: 66, b: 101, openings: [] },
  // vanity / linen
  { id: 'linen-n', axis: 'x', c: 108, t: 4.5, a: 6, b: 38.5, openings: [] },
  { id: 'linen-front', axis: 'y', c: 34, t: 4.5, a: 112.5, b: 152, openings: [{ id: 'linenDoor', a: 120, b: 144, sill: 0, head: 80 }] },
  { id: 'linen-s', axis: 'x', c: 152, t: 4.5, a: 6, b: 38.5, openings: [] },
  // bedroom closet
  { id: 'bedcloset-n', axis: 'x', c: 128, t: 4.5, a: 71.5, b: 152.5, openings: [] },
  { id: 'bedcloset-side', axis: 'y', c: 71.5, t: 4.5, a: 128, b: 159, openings: [] },
  { id: 'bedcloset-front', axis: 'x', c: 156.5, t: 2.5, a: 76, b: 148, openings: [{ id: 'bedClosetDoors', a: 78, b: 146, sill: 0, head: 80 }] },
  // bedroom | living
  { id: 'bed-liv', axis: 'y', c: 148, t: 4.5, a: 128, b: 301, openings: [] },
  // kitchen stubs + pony wall
  { id: 'stub-top', axis: 'y', c: 220.5, t: 4.5, a: 6, b: 40, openings: [] },
  { id: 'stub-bot', axis: 'y', c: 220.5, t: 4.5, a: 106, b: 140, openings: [] },
  { id: 'pony', axis: 'x', c: 135.5, t: 4.5, a: 225, b: 310.5, h: 34.5, openings: [] },
];

// Doors (swing data for trim/doors module). hinge: which end of the opening ('a'|'b'), swing: +1/-1 along wall normal.
export const DOORS = {
  entry: { w: 36, wall: 'ext-east', hinge: 'a', swingInto: 'dining', openDeg: 0, type: 'slab-entry' },
  bathDoor: { w: 28, wall: 'bath-s', hinge: 'b', swingInto: 'bath', openDeg: 88, type: 'slab' },
  bedDoor: { w: 30, wall: 'hall-wall', hinge: 'a', swingInto: 'hall', openDeg: 84, type: 'slab' }, // 84: lever clears the W/D side wall
  wdDoor: { w: 28, wall: 'hall-wall', hinge: 'a', swingInto: 'dining', openDeg: 100, type: 'louver' }, // IMG_3945: hinged on the entry-side jamb, standing open
  linenDoor: { w: 24, wall: 'linen-front', hinge: 'b', swingInto: 'hall', openDeg: 0, type: 'slab' }, // IMG_3940/3941: lever on the vanity side
  coatCloset: { w: 48, wall: 'hall-wall', type: 'bypass-slab' },
  bedClosetDoors: { w: 68, wall: 'bedcloset-front', type: 'bypass-mirror' },
};

// Glazing
export const SLIDER = {
  a: 180, b: 276, h: 80, frame: 2.25, frameD: 4, sillH: 1.25,
  sash: { stile: 2.5, top: 2.5, bottom: 3.5, t: 1.4, overlap: 2.5 }, pull: { elev: 36, h: 8, w: 1.4, proj: 1.3 },
  screen: { frame: 1.25, t: 0.4 },
  valance: { x0: 158.5, x1: 288, h: 5.5, d: 4.5, elev: 86, boardT: 0.75 }, // IMG_3925: runs ~9" past the S casing and over the blind stack
  blindsStackAt: 'a', blindsStack: [160, 183], vanes: 34, vaneW: 3.4, vaneBottom: 1.5, vaneTop: 88,
};
export const BED_WINDOW = {
  a: 40, b: 112, sill: 36, head: 84, frame: 2, frameD: 3, sash: 1.6, sashT: 1.2, mullion: 2,
  blindValance: { h: 3, d: 2.5, w: 76, elev: 83 }, blind: { slats: 26, slatW: 2, slatPitch: 0.15, railH: 0.7, cordDrop: 24 },
};
// Door joinery + hardware (openings item). Shell openings are the FINISHED openings; jamb = thin white lining.
export const DOOR_HW = {
  jambT: 0.12, gap: 0.1, undercut: 0.5, pinOut: 0.3, stop: { w: 1.25, t: 0.4 },
  lever: { elev: 36, backset: 2.375, roseR: 1.3, roseT: 0.35, neckR: 0.42, proj: 2.4, len: 4.4, h: 0.75, t: 0.5 },
  hinge: { h: 3.5, r: 0.28, elevs: [7, 40, 72] },
  entry: { slabT: 1.75, undercut: 0.6, deadboltElev: 45, deadbolt: { w: 2.7, h: 5.2, t: 1 }, knockerElev: 58, knocker: { w: 1.4, h: 3.6 },
    threshold: { h: 0.5, out: 0.75 }, corridorCasing: { w: 3.5, t: 0.75 }, sidePanel: { w: 13, h: 78, stile: 1.75, midRail: 30, plaque: 5, plaqueElev: 44 } },
  louver: { stile: 4.25, topRail: 4.5, midRail: [36.5, 41.5], botRail: 5.5, pitch: 1.1, slatW: 1.5, slatT: 0.22, tiltDeg: 38, leverElev: 33 },
  bypass: { overlap: 1, panelT: 1.125, trackH: 1.5, trackD: 3, pullR: 1.1, pullElev: 38, pullInset: 3,
    mirror: { overlap: 1.25, panelT: 1, stile: 1.25, trackD: 2.3, botTrackH: 0.4, peek: 1.5 } },
};
export const DECK = {
  depth: 66, x0: 152.5, x1: 316.5, floorDrop: 2, railH: 42, slatW: 5.5, slatGap: 3.5, slatT: 1.5, capW: 5.5,
  heightAboveGrade: 60, partitionAt: 'x1', partitionH: 80,
  // Daikin condenser, plan-left end, fan face toward plan-right (IMG_3927). x,y = plan centre; w runs along y.
  condenser: { w: 33, d: 13, h: 23, x: 169, y: 333, feetH: 2.5, edgeR: 1, grille: { w: 22, h: 19.5, inset: 1.5 }, valveCover: { w: 4, h: 11, d: 8 } },
  // railing build-up (IMG_3926/3927): slats outside, 2x apron + raised bottom rail inside, 4x4 posts, 2x6 cap
  capT: 1.5, slatsFront: 18, slatsReturn: 7, slatBelowFloor: 8, apronH: 5.5, bottomRailH: 3.5, bottomRailGap: 3, post: { w: 3.5, d: 2.5 }, postsAt: [0.27, 0.5, 0.73],
  slabT: 10, fasciaT: 1.5, skinT: 0.6, // stucco skin over the framed wall
  soffitElev: 94, soffitSlabT: 12, dripEdge: { h: 2, t: 0.75, tooth: 3 },
  partition: { t: 3, gapBelow: 5, frameW: 2.5, battenW: 2.5, battenT: 0.75, pitch: 8.5, post: 3.5 }, // IMG_3930
  sconce: { dia: 5, h: 9, x: 303, elev: 85, plateW: 5.5, plateH: 11, bandH: 0.8 }, // cylinder sconce above the partition (IMG_3930)
  disconnect: { w: 5, h: 8, d: 3, x: 166, elev: 44 }, linesetDia: 1.1, lineHide: { w: 3, d: 2.5, x: 177 },
  // building massing beyond the unit (ASSUMED, stylised): mirrored units, 3 storeys at 108" floor-to-floor
  bldg: { floorToFloor: 108, storeys: 3, unitsN: 2, unitsS: 1, eave: { over: 14, t: 10 } },
};
// Stylised exterior backdrop (assumption A10): positions estimated by perspective from IMG_3926-3930. Plan inches.
export const SCENERY = {
  redwoods: [ // x, y, base diameter; first two are the trunks framing the pool in IMG_3929
    [318, 470, 44], [125, 500, 40], [420, 1180, 40], [-60, 1350, 36], [640, 640, 38], [-230, 760, 34], [60, 1700, 40], [-420, 1250, 36], [330, 1750, 38], [900, 1500, 40],
  ],
  redwoodH: 1100, mulchR: 85,
  pool: { cx: 190, cy: 960, a: 215, b: 95, bend: 75, coping: 9, waterDrop: 3 },
  poolDeck: { cx: 210, cy: 940, r: 330, apronTo: [520, 700, 900, 1230], joint: 120, lift: 1 },
  path: { w: 50 },
  poolHouse: { x0: 520, y0: 860, w: 400, d: 340, wallH: 104, eaveOver: 34, fasciaH: 14, roofBase: 300, roofH: 150 },
  loungersNear: 6, loungersFar: 5, lounger: { w: 26, l: 76, seatH: 13, backL: 28, backDeg: 50 },
  umbrellas: [[30, 1150], [-40, 1080], [420, 1190], [-110, 1190]], umbrella: { r: 54, h: 96, canopyH: 20 },
  lampPosts: [[166, 640], [560, 760]], lampH: 90,
  farTreeRing: [1700, 3200], farTreeCount: 70, farTreeH: [450, 1100],
  shrubBed: { y0: 309, y1: 420 }, // mulch + shrubs along the building, below the bedroom window and the deck
  skyR: 9000, lawnR: 5000,
};

// ---------------------------------------------------------------- kitchen
export const KITCHEN = {
  counterH: 36, counterT: 1.25, counterD: 25.5, baseD: 24, baseH: 34.75, toeKick: 4, backsplashH: 4,
  upperBottom: 54, upperTop: 87, upperD: 12.5, pullL: 6,
  fridge: { w: 35.75, d: 31, h: 69.5, x0: 225.5, y0: 6.5 }, // GE bottom-freezer, east wall
  overFridgeCab: { w: 36, h: 16.5, d: 24 }, // 1" air gap over the fridge hinge caps (IMG_3946)
  eastRun: { drawerBase: [261.5, 285] }, // 4-drawer base between fridge and corner
  southRun: { base1: [31.5, 55.5], range: [55.5, 85.5], base2: [85.5, 110] }, // y extents along south wall
  range: { w: 29.9, d: 27, h: 36, backguardH: 10 },
  microwave: { w: 29.9, h: 16.5, d: 15.5, bottom: 53 }, // hangs ~1" below the uppers (IMG_3946); cabinet above fills to upperTop
  peninsula: { dw: [226, 250], sinkBase: [250, 280], corner: [280, 310.5], overhang: 1.5 },
  sink: { w: 21, d: 16, depth: 8, cx: 265, cy: 121, r: 2.75 },
  // --- detail sizes (kitchen builder) ---
  doorT: 0.75, reveal: 0.125, drawerH: 6, kickRecess: 3, edgeR: 0.12, splashT: 0.75,
  pull: { dia: 0.5, standoff: 1.25, postInset: 1, edge: 2, end: 2.25 }, // bar Ø, clear projection, post inset from bar end, from door edge, from door top/bottom
  upperCornerX: 298, upperFiller: 1.5, // S-wall uppers run past the peninsula corner (IMG_3932 left edge, IMG_3933, IMG_3948 top-left)
  southUppers: [[20, 31.8, 1, 'r'], [31.8, 55.5, 2], [85.5, 109.5, 2], [109.5, 128, 1, 'l']], // [y0, y1, doors, pullSide] (IMG_3946 door count)
  fridgeD: { caseD: 26.5, doorT: 3, bulge: 1.5, gap: 0.2, split: 27, grille: 3.5, hingeH: 0.75, handleR: 0.55, handleOff: 2.4, handleL: 25, freezerHandleW: 29, badge: 1.1 },
  rangeD: { bodyD: 25, doorT: 2, glassT: 0.4, drawerTop: 11, doorTop: 33, window: [20, 11], handleDia: 1, handleOff: 2.3, backguardD: 2.5, knobDia: 1.9, knobL: 1.2, display: [9, 3], burners: [[-7.2, 7.5, 4.5], [7.2, 7.5, 3.2], [-7.2, 19, 3.2], [7.2, 19, 4.5]] }, // burners: [x, z from back, radius]
  mwD: { doorW: 22.6, ventH: 1.3, window: [16, 8.5], handleDia: 0.9, handleL: 12, handleOff: 1.6 },
  dwD: { w: 23.75, controlH: 5, doorBottom: 4.5 },
  faucet: { y: 132, colR: 0.85, colH: 9.5, spoutR: 0.5, spoutL: 5, spoutDropDeg: 22, leverL: 3.5, airGapDx: -5.5, airGapR: 0.85, airGapH: 2.2 },
  outlets: { elev: 44, plate: [2.75, 4.5, 0.25], southY: [42, 50, 93, 120] }, // on the S splash wall (IMG_3946, IMG_3933)
};

// ---------------------------------------------------------------- bath / vanity / laundry
export const BATH = {
  // one-piece fiberglass tub/shower (IMG_3942/3944): valve end at the N wall, apron faces +y
  tub: { l: 60, w: 30, h: 17, surroundH: 74, wallT: 2, cornerR: 4, edgeR: 0.8, topBevel: 0.5,
    rimFront: 4, rimBack: 2.5, rimEnd: 3, basinR: 5, basinSlope: 3.5, floorElev: 1.5, apronRecess: 0.5, apronBand: 4.5, apronBase: 1.75,
    niche: { w: 6.5, bottom: 32, top: 46, depth: 1.5, fromValveWall: 35, barElev: 37 } },
  showerRod: { elev: 76, bow: 6, dia: 1, setback: 1, flange: 2.6 },
  showerHead: { elev: 75, armElev: 70, dia: 6, reach: 12, armDia: 0.7 },
  valve: { elev: 28, dia: 7 }, spout: { elev: 21, l: 5.5, dia: 1.7 }, overflow: { elev: 12.5, dia: 2.8 }, drain: { dia: 2.8, fromValveWall: 11 },
  toilet: { cy: 51, w: 17, l: 28.5, seatH: 16.5, tankH: 29, tankD: 8.25, tankGap: 0.75, tankBottom: 14.5, lidT: 1.4, rimH: 15, bowlW: 14, bowlL: 20.5,
    stop: { elev: 6, dy: 10 } },
  towelBar: { elev: 50, l: 24, standoff: 3, dia: 0.75 },
  paperHolder: { x: 21, elev: 24, arm: 6, standoff: 3 }, // IMG_3950: single-post holder on the bath S wall
  doorStop: { y: 46, elev: 2.6, l: 3 },
  vanity: { w: 37.5, d: 22, h: 34.5, topT: 1.25, backsplash: 4, splashT: 0.75, cabD: 20.25, doorT: 0.75, toeKickH: 4, toeKickRecess: 3,
    falseDrawerH: 6, reveal: 0.125, filler: 0.75, pullStandoff: 1.2, pullDia: 0.45,
    sink: { w: 17, d: 11.5, depth: 5.5, r: 1.2, fromBack: 6.5 }, faucet: { h: 6, dia: 1.9, reach: 4.5, fromBack: 3.3 },
    mirror: { w: 32, h: 38, bottom: 40, t: 0.2 }, // IMG_3941: ~0.87 of the alcove width, sits on the backsplash
    towelRing: { elev: 48, fromBack: 13, dia: 6 }, light: { w: 24, elev: 84 } },
};
export const LAUNDRY = {
  unit: { w: 23.5, d: 26, h: 33.5 }, stackGap: 0.5,
  // GE 24" front-load pair, IMG_3945. Units sit against the plan-up (y=63) side; 5.5" gap on the plan-down side holds duct/cord/hoses.
  sideGap: 1, frontX: 99.5, feetH: 0.6, edgeR: 0.7, stackKitInset: 0.4,
  panelH: 6.2, panelInset: 0.9, // control fascia strip at the top of each front
  door: { cz: 15.2, outerDia: 19.5, glassDia: 13.5, glassDomeR: 4, proud: 1.5 }, // cz = door centre above unit bottom
  knob: { dia: 2.3, proud: 1.1, dryerFromLeft: 9.3, washerFromLeft: 17 },
  drawer: { w: 7.2, h: 3.4, fromLeft: 1.4 }, // washer detergent drawer
  filterCover: { dia: 3.2, fromRight: 3.6, elev: 3.4 },
  label: { w: 6.6, h: 5.2, fromLeft: 1.2, elev: 1.6 }, // dryer instruction sticker
  duct: { dia: 4.1, topX: 94, bottomX: 73, topElev: 96, bottomElev: 37 }, // flex foil in the plan-down side gap: ceiling at the front -> behind the dryer
  receptacle: { w: 4.5, h: 4.5, d: 1.8, x: 91, elev: 47 }, cordDia: 0.55, cordHookElev: 79,
  cordLowElev: 30, washerBox: { w: 9, h: 7, d: 0.6, x: 72.5, elev: 17 }, hoseDia: 0.9, drainDia: 1.2,
};
// Closet shelf + rod (IMG_3938 bedroom closet, IMG_3940 linen): white painted shelf on wall cleats, natural pine rod below.
export const CLOSET = {
  shelfTop: 69, shelfD: 12, shelfT: 0.75, noseR: 0.25,
  cleat: { h: 3.5, t: 0.75 }, // 1x4 cleats on back + side walls; side cleats carry the rod sockets
  rod: { dia: 1.3125, centreBelowShelf: 2.6, out: 10.5 }, socket: { dia: 2.4, t: 0.5 },
  bracket: { padW: 3.5, plateW: 1.1, plateH: 10, plateT: 0.12, arm: 11, strutDia: 0.45, minSpan: 48 }, // centre shelf-and-rod bracket on spans >= minSpan
  panel: { w: 14.5, h: 30, proud: 0.75, top: 60, x0: 114.5, doorInset: 0.9, latch: { w: 0.9, h: 0.55 } }, // load centre, bedroom-closet back wall
};

// ---------------------------------------------------------------- fixtures
export const FIXTURES = {
  kitchenOval: { l: 32, w: 18, h: 4, cx: 262, cy: 70, rimH: 2.6, strapAt: 9.5, strapW: 1.1 }, // long axis along y (IMG_3934); 2 nickel straps
  underCab: { elev: 53.5, inset: 4, w: 0.6, t: 0.3, runs: [ // warm LED tape under the uppers (IMG_3946); a..b along the wall
    { id: 'east', wall: 'E', a: 261.5, b: 310 }, { id: 'south-1', wall: 'S', a: 6.5, b: 55.5 }, { id: 'south-2', wall: 'S', a: 85.5, b: 110 } ] },
  diningTrack: { l: 44, cx: 168, cy: 40, heads: 4, bar: 0.8, drop: 3, canopyDia: 5, canopyH: 1.2, headDia: 2.3, headL: 3.8, stem: 1.6 }, // bar runs along x (IMG_3934)
  hallFlush: { dia: 13, h: 3.75, cx: 70, cy: 100 },
  entryFlush: { dia: 13, h: 3.75, cx: 125, cy: 30 },
  bathFlush: { dia: 13, h: 3.75, cx: 36, cy: 51 }, // ASSUMED (no photo of the bath ceiling)
  vanityBar: { dia: 4.5, cage: 2.2, standoff: 1.5, plateH: 4.5, plateT: 0.6 }, // length + elevation: BATH.vanity.light (IMG_3941)
  miniSplit: { w: 32, h: 11.5, d: 8.5, elevTop: 92, wall: 'bed-liv', cy: 278 }, // bedroom head, IMG_3935
  outlets: { elev: 14, switchElev: 46 },
};

// ---------------------------------------------------------------- furniture (pos = plan x,y of center; rot = degrees about up)
export const FURNITURE = {
  desk: { w: 63, d: 24, h: 29, topT: 1, leg: 1.5, pos: [298, 232], rot: -90, // w/d/h user-measured; rest from table.jpg
    endPanelW: 16.5, tubeT: 1, frameInset: 0.5, railInset: 1, railH: 1.5, footH: 0.5, footDia: 1.2, edgeR: 0.06, tubeR: 0.12, woodTile: 24 },
  chair: { w: 25, d: 25.5, h: 47, seatH: 18.5, pos: [270, 232], rot: 90, // estimated from office_chair1/2.jpg
    seat: { w: 19, d: 19, t: 3, r: 4.5, panT: 0.8 }, back: { w: 18.5, h: 21, bottom: 20.5, r: 4.5, taper: 0.84, reclineDeg: 8, lumbar: 1.4, wrap: 1.6, tube: 0.55, z: -7.6 },
    head: { w: 12.5, h: 6.5, r: 2.4, wrap: 1.3, tiltDeg: 12, dz: 0.3 }, arm: { topElev: 25.5, x: 11, len: 12.5, tube: 0.42, bandW: 1.9, flareDeg: 3 },
    base: { r: 11, armW: 1.6, hubR: 1.7, hubTop: 6.2, tipTop: 3.6 }, caster: { dia: 2.2, w: 0.75, gap: 0.5 }, lift: { r: 1.05, pistonR: 0.55, top: 11 }, mech: { w: 7, d: 9, h: 1.6 } },
  futon: { w: 66, d: 33, h: 31, seatH: 15, armW: 8, legH: 5, pos: [169.5, 222], rot: 90, // ASSUMED typical click-clack futon (sofa 66x33x31, bed ~66x38.5)
    bodyW: 61, backL: 17, backT: 6, backBand: 2, gusset: 2.4, reclineDeg: 20, seatGrid: [6, 2], backGrid: [3, 3], puff: 0.8, dimple: 0.45, edgeR: 1.2, pipeR: 0.17,
    consoleW: 10, consoleT: 4, cupR: 1.55, cupDepth: 2.2, armT: 5.5, armTiltDeg: 6, legTopR: 1.05, legBotR: 0.55, stayR: 0.4, linenTile: 4 },
    bodyW: 61, backL: 18.5, backT: 6, backTuck: 1.5, backBand: 2, reclineDeg: 20, seatGrid: [6, 2], backGrid: [3, 3], puff: 0.8, dimple: 0.45, edgeR: 1.2, pipeR: 0.17,
    consoleW: 10, consoleT: 4, cupR: 1.55, cupDepth: 2.2, armT: 5.5, armTiltDeg: 6, legTopR: 1.05, legBotR: 0.55, stayR: 0.4, linenTile: 6 },
  // rot -90: the table's front (+Z, the side the top lifts toward) faces the futon sitter (plan -x)
  liftTop: { w: 41, d: 19.5, h: 16.5, legH: 5.5, liftRise: 7.5, liftFwd: 6, marbleW: 15, pos: [209, 222], rot: -90, // ASSUMED; ~13" knee gap to the futon front
    topT: 0.7, panelT: 0.6, fasciaInset: 0.4, topGap: 0.08, edgeR: 0.04, cornerR: 0.1,
    leg: { topR: 0.8, botR: 0.5, inset: 2.6, splayDeg: 3, centreR: 0.4, footH: 0.25 },
    mech: { closedDeg: 8, armW: 0.8, armT: 0.14, armGap: 6, frontPivotZ: 7.5, railW: 0.5, railH: 0.8, plateT: 0.12, plateH: 1.8, pinR: 0.22, barR: 0.2,
      spring: { bodyR: 0.36, rodR: 0.15, along: 5, baseBack: 9, baseDrop: 5.5 }, seconds: 0.9 } },
  mandir: { w: 29.5, d: 13, h: 71, baseH: 28, pos: [188, 12.8], rot: 0, // bookcase, ASSUMED Sauder-style 5-shelf w/ doors
    // carcass details scaled off bookcase.jpg (w/h/d are OVERALL incl. cornice overhang)
    corniceH: 4.75, corniceSteps: [[0.9, 0.25], [0.7, 0.5], [0.65, 0.7], [2.5, 1]], corniceOver: 1, sideT: 1.5, backT: 0.25, topT: 0.75,
    plinthH: 3.25, plinthProud: 0.25, deckT: 1.5, shelfT: 1, shelfInset: 1, nosingH: 1.25, nosingD: 0.6, edge: 0.06, // corniceSteps = [h, overhang] bottom→top
    door: { t: 0.75, gap: 0.125, frameW: 2.4, panelRaise: 0.3, pullH: 4, pullOff: 1.4, pullProj: 0.8, pullElevFrac: 0.62 },
    // puja articles (ASSUMED typical sizes, styled after home_mandir_earlier.jpeg)
    decor: { runnerDrop: 2.5, runnerMargin: 0.75, frameBar: 0.8, frameT: 0.6, frameLean: 7, pic: [7, 9], omPic: [7.5, 9],
      murtiH: 5.2, smallMurtiH: 3.4, diyaR: 1.15, vilakkuH: 9, lotusH: 3.6, plateR: 2.9, bellH: 3.6, incenseL: 8, flameH: 0.95 } },
  bed: { mattW: 54, mattL: 75, mattT: 12, frameW: 55.5, frameL: 77, deckH: 14, headH: 42, pos: [45, 225], rot: 90 },
  // wife's bedroom set (user request): IKEA LAGKAPTEN top + ALEX drawer unit + 2 ADILS legs; same chair model
  wifeDesk: { w: 47.25, d: 23.625, h: 29, topT: 1.375, alex: { w: 14.125, d: 22.875, h: 27.5, drawers: 5 }, legDia: 1.6, pos: [135.7, 238], rot: -90 }, // 47" user-given
  wifeChair: { module: 'chair', w: 25, d: 25, h: 47, seatH: 18.5, pos: [108, 238], rot: 90 },
  // ANTBOX portable wardrobe, user-given 19.7 x 40.2 x 67 (40.2 is the 3-door front width, 19.7 the depth)
  wardrobe: { w: 40.2, d: 19.7, h: 67, cols: 3, tiers: [29.5, 23.5, 14], pos: [16.1, 279.5], rot: 90 },
};

// Sun (user-confirmed: deck faces WEST = +y). Golden hour as in the 6:20 PM photos.
// azimuthFromWestDeg > 0 = sun sits toward plan-right (S): the 17 Sep 6:20 PM sun is WSW, so light travels toward plan-left —
// bedroom-window sun lands on the N wall + hall (IMG_3935/3937), slider sun lands beside the closet-back wall (IMG_3933).
export const SUN = { azimuthFromWestDeg: 18, elevationDeg: 13 };
