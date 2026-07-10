import { createReadStream } from "fs";
import readline from "readline";

const files = {
  BlanchePorte: "/Users/alexis/Downloads/BlanchePorte_products_405184272.csv",
  Cyrillus: "/Users/alexis/Downloads/Cyrillus_products_405179771.csv",
  MaisonsDuMonde: "/Users/alexis/Downloads/MaisonsDuMonde_products_405179647.csv",
  Selency: "/Users/alexis/Downloads/Selency_products_405179691.csv",
  StoresRideaux: "/Users/alexis/Downloads/StoresRideaux_products_405202037.csv",
  TheCoolRepublic: "/Users/alexis/Downloads/TheCoolRepublic_products_405179724.csv",
  UnAmourDeTapis: "/Users/alexis/Downloads/UnAmourDeTapis_products_405220156.csv",
};

function parseLine(line, delim = ";") {
  const out = [];
  let field = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

async function main() {
  for (const [brand, path] of Object.entries(files)) {
    const rl = readline.createInterface({ input: createReadStream(path, { encoding: "utf8" }) });
    let header = null;
    let n = 0;
    for await (const line of rl) {
      const cells = parseLine(line);
      if (!header) { header = cells; continue; }
      n++;
      const get = (name) => cells[header.indexOf(name)];
      console.log(`[${brand}] id=${get("id")} link=${get("link")} availability=${get("availability")} price=${get("price")}`);
      if (n >= 2) break;
    }
    rl.close();
  }
}
main();
