import type { PropsWithChildren } from "react";
import { Container } from "@/components/layout/container";

type SectionProps = PropsWithChildren<{
  id: string;
  className?: string;
  narrow?: boolean;
}>;

export function Section({ id, className = "", narrow, children }: SectionProps) {
  return (
    <section id={id} className={`section ${className}`.trim()}>
      <Container narrow={narrow}>{children}</Container>
    </section>
  );
}
