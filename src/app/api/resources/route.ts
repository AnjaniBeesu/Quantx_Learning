import { createHash } from "node:crypto";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".ppt": ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
};

const RESOURCE_TYPES = [
  "NOTES", "PDF", "PPT", "LAB_MANUAL", "ASSIGNMENT",
  "IMPORTANT_QUESTIONS", "REVISION_MATERIAL",
] as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) return jsonError("subjectId is required.", 400);

  try {
    const resources = await prisma.resource.findMany({
      where: { subjectId },
      include: { unit: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ resources });
  } catch {
    return jsonError("Unable to load resources.", 500);
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token?.email) return jsonError("Sign in to upload a resource.", 401);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return jsonError("File storage is not configured on the server.", 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid upload form.", 400);
  }

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const unitValue = String(formData.get("unitId") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!(file instanceof File)) return jsonError("Choose a file to upload.", 400);
  if (!title || title.length > 160) return jsonError("Title is required and must be 160 characters or fewer.", 400);
  if (!subjectId) return jsonError("Choose a subject.", 400);
  if (!RESOURCE_TYPES.includes(type as (typeof RESOURCE_TYPES)[number])) {
    return jsonError("Choose a valid resource type.", 400);
  }
  if (file.size === 0) return jsonError("The selected file is empty.", 400);
  if (file.size > MAX_FILE_SIZE) return jsonError("Files must be 10 MB or smaller.", 413);

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const allowedMimeTypes = ALLOWED_TYPES[extension];
  if (!allowedMimeTypes || !allowedMimeTypes.includes(file.type)) {
    return jsonError("Unsupported file. Upload a PDF, PPT, DOC, or image file.", 415);
  }

  const user = await prisma.user.findUnique({ where: { email: token.email } });
  if (!user) return jsonError("Your account was not found. Sign in again.", 401);

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return jsonError("The selected subject does not exist.", 404);

  let unitId: string | null = null;
  if (unitValue) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitValue, subjectId },
      select: { id: true },
    });
    if (!unit) return jsonError("The selected unit does not belong to this subject.", 400);
    unitId = unit.id;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "quantx-learning/resources";
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const cloudinaryForm = new FormData();
  cloudinaryForm.append("file", file, file.name);
  cloudinaryForm.append("api_key", apiKey);
  cloudinaryForm.append("timestamp", timestamp);
  cloudinaryForm.append("folder", folder);
  cloudinaryForm.append("signature", signature);

  let fileUrl: string;
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`,
      { method: "POST", body: cloudinaryForm },
    );
    const result = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) {
      return jsonError(result.error?.message ?? "Cloudinary upload failed.", 502);
    }
    fileUrl = result.secure_url;
  } catch {
    return jsonError("Could not reach file storage. Please try again.", 502);
  }

  try {
    const resource = await prisma.resource.create({
      data: {
        title,
        type: type as (typeof RESOURCE_TYPES)[number],
        fileUrl,
        subjectId,
        unitId,
        uploadedById: user.id,
      },
      include: { unit: true },
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch {
    return jsonError("The file uploaded, but its resource record could not be saved.", 500);
  }
}
