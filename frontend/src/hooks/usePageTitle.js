import { useEffect } from "react";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — Atlas` : "Atlas — map a legacy codebase before you rewrite it";
  }, [title]);
}
