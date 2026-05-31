import { useEffect, useRef, useState } from "react";

// Must match the Sheet content's `data-[state=closed]:duration-300` in components/ui/sheet.tsx.
// We keep the sheet mounted with open=false long enough for Radix to play the exit animation,
// then run the terminal callback (which typically unmounts the sheet from its parent).
const SHEET_CLOSE_MS = 300;

// Drives a Radix Sheet's `open` so its exit animation can play before the parent unmounts it.
// Parents that conditionally render a sheet (`{id && <Sheet onClose={() => setId(null)} />}`)
// otherwise unmount the whole tree the instant they close, so Radix never renders the
// `data-[state=closed]` animation and the sheet snaps out. This defers `onClosed` until after
// the exit animation. `closeThen` lets non-dismiss actions (e.g. picking a candidate) animate
// out first, then fire their own terminal callback.
export function useAnimatedSheetClose(onClosed: () => void) {
  const [open, setOpen] = useState(true);
  const pending = useRef(onClosed);

  const onOpenChange = (next: boolean) => {
    if (next) return;
    pending.current = onClosed;
    setOpen(false);
  };

  const closeThen = (fn: () => void) => {
    pending.current = fn;
    setOpen(false);
  };

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => pending.current(), SHEET_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  return { open, onOpenChange, closeThen };
}
