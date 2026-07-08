"use client";

/**
 * Lớp PWA phía client, mount một lần trong root layout:
 *
 * 1. Đăng ký /sw.js và TỰ CẬP NHẬT (chống kẹt bản cũ):
 *    - Khi SW mới nắm quyền (controllerchange) -> reload trang MỘT LẦN.
 *      Bỏ qua lần install đầu tiên (chưa có controller cũ) để không reload
 *      ngay ở lượt truy cập đầu.
 *    - Gọi registration.update() mỗi khi app được mở lại/focus.
 *
 * 2. Nút "Cài ứng dụng" (Android/Chrome qua beforeinstallprompt) và gợi ý
 *    "Thêm vào MH chính" cho iOS Safari. Ẩn khi app đã chạy standalone.
 */

import { useEffect, useState } from "react";

/** Sự kiện beforeinstallprompt (Chrome/Android) — chưa có trong lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_HINT_DISMISSED_KEY = "pwa-ios-hint-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari cũ phơi cờ riêng trên navigator.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaSetup() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  // --- 1. Đăng ký service worker + tự cập nhật ---
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Chỉ reload khi SW MỚI thay SW cũ (tránh reload ở lần cài đầu tiên).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {
          // Offline/lỗi mạng khi kiểm tra cập nhật -> bỏ qua, lần sau thử lại.
        });
      }
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
        })
        .catch(() => {
          // Không đăng ký được SW (trình duyệt cũ...) -> app vẫn chạy bình thường.
        });
    };

    // Đăng ký sau khi trang load để không tranh băng thông lúc khởi động.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  // --- 2. Nút cài (Android/Chrome) + gợi ý iOS ---
  useEffect(() => {
    if (isStandalone()) return; // đã cài -> không hiện gì

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // chặn banner mặc định, tự hiện nút nhẹ nhàng
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Cài xong (appinstalled) -> ẩn nút.
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("appinstalled", onInstalled);

    if (isIos() && localStorage.getItem(IOS_HINT_DISMISSED_KEY) !== "1") {
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    setInstallEvent(null); // prompt() chỉ gọi được một lần cho mỗi event
    await installEvent.prompt();
  };

  const dismissIosHint = () => {
    localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1");
    setShowIosHint(false);
  };

  if (installEvent) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          ⬇️ Cài ứng dụng
        </button>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-lg bg-gray-900/90 px-4 py-2 text-xs text-white shadow-lg">
          <span>
            Cài app: bấm nút <span aria-hidden>⎋</span> Chia sẻ → “Thêm vào MH
            chính”
          </span>
          <button
            type="button"
            onClick={dismissIosHint}
            aria-label="Đóng gợi ý cài đặt"
            className="text-base leading-none text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}
