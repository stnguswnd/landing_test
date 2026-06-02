import { randomUUID } from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import type { NoticeInput, NoticeStatus } from "@/lib/dashboardData";

const MAX_NOTICE_IMAGE_FILE_SIZE = 10 * 1024 * 1024;

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || `${randomUUID()}`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function noticeStatus(value: string): NoticeStatus | undefined {
  if (value === "draft" || value === "published" || value === "hidden" || value === "archived") return value;
  return undefined;
}

export async function parseNoticeInput(request: Request, teacherId: string): Promise<NoticeInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json().catch(() => ({}));
  }

  const formData = await request.formData();
  const imageFile = formData.get("imageFile");
  const currentImageUrl = textValue(formData.get("currentImageUrl")).trim();
  let imageUrl: string | null = currentImageUrl || null;

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isImageFile(imageFile)) {
      throw new Error("공지 이미지는 이미지 파일만 업로드할 수 있습니다.");
    }
    if (imageFile.size > MAX_NOTICE_IMAGE_FILE_SIZE) {
      throw new Error("공지 이미지는 1개당 최대 10MB까지 업로드할 수 있습니다.");
    }

    const supabase = createSupabaseAdminClient();
    const fileName = safeFileName(imageFile.name);
    const storagePath = `notices/${teacherId}/${randomUUID()}-${fileName}`;
    const upload = await supabase.storage.from(storageBuckets.images).upload(
      storagePath,
      Buffer.from(await imageFile.arrayBuffer()),
      { contentType: imageFile.type || "image/png", upsert: true },
    );
    if (upload.error) {
      throw new Error(`공지 이미지 업로드 실패: ${upload.error.message}`);
    }
    imageUrl = supabase.storage.from(storageBuckets.images).getPublicUrl(storagePath).data.publicUrl;
  }

  return {
    title: textValue(formData.get("title")),
    content: textValue(formData.get("content")),
    imageUrl,
    status: noticeStatus(textValue(formData.get("status"))),
  };
}
