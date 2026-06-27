const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const CACHE_MAX = 10_000;

const embeddingCache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
  return embeddingCache.get(key);
}

function cacheSet(key: string, value: number[]): void {
  if (embeddingCache.size >= CACHE_MAX) {
    const first = embeddingCache.keys().next().value;
    if (first !== undefined) embeddingCache.delete(first);
  }
  embeddingCache.set(key, value);
}

type JinaInput = { text: string } | { image: string };

async function jinaEmbed(inputs: JinaInput[]): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY not set");

  const MAX_ATTEMPTS = 6;
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    const res = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "jina-clip-v2", input: inputs }),
    });

    if (res.ok) {
      const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((d) => d.embedding);
    }

    // 429 = rate limit (tokens/min) → on attend que le bucket se recharge et on réessaie.
    if (res.status === 429) {
      attempt++;
      if (attempt >= MAX_ATTEMPTS) {
        const text = await res.text();
        throw new Error(`Jina API 429 (retries épuisés): ${text.slice(0, 140)}`);
      }
      await new Promise((r) => setTimeout(r, 12_000 * attempt)); // 12s, 24s, 36s…
      continue;
    }

    // autres 4xx = erreur définitive
    if (res.status >= 400 && res.status < 500) {
      const text = await res.text();
      throw new Error(`Jina API ${res.status}: ${text}`);
    }

    // 5xx = retry court
    attempt++;
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 600 * attempt));
  }

  throw new Error("Jina API: max retries exceeded");
}

export async function computeTextEmbedding(text: string): Promise<number[]> {
  const key = `t:${text}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const [emb] = await jinaEmbed([{ text }]);
  cacheSet(key, emb);
  return emb;
}

export async function computeImageEmbedding(imageUrl: string): Promise<number[]> {
  const key = `i:${imageUrl}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const [emb] = await jinaEmbed([{ image: imageUrl }]);
  cacheSet(key, emb);
  return emb;
}

export async function computeBatchTextEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  const toFetch: Array<{ idx: number; text: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const hit = cacheGet(`t:${texts[i]}`);
    if (hit) results[i] = hit;
    else toFetch.push({ idx: i, text: texts[i] });
  }

  if (toFetch.length > 0) {
    const embs = await jinaEmbed(toFetch.map((t) => ({ text: t.text })));
    for (let j = 0; j < toFetch.length; j++) {
      results[toFetch[j].idx] = embs[j];
      cacheSet(`t:${toFetch[j].text}`, embs[j]);
    }
  }

  return results;
}

export async function computeBatchImageEmbeddings(imageUrls: string[]): Promise<number[][]> {
  const results: number[][] = new Array(imageUrls.length);
  const toFetch: Array<{ idx: number; url: string }> = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const hit = cacheGet(`i:${imageUrls[i]}`);
    if (hit) results[i] = hit;
    else toFetch.push({ idx: i, url: imageUrls[i] });
  }

  if (toFetch.length > 0) {
    const embs = await jinaEmbed(toFetch.map((t) => ({ image: t.url })));
    for (let j = 0; j < toFetch.length; j++) {
      results[toFetch[j].idx] = embs[j];
      cacheSet(`i:${toFetch[j].url}`, embs[j]);
    }
  }

  return results;
}

/**
 * Embedding IMAGE de buffers (crops du rendu) → base64, pas d'URL. Pas de cache : les
 * crops sont éphémères (1 par élément matché, jamais réutilisés). UN appel Jina pour
 * tout le lot. Jina-clip-v2 accepte une image en base64 dans le champ `image`.
 */
export async function computeBatchImageEmbeddingsFromBytes(buffers: Buffer[]): Promise<number[][]> {
  if (buffers.length === 0) return [];
  return jinaEmbed(buffers.map((b) => ({ image: b.toString("base64") })));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
