"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type === "success" ? "toast-success" : "toast-error"}`}>
      {type === "success" ? "\u2705" : "\u274C"} {message}
    </div>
  );
}
