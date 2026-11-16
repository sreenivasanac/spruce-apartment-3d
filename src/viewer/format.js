// Length formatting shared by the plan overlay, info card and tape measure.

/** 316.5 -> 26'4½" (nearest half inch, no 12" roll-over). */
export function ftin(inch) {
  const h = Math.round(inch * 2) / 2, ft = Math.floor(h / 12), i = h - ft * 12;
  return `${ft}'${Math.floor(i)}${i % 1 ? '½' : ''}"`;
}

/** 31.52 -> 31.5″ (one decimal, trailing .0 dropped). */
export const inches = (v) => `${Math.round(v * 10) / 10}″`;
