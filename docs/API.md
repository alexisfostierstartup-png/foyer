# Foyer — Référence API

> Cartographie exhaustive des 43 routes `app/api/**/route.ts` (vérifiée dans le code le 2026-07-04).
> Colonne **Auth** : `public` = aucun contrôle · `anon-ok` = fonctionne sans compte (cookie) · `authenticated` = session Supabase requise · `owner-only` = vérifie la propriété · `pro` = plan `pro` requis · `admin` = cookie `admin_session` (middleware) · `cron` = `CRON_SECRET`.

## Conventions transverses

- **Admin** : toutes les routes `/api/admin/*` (sauf `login`) sont gardées **centralement** par `middleware.ts` (cookie `admin_session` == `ADMIN_SESSION_TOKEN`), pas dans le handler.
- **Paywall** : de nombreuses routes contournent les gardes crédit/auth quand `PAYWALL_DISABLED === true` (`lib/constants.ts`) — c'est le mode démo actuel.
- **`after()`** : plusieurs routes lancent le travail IA/shopping lourd en arrière-plan après avoir répondu (précalcul), dans le budget `maxDuration` de la route.
- **Store projet** : `getProject(id)` / `updateProject(id)` lisent/écrivent `foyer_projects.data` (jsonb) via le client **service-role** (contourne la RLS) → la sécurité repose entièrement sur les contrôles applicatifs de chaque route.

---

## 1. Flux de création / génération

| Méthode & chemin | Rôle | Auth | Entrée | Sortie | Effets · maxDuration |
|---|---|---|---|---|---|
| `POST /api/upload` | Normalise la photo (sharp), crée le projet, lance la détection en fond | anon-ok | multipart `file`, `roomType` (validé vs `getRoomTypes()`) | `{ projectId, basePhotoUrl }` · 400/413(>8 Mo)/500 | Storage write, `createProject`, cookie `foyer_anon_id` 30 j, `after(precomputeDetection)` (Gemini). **60 s** |
| `POST /api/projects/:id/generate` | Pipeline de rendu stylé principal | crédit (anon-ok), **pas d'ownership** | aucune | `{ ok, projectId }` · 402/429/400/503 | `runGenerationPipeline` (image Gemini), consomme crédit, `after(precomputeFinalAssets)`, cookie `foyer_free_used` 1 an. **90 s** |
| `POST /api/projects/:id/generate-dispositions` | Génère 3 dispositions alternatives | crédit (anon-ok), **pas d'ownership** | aucune | `{ ok, projectId, urls }` · 402/503 | `runDispositionsPipeline` (3 images //). **90 s** |
| `POST /api/projects/:id/iterate` | Régénère en appliquant une modif en langage naturel | **public** (ni auth ni crédit) | `{ userRequest: string }` | `{ ok, projectId }` · 400/429/503 | `runIterationPipeline` (image Gemini), `after(precomputeFinalAssets)`. **90 s** |
| `POST /api/projects/:id/analyze` | Analyse vision de la pièce (détection + verdict) | **public** | aucune | `{ ok, projectId }` · 503 | `runAnalysisPipeline` (2 appels Gemini). **60 s** |

## 2. Projets (état & choix utilisateur)

Toutes résolvent `getProject(id)` (404 si absent). **Aucune ne vérifie la propriété** (voir audit C4/C3).

| Méthode & chemin | Rôle | Auth | Entrée | Sortie |
|---|---|---|---|---|
| `POST /api/projects/:id/constraints` | Enregistre les contraintes utilisateur | public | `UserConstraints` (body entier) | `{ ok }` · 404 |
| `GET,PATCH /api/projects/:id/decisions` | GET lit les décisions par élément ; PATCH applique des overrides de verdict | public | PATCH `{ overrides?: Record<string,MismatchType> }` | `{ decisions[] }` / `{ ok, decisions[] }` · 404 |
| `PATCH /api/projects/:id/furniture` | Remplace la liste de meubles détectés | public | `{ furniture: DetectedFurniture[] }` | `{ ok }` · 404 |
| `POST /api/projects/:id/style` | Fixe le style (validé vs `data/styles.json`) | public | `{ styleId }` | `{ ok }` · 400/404 |

## 3. Shopping

| Méthode & chemin | Rôle | Auth | Entrée | Sortie · effets |
|---|---|---|---|---|
| `POST /api/projects/:id/select-disposition` | Fige une disposition comme rendu courant, reset dérivés, précalcul shopping | public (valide l'url vs la liste du projet) | `{ url }` | `{ ok }` · 400/404 · `after(precomputeFinalAssets)`. **90 s** |
| `POST /api/projects/:id/refresh-shopping` | Recalcule la liste + score ; `?full=1` purge le cache vision | **owner-only** (si `!PAYWALL_DISABLED`) | query `full` | `{ shoppingList, scoreFoyer }` · 401/403/404 |
| `GET /api/projects/:id/shopping-status` | Polling de l'écran /final ; auto-répare (relance le précalcul) | public | — | `{ ready, shoppingList?, scoreFoyer? }` · 404 · `after(precomputeFinalAssets)`. **90 s** |
| `GET /api/track/:item_id` | Redirection de tracking affilié | public (service-role) | query `dest` (validé http(s)) | 302 · 400 · lit `partner_products`, log `pipeline_logs` |

## 4. Billing / Stripe — **stubs Wizard-of-Oz** (pas de vraie intégration)

| Méthode & chemin | Rôle | Auth | Entrée | Sortie · effets |
|---|---|---|---|---|
| `POST /api/billing/create-checkout-session` | Faux checkout → URL de succès locale | authenticated | `{ type, successUrl, cancelUrl }` | `{ url, sessionId:"fake_…" }` · aucun Stripe, aucun crédit |
| `POST /api/billing/customer-portal` | Stub portail → `/account` | authenticated | — | `{ url }` |
| `POST /api/billing/webhook` | Stub webhook (log + 200) | **public, aucune vérif signature** | `text()` | `{ received:true }` · aucun effet |

> ⚠️ Le grant réel de crédits/plan est fait par la **page** `app/billing/success/page.tsx` sur un simple GET avec `user_id` en clair → faille critique (audit C1/C2). À ne jamais garder en prod.

## 5. Cron

| Méthode & chemin | Rôle | Auth | Effets |
|---|---|---|---|
| `GET /api/cron/sync-partners` | Sync hebdo du catalogue partenaire (Vercel Cron, lundi 03:00 UTC) | cron (`Bearer CRON_SECRET`) | `syncMerchantProducts` sur `manomano/castorama/la_redoute` (full). **Pas de maxDuration → risque timeout** |

## 6. Admin (`admin_session` via middleware)

| Méthode & chemin | Rôle | Entrée | Effets |
|---|---|---|---|
| `POST /api/admin/login` | Login mot de passe → cookie 7 j | `{ password }` vs `ADMIN_PASSWORD` (comparaison temps constant) | Set-Cookie `admin_session` |
| `POST /api/admin/logout` | Efface le cookie | — | Expire cookie |
| `POST /api/admin/ai-pricing` | Crée un tarif IA | body (provider, model, coûts…) | INSERT `ai_pricing` + invalide cache |
| `PATCH,DELETE /api/admin/ai-pricing/:id` | Modifie / supprime un tarif | body whitelisté | UPDATE/DELETE `ai_pricing` |
| `GET /api/admin/catalog` | Navigateur paginé `partner_products` | query (page, limit≤50, filtres, `attr_*`) | SELECT |
| `PATCH /api/admin/catalog/:id` | Image primaire (ré-embed) ou tier partenaire | `{ partner_tier?, primary_image_url? }` | Jina embedding (coût) + UPDATE |
| `POST /api/admin/catalog/sync` | Déclenche un sync (mode test, 100 items) | `{ merchant? }` | `syncMerchantProducts`. **Pas de maxDuration** |
| `GET,POST /api/admin/diy-actions` | Liste / crée une action DIY | POST body **whitelisté** (`slug` requis) | SELECT / INSERT |
| `GET,PATCH,DELETE /api/admin/diy-actions/:id` | Lit/modifie/supprime une action | PATCH whitelisté | SELECT/UPDATE/DELETE |
| `GET /api/admin/logs` | `pipeline_logs` récents | query (limit≤500, project) | SELECT |
| `POST /api/admin/prompts/test` | Résout un template + exécute contre un provider IA | `TestBody` | **Appel IA payant** (utilisé par l'UI admin) |

## 7. Pro (session + plan `pro`)

Chaque handler fait `getUser()` (401 sinon). « pro » ajoute `getProfile().plan === "pro"` (403 sinon).

| Méthode & chemin | Rôle | Auth | Notes |
|---|---|---|---|
| `GET /api/pro/clients` | Liste ses clients | authenticated | `listClients(user.id)` |
| `POST /api/pro/clients` | Crée un client | pro | write |
| `DELETE /api/pro/clients/:id` | Supprime un client | owner-scoped | `deleteClient(id, user.id)` |
| `GET /api/pro/templates` | Liste ses templates | authenticated | |
| `POST /api/pro/templates` | Crée un template | pro | |
| `DELETE /api/pro/templates/:id` | Supprime un template | owner-scoped | |
| `POST /api/pro/properties` | Crée un bien + pièces | pro | writes // |
| `GET /api/pro/properties/list` | Liste ses biens | authenticated | |
| `GET /api/pro/properties/:id/rooms` | Pièces d'un bien | authenticated · **⚠️ non scopé owner (IDOR)** | `getRooms(id)` |
| `POST /api/pro/jobs/create` | Crée un job de staging + déclenche le runner | pro | ⚠️ appelle `/api/pro/jobs/:id/run` **qui n'existe pas** → job jamais exécuté |
| `GET /api/pro/jobs/:jobId/status` | Statut d'un job | owner-only | `getJob(jobId, user.id)` |
| `POST /api/pro/jobs/:jobId/share` | Crée un lien de partage public | owner-only | `createShareLink` |
| `GET /api/pro/jobs/:jobId/export-pdf` | Rapport PDF avant/après | owner-only | `@react-pdf/renderer`. **nodejs, 30 s** |
| `POST /api/pro/renders/:renderId/favorite` | Toggle favori | authenticated · **⚠️ non scopé owner (IDOR)** | UPDATE service-role |
| `POST /api/pro/rooms/upload` | Upload + downscale photo de pièce | pro | sharp→1024/jpeg85, bucket `room-images` |

---

## Routes mortes supprimées le 2026-07-04

`POST /api/generate`, `POST /api/detect` (stubs 501), `POST /api/ai/test`, `POST /api/prompts/test` (dupliquaient l'admin, non gardées, invoquaient l'IA / fuitaient les prompts).

## Route manquante (bug)

`POST /api/pro/jobs/:jobId/run` est référencée par `jobs/create` mais **n'existe pas** → la fonctionnalité « jobs Pro » est cassée. À implémenter (le runner qui exécute la génération par pièce × ambiance) ou retirer le déclencheur.
