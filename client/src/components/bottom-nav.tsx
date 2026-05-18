import { Link, useLocation } from "wouter";
import { Home, Network, User } from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/network", icon: Network, label: "Network" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around"
      style={{
        height: 80,
        backgroundColor: "var(--dw-card)",
        borderTop: "1px solid var(--dw-border-sub)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link key={href} href={href}>
            <button
              type="button"
              className="flex flex-col items-center gap-1 px-6 py-2 group"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="w-[22px] h-[22px] transition-colors duration-150"
                strokeWidth={isActive ? 2.5 : 2}
                style={{ color: isActive ? "var(--dw-indigo)" : "var(--dw-text-sec)" }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.6px] transition-colors duration-150"
                style={{ color: isActive ? "var(--dw-indigo)" : "var(--dw-text-sec)" }}
              >
                {label}
              </span>
            </button>
          </Link>
        );
      })}
    </nav>
  );
}
