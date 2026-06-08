/* ============================================================
 *  COMMON UTILITIES — shared by user app & admin panel
 * ============================================================ */
window.UI = (function () {
  "use strict";

  const D = window.APP_DEFAULTS || {};
  const state = {
    settings: {
      appName: D.appName || "Premium Mini App",
      currencyName: D.currencyName || "Coins",
      currencySymbol: D.currencySymbol || "₵",
      logoText: D.logoText || "PM",
      welcomeMessage: D.welcomeMessage || "Welcome",
      maintenanceMode: !!D.maintenanceMode
    }
  };

  /* ---------- Telegram WebApp ---------- */
  function telegram() {
    return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  }
  function telegramUser() {
    const tg = telegram();
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.id) {
      return {
        id: String(u.id),
        firstName: u.first_name || "",
        lastName: u.last_name || "",
        username: u.username || "",
        photoUrl: u.photo_url || "",
        languageCode: u.language_code || "en",
        isPremium: !!u.is_premium,
        startParam: (tg.initDataUnsafe.start_param) || ""
      };
    }
    return null;
  }
  function initTelegram() {
    const tg = telegram();
    if (tg) { try { tg.ready(); tg.expand(); } catch (e) {} }
  }

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    const theme = t || localStorage.getItem("theme") || "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
    return theme;
  }
  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    return applyTheme(next);
  }

  /* ---------- Formatting ---------- */
  function money(n) {
    const v = Number(n || 0);
    const s = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${state.settings.currencySymbol}${s}`;
  }
  function num(n) { return Number(n || 0).toLocaleString(); }
  function shortDate(ts) {
    let d = tsToDate(ts);
    if (!d) return "—";
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }
  function dateTime(ts) {
    let d = tsToDate(ts);
    if (!d) return "—";
    return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function tsToDate(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  function timeAgo(ts) {
    const d = tsToDate(ts); if (!d) return "—";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function uid(prefix) { return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 10); }

  /* ---------- Toast ---------- */
  function ensureToastHost() {
    let host = document.getElementById("toasts");
    if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host); }
    return host;
  }
  function toast(msg, type) {
    const host = ensureToastHost();
    const colors = {
      success: "status-approved", error: "status-rejected",
      info: "chip", warn: "status-pending"
    };
    const el = document.createElement("div");
    el.className = `toast glass-strong rounded-2xl px-4 py-3 text-sm flex items-center gap-3 ${colors[type] || "chip"}`;
    el.innerHTML = `<span class="text-base">${type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️"}</span><span class="flex-1">${escapeHtml(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(10px)"; setTimeout(() => el.remove(), 250); }, 3200);
  }

  /* ---------- Modal ---------- */
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const back = document.createElement("div");
    back.className = "modal-back fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-3";
    back.innerHTML = `
      <div class="modal-card glass-strong w-full sm:max-w-lg rounded-3xl p-5 max-h-[88vh] overflow-y-auto no-scrollbar">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">${escapeHtml(title)}</h3>
          <button data-x class="w-9 h-9 rounded-xl chip grid place-items-center">✕</button>
        </div>
        <div data-body>${bodyHtml}</div>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.querySelector("[data-x]").addEventListener("click", close);
    if (opts.onOpen) opts.onOpen(back, close);
    return { el: back, close };
  }

  function confirm(message, onYes, opts) {
    opts = opts || {};
    const m = modal(opts.title || "Please confirm", `
      <p class="text-soft text-sm mb-5">${escapeHtml(message)}</p>
      <div class="flex gap-3">
        <button data-no class="flex-1 chip rounded-xl py-2.5 font-semibold">Cancel</button>
        <button data-yes class="flex-1 btn-primary rounded-xl py-2.5 font-semibold">${escapeHtml(opts.confirmText || "Confirm")}</button>
      </div>`);
    m.el.querySelector("[data-no]").addEventListener("click", m.close);
    m.el.querySelector("[data-yes]").addEventListener("click", () => { m.close(); onYes && onYes(); });
  }

  function statusPill(status) {
    const s = (status || "pending").toLowerCase();
    const cls = s === "approved" ? "status-approved" : s === "rejected" ? "status-rejected" : "status-pending";
    return `<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full ${cls}">${escapeHtml(s.charAt(0).toUpperCase() + s.slice(1))}</span>`;
  }

  function emptyState(text, icon) {
    return `<div class="text-center py-10 text-soft">
      <div class="text-4xl mb-2">${icon || "🗂️"}</div>
      <p class="text-sm">${escapeHtml(text || "Nothing here yet.")}</p>
    </div>`;
  }

  function skeletonList(n) {
    let h = "";
    for (let i = 0; i < (n || 3); i++) h += `<div class="skeleton h-16 rounded-2xl"></div>`;
    return `<div class="space-y-3">${h}</div>`;
  }

  return {
    state, telegram, telegramUser, initTelegram,
    applyTheme, toggleTheme,
    money, num, shortDate, dateTime, timeAgo, tsToDate, escapeHtml, uid,
    toast, modal, confirm, statusPill, emptyState, skeletonList
  };
})();
