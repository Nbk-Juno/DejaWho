import { Link, useLocation } from "wouter";
import { Home, Search, User } from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
};

// Network Graph (see design dock, screens-app.jsx Screen 9) is a planned
// destination but is hidden until after the first round of user feedback.
const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex justify-center px-4 pt-2 pointer-events-none"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full"
        style={{
          backgroundColor: "var(--dw-elevated)",
          boxShadow:
            "0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-full transition-colors duration-200 min-w-[72px]"
                style={{
                  backgroundColor: isActive ? "rgba(65,45,240,0.20)" : "transparent",
                }}
              >
                <Icon
                  className="w-[22px] h-[22px]"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: isActive ? "var(--dw-indigo)" : "rgba(255,255,255,0.55)" }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.6px]"
                  style={{ color: isActive ? "var(--dw-indigo)" : "rgba(255,255,255,0.55)" }}
                >
                  {label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
