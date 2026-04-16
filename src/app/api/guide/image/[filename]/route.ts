import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

function getUploadDir() {
  return process.env.GUIDE_UPLOAD_DIR || path.join(process.cwd(), "storage", "guides");
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) {
    return new NextResponse("Unsupported file type", { status: 400 });
  }

  try {
    const filePath = path.join(getUploadDir(), filename);
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}

