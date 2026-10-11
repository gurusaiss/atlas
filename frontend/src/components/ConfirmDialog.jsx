import { useEffect, useRef } from "react";
import { useConfirmStore } from "../store/confirmStore.js";

export default function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const answer = useConfirmStore((s) => s.answer);
  const cancelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!request) return undefined;
    returnFocusRef.current = document.activeElement;
    cancelRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape") answer(false);
      if (e.key === "Tab") {
        const focusable = document.querySelectorAll("[data-confirm-dialog] button");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus?.();
    };
  }, [request, answer]);

  if (!request) return null;
  const destructive = request.tone === "danger";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 animate-fade bg-ink/45 backdrop-blur-[2px]" onClick={() => answer(false)} aria-hidden="true" />
      <div
        data-confirm-dialog
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="panel relative w-full max-w-md animate-pop p-6 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45)]"
      >
        <p className={`eyebrow mb-2 ${destructive ? "!text-crit" : ""}`}>{destructive ? "This can't be undone" : "Please confirm"}</p>
        <h2 id="confirm-title" className="text-2xl text-ink">
          {request.title}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm leading-6 text-ink-2">
          {request.message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} onClick={() => answer(false)} className="btn btn-outline">
            Keep it
          </button>
          <button
            onClick={() => answer(true)}
            className={`btn ${destructive ? "bg-crit text-white hover:brightness-110" : "btn-primary"}`}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
