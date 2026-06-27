# Point 4 — Optimisation perf du pipeline (NOTE pour plus tard)

> Statut : **analysé, chiffré, PAS implémenté.** À lancer sur GO explicite du user.
> Contexte : entre soumission photo et liste de courses, ~3-4 min ressentis. Cette note
> garde tout l'historique pour reprendre sans re-creuser.

## Vérité terrain — où part le temps (mesuré sur `pipeline_logs`)
| Étape | Provider | Moy | Max |
|---|---|---|---|
| **detection** (inventaire/analyse vision) | gemini flash-lite | ~18 s | **~30 s** |
| disposition ×3 | nano_banana | ~10 s | 11 s |
| first-render / iterate | nano_banana | ~10 s | 11 s |
| verdict | gemini | ~4,6 s | 6,6 s |

Séquence d'un vrai projet (wall-clock) :
```
soumission → detection 8s + verdict 5s    ≈ ANALYSE 13 s
   (gap 39s : choix du style + prep)
→ disposition_1/2/3 EN PARALLÈLE ~11s      ≈ RENDU 11 s  ✅ déjà //
   (gap 138s : le USER regarde/choisit/édite)
→ iterate 10s (édition live)
   (gap 58s : user)
→ detection 28s                            ≈ INVENTAIRE SHOPPING 28 s ⚠️
```

## Les 3 vérités
1. **Sur la soumission, ce n'est pas le problème** : detection + verdict ≈ 13 s.
2. **Le vrai goulot = la « detection » vision**, surtout l'**inventaire post-rendu (28 s)** :
   scanne tout le rendu (~22 éléments × ~12 champs + bbox + couleurs + maintenant attrs) en
   `mediaResolution HIGH`. La génération d'image (~11 s) est **déjà parallélisée**, ce n'est pas elle.
3. **Une grosse partie des 3-4 min = temps USER** (gaps 39/138/58 s : choisir style, regarder
   les 3 dispositions, éditer). On ne le compresse pas, mais on peut **l'exploiter**.

## « Gemini est-il si lent ? » → NON, c'est le VOLUME de sortie
flash-lite, **pas de thinking**. La latence d'un LLM ≈ proportionnelle aux **tokens de sortie**.
22 éléments × 12 champs = grosse sortie → 18-28 s. Pas Gemini qui rame, la **taille de la commande**.
(Rappel coût : le 7€ surprise = flash + **thinking tokens** facturés en output 2,5$/M → on reste en flash-lite.)

## Les 4 leviers (SANS perte de qualité)

### Levier 1 — Pré-calcul en arrière-plan (UX, gros gain ressenti)
L'inventaire (28 s) + audit + matching tournent quand le user clique « liste de courses ». Or
juste avant il passe 138 s + 58 s à regarder/choisir. → **Lancer dès que le rendu est FINAL**
(après les iterate — pas avant, sinon on recalcule à chaque édition), en tâche de fond.
Quand il arrive sur le shopping : **0 s perçu**. Ne réduit pas le compute, le **cache** derrière le temps user.

### Levier 2 — Sortie LEAN pour l'inventaire shopping (perf RÉELLE)
Le `render_inventory` n'a besoin, pour matcher, que de `category + description + bbox + color_hex + attrs`.
Les champs DIY (`material_family, surface_features, condition, movable, dims`) servent à l'**analyse de
l'origine** (verdict/DIY), PAS à l'inventaire du rendu. → faire un variant **lean** du suffixe pour le
render_inventory → moins de tokens de sortie → **plus rapide ET moins cher**. (Vérifier d'abord que
ces champs ne sont pas lus en aval du render_inventory — a priori non.)

### Levier 3 — Streaming élément-par-élément (le plus « magique »)
Aujourd'hui `generateContent` attend la réponse COMPLÈTE (mur de 28 s). Gemini supporte
`generateContentStream` → tokens au fil de l'eau. → parser l'array JSON incrémentalement
(chaque `{…},` complet), lancer **son** match dès qu'un élément tombe, pousser vers l'UI (SSE).
→ time-to-**premier** résultat ~5-8 s au lieu de 28 s ; la liste se construit en live ; on pipeline.
**MÊME prix** (streaming ≠ surcoût). Caveats : parseur JSON incrémental + chaîne SSE bout-en-bout.

### Levier 4 — Gater l'inventaire redondant
L'inventaire post-rendu (28 s) sert surtout à trouver les **ajouts** (net-new). En pièce **meublée**
→ ~0 ajout, donc 28 s en partie gâchées (l'audit donne déjà les bbox des candidats). → **gater** :
inventaire complet seulement si pièce vide/sparse ; meublée → s'appuyer sur l'audit. (Risque : rater
un ajout en pièce meublée — à évaluer.)

## Lien avec l'Étape 2 (déjà fait)
- Levier 3 (streaming + attrs dans l'inventaire du **rendu propre**) **résout le point 5** gratis :
  les attrs viendraient du rendu net (pleine résolution), pas du composite `confirm_changes`
  (moins précis). Voir [[note point 5]] dans la roadmap.
- Le « fold attrs dans la detection » (levier 4 historique) est **déjà fait** côté inventaire
  (point 3, commit à venir) : l'inventaire émet maintenant les attrs.

## Ordre recommandé
1. **Levier 1** (background pré-compute) — plus gros gain ressenti, zéro risque qualité.
2. **Levier 2** (lean) — MESURER d'abord (detection lourde vs légère sur un vrai rendu, chiffres ms).
3. **Levier 4** (gating) — gain réel dans le cas courant (pièce meublée).
4. **Levier 3** (streaming) — le plus de travail (réarchitecture SSE), le plus spectaculaire. En dernier.

> Reprise : tout est mesurable via `pipeline_logs` (step, duration_ms). Le code de la detection =
> `detectElementProfiles` / `BBOX_SUFFIX` dans `lib/ai/pipeline.ts`. Le provider non-stream =
> `lib/ai/providers/geminiVision.ts` (`generateContent`, `mediaResolution HIGH`).
