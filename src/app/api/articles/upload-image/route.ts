import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import { getArticleEditorUser } from "@/lib/articles/server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function getUploadDir() {
  return process.env.ARTICLE_UPLOAD_DIR || path.join(process.cwd(), "storage", "articles");
}

function hasValidMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mime === "image/webp") {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return riff === "RIFF" && webp === "WEBP";
  }
  return false;
}

export async function POST(req: NextRequest) {
  const editor = await getArticleEditorUser();
  if (!editor) {
    return NextResponse.json({ error: "Bạn không có quyền tải ảnh bài viết" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Thiếu file ảnh" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Kích thước ảnh phải <= 5MB" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Chỉ chấp nhận jpg/jpeg/png/webp" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Định dạng file không hợp lệ" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidMagicBytes(bytes, file.type)) {
    return NextResponse.json({ error: "File ảnh không đúng định dạng" }, { status: 400 });
  }

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const random = crypto.randomBytes(8).toString("hex");
  const safeUserId = editor.id.replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `article-${safeUserId}-${Date.now()}-${random}.${ext}`;
  await writeFile(path.join(uploadDir, filename), bytes);

  return NextResponse.json({
    ok: true,
    url: `/api/articles/image/${filename}`,
    mimeType: file.type,
    size: file.size,
  });
}
