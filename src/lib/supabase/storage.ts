export const storageBuckets = {
  images: process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET ?? "homework-image",
  audio: process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET ?? "homework-audio",
} as const;

export type StorageBucketName = (typeof storageBuckets)[keyof typeof storageBuckets];
