import type { CSSProperties } from "react";

/**
 * Grille de carrés (motif de la marque Orange) qui s'allument un à un,
 * comme des déclarations qui arrivent. Rendu 100 % CSS, sans JS côté client.
 * Le tirage est déterministe (mulberry32) : le rendu serveur et client est identique.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cell = { kind: "" | "is-lit" | "is-trace" | "is-pulse"; delay: number };

function buildCells(cols: number, rows: number, seed: number): Cell[] {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rand();
      // Une diagonale douce : les cellules en haut à gauche s'allument d'abord
      const wave = (r + c) * 32 + rand() * 260;
      let kind: Cell["kind"] = "";
      if (roll < 0.07) kind = "is-pulse";
      else if (roll < 0.26) kind = "is-lit";
      else if (roll < 0.52) kind = "is-trace";
      cells.push({ kind, delay: Math.round(150 + wave) });
    }
  }
  return cells;
}

export default function SignalGrid({ cols = 12, rows = 7, seed = 2026 }: { cols?: number; rows?: number; seed?: number }) {
  const cells = buildCells(cols, rows, seed);
  return (
    <div className="signal-grid" style={{ "--cols": cols } as CSSProperties} aria-hidden="true">
      {cells.map((cell, i) => (
        <span
          key={i}
          className={`signal-cell ${cell.kind}`}
          style={cell.kind ? ({ "--d": `${cell.delay}ms` } as CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}
