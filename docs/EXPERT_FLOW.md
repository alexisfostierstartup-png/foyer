# Mode expert — blueprint (validé par spikes, 2026-07-06)

> Objectif : un rendu **de la même pièce** avec les **vrais meubles du catalogue**, sans
> look IA. Pour un tier **payant**. Architecture prouvée par spikes ; PAS encore implémentée.

## La recette validée (le cœur)

**Modèle : Gemini 3.x image edit** (l'app Gemini a marché en « 3.1 flash lite » ; en API
via fal : `fal-ai/nano-banana-2/edit`). C'est le meilleur pour cette tâche : il swappe le
meuble d'après une image de référence ET préserve la pièce (murs, ouvertures, cadrage) tout
seul, en photoréaliste.

**⚠️ Prérequis critique : images produit PROPRES.** La référence doit être un **packshot**
(produit sur fond blanc/neutre), PAS une photo d'ambiance. Constaté (2026-07-06) : le canapé
(packshot MdM) marche nickel ; le meuble TV (photo d'ambiance Leroy Merlin contenant en plus
un poster « Flower Market », vase, lampe, tapis…) rate → le modèle rétrécit/simplifie le meuble
pour rentrer dans l'emplacement ET recopie des éléments de la scène de référence (le poster
« Flower Market » apparu dans le rendu Seedream venait de LÀ). → étape de sélection/nettoyage :
préférer une image `_packshot`/fond blanc du catalogue, sinon **détourer** (background removal,
ex. `fal-ai/birefnet`) avant le swap. Le catalogue a un mix des deux types d'images.

**Trois règles apprises à la dure :**
1. **Image de référence + prompt MINIMAL.** Envoyer la photo produit et NE PAS décrire sa
   forme. Décrire le meuble en mots = le texte écrase l'image → mauvaise forme. Prompt type :
   `"Replace the {target} in this room with the {target} shown in the second image. Keep everything else exactly the same."`
   (`{target}` = juste le nom : "sofa", "coffee table", "TV stand" — jamais la forme/couleur).
2. **Plusieurs meubles en UN appel.** Base + N images produit + un prompt de mapping
   cible→image : `"In this room, replace the sofa with image 2, the coffee table with image 3,
   the TV stand with image 4. Keep everything else exactly the same."` → 1 appel ~19 s pour
   3 meubles (pas N appels). Rapide et pas cher.
3. **Ni masque ni composite nécessaires.** Le bon modèle préserve la pièce seul. Toute la
   plomberie (masques, inpaint, composite-back, détourage) testée = inutile avec NB2.

**Ce qui NE marche pas** (spikes à l'appui) : `gemini-2.5-flash-image` (vieux, recompose) ;
prompts sur-blindés (fights the image) ; 6+ références d'un coup sur le vieux modèle ; Seedream
/ FLUX Kontext en pleine image (recomposent la pièce, look IA, produit approximatif).

## Le flux `/create-expert`

Même UI/UX que `/create`, avec l'inversion de pipeline (idée user, validée) :
1. Photo pièce + style (comme le flux standard).
2. **Curation produits** : on choisit les vrais produits catalogue par catégorie attendue
   (canapé, table basse, meuble TV, tapis…) selon room_defaults + style + affinité. On peut
   partir de la disposition standard (matching render-driven existant) OU curer directement.
3. **Rendu expert** : 1 appel NB2 = base + images des produits choisis (prioriser sofa/tables
   > déco > peinture, ~jusqu'à ce que la qualité tienne) → la pièce avec les vrais meubles.
4. **Liste shopping = déterministe** : on SAIT ce qu'on a mis → plus besoin de re-détecter le
   rendu. Fiabilité + perf.
5. **Feature « URL produit imposé »** : le user colle un lien ; on récupère l'image (OG/scrape)
   et on l'ajoute comme référence dans le swap.

## Coût / perf
- ~1 appel NB2 par rendu (multi-meubles) : ~$0,05-0,13, ~20 s. Marginal vs le volume standard.
- Tier premium → coût acceptable.

## Chantiers ouverts
- **Alternative à Gemini (dépendance)** : NON résolu. Seedream (non-Google) recompose → pas un
  fallback à qualité égale. À tester : **FLUX.2 edit** (`fal-ai/flux-2-pro/edit`). Sinon,
  garder Gemini pour la qualité expert + un fallback **dégradé** (Seedream/FLUX) seulement en
  cas de 503. Voir `docs/FALLBACK_PROVIDERS.md`.
- **Nombre max de références** avant que NB2 sature (tester 4-6-8 meubles en un appel).
- **Ratio** : NB2 peut sortir carré ; vérifier/forcer le paysage (paramètre aspect fal).
- **Le fauteuil s'est re-stylé tout seul** dans le one-shot (hors cibles) : à cadrer si on veut
  garder certains meubles intacts.
- Env : `FAL_API_KEY` (Seedream + FLUX), `GPT_API_KEY` (option). Clé Gemini déjà là.

## Lien avec l'existant
- Le flux standard (`/create`) reste inchangé — l'expert est une route séparée.
- La curation peut réutiliser le matching partenaire existant (`lib/shopping/partnerMatch.ts`).
