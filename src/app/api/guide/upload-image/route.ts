import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function getUploadDir() {
  return process.env.GUIDE_UPLOAD_DIR || path.join(process.cwd(), "storage", "guides");
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

async function requireAdminId() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, systemRole: true },
  });
  if (!user || user.systemRole !== "ADMIN") return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
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
    return NextResponse.json({ error: "Magic bytes không khớp định dạng ảnh" }, { status: 400 });
  }

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const random = crypto.randomBytes(8).toString("hex");
  const filename = `guide-${adminId.replace(/[^a-zA-Z0-9-]/g, "")}-${Date.now()}-${random}.${ext}`;
  const filePath = path.join(uploadDir, filename);

  await writeFile(filePath, bytes);

  return NextResponse.json({
    ok: true,
    url: `/api/guide/image/${filename}`,
    mimeType: file.type,
    size: file.size,
  });
}

