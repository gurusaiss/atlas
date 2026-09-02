import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "../store/toastStore.js";

const VARIANTS = {
  success: { icon: CheckCircle2, cls: "border-green-800 text-atlas-success" },
  error: { icon: XCircle, cls: "border-red-900 text-atlas-critical" },
  info: { icon: Info, cls: "border-atlas-border text-gray-300" },
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(({ id, type, message }) => {
        const { icon: Icon, cls } = VARIANTS[type] ?? VARIANTS.info;
        return (
          <div
            key={id}
            role="status"
            aria-live="polite"
            className={`atlas-card ${cls} p-3 pr-2 flex items-start gap-2.5 shadow-lg animate-[fadeIn_150ms_ease-out]`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-gray-200 flex-1 break-words">{message}</p>
            <button
              onClick={() => dismiss(id)}
              aria-label="Dismiss notification"
              className="text-gray-500 hover:text-gray-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
