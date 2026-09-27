// Pixel helpers: fraction of pixels that changed between two PNG screenshots (sampled every 2 px).
import { PNG } from "pngjs";
export function changed(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let n = 0, c = 0;
  for (let y = 0; y < A.height; y += 2) for (let x = 0; x < A.width; x += 2) {
    const i = (y * A.width + x) * 4;
    if (Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])) > 24) c++;
    n++;
  }
  return n ? c / n : 0;
}
