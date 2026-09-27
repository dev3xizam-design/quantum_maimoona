import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { getSession } from "@/lib/auth";
import { appUrl } from "@/lib/connectors/oauth";
import { marketplaceItem } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Builds the plugin zip on request, with THIS Quantum's address written into
 * it - so after install the plugin's Connect button already knows where to go.
 * The zip's top folder is the plugin slug, as WordPress expects.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const item = marketplaceItem((await params).slug);
  if (!item?.download) return NextResponse.json({ error: "No download for that item." }, { status: 404 });

  const root = path.join(process.cwd(), "plugins", item.download.dir);
  const zip = new JSZip();
  const folder = zip.folder(item.download.dir)!;
  const base = appUrl(req);

  async function add(dir: string, rel = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await add(full, name);
      else if (/\.(php|txt|js|css|json|md)$/.test(entry.name)) {
        folder.file(name, (await readFile(full, "utf8")).replaceAll("{{QUANTUM_URL}}", base));
      } else folder.file(name, await readFile(full));
    }
  }
  await add(root);

  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${item.download.file}"`,
      "Cache-Control": "no-store",
    },
  });
}
