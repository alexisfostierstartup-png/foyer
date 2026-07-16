<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pipeline image — règles nées de l'incident du 2026-07-16

Deux jours perdus à chercher dans les prompts un bug qui vivait dans les ENTRÉES de
l'appel image. Règles pour que ça ne se reproduise jamais :

1. **JAMAIS d'image de référence ajoutée à un appel d'ÉDITION `gemini-2.5-flash-image`
   sans preuve par banc A/B.** Passer de 1 image (la photo) à plusieurs (crops,
   moodboard…) fait basculer le modèle d'« éditer cette photo » en « composer une scène
   avec ces éléments » : la pièce est réinventée, le meuble montré est fidèle au milieu
   d'une architecture fausse. Preuve : `scripts/bench-dispositions.ts` (2026-07-16,
   avec crops = 14 fautes d'archi / 3 pièces méconnaissables sur 5 ; sans = 0/5).

2. **Tout changement des ENTRÉES de la génération** (images jointes, provider, modèle,
   température, nouveau bloc de contexte dans le prompt assemblé) **passe le banc AVANT
   d'être mergé** : `npx tsx scripts/bench-dispositions.ts --ctxFrom=<projetTémoin>`
   — A/B avec/sans le changement, sur une photo qui a déjà cassé (`bench/base/test1.jpg`).
   Un tsc vert et « ça marche sur MA photo de test » ne suffisent pas : les échecs
   dépendent du verdict/de la détection du projet, donc paraissent aléatoires.

3. **Marqueur de régénération : le ratio de sortie.** Une édition fidèle garde ~le ratio
   de la photo source. Un rendu qui sort en 1472x704 ou 1632x640 sur une photo 4:3 n'a
   PAS été édité — il a été régénéré. Vérifier ce ratio EN PREMIER quand un rendu
   « invente » de l'architecture, avant de toucher au moindre prompt.

4. **Méthode de debug : répliquer, puis ablater.** Rejouer l'appel EXACT du projet cassé
   (`--ctxFrom` recharge visionOutput + décisions depuis la DB), puis retirer UNE
   variable à la fois. Ne jamais empiler des règles de prompt pour compenser un bug
   d'entrée — c'est ce qui a fait tripler le template sans rien corriger.

5. **`ai_calls` logge le prompt COMPLET** (débridé le 2026-07-16 — la troncature à
   5 000 caractères a masqué le vrai payload pendant tout le debug). Ne pas re-tronquer.
