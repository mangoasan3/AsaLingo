type ToastType = "success" | "error";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type Listener = (toast: ToastItem) => void;

let nextToastId = 1;
const listeners = new Set<Listener>();

function emit(type: ToastType, message: string) {
  const toast = {
    id: nextToastId++,
    type,
    message,
  };

  listeners.forEach((listener) => listener(toast));
}

export const toast = {
  success(message: string) {
    emit("success", message);
  },
  error(message: string) {
    emit("error", message);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export default toast;
