import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast, type ToastItem } from "@/lib/toast";
import { cn } from "@/utils/cn";

const TOAST_LIFETIME_MS = 3200;

export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((item) => {
      setItems((current) => [...current, item]);

      window.setTimeout(() => {
        setItems((current) => current.filter((toastItem) => toastItem.id !== item.id));
      }, TOAST_LIFETIME_MS);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-3 px-4">
      {items.map((item) => {
        const isSuccess = item.type === "success";

        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-soft backdrop-blur-sm",
              isSuccess
                ? "border-emerald-200 bg-white/95 text-emerald-800"
                : "border-red-200 bg-white/95 text-red-700"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </div>
            <p className="text-sm font-medium">{item.message}</p>
          </div>
        );
      })}
    </div>
  );
}
