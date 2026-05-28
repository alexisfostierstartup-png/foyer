# Images de la landing

Images utilisées par la landing page (`app/(marketing)/page.tsx`).

| Fichier | Usage | Format conseillé |
| --- | --- | --- |
| `before.jpg` | État initial de la pièce — slider avant/après (sections 1 et 4) | paysage ~1280×880, JPEG |
| `after.jpg` | Pièce transformée — slider avant/après (sections 1 et 4) | mêmes dimensions que `before.jpg` |

Les deux images doivent montrer **la même pièce** sous le **même angle** : c'est ce qui rend la
préservation de l'architecture visible (mêmes murs, fenêtres, sol).

Si un fichier est absent, le composant `<BeforeAfterSlider />` affiche un bloc placeholder
(fond cream + libellé) pour que la page reste fonctionnelle.

Placeholders actuels : réutilisés depuis `design/assets/before-living.jpg` et `after-living.jpg`.
Remplacez-les par vos propres visuels (ex. `origin.png` / `render1.png` de la démo).
