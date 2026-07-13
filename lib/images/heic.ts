// HEIC/HEIF (photos iPhone par défaut) → JPEG.
//
// Pourquoi ce module existe : sharp DÉCLARE le format heif en entrée, mais le libvips
// précompilé n'embarque aucun décodeur HEVC (seul AVIF passe). Une photo iPhone partait
// donc en « Le traitement de la photo a échoué » (500). On décode avec heic-convert
// (libheif en WASM) avant de la confier à sharp.
//
// Les navigateurs mentent sur le type : iOS envoie parfois "image/heic", parfois "" ou
// "application/octet-stream" selon la source (photothèque, fichiers, partage). On ne se
// fie donc pas à file.type — on renifle les octets.

/**
 * Boîte ISO-BMFF : [4 octets taille][ftyp][marque]. Les marques HEIC/HEIF sont celles
 * qu'un iPhone produit ; mif1/msf1 sont le conteneur générique HEIF.
 */
const MARQUES_HEIC = new Set([
  "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1",
]);

export function estHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  return MARQUES_HEIC.has(buffer.toString("ascii", 8, 12));
}

/**
 * Décode un HEIC/HEIF en JPEG. Import dynamique : libheif pèse quelques Mo de WASM, on ne
 * le charge que pour les photos qui en ont besoin (le cas courant reste le JPEG).
 */
export async function heicVersJpeg(buffer: Buffer): Promise<Buffer> {
  const { default: convert } = await import("heic-convert");
  const jpeg = await convert({
    buffer: buffer as unknown as ArrayBufferLike as never,
    format: "JPEG",
    quality: 0.92, // le redimensionnement sharp derrière recompresse de toute façon
  });
  return Buffer.from(jpeg);
}

/** Renvoie un buffer que sharp sait lire : convertit si HEIC, laisse passer sinon. */
export async function versBufferLisible(buffer: Buffer): Promise<Buffer> {
  return estHeic(buffer) ? heicVersJpeg(buffer) : buffer;
}
