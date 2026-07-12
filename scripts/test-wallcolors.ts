/**
 * Test one-shot getChangedWallColors sur le composite d'un projet réel —
 * vérifie que la demande de box_2d (pin peinture) ne casse pas la détection.
 * Usage: npx tsx scripts/test-wallcolors.ts <projectId>
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const projectId = process.argv[2];
  if (!projectId) throw new Error("usage: npx tsx scripts/test-wallcolors.ts <projectId>");
  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite } = await import("../lib/ai/pipeline");
  const { getChangedWallColors } = await import("../lib/shopping/paintMatch");

  const project = await getProject(projectId);
  if (!project?.basePhotoUrl || !project.generatedRenderUrl) throw new Error("projet incomplet");
  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  const walls = await getChangedWallColors(comp.buffer as never);
  console.log(JSON.stringify(walls, null, 2));
  console.log(`afterLeftFrac=${comp.afterLeftFrac}, afterWidthFrac=${comp.afterWidthFrac}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
