import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className="min-h-28 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100" />;
});
