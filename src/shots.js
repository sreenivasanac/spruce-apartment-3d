// Named camera poses for ?shot=<name>. pos/target = [plan x, plan y, elevation] in inches.
// iPhone lenses: UW = 0.5x ultra-wide (13mm eq), W = 1x main (26mm eq). vfov depends on orientation.
const UW_L = 92, UW_P = 108, W_L = 55, W_P = 69;

export const SHOTS = {
  // ---- matched to reference photos (refs/IMG_xxxx.jpg) ----
  IMG_3925: { pos: [228, 212, 58], target: [228, 301, 50], vfov: W_L, note: 'slider from living room' },
  IMG_3926: { pos: [235, 318, 60], target: [235, 420, 48], vfov: UW_L, note: 'deck, looking out (west)' },
  IMG_3927: { pos: [292, 336, 62], target: [160, 352, 38], vfov: UW_L, note: 'deck toward condenser end' },
  IMG_3928: { pos: [170, 366, 62], target: [90, 520, 30], vfov: UW_L, note: 'view off deck corner (scenery approximate)' },
  IMG_3929: { pos: [235, 372, 62], target: [235, 700, 20], vfov: UW_L, note: 'pool view (scenery approximate)' },
  IMG_3930: { pos: [200, 336, 62], target: [316, 342, 56], vfov: UW_L, note: 'deck toward privacy partition' },
  IMG_3932: { pos: [158, 172, 62], target: [300, 262, 48], vfov: UW_L, note: 'living room, accent wall + slider' },
  IMG_3933: { pos: [150, 14, 62], target: [190, 300, 44], vfov: UW_L, note: 'from entry toward slider' },
  IMG_3934: { pos: [110, 72, 62], target: [300, 70, 50], vfov: UW_L, note: 'dining toward kitchen' },
  IMG_3935: { pos: [77, 164, 62], target: [77, 301, 50], vfov: UW_L, note: 'bedroom toward window' },
  IMG_3936: { pos: [112, 252, 60], target: [72, 301, 58], vfov: UW_L, note: 'bedroom window close' },
  IMG_3937: { pos: [77, 294, 62], target: [77, 156, 50], vfov: UW_L, note: 'bedroom toward closet + hall' },
  IMG_3938: { pos: [100, 180, 50], target: [142, 140, 78], vfov: W_L, note: 'bedroom closet rod + panel' },
  IMG_3939: { pos: [14, 188, 62], target: [148, 272, 54], vfov: UW_L, note: 'bedroom, mini-split + window' },
  IMG_3940: { pos: [76, 126, 62], target: [18, 116, 50], vfov: UW_L, note: 'linen closet + vanity' },
  IMG_3941: { pos: [82, 89, 62], target: [6, 89, 48], vfov: UW_L, note: 'vanity' },
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
  desk: { pos: [225, 170, 55], target: [298, 232, 26], vfov: 45 },
  chair: { pos: [225, 200, 50], target: [270, 232, 24], vfov: 40 },
  futon: { pos: [250, 222, 50], target: [169, 222, 16], vfov: 45 },
  liftTop: { pos: [262, 205, 46], target: [205, 222, 10], vfov: 38 },
  mandir: { pos: [188, 105, 56], target: [188, 8, 38], vfov: 42 },
  bed: { pos: [130, 292, 66], target: [45, 232, 14], vfov: 55 },
  wifeDesk: { pos: [70, 290, 58], target: [132, 238, 24], vfov: 50 },
  wardrobe: { pos: [110, 240, 56], target: [16, 279, 34], vfov: 50 },
  // ---- overviews ----
  living: { pos: [160, 150, 64], target: [290, 290, 30], vfov: 75 },
  bedroom: { pos: [140, 165, 64], target: [30, 290, 25], vfov: 75 },
};
