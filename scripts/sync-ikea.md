# IKEA — Procédure de sync manuelle

IKEA n'a pas de flux Awin direct. La sync se fait manuellement via la liste d'IDs produits ci-dessous.

## Ajouter un produit IKEA

1. Trouver l'URL produit sur ikea.com/fr/fr
2. Extraire : nom, prix, image principale, catégorie Foyer, URL produit
3. Exécuter :

```bash
npx tsx scripts/add-ikea-product.ts \
  --name "KIVIK Canapé 3 places" \
  --category sofa \
  --price 599 \
  --url "https://www.ikea.com/fr/fr/p/kivik-canape-3-places-tibbleby-beige-gris-s99484527/" \
  --image "https://www.ikea.com/fr/fr/images/products/kivik-canape-3-places-tibbleby-beige-gris__..." \
  --style bois-clair,doux
```

## Produits IKEA cibles (priorité V1.5)

| Catégorie | Produit | ID IKEA |
|---|---|---|
| sofa | KIVIK 3 places | s99484527 |
| sofa | SÖDERHAMN 3 places | s69306396 |
| armchair | POÄNG | s00102681 |
| armchair | STRANDMON | s39302235 |
| coffee_table | HEMNES | s30152736 |
| coffee_table | LISTERBY | s90394788 |
| bookshelf | BILLY | s00263850 |
| bookshelf | KALLAX 2×4 | s40278175 |
| tv_stand | BESTÅ combinaison | s79392298 |
| rug | STOCKHOLM 2017 | s30321623 |
| rug | ÅDUM | s20300760 |
| floor_lamp | HEKTAR | s30292081 |
| lamp | RANARP | s60160974 |
| nightstand | HEMNES | s10293876 |
| dresser | MALM 6 tiroirs | s50035063 |

## Notes

- Les prix IKEA sont stables (pas besoin de sync hebdo — mensuel suffit).
- Source_type = 'eco_new' pour tous les produits IKEA.
- Partner_tier = 'standard' sauf négociation directe.
- IKEA n'a pas de programme d'affiliation standard — affiliate_url = product_url.
- Volume cible V1.5 : ~500 produits.
