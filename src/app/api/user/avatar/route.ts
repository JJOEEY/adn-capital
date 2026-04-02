import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Upload directory — outside public/ so it works in standalone mode */
function getUploadDir() {
  // Use env var or fallback to sibling of project root
  return process.env.AVATAR_UPLOAD_DIR || path.join(process.cwd(), "..", "uploads", "avatars");
}

/**
 * POST /api/user/avatar — Upload avatar từ máy tính
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Không có file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Chỉ chấp nhận JPG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File quá lớn (tối đa 2MB)" },
      { status: 400 }
    );
  }

  // Generate safe filename (only alphanumeric + dash + dot)
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const hash = crypto.randomBytes(8).toString("hex");
  const filename = `${session.user.id.replace(/[^a-zA-Z0-9-]/g, "")}-${hash}.${safeExt}`;

  // Ensure upload directory exists
  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  // Write file
  const bytes = new Uint8Array(await file.arrayBuffer());
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, bytes);

  // Build URL path — served via /api/user/avatar/[filename]
  const imageUrl = `/api/user/avatar/${filename}`;

  // Update user in DB
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: imageUrl },
  });

  return NextResponse.json({ image: imageUrl });
}
