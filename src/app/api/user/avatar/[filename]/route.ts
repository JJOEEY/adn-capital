import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function getUploadDir() {
  return process.env.AVATAR_UPLOAD_DIR || path.join(process.cwd(), "..", "uploads", "avatars");
}

/**
 * GET /api/user/avatar/[filename] — Serve uploaded avatar
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize: only allow safe characters
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(getUploadDir(), filename);

  // Prevent path traversal
  const resolved = path.resolve(filePath);
  const dir = path.resolve(getUploadDir());
  if (!resolved.startsWith(dir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) throw new Error("Not a file");

    const data = await readFile(resolved);
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const contentType = MIME[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(data.length),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
