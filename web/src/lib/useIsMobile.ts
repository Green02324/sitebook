import { useCallback, useSyncExternalStore } from "react";

// useSyncExternalStore re-reads the snapshot on every render and immediately
// after subscribing, so the value can't latch stale. The previous useState +
// "change" listener version missed any viewport change that landed between the
// initial render and the effect attaching, and then stayed wrong until the
// next resize — which on a phone launching straight into standalone mode meant
// the desktop sidebar could stick.
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint}px)`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
