# Mode expert — blueprint (implémenté, 2026-07-07)

> Objectif : un rendu **de la même pièce** avec les **vrais meubles du catalogue**, sans
> look IA. Pour un tier **payant**.

## Architecture retenue : VIDER → MEUBLER (2026-07-07)

Le rendu expert ne swappe plus les meubles d'un rendu fictif (ça gardait/dupliquait l'ancien
meuble : bug « 2 meubles TV »). Il part de la **photo de base** et procède en 2 étapes NB2 :

1. **Vider** (`emptyRoom`) — on retire tout le mobilier amovible de la photo de base, en
   conservant l'architecture et les éléments non remplacés : murs + couleur, alcôves, moulures,
   fenêtres, **rideaux**, portes, radiateurs, **parquet**, plafond + luminaires. Nécessaire car
   **les photos ne sont pas toujours vides** (annonces déjà meublées / staging). Le résultat
   (`emptyShellUrl`) est **mis en cache** (la photo de base ne change jamais) et **précalculé
   en fond dès l'upload** en mode expert (`after()` dans `/api/upload`) → à l'écran expert il ne
   reste que l'étape « meubler ».
2. **Meubler** (`furnishRoom`) — 1 appel NB2 = coquille vide + N images produit + prompt de
   mapping. Partir du vide **élimine par construction** le bug du meuble fictif conservé.

Validé par loops de test (2026-07-07) : chambre + 2 salons sur photo vide, + cas photo meublée
(mid-century) vidée puis re-meublée, + end-to-end via l'endpoint réel (31 s les 2 étapes, ~20 s
quand la coquille est précalculée). Fichiers : `lib/ai/expert.ts`, `POST /api/projects/[id]/expert-render`.

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

## Le flux `/expert-create` (implémenté)

Vrai flux **alternatif** (route séparée, pas un bouton en fin de flux standard). Même UploadForm
en mode expert → `project.mode='expert'`. Parcours style/review/generate **partagé** avec
`/create` (le rendu standard pilote le matching → `shoppingList`). Terminal mode-aware : sur le
`RenderScreen`, « J'adore » → `/create/[id]/expert` (au lieu de `/final`).

Écran expert (`ExpertScreen` + `app/(create)/create/[projectId]/expert/page.tsx`) :
1. Calcule la `shoppingList` si besoin (`ensureFinalAssets`, on saute `/final`).
2. `selectExpertPieces` : gros meubles matchés (whitelist `EXPERT_CATEGORIES`), 1 par catégorie,
   priorisés, plafond 8. V1 = SEULEMENT gros meubles (canapé/tables/tapis/meuble TV/lit/etc.),
   exclut déco/peinture/sol/luminaires.
3. **Auto-génère** le rendu (vider → meubler). « Avant » du slider = **photo de base** ; « après »
   = pièce meublée avec les vrais produits.
4. CTA principal **« Voir ma liste de courses »** (→ `/final`) ; secondaire « Régénérer un autre
   agencement » (NB2 a de la variance → nouvelle disposition).

À faire (cf. Chantiers) : « URL produit imposé » (coller un lien → image en réf) ; inversion du
matching (curation au lieu de render-driven).

## Coût / perf
- ~1 appel NB2 par rendu (multi-meubles) : ~$0,05-0,13, ~20 s. Marginal vs le volume standard.
- Tier premium → coût acceptable.

## Prompt de meuble : règles FONCTIONNELLES (pas de placement rigide)
- **Pas de placement rigide par meuble** (choix user, plus scalable), mais le containment seul
  ne suffit pas : il empêche de traverser un mur mais pas les fautes fonctionnelles (meuble TV
  sur une porte, canapé devant une ouverture, rien face à la TV). `furnishPrompt` impose donc 4
  RÈGLES FONCTIONNELLES :
  1. Portes / passages toujours dégagés (jamais de meuble devant/à cheval sur une porte ou une
     ouverture vers une autre pièce).
  2. TV/meuble TV contre un mur PLEIN (sans porte ni fenêtre) — niche peu profonde OK.
  3. Assises (canapé, fauteuil) tournées vers la TV → coin conversation autour du tapis + table.
  4. Grosses pièces repoussées contre les murs, centre + passages dégagés.
  + containment (chaque pièce entièrement dans la pièce, à plat, aucune traversée mur/porte/
  fenêtre/ouverture) + préservation expo/balance des blancs (corrige le délavé).
- **Fiabilité testée (2026-07-07)** : 5 tirages / 5 acceptables avec ces règles (plusieurs avec
  canapé face TV + passage dégagé), vs cas inacceptables sans (meuble TV sur porte). Validé aussi
  via l'endpoint réel. La variance résiduelle est couverte par le bouton « Régénérer ».

## Chantiers ouverts
- **Intégration dès le 1er rendu (inversion pipeline)** : aujourd'hui le matching reste piloté
  par le rendu standard fictif (le flux partagé le génère → shoppingList → écran expert vide+
  meuble). L'idéal (demande user) : curer les produits directement (room_defaults + style) et
  faire du rendu vide+meublé LE premier rendu, sans passer par le fictif. Nécessite un chemin de
  matching « curation » (pas render-driven). Non fait — à cadrer.
- **Alternative à Gemini (dépendance)** : NON résolu. Seedream (non-Google) recompose → pas un
  fallback à qualité égale. À tester : **FLUX.2 edit** (`fal-ai/flux-2-pro/edit`). Sinon, garder
  NB2 pour la qualité + fallback dégradé seulement en 503. Voir `docs/FALLBACK_PROVIDERS.md`.
- **Packshots** : la qualité produit dépend d'une image de référence sur fond neutre (cf. plus
  haut). Prévoir sélection `_packshot` ou détourage `fal-ai/birefnet` pour les réfs d'ambiance.
- **Petits ajouts hors-réf** : NB2 ajoute parfois un petit cadre / livre déco (mineur). À cadrer
  si gênant.
- **Ratio** : NB2 préserve le ratio d'entrée (photo paysage → sortie paysage). OK pour les
  photos réelles ; carré seulement si l'entrée est portrait.
- Env : `FAL_API_KEY` (NB2 + fallbacks), `GPT_API_KEY` (option). Clé Gemini déjà là.

## Lien avec l'existant
- Le flux standard (`/create`) reste inchangé — l'expert est une route séparée.
- La curation peut réutiliser le matching partenaire existant (`lib/shopping/partnerMatch.ts`).
