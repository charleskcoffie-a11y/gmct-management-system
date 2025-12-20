import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'confirm';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

let toastId = 0;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: number) => {
    setToasts((toasts) => toasts.filter((t) => t.id !== id));
  };

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts((toasts) => [...toasts, { id, message, type, duration }]);
    if (type !== 'confirm') {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
    const id = ++toastId;
    setToasts((toasts) => [
      ...toasts,
      {
        id,
        message,
        type: 'confirm',
        onConfirm: () => {
          removeToast(id);
          onConfirm();
        },
        onCancel: () => {
          removeToast(id);
          onCancel && onCancel();
        },
      },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      <div className="fixed z-50 top-4 right-4 flex flex-col gap-2 items-end">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const toastColors: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-yellow-500 text-black',
  confirm: 'bg-white text-gray-900 border border-gray-300',
};

function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  if (toast.type === 'confirm') {
    return (
      <div className={`rounded shadow-lg p-4 min-w-[260px] ${toastColors[toast.type]}`}> 
        <div className="mb-3">{toast.message}</div>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => toast.onCancel?.()}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => toast.onConfirm?.()}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded shadow-lg px-4 py-2 min-w-[220px] flex items-center gap-2 ${toastColors[toast.type]}`}> 
      <span>{toast.message}</span>
      <button className="ml-2 text-lg font-bold opacity-60 hover:opacity-100" onClick={onClose}>&times;</button>
    </div>
  );
}
