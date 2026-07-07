import { getFloorPresets, getRoomTypes } from "@/lib/db/assets";
import { UploadForm } from "@/components/create/UploadForm";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ diy?: string }>;
}) {
  const [floorPresets, roomTypes, { diy }] = await Promise.all([
    getFloorPresets(),
    getRoomTypes(),
    searchParams,
  ]);

  // ?diy=beta → flux DIY beta : le flag est persisté sur le projet à l'upload.
  return <UploadForm floorPresets={floorPresets} roomTypes={roomTypes} diyBeta={diy === "beta"} />;
}
