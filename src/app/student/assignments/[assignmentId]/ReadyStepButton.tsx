"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ReadyStepButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  tooltip?: string;
  onClick?: () => void;
};

export function ReadyStepButton({
  children,
  disabled = false,
  type = "button",
  variant,
  className,
  tooltip = "준비됐어요. 다음 단계로 넘어갈 수 있어요.",
  onClick,
}: ReadyStepButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const wasDisabledRef = useRef(disabled);

  useEffect(() => {
    if (wasDisabledRef.current && !disabled) {
      setShowTooltip(true);
      const timer = window.setTimeout(() => setShowTooltip(false), 3000);
      wasDisabledRef.current = disabled;
      return () => window.clearTimeout(timer);
    }

    wasDisabledRef.current = disabled;
    if (disabled) {
      setShowTooltip(false);
    }
  }, [disabled]);

  return (
    <div className="relative">
      {showTooltip && (
        <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 w-max max-w-[min(260px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-[#14532d] px-3 py-2 text-center text-xs font-extrabold leading-5 text-white shadow-soft">
          {tooltip}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-[#14532d]" />
        </div>
      )}
      <Button
        type={type}
        variant={variant}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "w-full",
          !disabled && "ring-2 ring-action/45 ring-offset-2 ring-offset-white shadow-soft",
          showTooltip && "animate-pulse",
          className,
        )}
      >
        {children}
      </Button>
    </div>
  );
}
