# Foyer

PWA mobile-first qui transforme une photo de pièce (salon ou chambre) en projet déco soft — en préservant l'architecture, en gardant le mobilier existant quand c'est possible, et en proposant un projet éco-aligné.

## Setup

```bash
npm install
cp .env.local.example .env.local   # puis renseignez GEMINI_API_KEY
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (palette Foyer définie dans `app/globals.css`)
- shadcn/ui (composants dans `components/ui`)
- Polices : Fraunces (titres) + Inter (UI) via `next/font/google`
- Stockage local : fichiers dans `public/uploads`, projets en JSON dans `data/projects.json`
- Pas d'auth, pas de DB, pas de paiement (cette phase)

## Architecture des dossiers

```
/app
  /(marketing)/page.tsx              Landing
  /(create)/create/page.tsx          Écran 1 : Upload
  /(create)/create/style/page.tsx    Écran 2 : Choix style
  /(create)/create/generating/page.tsx  Écran 3 : Génération (loader)
  /(create)/create/[projectId]/page.tsx Écran 4 : Rendu + marquage
  /api/detect/route.ts               Détection mobilier (Gemini Vision)
  /api/generate/route.ts             Génération rendu (Nano Banana)
  /api/upload/route.ts               Upload + resize photo
/components
  /ui                                shadcn
  /create                            Composants spécifiques au flow
  /shared                            Composants réutilisables (logo, footer)
/lib
  /ai/gemini.ts                      Wrapper Gemini Vision
  /ai/nano-banana.ts                 Wrapper Nano Banana
  /ai/prompts.ts                     Templates de prompts
  /storage/fs.ts                     Helpers filesystem local
  /storage/projects.ts               CRUD JSON projets
  /types.ts                          Types TypeScript globaux
  /constants.ts                      Constantes (styles, décisions, ambiances)
/data
  /styles.json                       10 styles seed
  /co2-factors.json                  Facteurs CO2 par catégorie
  /projects.json                     Stockage projets (init [])
/public
  /uploads                           Photos uploadées par les users
  /moodboards                        Moodboards pré-générés (V2)
/scripts
  /generate-moodboards.ts            Script de pré-génération (V2)
/design                              Maquettes Claude Design (référence, hors build)
```

## Couleurs sémantiques

- `foyer-sage` = Garder (mobilier conservé)
- `foyer-ochre` = Customiser (repeindre/recouvrir)
- `foyer-terra` = Remplacer / Acheter / CTA principal
- `foyer-water` = Accent éco

## Commandes utiles

```bash
npm run dev      # serveur de développement
npm run build    # build de production
npm run start    # serveur de production
```
