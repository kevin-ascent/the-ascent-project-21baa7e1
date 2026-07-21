import { icons, Sparkles, type LucideProps } from "lucide-react";

// Convert "heart" or "book-open" to "Heart" / "BookOpen" for lucide-react lookup
function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function FlowIcon({
  name,
  ...props
}: { name: string | null | undefined } & LucideProps) {
  if (!name) return <Sparkles {...props} />;
  const key = toPascal(name) as keyof typeof icons;
  const Icon = icons[key] ?? Sparkles;
  return <Icon {...props} />;
}
