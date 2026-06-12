# Foyer Alpha — Catalogue produits

Catalogue statique utilisé pour générer la liste de courses (`matchAlterationsToCatalog`).
Les URLs produit sont actuellement `#` (placeholder) — à remplacer par des liens réels ou affiliés.

## Structure

```ts
type CatalogProduct = {
  id: string               // slug unique
  name: string             // nom affiché
  category: CatalogCategory
  styleAffinity: StyleAffinity[]
  source: 'secondhand' | 'eco_new'
  merchant: string         // nom marchand exact (doit matcher SEARCH_URL dans ShoppingCard)
  price: number            // prix catalogue indicatif en €
  imgUrl: string           // path public/ (404 → icon fallback dans ShoppingCard)
  productUrl: string       // '#' pour l'instant → génère URL de recherche via SEARCH_URL
}
```

## Catégories disponibles

| Catégorie | # produits |
|---|---|
| sofa | 5 |
| armchair | 4 |
| coffee_table | 4 |
| rug | 4 |
| lamp | 4 |
| floor_lamp | 3 |
| tv_stand | 3 |
| bookshelf | 3 |
| bed | 3 |
| nightstand | 2 |
| paint | 3 |
| mouldings | 2 |
| curtains | 2 |
| cushion | 1 |
| plant | 1 |
| floor_material | 2 |
| **Total** | **46** |

## Marchands

Tous les marchands doivent être présents dans `SEARCH_URL` (ShoppingCard.tsx) pour
que le CTA « Voir » génère un lien de recherche valide.

| Marchand | Source |
|---|---|
| Selency | secondhand |
| Leboncoin | secondhand |
| Vinted | secondhand |
| IKEA | eco_new |
| La Redoute | eco_new |
| Maisons du Monde | eco_new |
| But | eco_new |
| Leroy Merlin | eco_new |
| Castorama | eco_new |
| ManoMano | eco_new |
| Jardineries Truffaut | eco_new |

## Score Foyer — formule

```
co2SavedKg = kept × 30 + secondhand × 20 + ecoNew × 5
```

Source : base ADEME, calcul indicatif par rapport à un projet tout-neuf équivalent.

## Ajout de produits

1. Ajouter une entrée dans `CATALOG` (catalog.ts)
2. Vérifier que `merchant` est dans `SEARCH_URL` (ShoppingCard.tsx) ou ajouter la clé
3. Placer l'image dans `public/catalog/<id>.jpg`
4. Mettre à jour ce fichier

## Prochaines étapes

- Remplacer `productUrl: '#'` par des URLs produit directes ou affiliées
- Ajouter des images produit réelles dans `public/catalog/`
- Étendre à ≥ 5 produits par catégorie principale
- Intégrer un flux marchand (API partenaire ou scraping autorisé)
