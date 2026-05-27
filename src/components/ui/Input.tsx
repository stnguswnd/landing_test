import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100" />;
}
