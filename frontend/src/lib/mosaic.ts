// Justified mosaic layout engine.
// Tiles images edge-to-edge with NO cropping — each image keeps its natural
// aspect ratio and rows are scaled to fill the canvas width.

export type Sized = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Align = "left" | "center" | "right";

function buildRows<T extends Sized>(
  imgs: T[],
  canvasW: number,
  targetH: number,
): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let ratioSum = 0;
  for (const im of imgs) {
    const r = im.width / im.height;
    row.push(im);
    ratioSum += r;
    if (ratioSum * targetH >= canvasW) {
      rows.push(row);
      row = [];
      ratioSum = 0;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

function rowHeight<T extends Sized>(row: T[], canvasW: number): number {
  const ratioSum = row.reduce((s, im) => s + im.width / im.height, 0);
  return canvasW / ratioSum;
}

// Full-bleed mosaic: fills the entire canvas (both width AND height) with no
// crop. Binary-searches a target row height so the stacked rows exactly cover
// the canvas, then snaps the last tile of each row to remove rounding gaps.
export function mosaicFullBleed<T extends Sized>(
  imgs: T[],
  canvasW: number,
  canvasH: number,
): (T & Box)[] {
  if (imgs.length === 0) return [];

  let lo = 24;
  let hi = canvasH * 1.5;
  let best = canvasH / 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const rows = buildRows(imgs, canvasW, mid);
    const total = rows.reduce((s, r) => s + rowHeight(r, canvasW), 0);
    if (total > canvasH) hi = mid;
    else lo = mid;
    best = mid;
  }

  const rows = buildRows(imgs, canvasW, best);
  const total = rows.reduce((s, r) => s + rowHeight(r, canvasW), 0) || canvasH;
  const scaleY = canvasH / total;

  const out: (T & Box)[] = [];
  let y = 0;
  for (const row of rows) {
    const h = rowHeight(row, canvasW) * scaleY;
    let x = 0;
    row.forEach((im, idx) => {
      let w = h * (im.width / im.height);
      if (idx === row.length - 1) w = canvasW - x; // snap to edge
      out.push({ ...im, x, y, width: w, height: h });
      x += w;
    });
    y += h;
  }
  return out;
}

// Aligned justified mosaic: full rows fill the width, and the final partial
// row is aligned left / center / right. Anchored to the top of the canvas.
export function mosaicAligned<T extends Sized>(
  imgs: T[],
  canvasW: number,
  canvasH: number,
  align: Align,
): (T & Box)[] {
  if (imgs.length === 0) return [];

  const targetH = Math.max(
    60,
    canvasH / Math.max(2, Math.round(Math.sqrt((imgs.length * canvasH) / canvasW))),
  );
  const rows = buildRows(imgs, canvasW, targetH);

  const out: (T & Box)[] = [];
  let y = 0;
  rows.forEach((row, ri) => {
    const isLast = ri === rows.length - 1;
    const natural = rowHeight(row, canvasW);
    const h = isLast ? Math.min(targetH, natural) : natural;
    const rowWidth = row.reduce((s, im) => s + h * (im.width / im.height), 0);

    let x = 0;
    if (isLast && rowWidth < canvasW) {
      if (align === "center") x = (canvasW - rowWidth) / 2;
      else if (align === "right") x = canvasW - rowWidth;
    }

    row.forEach((im) => {
      const w = h * (im.width / im.height);
      out.push({ ...im, x, y, width: w, height: h });
      x += w;
    });
    y += h;
  });
  return out;
}
