/**
 * Parseur CSV minimal (RFC 4180) sans dépendance — pour les flux Awin (Create-a-Feed).
 * Gère : guillemets, "" échappés, virgules et retours-ligne dans un champ quoté, CRLF.
 * Délimiteur configurable (Awin = virgule par défaut). Retourne des objets clés=en-tête.
 */
export function parseCsv(text: string, delimiter = ","): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Retire un éventuel BOM.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // "" → "
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (c === "\r") {
      // ignore (CRLF) — le \n suivant clôt la ligne
    } else field += c;
  }
  // Dernier champ / dernière ligne sans newline final.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === "") continue; // ligne vide
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = cells[c] ?? "";
    out.push(obj);
  }
  return out;
}
