import type { PropsWithChildren } from "react";

type ContainerProps = PropsWithChildren<{
  narrow?: boolean;
  className?: string;
}>;

export function Container({ children, narrow = false, className = "" }: ContainerProps) {
  return (
    <div className={`container ${narrow ? "container--narrow" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
