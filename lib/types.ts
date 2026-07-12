// Les types de pièce sont définis par les assets room_defaults (data-driven) —
// d'où un type permissif : ajouter une pièce = ajouter un asset, pas éditer une union.
export type RoomType = string;

export type FurnitureDecision = "keep" | "customize" | "replace";

export type Style = {
  id: string;
  name: string;
  description: string;
  // Description longue (FR) — infobulle au survol de la carte + matière SEO.
  longDescription?: string;
  paletteHex: string[];
  materials: string[];
  mood: string;
  moodboardUrl: string;
};

export type DetectedFurniture = {
  id: string;
  type: string;
  description: string;
  bbox: { x: number; y: number; w: number; h: number };
  decision: FurnitureDecision;
};

export type UserConstraints = {
  furniture: Record<string, FurnitureDecision>;
  floor: { change: boolean; preset: string | null; note: string };
  walls: {
    repaint: boolean;
    moldings: boolean;
    moldingStyle: string;
    frames: boolean;
  };
  accessories: "cosy" | "epure";
};

export type ShoppingSource = "reuse" | "secondhand" | "new" | "diy";

// Produit choisi par l'user (URL extraite ou JPEG importé) pour un élément/catégorie.
export type CustomProduct = {
  imageUrl: string;        // image du produit (extraite de l'URL ou uploadée)
  name?: string | null;
  price?: number | null;
  url?: string | null;     // lien source si fourni
  merchant?: string | null;
};

export type ShoppingMerchant = {
  name: string;
  source: ShoppingSource;
  url?: string;
};

export type MatchingSource = "mock_catalog" | "lbc" | "partner" | "kept";

// Produit réel du catalogue (partner_products) matché à un item de la liste de courses.
export type ProductMatch = {
  id: string;
  name: string;
  category: string;
  merchant: string;
  source_type: string;
  price: number | null;
  primary_image_url: string | null;
  product_url: string | null;
  similarity: number;
  // Calibration du blend (ÉTAPE 4) : cosines décomposés du top-1 — sim_image (crop↔image
  // produit) et sim_text (description↔texte produit). Permet de régler w/seuils sur données.
  simImage?: number;
  simText?: number;
  // Couleur dominante du produit (hex) + ΔE à la couleur de l'élément (calibration couleur).
  colorHex?: string | null;
  colorDeltaE?: number;
  // Score structuré (attrs V3 rendu↔produit) ∈ [0,1] du re-ranking (Étape 2). undefined
  // si l'élément ou le produit n'a pas d'attrs (→ pas de bonus, neutre).
  structScore?: number;
  // ── Débogage scoring (affiché sur /final) ────────────────────────────────
  // Poids image effectif (w_eff) utilisé dans final = image·w_eff + (struct|texte)·(1−w_eff).
  imgWeight?: number;
  // Détail par attribut du score structuré : valeur rendu vs produit, poids, similarité.
  attrScores?: AttrScoreDetail[];
  // true si le score final est sous le seuil d'affichage (confiance faible) — l'item est
  // tout de même proposé (le neuf sort toujours), mais signalé.
  belowThreshold?: boolean;
  // Bonus de style appliqué (MATCH_STYLE_BONUS) : le produit est taggé du style du
  // projet — "core" (style_affinity) ou "compatible" (metadata.style_compatible).
  styleTagHit?: "core" | "compatible";
};

// Détail d'un attribut structuré comparé (rendu ↔ produit), pour le debug scoring /final.
export type AttrScoreDetail = {
  key: string;            // ex. "seats", "color", "upholstery"
  render: string | null;  // valeur côté élément du rendu
  product: string | null; // valeur côté produit catalogue
  weight: number;         // poids de l'attribut (sur 100, dans sa catégorie)
  sim: number;            // similarité de cet attribut ∈ [0,1] (1 = match exact ; ΔE pour couleur)
  compared: boolean;      // false si non comparable (un côté unknown/n/a/absent → ignoré)
};

// Pièce réellement intégrée au rendu expert (swap NB2) : le produit exact + de quoi
// retrouver/reconstruire sa ligne de courses quel que soit le recalcul.
export type ExpertIntegratedPiece = {
  category: string;
  name: string;
  imageUrl: string;
  elementId?: string | null;
  // Produit catalogue utilisé (null si produit custom fourni par l'user).
  match?: ProductMatch | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  category: string;
  detail: string;
  priceMin: number;
  priceMax: number;
  source: ShoppingSource;
  merchants: ShoppingMerchant[];
  imgUrl?: string;
  // Hybrid matching metadata (α-10+)
  matchingSource?: MatchingSource;
  similarity?: number;
  city?: string;
  affiliateUrl?: string;
  postedAt?: string;
  // Nombre d'exemplaires identiques fusionnés sur cette ligne (ex. 6 chaises → 6).
  // Absent ou 1 = une seule unité.
  quantity?: number;
  // Vrais produits du catalogue matchés (top-N par similarité cosine). [0] = meilleur.
  matches?: ProductMatch[];
  // Élément source (decision.element_id) → permet de retrouver son crop/bbox dans le rendu
  // pour le matching image↔image. Absent pour les ajouts nets (détectés sans bbox).
  elementId?: string;
  // TOUS les element_id fusionnés sur cette ligne (quantity > 1) : un hotspot par
  // exemplaire sur le rendu (ex. 2 lampadaires = 1 ligne ×2 mais 2 pins).
  elementIds?: string[];
  // Rendu EXPERT : ce produit a été RÉELLEMENT intégré au rendu (swap NB2). La ligne
  // est AUTORITAIRE : matches[0] = le produit exact du rendu, jamais écrasée par une
  // re-dérivation vision (cf. enforceExpertIntegratedPieces).
  integrated?: boolean;
  // PEINTURE : couleur du mur détectée dans le rendu (hex) → matching ΔE + affichée.
  targetHex?: string;
  // ── Débogage scoring (/final) ────────────────────────────────────────────
  // Attributs détectés sur l'ÉLÉMENT DU RENDU (le « target » du matching) — permet de
  // repérer une mauvaise extraction côté rendu (ex. legs_type mal lu) qui fausse le score.
  elementAttrs?: Record<string, unknown>;
  // Règle de pondération de la catégorie (CATEGORY_W + ATTR_WEIGHTS) pour comprendre le score.
  weightRule?: {
    imgW: number;     // part image de base (à couverture pleine)
    imgWMax: number;  // part image max (quand peu d'attributs)
    attrWeights: Record<string, number>; // poids par attribut (sur 100)
  };
};

export type { ElementDecision } from "./diy/types";

export type ScoreFoyer = {
  kept: number;
  secondhand: number;
  ecoNew: number;
  co2SavedKg: number;
  totalEstimated: number;
};

export type Project = {
  id: string;
  createdAt: string;
  userId?: string;
  anon_id?: string;
  is_saved?: boolean;
  live_edits_used?: number;
  storageFolder: string;
  roomType: RoomType;
  basePhotoUrl: string;
  selectedStyleId: string | null;
  // Flux emprunté : "expert" (/expert-create) ajoute le loop de rendu avec les
  // vrais meubles du catalogue. Défaut/absent = flux standard (/create).
  mode?: "standard" | "expert";
  // Flux DIY beta (?diy=beta à la création) : actions beta + niveaux +
  // exclusions dures de style + RESTYLE meuble visible (prompt variant).
  // Absent = flux standard, bit à bit identique. Persisté sur le projet pour
  // suivre toute sa vie (analyse, re-générations, shopping) sans contamination
  // entre projets d'un même navigateur.
  diyMode?: "beta";
  generatedRenderUrl: string | null;
  firstRenderUrl?: string;
  // Rendu EXPERT : la pièce VIDÉE de son mobilier amovible (murs/fenêtres/parquet/
  // rideaux conservés) puis MEUBLÉE avec les VRAIS produits du catalogue (gros
  // meubles) — flux /expert-create.
  expertRenderUrl?: string | null;
  // Le rendu expert a été ITÉRÉ (« ajoute une table et des chaises ») → il contient
  // des meubles que le rendu fictif n'a jamais eus. Le fake cesse alors d'être une
  // base valide pour le swap : repartir de lui EFFACERAIT l'itération.
  expertIterated?: boolean;
  // Coquille vide de la pièce (mobilier retiré, architecture conservée) — étape 1
  // du rendu expert. Mise en cache : la photo de base ne change jamais, on ne la
  // re-vide donc pas à chaque régénération.
  emptyShellUrl?: string | null;
  // "3 dispositions" : 3 rendus distincts (feature experts), parmi lesquels le
  // user en choisit un (qui devient generatedRenderUrl).
  dispositionsRenderUrls?: string[];
  iterationCount?: number;
  editRequests?: string[]; // demandes d'édition live successives (pour le diff intent)
  detectedFurniture: DetectedFurniture[];
  architecture: {
    floor: string;
    walls: string;
    ceiling: string;
    windows: string;
    lighting: string;
  } | null;
  visionOutput?: unknown;
  // Taille de pièce estimée par la détection (photo) : module le plan de
  // génération (petit = essentiels aérés, grand = zones complémentaires).
  roomScale?: "small" | "medium" | "large";
  // Photo sur laquelle visionOutput a été détecté (clé de cache du précalcul
  // upload) : re-upload → clé différente → re-détection à l'analyse.
  visionDetectionPhotoUrl?: string;
  // Bail (lease) du calcul /final en cours : évite qu'un précalcul de fond et
  // une page /final (process/lambdas séparés) calculent la même liste en double.
  finalAssetsStartedAt?: string;
  finalAssetsRenderUrl?: string;
  alterations?: unknown;
  shoppingList?: ShoppingItem[];
  // Rendu expert : produit alternatif choisi par l'user pour un élément (option
  // « liste de courses alternative »). elementId → index dans `matches` (0 = meilleur).
  // Le rendu expert utilise ce produit au lieu de matches[0] pour cet élément.
  productOverrides?: Record<string, number> | null;
  // Rendu expert : les pièces RÉELLEMENT swappées dans le rendu (source de vérité de
  // la liste de courses pour ces meubles) — persistées par runExpertRenderPipeline au
  // moment du swap, ré-injectées dans toute liste recalculée. Jamais dans CLEAR_FINALIZE.
  expertIntegratedPieces?: ExpertIntegratedPiece[] | null;
  // VERROU DE LISTE (anti « loterie du refresh ») : snapshot des propositions déjà
  // montrées au user — un recalcul reprend ces matches par item, sauf pour les
  // catégories visées par les demandes d'itération en attente (listLock.ts).
  lockedShoppingList?: ShoppingItem[] | null;
  pendingReleaseRequests?: string[] | null;
  // Produit SUR-MESURE fourni par l'user (URL collée → image extraite, ou JPEG
  // importé). Clé = elementId (choix à la liste shopping) OU catégorie (choix dès
  // l'upload, avant détection). Prioritaire sur le matching pour cet élément/catégorie.
  customProducts?: Record<string, CustomProduct> | null;
  scoreFoyer?: ScoreFoyer;
  userConstraints: UserConstraints | null;
  element_decisions?: import("./diy/types").ElementDecision[] | null;
  applicationAudit?: import("./shopping/types").ApplicationAuditResult;
  reconciledPlan?: import("./shopping/types").ReconciledPlan;
  builtShoppingList?: import("./shopping/types").BuiltShoppingList;
  repairApplied?: boolean;
  // Cache de l'ANALYSE VISION du rendu (Gemini), réutilisée tant que le rendu ne change pas.
  // Permet un « re-rank seul » au refresh (matching Jina + scoring) sans rappeler Gemini.
  renderAnalysis?: RenderAnalysis;
  // Tap-to-target : element_ids à relâcher du verrou de liste au prochain
  // recalcul (libération précise, complète pendingReleaseRequests textuel).
  pendingReleaseElementIds?: string[];
};

// Analyse du rendu indépendante des poids de matching : squelette de liste + données vision
// (bboxes, attrs, couleurs). Mise en cache (clé = renderUrl) → refresh = re-matching seul.
export type RenderAnalysis = {
  renderUrl: string;
  items: ShoppingItem[]; // squelette (sans matches/scoring)
  bboxById: Record<string, { x: number; y: number; w: number; h: number }>;
  elementHexById: Record<string, string>;
  elementAttrsById: Record<string, Record<string, unknown>>;
  wallColors: { hex: string; label: string }[]; // murs repeints (getChangedWallColors)
  keptScore: number; // built.score.kept (pour le scoreFoyer)
  builtShoppingList: import("./shopping/types").BuiltShoppingList;
};
