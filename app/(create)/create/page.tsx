import { getFloorPresets, getRoomDefaults } from "@/lib/db/assets";
import { UploadForm } from "@/components/create/UploadForm";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const [floorPresets, roomDefaults] = await Promise.all([
    getFloorPresets(),
    getRoomDefaults(),
  ]);

  return <UploadForm floorPresets={floorPresets} roomDefaults={roomDefaults} />;
}
