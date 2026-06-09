# Prompt Template Engine

## Variables connues

| Variable | Type | Source |
|---|---|---|
| `styleName` | string | `loadStyleContext(styleId)` — nom de l'ambiance (ex: "Doux") |
| `styleMood` | string | `loadStyleContext(styleId)` — mood + palette + materials |
| `roomType` | string | Input user (`"salon"` ou `"chambre"`) |
| `furnitureDefaults` | string | `loadRoomDefaults(roomType)` — liste de meubles attendus en anglais |
| `visionJson` | string | JSON.stringify de l'output Vision — injecté BRUT (règle archi 3 couches) |
| `userInstructions` | string | `formatUserInstructions(choices)` — lignes formatées des choix user |
| `userRequest` | string | Demande libre de l'utilisateur pour une itération |

## Comment fonctionnent les conditions

Chaque prompt a un champ `conditions` (JSONB). Le moteur sélectionne le prompt actif dont **toutes** les conditions matchent le contexte, en préférant le plus spécifique.

```
conditions = {}                  → matche toujours (fallback générique)
conditions = { roomType: "salon" } → matche seulement si ctx.roomType === "salon"
conditions = { roomType: "salon", state: "empty" } → plus spécifique, prioritaire
```

Si plusieurs prompts matchent, celui avec le plus de conditions gagne. À égalité, la version la plus élevée gagne.

## Ajouter un nouveau prompt en base

Via SQL (ou l'admin α-4) :

```sql
-- Désactiver l'ancien actif si on veut une nouvelle version
update prompts set is_active = false where slug = 'mon_slug' and purpose = 'generation' and is_active = true;

-- Insérer la nouvelle version
insert into prompts (slug, purpose, conditions, provider, template, notes, is_active, version)
values (
  'mon_slug',
  'generation',
  '{"roomType": "chambre"}'::jsonb,   -- conditions optionnelles
  'nano_banana',
  'Mon template avec {{styleName}} et {{userInstructions}}',
  'Version spécialisée chambre',
  true,
  1
);
```

Le trigger `trg_prompts_snapshot` crée automatiquement un enregistrement dans `prompt_versions`.

## Ajouter une nouvelle variable de substitution

1. Ajouter la clé dans `ResolveContext` (`lib/prompts/types.ts`)
2. Si la valeur vient de la DB : ajouter un helper dans `lib/prompts/helpers.ts`
3. Peupler la variable dans le code appelant avant d'appeler `resolvePrompt()`
4. Utiliser `{{maVariable}}` dans le template du prompt

## Usage

```ts
import { resolvePrompt } from "@/lib/prompts/engine"
import { loadStyleContext, loadRoomDefaults, formatUserInstructions } from "@/lib/prompts/helpers"

const ctx = {
  styleName: "Doux",
  styleMood: "calm, bright...",
  roomType: "salon",
  furnitureDefaults: "sofa, coffee table...",
  visionJson: JSON.stringify(visionOutput),
  userInstructions: await formatUserInstructions(userChoices),
}

const { resolvedTemplate, prompt } = await resolvePrompt("gen_wow_generic", ctx)
// resolvedTemplate est prêt à être envoyé au provider
```

## Mode non-strict (debug)

```ts
const r = await resolvePrompt("gen_wow_generic", ctx, { strict: false })
if (r.missingVariables.length > 0) {
  console.warn("Variables non résolues:", r.missingVariables)
}
```
