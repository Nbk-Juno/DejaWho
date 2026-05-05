import { useState, useEffect } from "react";
import { X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldShowInstallBanner } from "@/lib/ios-detect";

const STORAGE_KEY = "who-that-ios-install-dismissed";

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const show = shouldShowInstallBanner(navigator.userAgent, standalone, dismissed);
    setVisible(show);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Install Who That!?</p>
            <p className="text-xs text-muted-foreground">
              Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> then{" "}
              <span className="font-medium">"Add to Home Screen"</span>
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={dismiss}
            aria-label="Dismiss install banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
