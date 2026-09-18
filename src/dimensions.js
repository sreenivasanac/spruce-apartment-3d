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
  bedDoor: { w: 30, wall: 'hall-wall', hinge: 'a', swingInto: 'hall', openDeg: 88, type: 'slab' },
  wdDoor: { w: 28, wall: 'hall-wall', hinge: 'b', swingInto: 'dining', openDeg: 0, type: 'louver' },
  linenDoor: { w: 24, wall: 'linen-front', hinge: 'a', swingInto: 'hall', openDeg: 0, type: 'slab' },
  coatCloset: { w: 48, wall: 'hall-wall', type: 'bypass-slab' },
  bedClosetDoors: { w: 68, wall: 'bedcloset-front', type: 'bypass-mirror' },
};

// Glazing
export const SLIDER = { a: 180, b: 276, h: 80, frame: 2.25, valance: { w: 112, h: 5, d: 4.5, elev: 86 }, blindsStackAt: 'a', blindsStackW: 14 };
export const BED_WINDOW = { a: 40, b: 112, sill: 36, head: 84, frame: 2, blindValance: { h: 3, d: 2.5 } };
export const DECK = {
  depth: 66, x0: 152.5, x1: 316.5, floorDrop: 2, railH: 42, slatW: 5.5, slatGap: 3.5, slatT: 1.5, capW: 5.5,
  heightAboveGrade: 60, partitionAt: 'x1', partitionH: 80,
  condenser: { w: 33, d: 13, h: 23, x: 160, y: 352 }, // Daikin, plan-left end (IMG_3927)
};

// ---------------------------------------------------------------- kitchen
export const KITCHEN = {
  counterH: 36, counterT: 1.25, counterD: 25.5, baseD: 24, baseH: 34.75, toeKick: 4, backsplashH: 4,
  upperBottom: 54, upperTop: 87, upperD: 12.5, pullL: 6,
  fridge: { w: 35.75, d: 31, h: 69.5, x0: 225.5, y0: 6.5 }, // GE bottom-freezer, east wall
  overFridgeCab: { w: 36, h: 17.5, d: 24 },
  eastRun: { drawerBase: [261.5, 285] }, // 4-drawer base between fridge and corner
  southRun: { base1: [31.5, 55.5], range: [55.5, 85.5], base2: [85.5, 110] }, // y extents along south wall
  range: { w: 29.9, d: 27, h: 36, backguardH: 10 },
  microwave: { w: 29.9, h: 16.5, d: 15.5, bottom: 54 + 12 },
  peninsula: { dw: [226, 250], sinkBase: [250, 280], corner: [280, 310.5], overhang: 1.5 },
  sink: { w: 21, d: 16, depth: 8, cx: 265, cy: 121 },
};

// ---------------------------------------------------------------- bath / vanity / laundry
export const BATH = {
  tub: { l: 60, w: 30, h: 17, surroundH: 74 },
  showerRod: { elev: 76, bow: 6 }, showerHead: { elev: 72 },
  toilet: { cy: 51, w: 17, l: 28.5, seatH: 16.5, tankH: 29 },
  towelBar: { elev: 50, l: 24 },
  vanity: { w: 37.5, d: 22, h: 34.5, topT: 1.25, backsplash: 4, mirror: { w: 30, h: 40, bottom: 40 }, light: { w: 24, elev: 84 } },
};
export const LAUNDRY = { unit: { w: 23.5, d: 26, h: 33.5 }, stackGap: 0.5 };

// ---------------------------------------------------------------- fixtures
export const FIXTURES = {
  kitchenOval: { l: 32, w: 18, h: 4, cx: 262, cy: 70 },
  diningTrack: { l: 44, cx: 168, cy: 40, heads: 4 },
  hallFlush: { dia: 13, cx: 70, cy: 100 },
  entryFlush: { dia: 13, cx: 125, cy: 30 },
  miniSplit: { w: 32, h: 11.5, d: 8.5, elevTop: 92, wall: 'bed-liv', cy: 278 }, // bedroom head, IMG_3935
  outlets: { elev: 14, switchElev: 46 },
};

// ---------------------------------------------------------------- furniture (pos = plan x,y of center; rot = degrees about up)
export const FURNITURE = {
  desk: { w: 63, d: 24, h: 29, topT: 1, leg: 1.5, pos: [298, 232], rot: 90 }, // user-measured
  chair: { w: 25, d: 25, h: 47, seatH: 18.5, pos: [270, 232], rot: 90 },
  futon: { w: 66, d: 33, h: 30, seatH: 15, armW: 8, legH: 5, pos: [169.5, 222], rot: -90 }, // ASSUMED typical click-clack futon
  liftTop: { w: 41, d: 19.5, h: 16.5, legH: 5.5, liftRise: 7.5, liftFwd: 6, marbleW: 15, pos: [205, 222], rot: -90 }, // ASSUMED
  mandir: { w: 29.5, d: 13, h: 71, baseH: 28, pos: [188, 12.8], rot: 0 }, // bookcase, ASSUMED Sauder-style 5-shelf w/ doors
  bed: { mattW: 54, mattL: 75, mattT: 12, frameW: 55.5, frameL: 77, deckH: 14, headH: 42, pos: [45, 232], rot: 90 },
};

// Sun (user-confirmed: deck faces WEST = +y). Golden hour as in the 6:20 PM photos.
export const SUN = { azimuthFromWestDeg: -8, elevationDeg: 14 };
