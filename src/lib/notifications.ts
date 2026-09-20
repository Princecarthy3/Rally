"use client";

let permissionAsked = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  if (permissionAsked) return false;
  permissionAsked = true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function registerRallyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (err) {
    console.warn("SW register failed", err);
    return null;
  }
}

/** Show a system notification (works when tab is backgrounded; needs permission). */
export async function notifyUser(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Prefer service worker notification so it can show when the page is closed/backgrounded
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(opts.title, {
        body: opts.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: opts.tag,
        data: { url: opts.url || "/" },
      });
      return;
    }
  } catch {
    /* fall through */
  }

  new Notification(opts.title, {
    body: opts.body,
    icon: "/icon-192.png",
    tag: opts.tag,
  });
}
