#!/bin/bash
# Boucle le backfill par pages de 1000 jusqu'à épuisement des produits non taggés.
cd /Users/alexis/Foyer
for i in $(seq 1 25); do
  OUT=$(npx tsx scripts/backfill-style-tags.ts --all 2>&1 | grep -vE "injected env|ai:retry")
  echo "$OUT" | tail -2
  if echo "$OUT" | grep -q "^0 produit"; then echo "TERMINÉ après $i page(s)"; break; fi
done
