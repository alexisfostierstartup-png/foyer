# Fallback génération d'image + mode expert — comparatif providers (2026)

> Recherche du 2026-07-06. **Rien n'est câblé** — à valider avant intégration.
> Objectif : (a) un fallback quand `gemini-2.5-flash-image` renvoie 503, (b) un mode
> expert haute-fidélité conditionné sur jusqu'à 14 images de meubles réels.

## Constat structurant : le 503 est infra-Google

Le 503 « model overloaded » est une **saturation de capacité côté Google** (distincte du 429
quota), qui touche tous les users en même temps (incidents documentés fév. 2026). **Imagen,
Nano Banana 2 et Nano Banana Pro tournent sur la MÊME flotte** → ils 503 ensemble. Donc :
un vrai fallback de résilience doit être sur une **infra non-Google** (Black Forest Labs,
ByteDance/Seedream, ou OpenAI).

## Déjà dans le code
- `lib/ai/provider.ts` : `getImageProvider()` expose `nano_banana` (Gemini) + un stub
  **`flux_kontext`**. La route admin de test whiteliste déjà `["nano_banana","flux_kontext"]`.
  → le chemin FLUX est à moitié plombé = coût d'intégration le plus bas.
- Chaque ligne `prompts` porte son `provider` → ajouter un fallback = registre + routage,
  **pas** un changement de schéma.

## Comparatif (chiffres 2026, à re-vérifier avant achat)

| Modèle / API | Hébergement | Multi-référence (besoin ~14) | Coût/img | Latence | Qualité intérieur/édition | Compat prompt Gemini | Hors Google ? |
|---|---|---|---|---|---|---|---|
| **FLUX.1 Kontext [pro]** | BFL, fal.ai, Replicate | 1 réf native (max/multi expérimental ~4) | **$0.04** | ~3-5s | Forte (édition locale, relight) | NL OK, aime les verbes d'édition explicites | ✅ |
| **FLUX.1 Kontext [max]** | BFL, fal | ~4 (expérimental) | $0.08 | ~7s | Meilleure adhérence | idem | ✅ |
| **FLUX.2 [pro/max]** | BFL, fal, Vercel AI Gateway | **jusqu'à 8 via API** (<14) | ~$0.03-0.10 | pro rapide | Photoréalisme 2026 au top | NL + rôle par référence | ✅ |
| **Seedream 4.5 Edit** (ByteDance) | fal, Replicate | **1-10** (<14) | ~$0.04 | ~2-6s | **Conçu pour « swap sol/mur/meuble en gardant la lumière »** | NL portable | ✅ |
| **GPT Image 2 / 1.5 (edit)** | OpenAI, Vercel AI Gateway | **jusqu'à 16 images** ✅ couvre 14 | ~$0.009-0.133 +tokens image | ~5-20s | **#1 arène édition (Elo ~1254)** | NL portable | ✅ |
| Google Imagen 3/4 | Vertex | limité | ~$0.03-0.06 | — | bon, édition pièce faible | native | ❌ même infra 503 |
| Nano Banana Pro (`gemini-3-pro-image`) | Google | **14 réfs** ✅ | $0.134 (batch $0.067) | rapide-moy | Elo ~1240 | **native, 0 changement** | ❌ même infra 503 |
| Stability SD3.5 | Stability, Replicate | pas de multi-réf natif | $0.035-0.065 | moy | mid | **prompts à adapter (tags)** | ✅ |
| Ideogram 3.0 | Ideogram | édition par masque | $0.03-0.09 | moy | fort texte, pas relight pièce | **paradigme masque** | ✅ |

Non vérifiés (pas de benchmark intérieur 2026 trouvé) : Luma Photon, Leonardo, Bria, Recraft,
Adobe Firefly (ce dernier = indemnisé IP / « commercially safe » si enjeu légal). Ne pas
considérer comme drop-in sans essai direct.

## Compatibilité des prompts
Les prompts NL actuels portent **proprement** vers FLUX Kontext/FLUX.2, Seedream et GPT Image.
FLUX gagne à ajouter des verbes d'édition explicites (« replace the sofa… keep the wall and
window unchanged ») + termes PBR/lighting → **petit variant de template, pas une réécriture**.
**SD3.5 et Ideogram** nécessitent une vraie adaptation (tags / masque).

## Reco

**(a) Fallback 503 drop-in → FLUX.1 Kontext [pro] via fal.ai.** Stub déjà présent = le moins
cher à livrer. $0.04/img, ~4s, prompts compatibles (léger tuning), **hors infra Google** →
survit à une panne Gemini. À câbler en cible de retry automatique sur 503/timeout de
`nano_banana`. Second à ajouter dans la même passe : **Seedream 4.x Edit** (~$0.02-0.04,
conçu pour l'intérieur, souvent meilleur que Kontext ici). Idéal : les deux derrière
**Vercel AI Gateway** → 503 → Kontext → Seedream en cascade automatique.

**(b) Mode expert 14 meubles → GPT Image 2/1.5 (edit).** Seul modèle mainstream non-Google
qui accepte nativement **jusqu'à 16 images** en un appel (couvre les 14) et **#1 en édition**.
Coût plus élevé + token-billed, ~5-20s → acceptable pour un tier premium. Hors Google → sert
aussi de fallback haute qualité.
- Alternative « rester chez Google » pour la parité prompt : **Nano Banana Pro** (14 réfs,
  0 changement de prompt, ~$0.134) — mais **même infra 503**, donc jamais comme fallback de
  panne ; à réserver derrière Vertex *provisioned throughput*.
- FLUX.2 (8 réfs) / Seedream 4.5 (10 réfs) < 14 en un appel → utilisables pour l'expert
  **seulement** en compositant les images produit en 1-2 collages de référence (contournement
  courant et efficace).

**Câblage net suggéré :** primaire `nano_banana` → sur 503, cascade `flux_kontext (fal)` →
`seedream_edit` ; toggle « Expert » → `gpt_image` (14 réfs, meilleur édition) ou
`nano_banana_pro` (14 réfs, prompt natif, mais infra Google). Le tout derrière Vercel AI Gateway.

## Sources clés
BFL pricing/multi-ref : bfl.ai/pricing, docs.bfl.ml, fal.ai/flux-2 · Seedream : seed.bytedance.com/en/seedream4_0,
wavespeed.ai · GPT Image (16 imgs, arène) : developers.openai.com, artificialanalysis.ai/image/leaderboard/editing ·
503 infra Google + Nano Banana Pro 14 réfs : status.cloud.google.com, pricepertoken.com · Stability/Ideogram : platform.stability.ai, ideogram.ai
