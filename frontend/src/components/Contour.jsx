import { memo, useMemo } from "react";

/**
 * Topographic contour lines, generated for real: a smooth height field built
 * from a few seeded gaussian bumps is sliced at evenly spaced levels with
 * marching squares. Same seed => same terrain, so a project keeps its own
 * "map" everywhere it appears. Every 4th line is an index contour (heavier),
 * as on a survey map.
 */

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

function buildContours(seed, cols, rows, levels) {
  const key = `${seed}|${cols}|${rows}|${levels}`;
  if (cache.has(key)) return cache.get(key);

  const rand = mulberry32(hashSeed(String(seed)));
  const bumps = Array.from({ length: 6 }, () => ({
    x: rand() * cols,
    y: rand() * rows,
    r: (0.18 + rand() * 0.3) * Math.max(cols, rows),
    a: (rand() > 0.35 ? 1 : -0.7) * (0.6 + rand() * 0.6),
  }));
  const waveA = rand() * Math.PI * 2;
  const waveB = rand() * Math.PI * 2;

  const field = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= rows; j++) {
    const row = [];
    for (let i = 0; i <= cols; i++) {
      let v = 0.18 * Math.sin(i / (cols / 3.2) + waveA) * Math.cos(j / (rows / 2.4) + waveB);
      for (const b of bumps) {
        const dx = i - b.x;
        const dy = j - b.y;
        v += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.r * b.r));
      }
      row.push(v);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    field.push(row);
  }

  const lerp = (a, b, level) => (b === a ? 0.5 : (level - a) / (b - a));
  const fmt = (n) => Math.round(n * 10) / 10;
  let minor = "";
  let major = "";

  for (let l = 1; l <= levels; l++) {
    const level = min + ((max - min) * l) / (levels + 1);
    const isMajor = l % 4 === 0;
    let d = "";
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tl = field[j][i];
        const tr = field[j][i + 1];
        const br = field[j + 1][i + 1];
        const bl = field[j + 1][i];
        const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;

        const top = [i + lerp(tl, tr, level), j];
        const right = [i + 1, j + lerp(tr, br, level)];
        const bottom = [i + lerp(bl, br, level), j + 1];
        const left = [i, j + lerp(tl, bl, level)];
        const seg = (p, q) => {
          d += `M${fmt(p[0] * 10)} ${fmt(p[1] * 10)}L${fmt(q[0] * 10)} ${fmt(q[1] * 10)}`;
        };
        switch (idx) {
          case 1:
          case 14:
            seg(left, bottom);
            break;
          case 2:
          case 13:
            seg(bottom, right);
            break;
          case 3:
          case 12:
            seg(left, right);
            break;
          case 4:
          case 11:
            seg(top, right);
            break;
          case 6:
          case 9:
            seg(top, bottom);
            break;
          case 7:
          case 8:
            seg(left, top);
            break;
          case 5:
            seg(left, top);
            seg(bottom, right);
            break;
          case 10:
            seg(top, right);
            seg(left, bottom);
            break;
          default:
            break;
        }
      }
    }
    if (isMajor) major += d;
    else minor += d;
  }

  const result = { minor, major, width: cols * 10, height: rows * 10 };
  cache.set(key, result);
  return result;
}

function Contour({ seed = "atlas", cols = 60, rows = 40, levels = 13, className = "", minorOpacity = 0.55, majorOpacity = 1 }) {
  const { minor, major, width, height } = useMemo(() => buildContours(seed, cols, rows, levels), [seed, cols, rows, levels]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d={minor} stroke="currentColor" strokeWidth="0.9" opacity={minorOpacity} vectorEffect="non-scaling-stroke" />
        <path d={major} stroke="currentColor" strokeWidth="1.5" opacity={majorOpacity} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

export default memo(Contour);
