import { MapPin } from "lucide-react";

interface RecentCardProps {
  name: string;
  location?: string;
  date?: string;
  onClick: () => void;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatRecentDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function RecentCard({ name, location, date, onClick }: RecentCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`recent-card-${name}`}
      className="flex-shrink-0 w-[180px] text-left px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] active:bg-white/[0.09] transition-colors flex flex-col gap-1.5"
    >
      <div className="text-sm font-semibold text-white truncate">
        {titleCase(name)}
      </div>
      {location && (
        <div className="flex items-center gap-1 text-xs text-white/55 min-w-0">
          <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.8} />
          <span className="truncate">{location}</span>
        </div>
      )}
      {date && (
        <div className="text-[11px] text-dw-fg-ter">
          {formatRecentDate(date)}
        </div>
      )}
    </button>
  );
}
