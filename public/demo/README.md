# Images de la démo (Wizard of Oz)

Le prototype `/demo` rejoue un scénario pré-enregistré avec ces 3 images, dans cet ordre :

| Fichier | Rôle dans le parcours |
| --- | --- |
| `origin.png` | Photo d'origine — la pièce vide (écrans 1 et 4, côté « avant » du slider) |
| `render1.png` | Rendu #1 — la pièce transformée (écran 4, côté « après » + écran 5) |
| `final.png` | Rendu après itération — le projet abouti (écran 6) |

Noms d'origine fournis et renommés :
- `test-image-window&stairs.(jpg/png)` → `origin.png`
- `Generated Image May 28, 2026 - 11_19AM.png` → `render1.png`
- `final.png` → `final.png`

Si un fichier manque, l'app affiche un placeholder gris avec le label (`origin` / `render1` / `final`) — le flow reste jouable.
