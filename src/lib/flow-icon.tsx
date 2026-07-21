import { icons, Sparkles } from "lucide-react";
import type { ComponentProps } from "react";

function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

type Props = { name: string | null | undefined } & Omit<ComponentProps<typeof Sparkles>, "name">;

export function FlowIcon({ name, ...props }: Props) {
  if (!name) return <Sparkles {...props} />;
  const key = toPascal(name) as keyof typeof icons;
  const Icon = icons[key] ?? Sparkles;
  return <Icon {...props} />;
}
