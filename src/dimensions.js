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
  roofT: 10, floorSlabT: 8, // structure above the ceiling / below the floor (blocks grazing sun leaks, reads solid in dollhouse)
  carpetT: 0.5, // carpet + pad stands ~1/2" proud of the LVP
  kitchenCeiling: 96, // NO drop: IMG_3933/3934 show one continuous ceiling plane dining->kitchen->living (name kept for dependants)
  door: { h: 80, casing: 2.5, casingT: 0.6, slabT: 1.4 },
  baseboard: { h: 5.25, t: 0.6 },
  eye: 67, // 5'7" walk-mode eye height
};

// Key grid lines (interior faces unless noted)
export const X = {
  northInt: 6, //         inside face of plan-left exterior wall
  bathE: 66, //           bath / tub alcove far side (60" tub)
  coatClosetW: 70.5, //   coat closet + W/D back (bath-e/wd-w wall is one 4.5" wall x 66..70.5, as drawn on the plan)
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
  coatClosetS: 50, wdN: 54.5, wdS: 84.5, wdWallB: 89, // W/D closet 30" for the 23.5" stack + duct; ~14" of wall between W/D and hall-door openings (IMG_3945)
  bedDoorA: 97.5, bedDoorB: 125.5, // 28" hall door; its casing butts the y=128 corner (IMG_3933)
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
  hall: { r: [38.5, 89, 101, 128], label: 'Hall', floor: 'lvp' },
  hallBath: { r: [28, 70.5, 66, 89], label: '', floor: 'lvp' }, // hall leg in front of bath door / vanity
  bedEntry: { r: [38.5, 128, 71.5, 156.5], label: '', floor: 'lvp' },
  bath: { r: [6, 6, 66, 66], label: 'Bath', floor: 'lvp' },
  vanity: { r: [6, 70.5, 28, 108], label: '', floor: 'lvp' },
  linen: { r: [6, 112.5, 34, 152], label: 'Closet', floor: 'lvp' },
  coat: { r: [70.5, 6, 101, 50], label: 'Closet', floor: 'lvp' },
  wd: { r: [70.5, 54.5, 101, 84.5], label: 'W/D', floor: 'lvp' },
  bedCloset: { r: [76, 132.5, 148, 156.5], label: 'Closet', floor: 'carpet' },
  deck: { r: [152.5, 307, 316.5, 373], label: 'Deck', floor: 'deck' },
};

// Walls: axis 'x' = runs along x at y=c (c = low face), axis 'y' = runs along y at x=c.
// t = thickness, a..b = extent, h = height (default ceiling), openings: {a,b,sill,head,id}
// accent: {side:'lo'|'hi', a?, b?} = darker gray paint on that face (lo = face at c, hi = face at c+t), optionally only a..b.
// Walls butt (never overlap) at corners so no coplanar faces z-fight.
export const WALLS = [
  // exterior
  { id: 'ext-east', axis: 'x', c: 0, t: 6, a: 0, b: 316.5, openings: [{ id: 'entry', a: 107, b: 143, sill: 0, head: 80 }] },
  { id: 'ext-west', axis: 'x', c: 301, t: 6, a: 0, b: 316.5, openings: [
    { id: 'bedWindow', a: 47, b: 119, sill: 24, head: 80 }, // IMG_3935: 28.7" from bed|living wall, sill 24" (outlet at 13" checks the scale)
    { id: 'slider', a: 180, b: 276, sill: 0, head: 80 },
  ] },
  { id: 'ext-north', axis: 'y', c: 0, t: 6, a: 6, b: 301, openings: [] },
  { id: 'ext-south', axis: 'y', c: 310.5, t: 6, a: 6, b: 301, openings: [], accent: { side: 'lo', a: 140, b: 301 } }, // living accent wall, IMG_3932
  // bath
  { id: 'bath-e', axis: 'y', c: 66, t: 4.5, a: 6, b: 66, openings: [] }, // bath | coat closet (shower plumbing is on the N wall, IMG_3942)
  { id: 'bath-s', axis: 'x', c: 66, t: 4.5, a: 6, b: 66, openings: [{ id: 'bathDoor', a: 39.5, b: 65.5, sill: 0, head: 80 }] }, // IMG_3937: leaf edge at x~41
  // coat closet / WD / hall-door wall (x = 101..105.5)
  { id: 'hall-wall', axis: 'y', c: 101, t: 4.5, a: 6, b: 128, openings: [
    { id: 'coatCloset', a: 8, b: 48, sill: 0, head: 80 },
    { id: 'wdDoor', a: 55.5, b: 83.5, sill: 0, head: 80 },
    { id: 'bedDoor', a: 97.5, b: 125.5, sill: 0, head: 80 },
  ] },
  { id: 'coat-s', axis: 'x', c: 50, t: 4.5, a: 70.5, b: 101, openings: [] },
  { id: 'wd-w', axis: 'y', c: 66, t: 4.5, a: 66, b: 89, openings: [] }, // W/D back wall (x 66..70.5), continues bath-e
  { id: 'wd-s', axis: 'x', c: 84.5, t: 4.5, a: 70.5, b: 101, openings: [] },
  // vanity / linen
  { id: 'linen-n', axis: 'x', c: 108, t: 4.5, a: 6, b: 38.5, openings: [] },
  { id: 'linen-front', axis: 'y', c: 34, t: 4.5, a: 112.5, b: 152, openings: [{ id: 'linenDoor', a: 120, b: 144, sill: 0, head: 80 }] },
  { id: 'linen-s', axis: 'x', c: 152, t: 4.5, a: 6, b: 38.5, openings: [] },
  // bedroom closet
  { id: 'bedcloset-n', axis: 'x', c: 128, t: 4.5, a: 71.5, b: 152.5, openings: [] },
  { id: 'bedcloset-side', axis: 'y', c: 71.5, t: 4.5, a: 132.5, b: 156.5, openings: [] },
  { id: 'bedcloset-front', axis: 'x', c: 156.5, t: 2.5, a: 71.5, b: 148, accent: { side: 'hi' }, // closet wall reads darker gray, IMG_3937
    openings: [{ id: 'bedClosetDoors', a: 79.5, b: 145.5, sill: 0, head: 80 }] }, // IMG_3937: 8.5" pier left, casing butts bed|living wall
  // bedroom | living
  { id: 'bed-liv', axis: 'y', c: 148, t: 4.5, a: 132.5, b: 301, openings: [] },
  // kitchen stubs + pony wall
  { id: 'stub-top', axis: 'y', c: 220.5, t: 4.5, a: 6, b: 40, openings: [] },
  { id: 'stub-bot', axis: 'y', c: 220.5, t: 4.5, a: 106, b: 140, openings: [] },
  { id: 'pony', axis: 'x', c: 135.5, t: 4.5, a: 225, b: 310.5, h: 34.5, openings: [], accent: { side: 'hi' } }, // living face gray, IMG_3932
];

// Doors (swing data for trim/doors module). hinge: which end of the opening ('a'|'b'), swing: +1/-1 along wall normal.
export const DOORS = {
  entry: { w: 36, wall: 'ext-east', hinge: 'a', swingInto: 'dining', openDeg: 0, type: 'slab-entry' },
  bathDoor: { w: 26, wall: 'bath-s', hinge: 'b', swingInto: 'bath', openDeg: 88, type: 'slab' },
  bedDoor: { w: 28, wall: 'hall-wall', hinge: 'a', swingInto: 'hall', openDeg: 88, type: 'slab' },
  wdDoor: { w: 28, wall: 'hall-wall', hinge: 'a', swingInto: 'dining', openDeg: 100, type: 'louver' }, // IMG_3945: hinged on the entry-side jamb, standing open
  linenDoor: { w: 24, wall: 'linen-front', hinge: 'b', swingInto: 'hall', openDeg: 0, type: 'slab' }, // IMG_3940/3941: lever on the vanity side
  coatCloset: { w: 40, wall: 'hall-wall', type: 'bypass-slab' },
  bedClosetDoors: { w: 66, wall: 'bedcloset-front', type: 'bypass-mirror' },
};

// Glazing
export const SLIDER = {
  a: 180, b: 276, h: 80, frame: 2.25, frameD: 4, sillH: 1.25,
  sash: { stile: 2.5, top: 2.5, bottom: 3.5, t: 1.4, overlap: 2.5 }, pull: { elev: 36, h: 8, w: 1.4, proj: 1.3 },
  screen: { frame: 1.25, t: 0.4 },
  valance: { x0: 158.5, x1: 288, h: 5.5, d: 4.5, elev: 86, boardT: 0.75 }, // IMG_3925: runs ~9" past the S casing and over the blind stack
  blindsStackAt: 'a', blindsStack: [160, 183], vanes: 34, vaneW: 3.4, vanePleat: 0.5, vaneBottom: 1.5, vaneTop: 88,
};
export const BED_WINDOW = {
  a: 47, b: 119, sill: 24, head: 80, frame: 2, frameD: 3, sash: 1.6, sashT: 1.2, mullion: 2.5,
  blindValance: { h: 3, d: 2.5, overhang: 2, drop: 1 }, blind: { slats: 26, slatW: 2, slatPitch: 0.15, railH: 0.7, cordDrop: 24 },
};
// Door joinery + hardware (openings item). Shell openings are the FINISHED openings; jamb = thin white lining.
export const DOOR_HW = {
  jambT: 0.12, gap: 0.1, undercut: 0.5, pinOut: 0.3, stop: { w: 1.25, t: 0.4 },
  lever: { elev: 36, backset: 2.375, roseR: 1.3, roseT: 0.35, neckR: 0.42, proj: 2.4, len: 4.4, h: 0.75, t: 0.5 },
  hinge: { h: 3.5, r: 0.28, elevs: [7, 40, 72] },
  entry: { slabT: 1.75, undercut: 0.6, deadboltElev: 45, deadbolt: { w: 2.7, h: 5.2, t: 1 }, knockerElev: 58, knocker: { w: 1.4, h: 3.6 },
    threshold: { h: 0.5, out: 0.75 }, corridorCasing: { w: 3.5, t: 0.75 }, sidePanel: { w: 13, h: 78, stile: 1.75, midRail: 30, plaque: 5, plaqueElev: 44 } },
  louver: { stile: 4.25, topRail: 4.5, midRail: [36.5, 41.5], botRail: 5.5, pitch: 1.1, slatW: 1.5, slatT: 0.22, tiltDeg: 38, leverElev: 33 },
  bypass: { carpetT: 0.5, trackGap: 0.15, overlap: 1, panelT: 1.125, trackH: 1.5, trackD: 3, pullR: 1.1, pullElev: 38, pullInset: 3,
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
  soffitElev: 94, dripEdge: { h: 2, t: 0.75 }, // soffit = underside of the balcony slab above
  partition: { t: 3, gapBelow: 5, frameW: 2.5, battenW: 3, battenT: 0.75, pitch: 9.5, post: 3.5 }, // IMG_3930
  sconce: { dia: 5, h: 9, x: 303, elev: 85, plateW: 5.5, plateH: 11, bandH: 0.8 }, // cylinder sconce above the partition (IMG_3930)
  disconnect: { w: 5, h: 8, d: 3, x: 166, elev: 44 }, linesetDia: 1.1, lineHide: { w: 3, d: 2.5, x: 177 },
  // building massing beyond the unit (ASSUMED, stylised): mirrored units, 3 storeys at 108" floor-to-floor
  bldg: { floorToFloor: 108, storeys: 3, unitsN: 2, unitsS: 1, eave: { over: 14, t: 10 } },
};
// Stylised exterior backdrop (assumption A10): positions estimated by perspective from IMG_3926-3930. Plan inches.
export const SCENERY = {
  redwoods: [ // x, y, base diameter; first two frame the pool in IMG_3929 (A also fills the slider in IMG_3925, B the bedroom window in IMG_3936)
    [300, 470, 44], [105, 500, 40], [590, 560, 38], [-230, 760, 34], [-420, 1250, 36], [60, 2150, 40], [430, 2050, 38], [950, 1750, 40], [-330, 1950, 36], [780, 2350, 38],
  ],
  redwoodH: 1100, canopyFrom: 230, mulchR: 85, // canopyFrom = lowest boughs above grade
  // distances from horizon-line perspective in IMG_3925/3929/3936: pool ~90 ft out, plaza edge ~30 ft out
  pool: { cx: 190, cy: 1400, a: 285, b: 135, bend: 90, coping: 10, waterDrop: 3 },
  poolDeck: { cx: 200, cy: 1350, r: 620, apronTo: [560, 780, 1250, 1450], joint: 120, lift: 4 },
  path: { w: 50 },
  poolHouse: { x0: 690, y0: 850, w: 420, d: 420, wallH: 104, eaveOver: 34, fasciaH: 14, roofBase: 320, roofH: 160, rotDeg: 18 },
  loungersNear: 6, loungersFar: 5, lounger: { w: 26, l: 76, seatH: 13, backL: 28, backDeg: 50 },
  umbrellas: [[-20, 1690], [-110, 1600], [560, 1560], [-200, 1720]], umbrella: { r: 54, h: 96, canopyH: 20 },
  lampPosts: [[166, 700], [-260, 800]], lampH: 90,
  farTreeRing: [2300, 3600], farTreeCount: 70, farTreeH: [450, 1100], centreY: 1400,
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
  fridgeD: { caseD: 26.3, doorT: 3, bulge: 1.5, gap: 0.2, split: 27, grille: 3.5, hingeH: 0.75, handleR: 0.55, handleOff: 2.4, handleL: 25, freezerHandleW: 29, badge: 1.1 },
  rangeD: { bodyD: 25, doorT: 2, glassT: 0.4, drawerTop: 11, doorTop: 33, window: [20, 11], handleDia: 1, handleOff: 2.3, backguardD: 2.5, knobDia: 1.9, knobL: 1.2, display: [9, 3], burners: [[-7.2, 7.5, 4.5], [7.2, 7.5, 3.2], [-7.2, 19, 3.2], [7.2, 19, 4.5]] }, // burners: [x, z from back, radius]
  mwD: { doorW: 22.6, ventH: 1.3, window: [16, 8.5], handleDia: 0.9, handleL: 12, handleOff: 1.6 },
  dwD: { w: 23.75, controlH: 5, doorBottom: 4.5 },
  faucet: { y: 132, colR: 0.85, colH: 9.5, spoutR: 0.5, spoutL: 4.2, spoutDropDeg: 8, swivelDeg: 35, headH: 2.4, leverL: 2.2, airGapDx: -5.5, airGapR: 0.85, airGapH: 2.2 },
  outlets: { elev: 44, plate: [2.75, 4.5, 0.25], southY: [42, 50, 93, 120] }, // on the S splash wall (IMG_3946, IMG_3933)
};

// ---------------------------------------------------------------- bath / vanity / laundry
export const BATH = {
  // one-piece fiberglass tub/shower (IMG_3942/3944): valve end at the N wall, apron faces +y
  tub: { l: 60, w: 30, h: 17, surroundH: 74, wallT: 2.5, cornerR: 4, edgeR: 0.8, topBevel: 0.5,
    rimFront: 4, rimBack: 2.5, rimEnd: 3, basinR: 6, basinSlope: 3.5, floorElev: 1.5, apronRecess: 0.5, apronBand: 4.5, apronBase: 1.75,
    niche: { w: 8, bottom: 26, top: 40, depth: 2, fromValveWall: 30, barElev: 31.5 } }, // IMG_3944: centred on the back wall
  showerRod: { elev: 76, bow: 6, dia: 1, setback: 1, flange: 2.6 },
  showerHead: { elev: 74, armElev: 72, dia: 6, reach: 8.5, armDia: 0.7 }, // IMG_3943: flange just under the surround top
  valve: { elev: 28, dia: 7 }, spout: { elev: 21, l: 5.5, dia: 1.7 }, overflow: { elev: 12.5, dia: 2.8 }, drain: { dia: 2.8, fromValveWall: 11 },
  toilet: { cy: 51, w: 17, l: 28.5, seatH: 16.5, tankH: 29, tankD: 8.25, tankGap: 0.75, tankBottom: 14.5, lidT: 1.4, rimH: 15, bowlW: 14, bowlL: 20.5,
    stop: { elev: 6, dy: 10 } },
  towelBar: { elev: 58, l: 24, standoff: 3, dia: 0.75 }, // IMG_3942: ~16" below the surround top
  paperHolder: { x: 24, elev: 24, arm: 6, standoff: 3 }, // IMG_3950: single-post holder on the bath S wall
  doorStop: { leverBackset: 2.75, elev: 36, dia: 2.2, t: 0.4 }, // wall bumper where the bath-door lever lands
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
  hallFlush: { dia: 13, h: 3.75, cx: 55, cy: 112 }, // seen through the bedroom doorway in IMG_3945 and left of centre from the bedroom in IMG_3937
  entryFlush: { dia: 13, h: 3.75, cx: 125, cy: 30 },
  bathFlush: { dia: 13, h: 3.75, cx: 36, cy: 51 }, // ASSUMED (no photo of the bath ceiling)
  vanityBar: { dia: 4.5, cage: 2.2, standoff: 1.5, plateH: 4.5, plateT: 0.6 }, // length + elevation: BATH.vanity.light (IMG_3941)
  miniSplit: { w: 32, h: 11.5, d: 8.5, elevTop: 92, wall: 'bed-liv', cy: 281 }, // bedroom head, IMG_3935; IMG_3939: end ~4" from the window wall
  outlets: { elev: 14, switchElev: 46 },
};

// ---------------------------------------------------------------- finishes (baseboards, wall plates, detector, chime, mini-split detail)
export const FINISHES = {
  lvp: { plankW: 6, plankL: 48, tile: 96 }, // texture tile = 16 rows x 2 planks
  carpetTile: 36, wallTextureTile: 24, // procedural texture tile sizes
  baseboard: { chamfer: 0.12, minRun: 1, probe: 0.25 }, // eased top edge; runs shorter than minRun are dropped; probe = sampling step of the run finder
  plate: { w: 2.75, w2: 4.56, h: 4.5, t: 0.2, r: 0.14, bevel: 0.05 }, // 1-gang / 2-gang thermoplastic wall plates
  // p = point on the wall face (plan x,y), n = face normal (plan), elev = plate centre. kind: outlet | gfci | rocker | rocker2 | coax
  plates: [
    { id: 'living-s-outlet', kind: 'outlet', p: [310.5, 150], n: [-1, 0], elev: 14 }, // IMG_3932 low, just past the peninsula
    { id: 'living-s-cable', kind: 'coax', p: [310.5, 284], n: [-1, 0], elev: 14 }, // IMG_3932 near the slider corner
    { id: 'dining-e-outlet', kind: 'outlet', p: [206, 6], n: [0, 1], elev: 14 }, // IMG_3934 near the stub corner
    { id: 'stub-switch', kind: 'rocker2', p: [220.5, 112], n: [-1, 0], elev: 48 }, // IMG_3933/3934 kitchen + dining lights
    { id: 'hall-switch', kind: 'rocker', p: [94, 128], n: [0, -1], elev: 48 }, // IMG_3933, seen through the hall doorway
    { id: 'vanity-gfci', kind: 'gfci', p: [19, 70.5], n: [0, 1], elev: 44 }, // IMG_3941 alcove side wall
    { id: 'vanity-switch', kind: 'rocker2', p: [32.5, 70.5], n: [0, 1], elev: 48 }, // IMG_3941 between vanity and bath door
    { id: 'bed-s-outlet-1', kind: 'outlet', p: [148, 168], n: [-1, 0], elev: 14 }, // IMG_3937/3939
    { id: 'bed-s-outlet-2', kind: 'outlet', p: [148, 266], n: [-1, 0], elev: 14 }, // IMG_3935/3939 below the mini-split
    { id: 'bed-s-cable', kind: 'coax', p: [148, 283], n: [-1, 0], elev: 14 }, // IMG_3939
    { id: 'bed-w-outlet', kind: 'outlet', p: [28, 301], n: [0, -1], elev: 14 }, // IMG_3935 between window and N corner
    { id: 'bed-n-outlet-1', kind: 'outlet', p: [6, 182], n: [1, 0], elev: 14 }, // IMG_3935 bottom right
    { id: 'bed-n-outlet-2', kind: 'outlet', p: [6, 262], n: [1, 0], elev: 14 }, // IMG_3937 bottom left
  ],
  transition: { w: 1.75, h: 0.7 }, // vinyl reducer LVP -> carpet across the bedroom entry (IMG_3937)
  smoke: [{ id: 'entry', cx: 114, cy: 80, dia: 5.5, h: 1.6, button: 0.9 }], // IMG_3933 ceiling, outside the W/D + hall doors
  chime: { cx: 76.2, elev: 87.2, w: 2.75, h: 3.5, d: 1, r: 0.3, slots: 5, slotW: 0.07, slotH: 0.55, slotPitch: 0.22 }, // IMG_3937 on the pier above/left of the closet head
  miniSplit: { endR: 0.5, grooveFrac: 0.6, grooveH: 0.2, louverD: 2.4, louverT: 0.2, louverFrac: 0.88,
    display: { w: 2.2, h: 0.5 }, badge: { w: 1.8, h: 0.35 }, remote: { w: 2.4, h: 5.2, d: 0.8, cy: 294, elev: 76, lcd: [1.5, 1.3] } }, // IMG_3939: remote cradle below the head
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
  // rot -90: the table's front (+Z, the side the top lifts toward) faces the futon sitter (plan -x)
  liftTop: { w: 41, d: 19.5, h: 14.5, legH: 6, liftRise: 7.5, liftFwd: 6, marbleW: 16.5, pos: [209, 222], rot: -90, // w/d user-given; h ASSUMED from lift_top1/2.jpg proportions (F2); ~13" knee gap to the futon front
    topT: 0.7, topOver: 0.5, panelT: 0.9, fasciaT: 0.6, fasciaInset: 0.25, topGap: 0.08, edgeR: 0.04, cornerR: 0.1, plankW: 6.5, seamW: 0.03,
    leg: { topR: 0.85, botR: 0.65, inset: 2.2, splayDeg: 3, centreR: 0.4, footH: 0.25 },
    mech: { closedDeg: 8, armW: 0.8, armT: 0.14, armGap: 6, frontPivotZ: 7.2, railW: 0.5, railH: 0.8, plateT: 0.12, plateH: 1.8, plateL: 12, pinR: 0.22, barR: 0.2,
      spring: { bodyR: 0.36, rodR: 0.15, along: 5, baseBack: 5, baseDrop: 4 }, seconds: 0.9 } },
  mandir: { w: 29.5, d: 13, h: 71, baseH: 25.5, pos: [188, 13.1], rot: 0, // bookcase, ASSUMED Sauder-style 5-shelf w/ doors
    // carcass details scaled off bookcase.jpg (w/h/d are OVERALL incl. cornice overhang)
    corniceH: 4.75, corniceSteps: [[0.9, 0.25], [0.7, 0.5], [0.65, 0.7], [2.5, 1]], corniceOver: 1, sideT: 1.75, backT: 0.25, topT: 0.75,
    plinthH: 3.25, plinthProud: 0, deckT: 1.5, shelfT: 1, shelfInset: 1, nosingH: 1.5, nosingD: 0.6, edge: 0.06, // corniceSteps = [h, overhang] bottom→top
    door: { t: 0.75, gap: 0.125, frameW: 2.4, panelRaise: 0.3, pullH: 4, pullW: 1, pullOff: 1.4, pullProj: 0.55, pullElevFrac: 0.5, hingeDia: 0.3, hingeL: 2.2, hingeFrac: 0.15, mullionW: 1.5 },
    // puja articles (ASSUMED typical sizes, styled after home_mandir_earlier.jpeg)
    decor: { runnerDrop: 2.5, runnerMargin: 0.75, runnerFoldR: 0.18, runnerCurl: 0.2, flameLightIn: 25, frameBar: 0.8, frameT: 0.6, frameLean: 7, pic: [7, 9], omPic: [7.5, 9],
      murtiH: 5.2, smallMurtiH: 3.4, diyaR: 1.15, vilakkuH: 9, lotusH: 3.6, plateR: 2.9, bellH: 3.6, incenseL: 8, flameH: 0.95 } },
  bed: { mattW: 54, mattL: 75, mattT: 12, frameW: 55.5, frameL: 77, deckH: 14, headH: 42, pos: [45, 225], rot: 90,
    // bed item: steel sections (full_size_bedframe.jpg), headboard panel elevations, soft goods
    post: 1.5, railH: 2.5, railT: 1, slats: 9, slat: 0.75, centreRail: { w: 1.5, h: 1.5 }, centreLegs: 3, leg: 1.25, footLegInset: 5, foot: { w: 1.6, h: 0.35 }, steelR: 0.1,
    panel: { bottom: 23.5, top: 37, t: 1.9, channels: 9, r: 0.55, bar: 0.75, usb: { w: 3.2, h: 1.6, t: 0.3, inset: 1.3 } },
    mattR: 1.6, sheetT: 0.15, sheetDrop: 10.2,
    duvet: { th: 1.4, side: 11.5, foot: 10, foldAt: 27, foldW: 11, hemR: 0.4, wrinkle: 0.22, flare: 0.5, cornerSag: 0.25 },
    pillow: { w: 26, d: 19.5, h: 7, waist: 0.05, tiltDeg: 11, gap: 0.4, sink: 0.4 } },
  // wife's bedroom set (user request): IKEA LAGKAPTEN top + ALEX drawer unit + 2 ADILS legs; same chair model
  wifeDesk: { w: 47.25, d: 23.625, h: 29, topT: 1.375, alex: { w: 14.125, d: 22.875, h: 27.5, drawers: 5, panelT: 0.625, inset: 0.75, plinthH: 1.5, gap: 0.125, frontT: 0.625, scoopW: 6.25, scoopH: 0.7, frontSetback: 0.5 }, edgeR: 0.06, legDia: 1.6, legInset: 2.75, footH: 0.6, plateDia: 3.5, plateT: 0.15, pos: [135.7, 238], rot: -90 }, // 47" user-given
  wifeChair: { module: 'chair', w: 25, d: 25, h: 47, seatH: 18.5, pos: [108, 238], rot: 90 },
  // ANTBOX portable wardrobe, user-given 19.7 x 40.2 x 67 (40.2 is the 3-door front width, 19.7 the depth)
  wardrobe: { w: 40.2, d: 19.7, h: 67, cols: 3, tiers: [29.5, 23.5, 14], wallT: 0.5, doorT: 0.7, doorGap: 0.1, doorR: 1.1, frameW: 1.55, panelR: 1.0, handle: { w: 1.05, h: 3.6, proj: 0.45, bar: 0.22 }, ribPitch: 1.3, ribW: 0.5, ribT: 0.14, rodDia: 0.75, rodDrop: 2.6, openDeg: 105, pos: [16.1, 279.5], rot: 90 },
};

// Sun (user-confirmed: deck faces WEST = +y). Golden hour as in the 6:20 PM photos.
// azimuthFromWestDeg > 0 = sun sits toward plan-right (S): the 17 Sep 6:20 PM sun is WSW, so light travels toward plan-left —
// bedroom-window sun lands on the N wall + hall (IMG_3935/3937), slider sun lands beside the closet-back wall (IMG_3933).
export const SUN = { azimuthFromWestDeg: 18, elevationDeg: 13 };
