export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJob, getJobRenders } from "@/lib/db/pro";
import { getProperty } from "@/lib/db/pro";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: "#faf6f0", fontFamily: "Helvetica" },
  cover: { flex: 1, justifyContent: "center", alignItems: "center" },
  coverTitle: { fontSize: 28, marginBottom: 8, color: "#1f1b16" },
  coverSub: { fontSize: 14, color: "#6b645a" },
  coverDate: { fontSize: 11, color: "#6b645a", marginTop: 20 },
  coverFooter: { fontSize: 10, color: "#6b8e6f", marginTop: 40 },
  renderPage: { padding: 30, backgroundColor: "#faf6f0" },
  roomLabel: { fontSize: 12, fontWeight: "bold", color: "#1f1b16", marginBottom: 6 },
  ambianceLabel: { fontSize: 10, color: "#6b8e6f", marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  imgBox: { flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "#e5ddd0" },
  img: { width: "100%", aspectRatio: 1.33 },
  caption: { fontSize: 9, color: "#6b645a", marginTop: 4, textAlign: "center" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, fontSize: 9, color: "#6b645a", textAlign: "center" },
});

type RenderRow = {
  id: string;
  source_photo_url: string;
  render_url: string | null;
  ambiance_slug: string;
  status: string;
  pro_property_rooms?: { name: string; room_type: string } | null;
};

function ProPdfDocument({
  address,
  date,
  renders,
}: {
  address: string;
  date: string;
  renders: RenderRow[];
}) {
  const completed = renders.filter((r) => r.status === "completed" && r.render_url);
  return React.createElement(
    Document,
    null,
    // Cover page
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.cover },
        React.createElement(Text, { style: styles.coverTitle }, "Foyer Pro"),
        React.createElement(Text, { style: styles.coverSub }, address),
        React.createElement(Text, { style: styles.coverDate }, `Généré le ${date}`),
        React.createElement(
          Text,
          { style: styles.coverFooter },
          `${completed.length} rendu${completed.length > 1 ? "s" : ""} inclus`,
        ),
      ),
    ),
    // One page per completed render
    ...completed.map((r) =>
      React.createElement(
        Page,
        { key: r.id, size: "A4", style: styles.renderPage },
        React.createElement(Text, { style: styles.roomLabel }, r.pro_property_rooms?.name ?? "Pièce"),
        React.createElement(Text, { style: styles.ambianceLabel }, `Ambiance : ${r.ambiance_slug}`),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(
            View,
            { style: styles.imgBox },
            React.createElement(PdfImage, { src: r.source_photo_url, style: styles.img }),
            React.createElement(Text, { style: styles.caption }, "Avant"),
          ),
          React.createElement(
            View,
            { style: styles.imgBox },
            React.createElement(PdfImage, { src: r.render_url!, style: styles.img }),
            React.createElement(Text, { style: styles.caption }, "Après"),
          ),
        ),
        React.createElement(Text, { style: styles.footer }, "Généré avec Foyer Pro · foyer.io"),
      ),
    ),
  );
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [job, renders] = await Promise.all([
    getJob(jobId, user.id),
    getJobRenders(jobId),
  ]);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const property = await getProperty(job.property_id, user.id);
  const address = property?.address ?? "Bien immobilier";
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const docElement = ProPdfDocument({
    address,
    date,
    renders: renders as unknown as RenderRow[],
  });
  const pdfBuffer = await renderToBuffer(docElement as Parameters<typeof renderToBuffer>[0]);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="foyer-pro-${jobId.slice(0, 8)}.pdf"`,
    },
  });
}
