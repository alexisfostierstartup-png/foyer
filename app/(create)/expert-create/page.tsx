import { getFloorPresets, getRoomTypes } from "@/lib/db/assets";
import { UploadForm } from "@/components/create/UploadForm";

export const dynamic = "force-dynamic";

// Flux EXPERT : même parcours UI/UX que /create (upload → style → review →
// rendu), mais le projet est marqué "expert" → le terminal ajoute le loop de
// rendu avec les vrais meubles du catalogue.
export default async function ExpertCreatePage() {
  const [floorPresets, roomTypes] = await Promise.all([
    getFloorPresets(),
    getRoomTypes(),
  ]);

  return <UploadForm floorPresets={floorPresets} roomTypes={roomTypes} expert />;
}
