import { getFloorPresets, getRoomTypes } from "@/lib/db/assets";
import { UploadForm } from "@/components/create/UploadForm";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const [floorPresets, roomTypes] = await Promise.all([
    getFloorPresets(),
    getRoomTypes(),
  ]);

  return <UploadForm floorPresets={floorPresets} roomTypes={roomTypes} />;
}
