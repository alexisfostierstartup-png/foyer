import { describe, it, expect } from "vitest";
import { mergeWallColors, type WallColor } from "../paintMatch";

const w = (hex: string, label: string): WallColor => ({ hex, label });

describe("mergeWallColors — un mur repeint = une peinture, pas un pot par pan", () => {
  it("fusionne les pans d'un même beige (ombre : Δab ~0.1-1.7) — cas réel QAWf50S1", () => {
    const out = mergeWallColors([
      w("#c9ad8f", "mur de droite"),
      w("#d2b493", "mur du fond"),
      w("#c5a98b", "mur de gauche"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("murs");
  });

  it("garde 2 lignes pour beige vs jaune (piège familles proches, Δab ~18-41)", () => {
    expect(mergeWallColors([w("#d2b48c", "mur 1"), w("#e8c547", "mur 2")])).toHaveLength(2);
    expect(mergeWallColors([w("#d2b48c", "mur 1"), w("#efd88a", "mur 2")])).toHaveLength(2);
  });

  it("garde 2 lignes pour deux vraies couleurs (sable/terracotta, crème/olive, sauge clair/foncé)", () => {
    expect(mergeWallColors([w("#d2b48c", "a"), w("#c2704e", "b")])).toHaveLength(2);
    expect(mergeWallColors([w("#f2e8cf", "a"), w("#5a6b3b", "b")])).toHaveLength(2);
    expect(mergeWallColors([w("#8a9b6e", "a"), w("#4a5d43", "b")])).toHaveLength(2);
  });

  it("garde 2 lignes pour un bicolore de même teinte mais valeur assumée (ΔE > 14)", () => {
    // soubassement foncé + haut clair : Δab faible (même teinte) mais ΔE ~22.
    expect(mergeWallColors([w("#8a7660", "soubassement"), w("#c9ad8f", "haut")])).toHaveLength(2);
  });

  it("conserve un pin par pan fusionné (bboxes) et une seule ligne", () => {
    const out = mergeWallColors([
      { hex: "#c9ad8f", label: "droite", bbox: { x: 0.1, y: 0, w: 0.2, h: 0.4 } },
      { hex: "#c5a98b", label: "gauche", bbox: { x: 0.6, y: 0, w: 0.2, h: 0.4 } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].bboxes).toHaveLength(2);
  });
});

// Le paint_group du modèle vision fait foi. Les cas ci-dessous sont INSOLUBLES par
// distance de pixels : les pans d'une même peinture y sont PLUS ÉLOIGNÉS (Δab 16,1)
// que deux murs de couleurs différentes (beige vs sauge, Δab 7,4). Aucun seuil ne
// peut trancher les deux — seul le modèle, qui voit la lumière, le peut.
describe("mergeWallColors — le paint_group du modèle prime sur la distance pixel", () => {
  const g = (hex: string, label: string, group: number): WallColor => ({ hex, label, group });

  it("fusionne des pans très éloignés en couleur si le modèle dit MÊME pot — cas réel 51NekyJs0Qt", () => {
    // Δab 16,1 entre les deux : la règle pixel les aurait séparés (seuil 6).
    const out = mergeWallColors([
      g("#73584c", "mur du fond", 1),
      g("#865438", "mur de gauche (plein soleil)", 1),
      g("#7d5a45", "retour d'angle (à l'ombre)", 1),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("murs");
    expect(out[0].bboxes).toHaveLength(0); // pas de bbox fournie ici, mais une seule ligne
  });

  it("sépare des pans quasi identiques en couleur si le modèle dit DEUX pots", () => {
    // La règle pixel les aurait fusionnés (Δab ~1) : le modèle a vu deux pots.
    const out = mergeWallColors([g("#c9ad8f", "haut", 1), g("#c5a98b", "soubassement", 2)]);
    expect(out).toHaveLength(2);
  });

  it("retombe sur la distance pixel si le modèle n'a pas fourni de paint_group", () => {
    const out = mergeWallColors([w("#c9ad8f", "droite"), w("#c5a98b", "gauche")]);
    expect(out).toHaveLength(1);
  });
});
