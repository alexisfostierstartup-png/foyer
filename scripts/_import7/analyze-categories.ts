#!/usr/bin/env npx tsx
/**
 * Analyse READ-ONLY (aucune écriture DB) des 7 CSV à importer.
 * Parseur streaming maison (ne garde en mémoire que les colonnes catégorie) pour
 * éviter l'OOM sur les gros fichiers (Selency ~233k lignes).
 */
import { createReadStream } from "fs";

const FILES: Record<string, string> = {
  BlanchePorte: "/Users/alexis/Downloads/BlanchePorte_products_405184272.csv",
  Cyrillus: "/Users/alexis/Downloads/Cyrillus_products_405179771.csv",
  MaisonsDuMonde: "/Users/alexis/Downloads/MaisonsDuMonde_products_405179647.csv",
  Selency: "/Users/alexis/Downloads/Selency_products_405179691.csv",
  StoresRideaux: "/Users/alexis/Downloads/StoresRideaux_products_405202037.csv",
  TheCoolRepublic: "/Users/alexis/Downloads/TheCoolRepublic_products_405179724.csv",
  UnAmourDeTapis: "/Users/alexis/Downloads/UnAmourDeTapis_products_405220156.csv",
};

const WANT = ["category", "category_level2", "category_level3", "category_level4"];

async function analyzeFile(brand: string, path: string) {
  const counts = new Map<string, number>();
  let total = 0;
  let header: string[] = [];
  let wantIdx: number[] = [];

  let field = "";
  let rowFields: string[] = [];
  let inQuotes = false;
  let rowIndex = 0;
  let firstChunk = true;

  function endField() {
    rowFields.push(field);
    field = "";
  }
  function endRow() {
    endField();
    if (rowIndex === 0) {
      header = rowFields.map((h) => h.trim());
      wantIdx = WANT.map((w) => header.indexOf(w));
    } else if (!(rowFields.length === 1 && rowFields[0] === "")) {
      total++;
      const key = wantIdx
        .map((i) => (i >= 0 ? (rowFields[i] || "").trim() : ""))
        .filter(Boolean)
        .join(" > ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    rowIndex++;
    rowFields = [];
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
    stream.on("data", (chunkRaw) => {
      let chunk = chunkRaw as string;
      if (firstChunk) {
        firstChunk = false;
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      }
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (inQuotes) {
          if (c === '"') {
            if (chunk[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else field += c;
        } else if (c === '"') {
          inQuotes = true;
        } else if (c === ";") {
          endField();
        } else if (c === "\n") {
          endRow();
        } else if (c === "\r") {
          // skip
        } else field += c;
      }
    });
    stream.on("end", () => {
      if (field.length > 0 || rowFields.length > 0) endRow();
      resolve();
    });
    stream.on("error", reject);
  });

  console.log(`\n=== ${brand} — ${total} lignes ===`);
  console.log("Colonnes:", header.join(", "));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${sorted.length} chemins catégorie distincts`);
  for (const [key, n] of sorted.slice(0, 80)) {
    console.log(`  ${n.toString().padStart(6)}  ${key}`);
  }
}

async function main() {
  const only = process.argv[2];
  for (const [brand, path] of Object.entries(FILES)) {
    if (only && brand !== only) continue;
    await analyzeFile(brand, path);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
