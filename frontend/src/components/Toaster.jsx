import { X } from "lucide-react";
import { useToastStore } from "../store/toastStore.js";

const VARIANTS = {
  success: { label: "Done", bar: "bg-moss", text: "text-moss" },
  error: { label: "Problem", bar: "bg-crit", text: "text-crit" },
  info: { label: "Note", bar: "bg-sky", text: "text-sky" },
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(({ id, type, message, duration }) => {
        const v = VARIANTS[type] ?? VARIANTS.info;
        return (
          <div
            key={id}
            role={type === "error" ? "alert" : "status"}
            className="panel pointer-events-auto relative animate-pop overflow-hidden shadow-[0_18px_40px_-18px_rgb(0_0_0/0.4)]"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${v.bar}`} aria-hidden="true" />
            <div className="flex items-start gap-3 py-3 pl-5 pr-2">
              <div className="min-w-0 flex-1">
                <p className={`eyebrow ${v.text}`}>{v.label}</p>
                <p className="mt-0.5 break-words text-sm leading-5 text-ink">{message}</p>
              </div>
              <button onClick={() => dismiss(id)} aria-label="Dismiss notification" className="icon-btn !h-7 !w-7 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {duration > 0 && (
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${v.bar} opacity-60`}
                style={{ animation: `tick ${duration}ms linear reverse forwards` }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
