# Foyer — Documentation produit & technique

> Vue d'ensemble vérifiée contre le code le 2026-07-04. Documents liés :
> `API.md` (endpoints) · `AUDIT_2026-07-04.md` (sécurité/qualité) · `FOYER_LOGIC.md` (logique matching détaillée) · `PERF_POINT4.md` (perf pipeline).

---

## 1. Le produit

**Foyer** est une PWA mobile-first (français) de **redécoration douce**. L'utilisateur photographie une pièce, choisit un style, et reçoit :

1. un **rendu IA de sa propre pièce** — l'architecture est préservée (fenêtres/portes/ouvertures/escalier restent en place), le mobilier existant est gardé quand c'est possible ;
2. une **liste de courses de vrais produits** d'un catalogue partenaire qui correspondent au rendu, avec **liens d'affiliation trackés** ;
3. un **Score Foyer** — score RSE (gardé vs seconde main vs neuf durable, CO₂ économisé).

**Angle** : redécoration éco-responsable. La hiérarchie est **Garder > Customiser (DIY) > Remplacer**, privilégiant la réutilisation, la seconde main (phase 2) et les enseignes responsables (Amazon exclu). Les couleurs sémantiques encodent ça : sauge = Garder, ocre = Customiser, terracotta = Remplacer/Acheter.

**Cibles & plans** : B2C (`neophyte` gratuit / `expert` / `pro`) + une suite **Pro** pour professionnels de l'immobilier/déco (jobs multi-biens, templates, liens de partage — `app/pro/**`, aujourd'hui surtout une maquette UI, le pipeline IA Pro ayant été retiré).

**Modèle** : commission d'affiliation sur la liste de courses (ex. tapis.fr via Awin à 13 %) + plans abonnement/crédits. Le billing est **stubbé** aujourd'hui (voir §6).

**Types de pièce** : `salon`, `chambre`, `chambre_parentale`. **18 collections de style** (`data/styles.json`, chargées depuis la table `assets`, catégorie `ambiance`) : scandinave, japandi, boheme, boho, mid-century, industriel, mediterraneen, haussmannien, wabi-sabi, quiet-luxury, art-deco, cottage-anglais, dark-academia, desert, seventies, color-block, memphis, maximaliste.

---

## 2. Parcours utilisateur (écran → route → API → pipeline)

Les **pages** du flux (`app/(create)/create/**`) sont des Server Components (redirects + lectures DB) ; les `fetch()` vivent dans les **composants clients** (`components/create/**`).

| # | Écran / Route | Action | API → serveur | Fonction pipeline |
|---|---|---|---|---|
| 0 | Landing `/` | CTA | Link → `/create` | — |
| 1 | Upload + pièce + contraintes `/create` | Photo + type + contraintes | `POST /api/upload` puis `POST …/constraints` | sharp→1024px ; `createProject` ; **`after(precomputeDetection)`** (détection lancée en fond pendant que l'utilisateur remplit la suite) |
| 2 | Choix du style `/create/style` | 1 ambiance parmi 18 | `POST …/style {styleId}` | — |
| 3 | Review `/create/:id/review` | Chips Garder/Personnalise/Remplace par élément | on load : `POST …/analyze` + `GET …/decisions` ; submit : `PATCH …/decisions` | **`runAnalysisPipeline`** |
| 4a | Génération `/create/generating` | Attente | `POST …/generate` | **`runGenerationPipeline`** + `after(precomputeFinalAssets)` |
| 4b | Dispositions (expert) `/create/dispositions` | 3 layouts, en choisir 1 | `POST …/generate-dispositions` puis `POST …/select-disposition` | **`runDispositionsPipeline`** |
| 5 | Rendu `/create/:id` | Slider avant/après ; Sauver/Partager | server action `saveProject` | — |
| 6 | Itération `/create/:id/iterate` | Modif en langage naturel | `POST …/iterate {userRequest}` | **`runIterationPipeline`** |
| 7 | Final `/create/:id/final` | Liste shopping / Score ; liens marchands | page → `after(precomputeFinalAssets)` ; client polle `GET …/shopping-status` | **`ensureFinalAssets`** |
| — | Clic produit | Ouvre un lien | `GET /api/track/:item_id?dest=…` → 302 | — |

**Optimisations perçues** (détail dans `PERF_POINT4.md`) : la détection part dès l'upload (la review n'attend que le verdict) ; le shopping se précalcule en fond pendant que l'utilisateur regarde son rendu (écran /final non bloquant : squelette + polling).

---

## 3. Le pipeline IA (`lib/ai/pipeline.ts`)

**Modèles** : détection/inventaire sur `gemini-2.5-flash-lite` ; génération d'image sur `gemini-2.5-flash-image` (provider `nano_banana`, alt `flux_kontext`) ; audit final sur `gemini-2.5-flash` (plus fort) ; embeddings via **Jina `jina-clip-v2`** (1024-d, image+texte). Les providers sont résolus **par prompt** via la colonne `provider`. Chaque appel LLM passe par `withTracking()` → `ai_calls` ; les événements pipeline → `pipeline_logs`. **Les prompts sont en base** (table `prompts`, `resolvePrompt(slug, vars)`) → le code doit être déployé avec des prompts cohérents, sinon les `{{vars}}` s'affichent littéralement.

- **`runAnalysisPipeline`** (2 appels) — (1) détection `vision_detect_extended` → `elementProfiles[]` (catégorie, description, couleur, matériau, état, movable, bbox…) ; (2) filtre DIY déterministe (`getCandidateActions`) ; (3) verdict `verdict_elements` → `mismatch_type` (`none`/`surface`/`structural`) + action **choisie parmi les candidats** ; (4) garde-fous par catégorie (siège = keep/replace, mur = keep/repaint, fenêtre/porte = keep). Réutilise la détection précalculée à l'upload.
- **`runGenerationPipeline`** (1 rendu) — réutilise `visionOutput`, assemble style + contraintes + **plan de design** (des décisions) + **résumé d'architecture fixe** (`buildFixedFeaturesSummary` empêche le modèle de déplacer/bloquer l'architecture) + `removeList` → prompt `gen_wow_generic`. Depuis 2026-07-02, les **murs suivent la palette du style** par défaut (sol verrouillé, instructions utilisateur prioritaires).
- **`runDispositionsPipeline`** (3 rendus //, experts) — 3 briefs de layout (`gen_wow_3_dispositions`).
- **`runIterationPipeline`** — édite le rendu **courant** (`iterate_generic`) avec seulement le `userRequest` (pas de ré-injection du plan, pour préserver les changements déjà appliqués).
- **`ensureFinalAssets`** → `{shoppingList, scoreFoyer}` — caché (retourne la liste existante si présente ; dédup en mémoire + **bail DB** `finalAssetsStartedAt`). Deux phases :
  - **A — `analyzeRender`** (Gemini, cache par URL de rendu) : composite AVANT|APRÈS + 3 passes vision **en parallèle** — `confirmChanges` (quels candidats ont vraiment été appliqués + bbox + attrs), `computeRenderAdditions` (inventaire du rendu → meubles net-new), `getChangedWallColors` (couleur des murs repeints par ΔE).
  - **B — `buildMatchesAndScore`** : crop de chaque élément par bbox → matching produit (§4) puis Score Foyer (§5). Re-jouable au « Rafraîchir » sans re-appel Gemini si le rendu n'a pas changé.

---

## 4. Matching / shopping (détail dans `FOYER_LOGIC.md` §8)

- **Meubles & général — BLEND** (`matchPartnerProductsBlendBatch` → RPC `match_partner_products_blend[_v2]`) : `blend = w·cos(crop, image_emb) + (1−w)·cos(desc, text_emb)`, `w` par **catégorie × source** (`assets.matching_weights`) ; sans crop → texte seul. Un **terme couleur** re-classe par **ΔE (CIELAB)** (`colorScore = max(0, 1 − ΔE/seuil)`), poids couleur par catégorie (canapé/tapis/rideaux ~0,30 ; table 0,04). Sous `min_score` → item « À sourcer ». Pré-filtre optionnel par **famille de couleur** (`MATCH_COLOR_FAMILY_RESTRICT=1`) là où la couleur discrimine déjà.
- **Peinture — ΔE pur** (`matchPaintByColor`) : un item par mur repeint, matché par ΔE au `metadata.color_hex` des produits peinture.
- **Sol — blend filtré matière** (`matchFloorProductsBlend`) : filtré par famille de revêtement (parquet vs carrelage vs béton vs pvc), poids image plus bas.
- **Non-shoppable** : architecture (mur/plafond/fenêtre/porte/ouverture), cadre, miroir, plante, objet déco, luminaires (ingérés mais dormants). Le **sol est shoppable**.

**Catalogue & affiliation** (`lib/catalog/`) : interface `ProductSource` (`PiloterrSource` test, `AwinSource` prod via CSV Create-a-Feed). `ingestFromSource` calcule les embeddings Jina image+texte, l'`affiliate_url`, les métadonnées. `partner_merchants` = source de vérité (plateforme, advertiser_id, commission_pct, feed_url). ~7300 produits (Cdiscount, Leroy Merlin, IKEA test ; tapis.fr ~3553 via Awin). Sync hebdo par cron.

## 5. Score Foyer

Calculé dans `buildMatchesAndScore` : `kept` (éléments gardés), `secondhand`, `ecoNew`, `co2SavedKg = kept·30 + secondhand·20 + ecoNew·5`, `totalEstimated` (somme des prix moyens × quantités).

---

## 6. Billing / crédits

- **Plans** : `neophyte` (gratuit, défaut), `expert`, `pro`.
- **Crédits** : `credit_wallet` / `credit_transactions`. `checkAndConsumeCredit` : expert/pro = illimité ; neophyte consomme un crédit ; anonyme = `check_cookie`.
- **Gating** : **`PAYWALL_DISABLED = true`** aujourd'hui (paywall off). Activé : authentifié → `checkAndConsumeCredit` (402 sinon) ; anonyme → 1ʳᵉ génération gratuite via cookies. `MAX_FREE_GENERATIONS=1`, `MAX_FREE_EDITS=2`.
- **Stripe** : **stubbé** (voir `AUDIT_2026-07-04.md` C1–C3). Prix dans une map locale, pas via les `STRIPE_PRICE_*` (inutilisés). Le grant réel de crédits est fait par la page `/billing/success` sur un GET — **faille critique à corriger avant prod**.

---

## 7. Modèle de données (Supabase)

**Cœur produit / IA**
- **`foyer_projects`** — état du projet B2C (`id`, `user_id`, `anon_id`, `data` jsonb). ⚠️ **Pas défini dans une migration** — créé directement en base ; les migrations ne définissent que la table legacy `projects`. Le jsonb `data` porte tout l'objet `Project` (roomType, basePhotoUrl, selectedStyleId, userConstraints, visionOutput, element_decisions[], generatedRenderUrl, shoppingList[], scoreFoyer, renderAnalysis…). `CLEAR_FINALIZE` invalide la liste/le score dès que le rendu ou les décisions changent.
- **`prompts`** (slug, template, provider, version, is_active) + **`prompt_versions`** (historique).
- **`assets`** — config data-driven : `ambiance` (18 styles), `element_category` (taxonomie → catalog_category + actions autorisées), `room_defaults`, `floor_preset`, `wall_palette`, `standard_dims`, `matching_weights`. Éditable via `/admin/assets/[category]`.
- **`diy_actions`** — actions de customisation (repaint, wallpaper, reupholster, refinish_floor…) avec requires/excludes, `style_affinity`, formule de quantité, fournitures.
- **`ai_calls`** (tracking par appel), **`ai_pricing`** (tarifs éditables), **`pipeline_logs`** (événements + clics produit), **`iterations`**.

**Catalogue / affiliation**
- **`partner_products`** (external_id, merchant, category, name, price, product_url, affiliate_url, image_urls[], style_affinity[], source_type, **`embedding` + `text_embedding` vector(1024)**, metadata jsonb dont **color_hex**, partner_tier). pgvector + index ANN pour les RPC blend.
- **`partner_merchants`** (plateforme, advertiser_id, commission_pct, feed_url, status), **`partner_sync_runs`**, **`lbc_search_cache`** (seconde main, phase 2), **`shopping_lists`** (legacy).

**Auth / B2C / Pro**
- **`profiles`** (plan, subscription_status), **`credit_wallet`** + **`credit_transactions`**.
- **`pro_clients`, `pro_properties`, `pro_property_rooms`, `pro_generation_jobs`, `pro_renders`, `pro_share_links`, `pro_templates`**. **`projects`** = legacy.

> ⚠️ Écarts avec les migrations : `foyer_projects` et les RPC `match_partner_products_blend_v2` / `_hybrid` ont été appliqués **hors migration** (directement en base). Le schéma versionné n'est pas la source de vérité complète.

---

## 8. Config, env & services externes

**Feature flags** (`lib/constants.ts`) : `PAYWALL_DISABLED=true`, `MAX_FREE_GENERATIONS=1`, `MAX_FREE_EDITS=2`, `MAX_UPLOAD_BYTES=8Mo`, `UPLOAD_MAX_DIMENSION=1024`, `MATCH_BLEND_ALPHA=0.5`, `MATCH_MIN_SIMILARITY=0.25`, `MATCH_COLOR_FAMILY_RESTRICT=1`, `ROOM_TYPES`, `DECISION_COLORS`.

**Variables d'environnement** (~20) :
- Supabase : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- IA : `GEMINI_API_KEY`, `JINA_API_KEY`, `INPUT_MAX_DIM`.
- Catalogue : `AWIN_API_TOKEN`, `AWIN_PUBLISHER_ID`, `PILOTERR_API_KEY`, `BRIGHTDATA_API_TOKEN`, `BRIGHTDATA_ZONE`, `SEED_SCRAPE_ENABLED`.
- Admin/infra : `ADMIN_SESSION_TOKEN`, `ADMIN_PASSWORD`, `INTERNAL_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_USD_EUR`, `NODE_ENV`.
- Stripe : `STRIPE_*` présents dans `.env.local.example` mais **inutilisés** (billing stubbé).

> ⚠️ `.env.local.example` est incomplet : Jina, Awin, Piloterr, BrightData, admin, cron y manquent.

**Config** : `vercel.json` (cron `/api/cron/sync-partners`, lundi 03:00 UTC) ; `middleware.ts` (auth admin par cookie, refresh session Supabase, protège `/account` et `/projects`). **Next.js 16.2.6 / React 19** — ⚠️ voir `AGENTS.md` : cette version a des breaking changes, lire `node_modules/next/dist/docs/` avant d'écrire du code.

**Services externes** : Google Gemini (vision + génération), Jina (embeddings), Supabase (Postgres+pgvector / Auth / Storage buckets `room-images` & `renders`), Awin (feeds affiliés), Piloterr (scraping/test), Bright Data (fetch anti-bot), Stripe (stubbé), Vercel (déploiement + cron).

---

## 9. Développement

```bash
npm install
cp .env.local.example .env.local   # compléter les clés manquantes (cf. §8)
npm run dev                         # http://localhost:3000
npm run typecheck                   # tsc --noEmit
npm run lint                        # next lint
npm run test                        # vitest (41 tests, helpers purs)
npm run build                       # build prod
```

**Structure** : `app/` (routes & pages, groupes `(create)`/`(marketing)`, `api/`, `admin/`, `pro/`) · `lib/` (`ai/` pipeline & providers, `shopping/` matching, `db/` accès, `catalog/` ingestion, `prompts/`, `auth/`, `embeddings/`) · `components/` (`create/`, `demo/`, `admin/`, `paywalls/`) · `supabase/migrations/` · `scripts/` (seeds, imports, bancs d'essai) · `data/` (styles.json, co2-factors.json).

**Dette technique prioritaire** (détail `AUDIT_2026-07-04.md`) : découper `lib/ai/pipeline.ts` (1406 lignes) derrière des tests de caractérisation ; trancher le sort du matcher hybride mort ; ajouter une couverture de tests sur le pipeline ; centraliser l'accès aux styles.
