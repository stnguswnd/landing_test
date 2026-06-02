"use client";

type RecordingStatusBarProps = {
  seconds: number;
  minSeconds?: number;
  isRecording: boolean;
  formatSeconds: (value: number) => string;
};

export function RecordingStatusBar({ seconds, minSeconds = 0, isRecording, formatSeconds }: RecordingStatusBarProps) {
  const progress = minSeconds > 0 ? Math.min((seconds / minSeconds) * 100, 100) : 100;

  return (
    <div className={isRecording ? "rounded-lg border border-red-200 bg-red-50 p-4" : "rounded-lg border border-line bg-white p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={isRecording ? "h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-600" : "h-3 w-3 shrink-0 rounded-full bg-slate-300"} />
          <p className={isRecording ? "font-extrabold text-red-700" : "font-bold text-slate-700"}>
            {isRecording ? "녹음 중" : "녹음 대기"}
          </p>
        </div>
        <p className={isRecording ? "shrink-0 text-xl font-extrabold text-red-700" : "shrink-0 text-xl font-extrabold text-action"}>
          {formatSeconds(seconds)}
        </p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner">
        <div
          className={isRecording ? "h-full rounded-full bg-red-500 transition-all duration-500" : "h-full rounded-full bg-action/70 transition-all duration-500"}
          style={{ width: `${progress}%` }}
        />
      </div>
      {minSeconds > 0 && (
        <p className="mt-2 text-xs font-semibold text-slate-500">
          최소 {formatSeconds(minSeconds)}
        </p>
      )}
    </div>
  );
}
