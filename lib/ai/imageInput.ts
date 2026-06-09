import type { ImageInput } from "./types";

type InlineData = { inlineData: { data: string; mimeType: string } };

export async function toInlineData(input: ImageInput): Promise<InlineData> {
  if (Buffer.isBuffer(input)) {
    return { inlineData: { data: input.toString("base64"), mimeType: "image/jpeg" } };
  }

  if ("storageUrl" in input) {
    const res = await fetch(input.storageUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch image from storage (${res.status}): ${input.storageUrl}`,
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return {
      inlineData: {
        data: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: mimeType.split(";")[0].trim(),
      },
    };
  }

  return { inlineData: { data: input.base64, mimeType: input.mimeType } };
}
