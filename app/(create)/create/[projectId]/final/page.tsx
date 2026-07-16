import { redirect } from "next/navigation";
import { after } from "next/server";
import { getProject } from "@/lib/storage/projects";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { FinalScreen } from "@/components/create/FinalScreen";
import { precomputeFinalAssets } from "@/lib/ai/pipeline";
import { resolveHotspots } from "@/lib/shopping/hotspots";

export const maxDuration = 300; // plafond Fluid Compute — à 90 s, le calcul liste+pins en prod (vision + Jina froid + matching, parfois >90 s) était tué en plein vol et bouclait (QA Alexis 2026-07-17)

export default async function FinalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.generatedRenderUrl) redirect(`/create/${projectId}`);

  // La page ne BLOQUE plus sur le calcul de la liste (30-50 s de page blanche) :
  //  - liste en cache (précalcul de fond terminé) → rendu complet immédiat ;
  //  - sinon → rendu immédiat en mode « préparation » : le calcul continue/part
  //    en fond (bail DB anti-doublon) et FinalScreen polle /shopping-status
  //    jusqu'à l'arrivée de la liste.
  const pendingList = !project.shoppingList;
  if (pendingList) {
    after(() => precomputeFinalAssets(projectId, "final-page"));
  }

  // Expert : la liste de courses montre le rendu RÉEL (produits intégrés), pas le fictif.
  const displayRenderUrl =
    project.mode === "expert" && project.expertRenderUrl
      ? project.expertRenderUrl
      : project.generatedRenderUrl!;

  // Hotspots (dots sur le rendu) : bboxes de l'audit, valides pour le rendu affiché
  // — y compris en expert, dont le rendu dérive du fake analysé. Cf. resolveHotspots.
  const { bboxById, anchorById, items: analysisItems } = resolveHotspots(project);

  // ID TESTEUR (user tests anonymes, demande Alexis 2026-07-16) : anon_id du
  // projet (colonne posée à l'upload via le cookie foyer_anon_id, httpOnly).
  // Affiché en pied de page pour être recopié dans le questionnaire → recoupement
  // parcours (projets par anon_id → ai_calls/pipeline_logs) ↔ réponses.
  const { data: anonRow } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("anon_id")
    .eq("id", projectId)
    .single();
  const testerId = (anonRow?.anon_id as string | null)?.slice(0, 8) ?? null;

  return (
    <FinalScreen
      projectId={projectId}
      beforeUrl={project.basePhotoUrl}
      afterUrl={displayRenderUrl}
      shoppingList={project.shoppingList ?? []}
      scoreFoyer={project.scoreFoyer}
      visionOutput={project.visionOutput}
      alterations={project.alterations}
      liveEditsUsed={project.live_edits_used ?? 0}
      pendingList={pendingList}
      expertMode={project.mode === "expert"}
      fakeRenderUrl={project.mode === "expert" && project.expertRenderUrl ? project.generatedRenderUrl : null}
      diyBeta={project.diyMode === "beta"}
      bboxById={bboxById}
      anchorById={anchorById}
      analysisItems={analysisItems}
      productOverrides={project.productOverrides ?? null}
      productPicks={project.productPicks ?? null}
      customProducts={project.customProducts ?? null}
      testerId={testerId}
    />
  );
}
