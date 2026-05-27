"use client";

import { forwardRef, type AudioHTMLAttributes } from "react";

type AudioPlayerProps = AudioHTMLAttributes<HTMLAudioElement> & {
  src?: string;
};

export const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(function AudioPlayer(
  { src, className = "", onContextMenu, controls = true, ...props },
  ref,
) {
  if (!src) {
    return <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">오디오 파일을 불러오지 못했습니다.</div>;
  }

  return (
    <audio
      ref={ref}
      className={`w-full ${className}`}
      src={src}
      controls={controls}
      controlsList="nodownload"
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(event);
      }}
      {...props}
    />
  );
});
