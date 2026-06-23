# Foyer — Documentation exhaustive de la logique

> Référence vérifiée contre le code le 2026-06-23 (branche `feat/alpha-10-partner-catalog-hybrid`).
> Chaque affirmation a été contrôlée dans le code / la base. Destiné à ré-aligner Notion.
> Convention : ✅ = vérifié dans le code ; ⚠️ = nuance/limite.

---

## 1. Produit & principe

Foyer transforme une **photo de pièce** + un **style** en :
1. un **rendu redécoré** (image générée par IA) ;
2. une **liste de courses** de **vrais produits** du catalogue partenaire correspondant au rendu, avec **liens d'affiliation trackés** ;
3. un **score Foyer** (impact RSE).

Angle RSE : privilégier la **réutilisation** (garder/customiser > remplacer), la **seconde main** (phase 2), des enseignes responsables ; Amazon exclu.

---

## 2. Stack & environnements

- **Next.js 15** (App Router, **Turbopack**) + **TypeScript** + **Tailwind**.
- **Supabase** : Postgres (`pgvector`), Auth, Storage. Projet `foyer` (`vflgjfbbkzyqeydzaaoc`, eu-west-3).
- **IA** : Google **Gemini** (vision + image), **Jina** `jina-clip-v2` (embeddings image+texte 1024d).
- **Catalogue** : **Piloterr** (jeu de test), **Awin** (production/affiliation).
- **Déploiement** : GitHub → **Vercel**. Push branche = **preview** ; `main` = **production**.
- **Flags / env** ✅ (`lib/constants.ts`) : `PAYWALL_DISABLED=true`, `MAX_FREE_GENERATIONS=1`, `MAX_FREE_EDITS=2`, `MAX_UPLOAD_BYTES=8MB`, `UPLOAD_MAX_DIMENSION=1024px`, `SHOPPING_RAW_AUDIT_MODE=true`, `MATCH_BLEND_ALPHA=0.5`, `MATCH_MIN_SIMILARITY=0.25`. Env : `JINA_API_KEY`, `AWIN_PUBLISHER_ID`/`AWIN_API_TOKEN`, `PILOTERR_API_KEY`, `ADMIN_SESSION_TOKEN`, `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_USD_EUR`.
- **Types de pièce** ✅ : `salon`, `chambre`, `chambre_parentale` (3).
- **État projet** : table `foyer_projects` (colonne `data` jsonb). *(historiquement `projects.json` sur FS → migré Supabase, FS Vercel read-only).*

---

## 3. Modèle de données (tables réelles — vérifiées en base)

**Cœur produit / IA**
| Table | Rôle |
|---|---|
| `foyer_projects` | État complet du projet (`id` text, `user_id`, `anon_id`, `data` jsonb). |
| `prompts` | Prompts IA (slug, `template`, `provider`, `version`, `is_active`, `conditions`). |
| `prompt_versions` | Historique de versions de prompts. |
| `ai_calls` | Tracking de chaque appel IA (step, provider, model, tokens, images, coût, request/response payload, durée). |
| `ai_pricing` | Tarifs IA éditables (admin), cache 5 min. |
| `pipeline_logs` | Événements pipeline **+ clics produits** (`event='product_click'`, `step`=`partner_products.id`). |
| `iterations` | Historique d'itérations de rendu. |
| `assets` | **Config data-driven** (voir §10). |
| `diy_actions` | Actions DIY (voir §7). |

**Catalogue / affiliation**
| Table | Rôle |
|---|---|
| `partner_products` | Catalogue (~7300). `merchant`, `category`, `name`, `description`, `price`, `product_url`, `affiliate_url`, `image_urls[]`, `primary_image_url`, `source_type` (eco_new/secondhand/eco_label_certified), `embedding` vector(1024), `text_embedding` vector(1024), `metadata` jsonb (brand, couleur, dimensions, **color_hex**, outdoor, ingestion…), `availability_status`, `partner_tier`. |
| `partner_merchants` | Registre marchand : `affiliation_platform` (awin/piloterr/direct/other), `advertiser_id`, `feed_url`, `commission_pct`, `status`. |
| `partner_sync_runs` | Journal des syncs catalogue. |
| `lbc_search_cache` | Cache Leboncoin (seconde main, phase 2). |
| `shopping_lists` | (legacy) `matching_strategy`. |

**Auth / B2C / Pro**
| Table | Rôle |
|---|---|
| `profiles` | Profil user + **plan** (neophyte/expert/pro). |
| `credit_wallet` / `credit_transactions` | Crédits B2C (consommation génération). |
| `pro_clients`, `pro_properties`, `pro_property_rooms`, `pro_generation_jobs`, `pro_renders`, `pro_share_links`, `pro_templates` | Suite **Pro** (multi-biens, jobs, rendus, partage, templates). |
| `projects` | Table legacy (le projet B2C vit dans `foyer_projects`). |

### `Project` (foyer_projects.data) — champs clés ✅
`id`, `roomType`, `basePhotoUrl`, `selectedStyleId`, `userConstraints`, `visionOutput` (profils détectés réutilisés), `element_decisions[]`, `detectedFurniture[]`, `dispositionsRenderUrls[]`, `generatedRenderUrl` (rendu courant), `firstRenderUrl`, `iterationCount`, `editRequests[]`, `shoppingList[]`, `scoreFoyer`, `builtShoppingList`, `storageFolder`. *(`CLEAR_FINALIZE` invalide shoppingList/score/audit dès que rendu ou décisions changent.)*

---

## 4. Cycle de vie d'un projet

```
upload photo + style
 → ANALYSE   : runAnalysisPipeline  (détection + verdict → element_decisions)   [page review]
 → GÉNÉRATION: runGenerationPipeline (1 rendu) OU runDispositionsPipeline (3 rendus → choix)
 → (FINAL)   : ensureFinalAssets    (audit + liste de courses + matching + score) [page final]
 → ITÉRATION : runIterationPipeline  (édition ciblée du rendu courant)
```

---

## 5. Pipeline IA (`lib/ai/pipeline.ts`) — fonctions exportées ✅

### `runAnalysisPipeline(projectId)` — **2 appels Gemini**
1. **Détection** : `detectElementProfiles` → prompt **`vision_detect_extended`** (provider `gemini_vision`) → `elementProfiles[]` (element_id, category slug, description, color, material_family, surface_features, condition, movable, dims). Catégories autorisées injectées depuis `assets.element_category` (filtrées par type de pièce via `getElementCategoryEnum`).
2. **Filtre DIY déterministe** : `getCandidateActions(profile, styleId)` calcule les actions DIY applicables par élément (requires/excludes + tri par affinité de style).
3. **Verdict** : prompt **`verdict_elements`** → pour chaque élément `mismatch_type` (`none`/`surface`/`structural`) + `action_slug`/`action_label`, choisi **parmi les candidates**.
4. **Garde-fous** : (a) "surface" sans action DIY valide → fallback meilleure candidate, ou si aucune → `structural` ; (b) **clamp** par `getAllowedActionsByCategory` (une catégorie n'accepte que certaines actions : assise = garder/remplacer ; mur = garder/repeindre ; fenêtre/porte = garder…).
→ persiste `element_decisions` + `visionOutput`. L'utilisateur ajuste sur la page **review** (chips Garde/Personnalise/Remplace).

### `runGenerationPipeline(projectId)` — **1 rendu**
- Réutilise `visionOutput` (pas de 2e détection ; fallback détecte si absent).
- Contexte : style (`loadStyleContext`), defaults pièce, contraintes user (`constraintsToChoices`/`formatUserInstructions`), **plan de design** issu des décisions (`formatDesignPlan`), **architecture fixe** (`buildFixedFeaturesSummary` : compte chiffré fenêtres/portes-fenêtres `french_door`/portes/ouvertures `wall_opening`/escalier… → empêche le modèle de boucher/déplacer l'archi), `buildRemoveList`.
- Génère via prompt **`gen_wow_generic`** + `getImageProvider(provider).generateFromText(...)`. Sauvegarde → `generatedRenderUrl`.
- ⚠️ Pas d'audit à la génération (commenté : l'audit appartient au "finalize" déclenché par l'user).

### `runDispositionsPipeline(projectId)` — **3 rendus distincts** (feature experts)
- 3 **briefs de layout** en dur (`DISPOSITION_BRIEFS` : convivial / ouvert / aéré), formulés en agencement de mobilier pur (pas de repère archi, qui faisait déplacer l'escalier).
- 3 appels parallèles à **`gen_wow_3_dispositions`** (1 par brief) → 3 rendus plein format → `dispositionsRenderUrls`. ⚠️ « multiple candidates » non dispo dans l'API → 3 appels séparés.
- L'user **choisit** (route `select-disposition`) → le rendu devient `generatedRenderUrl`.

### `runIterationPipeline(projectId, userRequest)`
- Édite **toujours le rendu COURANT** (`editImage`) via **`iterate_generic`** + le seul `userRequest` (⚠️ pas de design plan ré-injecté → préserve les changements déjà appliqués). Incrémente `iterationCount`, ajoute à `editRequests[]`.

### `ensureFinalAssets(projectId)` → `{ shoppingList, scoreFoyer }`
1. **Audit** `confirmChanges` : prompt **`confirm_changes`** (provider `gemini_vision`) sur un **composite AVANT|APRÈS** (`buildBeforeAfterComposite`). Renvoie par élément candidat : `changed`, `after` (description dans le rendu), **bbox** (panneau APRÈS, reprojetée vers le rendu via `mapCompositeBoxToRender`).
2. **Décisions effectives** : la liste reflète le **RENDU** (un "keep" changé par le générateur → promu remplacement ; mur repeint sans fourniture → injecte "Peinture").
3. **Additions** `computeRenderAdditions` : détection d'inventaire **du rendu** (`detectElementProfiles(..., {withBbox:true})`, pleine résolution, + bbox + `color_hex`) réconciliée avec l'AVANT (`reconcileRenderAdditions`).
4. **Construction** : `reconcilePlan(decisions, {elements:[]}, …)` (→ kept/applied/toReplace) → `buildShoppingList` → `builtToLegacyShoppingList` → fusion + quantités (`mergeShoppingItems`).
5. **Matching produits** (§8) : crops du rendu + blend image/texte/couleur.
6. **Score Foyer** (§11). Persiste `shoppingList`, `scoreFoyer`, `builtShoppingList`. ⚠️ mis en cache (renvoie l'existant) ; le bouton "Rafraîchir" reset + recalcule (`POST /api/projects/[id]/refresh-shopping`).

---

## 6. Prompts, providers & tracking IA ✅

- **8 prompts actifs en base** (`prompts`, clé `slug`) : `vision_detect`, `vision_detect_extended`, `verdict_elements`, `gen_wow_generic`, `gen_wow_3_dispositions`, `iterate_generic`, `confirm_changes`, `extract_alterations`. Résolus par `resolvePrompt(slug, vars, {strict})` (`lib/prompts/engine.ts`, `helpers.ts`), injection `{{vars}}`. ⚠️ **Le code doit être déployé avec les prompts** (sinon placeholder littéral).
- **Providers** (`lib/ai/provider.ts`) : vision = `gemini_vision` (`GeminiVisionProvider`) ; image = `nano_banana` (Gemini **flash-image**) ou `flux_kontext` (Flux). Le provider de chaque appel vient du champ `provider` du prompt.
- **Modèles** référencés : `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-flash-image`, `jina-clip-v2`.
- **Tracking** : `withTracking(meta, fn)` (`lib/ai/track.ts`) écrit chaque appel dans `ai_calls` (tokens/images/latence/coût via `lib/ai/pricing.ts` ← `ai_pricing`). `logPipelineEvent` → `pipeline_logs`.

---

## 7. Moteur DIY (`lib/diy/`) ✅

- `diy_actions` : actions de customisation (repeindre, lasurer, cannage, moulures, retapisser, etc.) avec `requires`/`excludes` (material_family, surface_features, condition), `style_affinity` (score par style), difficulté, temps, **formule de quantité**, fournitures.
- `getCandidateActions(profile, styleId)` (`rules.ts`) : filtre les actions dont `requires` matche ET `excludes` ne matche pas le profil, trie par `style_affinity[styleId]`.
- `evalQtyFormula(formula, dims)` (`quantities.ts`) : **mini-évaluateur arithmétique** (tokenize → parse → eval) avec variables = dimensions (`getStandardDims` ← `assets.standard_dims` + dims détectées) ; erreurs sur variable inconnue / division par zéro.
- Résultat : un élément "customize" porte des **fournitures DIY** (source `diy` dans la liste).

---

## 8. Matching liste de courses ↔ produits réels (cœur métier)

`ensureFinalAssets` attache à chaque item les vrais produits proches. ⚠️ `SHOPPING_RAW_AUDIT_MODE=true` → tout part en "À sourcer" puis est matché.

### 8.1 Mobilier & reste — BLEND crop↔image + description↔texte + COULEUR
`matchPartnerProductsBlendBatch` (`lib/shopping/partnerMatch.ts`) → RPC SQL `match_partner_products_blend`.
- 2 signaux de la même détection : **crop** du rendu (bbox) → embedding image ; **description** → embedding texte.
- `blend = w·cos(crop, image_produit) + (1−w)·cos(desc, texte_produit)`. `w` par **catégorie × source** (`assets.matching_weights`). crop absent → texte seul.
- **Terme COULEUR (hex/ΔE)** : re-ranking par proximité perceptuelle **ΔE CIELAB** (`lib/color.ts`) — latitude réglable, **pas un match exact** : `colorScore = max(0, 1 − ΔE/threshold)`. Couleur élément lue par Gemini (`color_hex`) ; couleur produit = `metadata.color_hex` (calculée image, backfill). Poids **par catégorie** (`matching_weights.<cat>.color.weight`) : fort où la couleur discrimine (canapé/tapis/rideaux 0.30), faible où la **forme** prime (table 0.04, fauteuil 0.08). ⚠️ Le seuil "À sourcer" reste sur le **blend** (la couleur re-classe, n'élimine jamais).
- Sous le seuil (`min_score` par source) → item "À sourcer".

### 8.2 Peinture — par COULEUR (ΔE) (`paintMatch.ts`)
Vision lit la couleur de **chaque mur REPEINT** (AVANT|APRÈS), compare en ΔE au `metadata.color_hex` des peintures. 1 item/mur, `targetHex` affiché.

### 8.3 Sol — blend FILTRÉ par matériau (`matchFloorProductsBlend`)
Blend, mais **filtré par type de revêtement** (`FLOOR_MATERIALS` regex : parquet/stratifié vs carrelage vs béton vs pvc). Poids 'floor' (w image 0.45). Seuil après le filtre.

### 8.4 Texte produit
`buildProductText(product)` (`lib/catalog/productText.ts`) : name + description + specs (couleur/matière/dimensions/marque, **agnostique du marchand**). Réutilisé par sync ET backfill.

### 8.5 (À venir) Étape 2 — attributs structurés
`lib/shopping/attributeSchema.ts` : référentiel par catégorie (attributs priorisés + vocabulaire fermé + poids sur 100 du score texte) pour capturer la **forme/tissage/nb de places** que couleur+image floutent.

---

## 9. Catalogue & affiliation

### Ingestion (`lib/catalog/`)
- Interface `ProductSource`. Implémentations : `PiloterrSource` (test), `AwinSource` (prod, flux CSV Create-a-Feed).
- `ingestFromSource(source, categories, opts)` : embeddings **image + texte** (Jina), `buildProductText`, `affiliate_url`, `metadata`. Dédup + skip-reprise + throttle Jina.
- `AwinSource` : lit `partner_merchants.feed_url`, télécharge (gunzip si gzip), parse CSV (`lib/catalog/csv.ts`), filtre catégorie, `affiliate_url=aw_deep_link`, image pleine résolution, capte couleur/dimensions/matière, flag `outdoor`.

### Catalogue actuel (~7300)
- Cdiscount ~2008, Leroy Merlin ~1049, IKEA ~687 (test Piloterr) ; **tapis.fr ~3553** (Awin réel : 2785 tapis dont 524 outdoor, 750 luminaires, 19 miroirs). 100% embeddés + 100% `color_hex`.
- ⚠️ luminaires/miroirs **dormants** (catégories `lamp`/`mirror` `NON_SHOPPABLE` côté matcher).

### Affiliation & suivi
- `partner_merchants` = source de vérité (plateforme, advertiser_id, **commission_pct**, feed_url, status). tapis.fr : Awin, advertiser 107550, **13%**.
- **Clic tracké** : `GET /api/track/[item_id]?dest=…` → redirige vers `affiliate_url` (deep-link Awin) + log `pipeline_logs` (`product_click`).
- À construire : ingestion conversions Awin (pending→approved→payé) → CA, page `/admin/partners`. ⚠️ Hors Awin : **MdM = Effinity** ; **La Redoute = Kwanko/Effinity** (Awin = refus).

---

## 10. Config data-driven (table `assets`) ✅

Catégories utilisées (`lib/db/assets.ts`) :
- **`ambiance`** = les **STYLES** proposés (le `selectedStyleId` = un slug d'ambiance ; `getAmbiances`/`getAmbianceById`).
- **`element_category`** = taxonomie d'éléments (slug → catalog_category, allowed_actions) ; filtrée par pièce.
- **`room_defaults`** = catégories à retirer par type de pièce.
- **`floor_preset`**, **`wall_palette`** = presets sol / palette murs.
- **`standard_dims`** = dimensions standard (formules DIY).
- **`matching_weights`** = poids matching par catégorie (`image_weight` par source, `min_score` par source, `color`{weight,threshold}) ; slug `default` + overrides ; cache app TTL 30 s.
Édition via `/admin/assets/[category]`.

---

## 11. Score Foyer (`computeScoreFoyer`, `lib/shopping/matcher.ts`) ✅

En **unités** (quantités incluses) : `kept` (conservés), `secondhand`, `ecoNew` (neuf avec marchand).
- **CO₂ ≈ `kept·30 + secondhand·20 + ecoNew·5` kg.**
- `totalEstimated` = Σ prix moyens × quantités.

---

## 12. Auth, plans, crédits, billing ✅

- **Supabase Auth** (`lib/auth/actions.ts`) : `signUp(email, pwd, name, plan)` (plans valides `expert`/`pro`, défaut **`neophyte`**), `signIn`, `claimAnonProjects` (anon → user).
- **Plans** : `neophyte` (gratuit, limité), `expert`, `pro`.
- **Crédits** : `credit_wallet` + `credit_transactions` ; `getWallet`, `creditUser`, `checkAndConsumeCredit(projectId, userId)` → expert/pro = illimité, neophyte = consomme un crédit. `activateExpertPlan`.
- **Billing** ⚠️ **Stripe factice** : `create-checkout-session` génère une `fake_…` session + redirige vers `/billing/success` ; `webhook` = stub 200. Vraie intégration à venir.
- **Middleware** (`middleware.ts`) : pages/API `/admin/*` protégées par cookie `admin_session` (`ADMIN_SESSION_TOKEN`) ; `/account` & `/projects` requièrent l'auth ; résilient si env Supabase absente (preview). `PAYWALL_DISABLED=true` désactive le gating en preview.

---

## 13. Pages (App Router) ✅

- **Marketing** : `(marketing)` (home), `/features`, `/auth`.
- **Création B2C** : `/create` → `/create/[projectId]` → `/create/style`, `/create/generating`, `/create/dispositions`, `/create/[projectId]/review`, `…/final`, `…/iterate`. Pages legacy `/demo`, `/order`.
- **B2C connecté** : `/dashboard`, `/dashboard/rendus` (historique, limite 3 neophyte + slots verrouillés + CTA upgrade), `/dashboard/settings`, `(authenticated)/account`, `(authenticated)/projects`, `/billing/success`.
- **Pro** : `/pro`, `/pro/create`, `/pro/dashboard` (+ `biens`, `biens/[id]`, `clients`, `jobs/[jobId]`, `templates`, `stats`, `settings`), `/pro/share/[slug]`.
- **Admin** : `/admin`, `/admin/dashboard` (coûts IA), `/admin/ai-pricing`, `/admin/assets[/...]`, `/admin/catalog[/...]`, `/admin/diy-actions[/...]`, `/admin/prompts[/...]`, `/admin/logs[/...]`, `/admin/login`.

---

## 14. Routes API (`app/api/`) ✅

- **Projet B2C** : `projects/[id]/{analyze, constraints, decisions, furniture, style, generate, generate-dispositions, select-disposition, iterate, refresh-shopping}`, `detect`, `generate`, `upload`.
- **Tracking** : `track/[item_id]` (clic affilié).
- **Cron** : `cron/sync-partners` (sync catalogue).
- **Billing** (factice) : `billing/{create-checkout-session, customer-portal, webhook}`.
- **Pro** : `pro/{clients, properties, rooms/upload, templates, jobs/create, jobs/[jobId]/{run,status,export-pdf,share}, renders/[renderId]/favorite}`.
- **Admin** : `admin/{login, logout, ai-pricing[/id], catalog[/id, /sync], diy-actions[/id], logs, prompts/test}`, `prompts/test`, `ai/test`.

---

## 15. Scripts & outillage (`scripts/`)

- **Catalogue** : `seed-test-catalog.ts` (Piloterr), `sync-awin.ts` (`--file`/`--force`), `backfill-text-embeddings.ts` (`--all`), `backfill-color-hex.ts` (couleur dominante sharp, Accept jpeg/webp).
- **Diagnostic matching (lecture seule, ne persistent rien)** : `validate-blend.ts`, `validate-additions.ts`, `diag-embedding.ts`, `diag-project.ts`, `diag-color.ts`, `audit-dump.ts`.

---

## 16. Limites connues & roadmap

- **% correspondance** plafonné ~80-92% : limite intrinsèque (rendu **génératif** vs photo catalogue ; CLIP = ressemblance, pas identité d'instance). Leviers : crop serré, profondeur catalogue, attributs structurés.
- **Couleur form-blind** : un objet même-couleur mauvaise-forme peut remonter (cube blanc, fauteuil à bascule). Stopgap = poids couleur par catégorie. **Vrai fix = Étape 2** (`attributeSchema.ts`).
- **Luminaires/miroirs** ingérés mais dormants (catégories à activer).
- **Suivi affiliation** (conversions → CA, `/admin/partners`) à construire.
- **Seconde main** (Leboncoin) : `lbc_search_cache` prêt, matcher hybride `matchAlterationsHybrid` (legacy/parallèle), phase 2.

---

*Doc vérifiée contre le code (lib/ai/pipeline.ts, lib/shopping/*, lib/catalog/*, lib/diy/*, lib/auth/*, lib/db/assets.ts, middleware.ts, app/api/*, base Supabase). Matching récent : commits `3254082`→`bd8fefe`.*
