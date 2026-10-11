// Named camera poses for ?shot=<name>. pos/target = [plan x, plan y, elevation] in inches.
// iPhone lenses per EXIF: UW = 0.5x ultra-wide (14mm eq), W = 1x main (24mm eq). 4:3 frame on a 43.3mm diagonal is
// 34.6 x 26.0mm, so vfov = 2*atan(26.0/2/f) in landscape and 2*atan(34.6/2/f) in portrait.
// Optional `doors: { id: openDeg }` re-poses a hinged door for that shot only; optional `roll` (deg) tilts the horizon for handheld shots. Poses were solved from known wall corners (least squares).
const UW_L = 85.7, UW_P = 102, W_L = 56.8, W_P = 71.6;

export const SHOTS = {
  // ---- matched to reference photos (refs/IMG_xxxx.jpg) ----
  IMG_3925: { pos: [231, 197, 42], target: [225, 297, 47], vfov: W_L, note: 'slider from living room' },
  IMG_3926: { pos: [252, 298, 54], target: [242, 397, 46], vfov: UW_L, note: 'deck, looking out (west)' },
  IMG_3927: { pos: [222, 328, 60], target: [152, 348, 48], vfov: UW_L, note: 'deck toward condenser end' },
  IMG_3928: { pos: [162, 364, 62], target: [-14, 458, 44], vfov: UW_L, note: 'view off deck corner (scenery approximate)' },
  IMG_3929: { pos: [235, 372, 62], target: [235, 700, 20], vfov: UW_L, note: 'pool view (scenery approximate)' },
  IMG_3930: { pos: [206, 339, 62], target: [293, 389, 60], vfov: UW_L, note: 'deck toward privacy partition' },
  IMG_3932: { pos: [168, 176, 58], target: [300, 268, 52], vfov: UW_L, note: 'living room, accent wall + slider' },
  IMG_3933: { pos: [123, 34, 49], target: [171, 122, 49], vfov: UW_L, doors: { wdDoor: 0 }, note: 'from entry toward slider (W/D door was shut)' },
  IMG_3934: { pos: [124, 98, 54], target: [218, 64, 54], vfov: UW_L, note: 'dining toward kitchen' },
  IMG_3935: { pos: [46, 143, 41], target: [51, 243, 39], vfov: UW_L, note: 'bedroom toward window' },
  IMG_3936: { pos: [94, 255, 62], target: [73, 351, 45], vfov: UW_L, note: 'bedroom window close' },
  IMG_3937: { pos: [95, 288, 67], target: [99, 188, 61], vfov: UW_L, note: 'bedroom toward closet + hall' },
  IMG_3938: { pos: [78, 178, 40], target: [124, 92, 60], vfov: UW_L, note: 'bedroom closet rod + panel' },
  IMG_3939: { pos: [29, 200, 54], target: [116, 249, 59], vfov: UW_L, note: 'bedroom, mini-split + window' },
  IMG_3940: { pos: [60, 117, 60], target: [0, 126, 58], vfov: UW_L, doors: { linenDoor: 95 }, note: 'linen closet (door open in the photo) + vanity' },
  IMG_3941: { pos: [65, 87, 64], target: [-26, 90, 46], vfov: UW_L, doors: { bathDoor: 40 }, note: 'vanity; bath door was half open' },
  IMG_3942: { pos: [50, 78, 62], target: [36, 6, 46], vfov: UW_L, note: 'bath from door' },
  IMG_3943: { pos: [54, 64, 62], target: [10, 26, 40], vfov: UW_P, portrait: true, note: 'toilet + tub' },
  IMG_3944: { pos: [50, 66, 62], target: [40, 8, 46], vfov: UW_P, portrait: true, note: 'tub/shower' },
  IMG_3945: { pos: [172, 84, 60], target: [101, 94, 46], vfov: UW_P, portrait: true, note: 'W/D closet + bedroom doorway' },
  IMG_3946: { pos: [229, 96, 64], target: [292, 28, 44], vfov: UW_L, note: 'kitchen' },
  IMG_3947: { pos: [243, 62, 60], target: [243, 12, 96], vfov: UW_L, note: 'cabinet over fridge' },
  IMG_3948: { pos: [265, 84, 66], target: [265, 126, 28], vfov: W_P, portrait: true, note: 'sink base open' },
  IMG_3949: { pos: [265, 100, 60], target: [263, 136, 30], vfov: W_P, portrait: true, note: 'sink close-up' },
  IMG_3950: { pos: [50, 60, 64], target: [14, 50, 8], vfov: UW_P, portrait: true, note: 'toilet' },
  IMG_3951: { pos: [48, 66, 62], target: [40, 8, 44], vfov: UW_P, portrait: true, note: 'tub/shower 2' },
  IMG_3952: { pos: [140, -60, 62], target: [122, 0, 44], vfov: UW_P, portrait: true, note: 'entry door from corridor (corridor itself out of scope)' },
  // ---- furniture beauty shots (compare with product photos in spruce_apt_photos/) ----
  desk: { pos: [222, 150, 58], target: [298, 190, 30], vfov: 50 },
  chair: { pos: [225, 160, 50], target: [270, 190, 24], vfov: 40 },
  futon: { pos: [250, 222, 50], target: [169, 222, 16], vfov: 45 },
  liftTop: { pos: [262, 205, 46], target: [205, 222, 10], vfov: 38 },
  mandir: { pos: [188, 105, 56], target: [188, 8, 38], vfov: 42 },
  bed: { pos: [60, 175, 66], target: [119, 261, 16], vfov: 60 },
  wifeDesk: { pos: [88, 230, 58], target: [18, 276, 26], vfov: 55 },
  wardrobe: { pos: [100, 205, 58], target: [16, 178, 36], vfov: 55 },
  cabinet: { pos: [205, 250, 58], target: [300, 278, 36], vfov: 55, note: 'storage-cabinet option slot by the slider (add ?cabinet=1|2|3)' },
  shed: { pos: [215, 352, 60], target: [300, 337, 22], vfov: 60, note: 'deck storage shed (S end, against the privacy partition)' },
  shed2: { pos: [228, 240, 62], target: [296, 337, 24], vfov: 60, note: 'shed seen from the living room through the slider' },
  // ---- overviews ----
  living: { pos: [160, 150, 64], target: [290, 290, 30], vfov: 75 },
  bedroom: { pos: [140, 165, 64], target: [30, 290, 25], vfov: 75 },
  bedroom2: { pos: [20, 290, 64], target: [120, 170, 25], vfov: 75 },
};
