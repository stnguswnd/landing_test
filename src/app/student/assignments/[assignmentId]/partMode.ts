export type PartSavePayload = {
  data?: Record<string, unknown>;
  files?: File[] | Blob[];
  attachmentType?: "image" | "audio";
  replaceAttachments?: boolean;
  durationSec?: number;
};

export type PartMode = {
  onSave: (payload?: PartSavePayload) => void | Promise<void>;
  label?: string;
  tooltip?: string;
};
