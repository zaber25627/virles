/* ============================================================
 *  USER APP — Premium Telegram Mini App
 * ============================================================ */
(function () {
  "use strict";

  const App = {
    user: null,
    settings: {},
    unsubs: [],
    route: "home"
  };
  window.App = App;

  const $ = (s, r) => (r || document).querySelector(s);
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const content = () => document.getElementById("app-content");

  /* ---------------- BOOT ---------------- */
  async function boot() {
    UI.applyTheme();
    UI.initTelegram();

    // settings + branding
    const remote = await DB.getSettings().catch(() => ({}));
    App.settings = Object.assign({}, UI.state.settings, remote);
    UI.state.settings.currencySymbol = App.settings.currencySymbol || UI.state.settings.currencySymbol;
    UI.state.settings.currencyName = App.settings.currencyName || UI.state.settings.currencyName;
    applyBranding();

    if (!window.FB || !window.FB.configured) $("#configBar").classList.remove("hide");
    if (App.settings.maintenanceMode) $("#maintenanceBar").classList.remove("hide");

    // auth + user
    await DB.ensureAuth().catch(() => {});
    const tgUser = UI.telegramUser() || previewUser();
    const ref = (tgUser && tgUser.startParam) ? tgUser.startParam.replace(/^ref_?/, "") : "";
    App.user = await DB.getOrCreateUser(tgUser, ref).catch(() => null);
    if (!App.user) App.user = previewProfile(tgUser);

    $("#topHello").textContent = "Hi, " + (App.user.firstName || App.user.username || "there");

    wireChrome();
    watchNotifications();
    hideLoader();
    go("home");
  }

  function previewUser() {
    return { id: "preview", firstName: "Guest", lastName: "", username: "preview", photoUrl: "", isPremium: false, startParam: "" };
  }
  function previewProfile(tg) {
    return {
      id: (tg && tg.id) || "preview", firstName: (tg && tg.firstName) || "Guest",
      username: (tg && tg.username) || "preview", photoUrl: (tg && tg.photoUrl) || "",
      activated: false, isPremium: false, status: "active",
      mainBalance: 0, depositBalance: 0, referralBalance: 0, totalEarnings: 0,
      totalWithdraw: 0, totalDeposit: 0, referralCount: 0, referredBy: null,
      adsWatchedToday: 0, tasksCompleted: 0, joinedAt: new Date().toISOString()
    };
  }

  function applyBranding() {
    const s = App.settings;
    const logo = (s.logoText || "PM").slice(0, 2).toUpperCase();
    ["loaderLogo", "topLogo"].forEach((id) => { const n = document.getElementById(id); if (n) n.textContent = logo; });
    $("#loaderName").textContent = s.appName;
    $("#topAppName").textContent = s.appName;
    document.title = s.appName;
  }

  function hideLoader() {
    setTimeout(() => { const l = document.getElementById("loader"); if (l) l.classList.add("hide"); }, 700);
  }

  function wireChrome() {
    $("#btnTheme").addEventListener("click", () => {
      const t = UI.toggleTheme();
      $("#btnTheme").textContent = t === "dark" ? "🌙" : "☀️";
    });
    $("#btnTheme").textContent = document.documentElement.classList.contains("dark") ? "🌙" : "☀️";
    $("#btnNotif").addEventListener("click", () => go("notifications"));
    document.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => go(b.getAttribute("data-nav")))
    );
  }

  function watchNotifications() {
    if (App.user.id === "preview") return;
    const off = DB.listen("notifications", { where: [["userId", "==", App.user.id]], orderBy: ["createdAt", "desc"], limit: 30 }, (items) => {
      App._notifs = items;
      const unread = items.filter((n) => !n.read).length;
      const dot = $("#notifDot");
      if (unread > 0) { dot.textContent = unread > 9 ? "9+" : unread; dot.classList.remove("hide"); }
      else dot.classList.add("hide");
      if (App.route === "notifications") renderNotifications();
    });
    App.unsubs.push(off);
  }

  /* ---------------- ROUTER ---------------- */
  const ROUTES = {
    home: renderHome, tasks: renderTasks, ads: renderAds, wallet: renderWallet,
    profile: renderProfile, activation: renderActivation, referral: renderReferral,
    deposit: renderDeposit, withdraw: renderWithdraw, marketplace: renderMarketplace,
    leaderboard: renderLeaderboard, promo: renderPromo, notices: renderNotices,
    history: renderHistory, notifications: renderNotifications
  };
  const PRIMARY = ["home", "tasks", "ads", "wallet", "profile"];

  function go(route) {
    App.route = route;
    document.querySelectorAll("[data-nav]").forEach((b) =>
      b.classList.toggle("active", b.getAttribute("data-nav") === route)
    );
    content().scrollTop = 0;
    window.scrollTo(0, 0);
    (ROUTES[route] || renderHome)();
  }
  App.go = go;

  function pageHeader(title, subtitle, withBack) {
    const back = withBack ? `<button id="backBtn" class="w-9 h-9 rounded-xl chip grid place-items-center mr-1">←</button>` : "";
    return `<div class="flex items-center gap-2 mb-4 view">
      ${back}
      <div><h1 class="text-2xl font-extrabold">${UI.escapeHtml(title)}</h1>
      ${subtitle ? `<p class="text-soft text-sm">${UI.escapeHtml(subtitle)}</p>` : ""}</div></div>`;
  }
  function bindBack() {
    const b = $("#backBtn"); if (b) b.addEventListener("click", () => go("home"));
  }

  /* ---------------- HOME ---------------- */
  async function renderHome() {
    const u = App.user;
    const c = content();
    c.innerHTML = `
      <div class="view">
        ${activationBanner()}
        <div class="glass-strong rounded-3xl p-5 mb-4 card-hover relative overflow-hidden">
          <div class="absolute -right-8 -top-8 w-32 h-32 rounded-full brand-grad opacity-30 blur-2xl"></div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-soft text-xs">Main Balance</p>
              <p class="text-3xl font-extrabold mt-1">${UI.money(u.mainBalance)}</p>
            </div>
            ${u.activated ? `<span class="badge-premium text-[11px] font-bold px-3 py-1.5 rounded-full">★ PREMIUM</span>` : `<span class="chip text-[11px] font-semibold px-3 py-1.5 rounded-full status-pending">Locked</span>`}
          </div>
          <div class="grid grid-cols-3 gap-2 mt-4">
            ${miniBal("Deposit", UI.money(u.depositBalance))}
            ${miniBal("Referral", UI.money(u.referralBalance))}
            ${miniBal("Earnings", UI.money(u.totalEarnings))}
          </div>
          <div class="grid grid-cols-2 gap-2 mt-3">
            <button data-quick="deposit" class="btn-primary rounded-xl py-2.5 text-sm font-semibold">＋ Deposit</button>
            <button data-quick="withdraw" class="chip rounded-xl py-2.5 text-sm font-semibold">↑ Withdraw</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4">
          ${statCard("📤", "Total Withdraw", UI.money(u.totalWithdraw))}
          ${statCard("📥", "Total Deposit", UI.money(u.totalDeposit))}
          ${statCard("👥", "Total Referrals", UI.num(u.referralCount))}
          ${statCard("✅", "Tasks Done", UI.num(u.tasksCompleted))}
        </div>

        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-bold">Quick Actions</h2>
        </div>
        <div class="grid grid-cols-4 gap-3 mb-5">
          ${quick("🎁", "Referral", "referral")}
          ${quick("🛒", "Market", "marketplace")}
          ${quick("🏆", "Ranks", "leaderboard")}
          ${quick("🎟️", "Promo", "promo")}
          ${quick("📢", "Notices", "notices")}
          ${quick("🧾", "History", "history")}
          ${quick("🚀", "Activate", "activation")}
          ${quick("📺", "Earn Ads", "ads")}
        </div>

        <div class="flex items-center justify-between mb-2">
          <h2 class="font-bold">Recent Activity</h2>
        </div>
        <div id="recentActivity">${UI.skeletonList(3)}</div>
      </div>`;

    c.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => go(b.getAttribute("data-quick"))));
    c.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.getAttribute("data-go"))));

    // recent activity
    const tx = await DB.list("transactions", { where: [["userId", "==", u.id]], orderBy: ["createdAt", "desc"], limit: 6 }).catch(() => []);
    const host = $("#recentActivity");
    if (!tx.length) host.innerHTML = UI.emptyState("No activity yet — start earning!", "✨");
    else host.innerHTML = `<div class="space-y-2">${tx.map(txRow).join("")}</div>`;
  }

  function miniBal(label, val) {
    return `<div class="chip rounded-2xl p-2.5 text-center">
      <p class="text-[10px] text-soft">${label}</p>
      <p class="font-bold text-sm mt-0.5">${val}</p></div>`;
  }
  function statCard(icon, label, val) {
    return `<div class="glass rounded-2xl p-3.5 card-hover">
      <div class="text-xl">${icon}</div>
      <p class="text-soft text-[11px] mt-1">${label}</p>
      <p class="font-bold text-lg">${val}</p></div>`;
  }
  function quick(icon, label, route) {
    return `<button data-go="${route}" class="glass rounded-2xl p-2.5 flex flex-col items-center gap-1 card-hover">
      <span class="text-xl">${icon}</span><span class="text-[10px] font-medium text-soft">${label}</span></button>`;
  }
  function txRow(t) {
    const sign = ["withdraw", "deposit_fee", "activation", "buy"].includes(t.type) ? "-" : "+";
    return `<div class="glass rounded-2xl px-3 py-2.5 flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl chip grid place-items-center">${txIcon(t.type)}</div>
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold capitalize truncate">${UI.escapeHtml((t.type||"").replace(/_/g," "))}</p>
      <p class="text-[11px] text-soft">${UI.timeAgo(t.createdAt)}</p></div>
      <p class="text-sm font-bold ${sign==="-"?"text-rose-400":"text-emerald-400"}">${sign}${UI.money(t.amount)}</p></div>`;
  }
  function txIcon(t) {
    return ({ deposit:"📥", withdraw:"📤", ad:"📺", task:"🎯", referral:"🎁", promo:"🎟️", activation:"🚀", buy:"🛒", sell:"🏷️" })[t] || "💸";
  }
  function activationBanner() {
    if (App.user.activated) return "";
    return `<div data-go="activation" class="glass-strong rounded-3xl p-4 mb-4 flex items-center gap-3 card-hover status-pending">
      <div class="text-2xl">🔒</div>
      <div class="flex-1"><p class="font-bold text-sm">Account not activated</p>
      <p class="text-[11px] opacity-80">Activate to unlock withdrawals & full features.</p></div>
      <span class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Activate</span></div>`;
  }

  /* ---------------- TASKS ---------------- */
  async function renderTasks() {
    const c = content();
    c.innerHTML = pageHeader("Task Center", "Complete tasks & earn rewards") +
      `<div id="taskList">${UI.skeletonList(4)}</div>`;
    const tasks = await DB.list("tasks", { where: [["active", "==", true]], orderBy: ["createdAt", "desc"] }).catch(() => []);
    const done = await DB.list("transactions", { where: [["userId", "==", App.user.id], ["type", "==", "task"]] }).catch(() => []);
    const doneIds = new Set(done.map((d) => d.meta && d.meta.taskId));
    const host = $("#taskList");
    if (!tasks.length) { host.innerHTML = UI.emptyState("No active tasks right now.", "🎯"); return; }
    host.innerHTML = `<div class="space-y-3">${tasks.map((t) => taskCard(t, doneIds.has(t.id))).join("")}</div>`;
    host.querySelectorAll("[data-task]").forEach((b) =>
      b.addEventListener("click", () => completeTask(tasks.find((x) => x.id === b.getAttribute("data-task"))))
    );
  }
  function taskCard(t, done) {
    return `<div class="glass rounded-2xl p-4 card-hover">
      <div class="flex items-start gap-3">
        <div class="w-11 h-11 rounded-xl brand-grad grid place-items-center text-white text-lg">${t.icon || "🎯"}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold">${UI.escapeHtml(t.title || "Task")}</p>
          <p class="text-soft text-xs mt-0.5">${UI.escapeHtml(t.description || "")}</p>
          <div class="flex items-center gap-2 mt-2">
            <span class="chip text-[11px] px-2 py-1 rounded-full font-semibold text-emerald-400">+${UI.money(t.reward)}</span>
            ${t.url ? `<a href="${UI.escapeHtml(t.url)}" target="_blank" class="text-[11px] underline text-soft">Open link ↗</a>` : ""}
          </div>
        </div>
        <button data-task="${t.id}" ${done?"disabled":""} class="${done?"chip text-soft":"btn-primary"} rounded-xl px-3 py-2 text-xs font-semibold self-center">${done?"Done ✓":"Claim"}</button>
      </div></div>`;
  }
  async function completeTask(t) {
    if (!t) return;
    if (!requireActivated()) return;
    try {
      await DB.adjustBalance(App.user.id, "mainBalance", Number(t.reward || 0));
      await DB.adjustBalance(App.user.id, "totalEarnings", Number(t.reward || 0));
      await DB.updateDoc("users", App.user.id, { tasksCompleted: DB.inc(1) });
      await DB.tx(App.user.id, "task", t.reward, { taskId: t.id, title: t.title });
      await DB.notify(App.user.id, "Task completed", `You earned ${UI.money(t.reward)} from "${t.title}".`, "success");
      App.user.mainBalance = Number(App.user.mainBalance || 0) + Number(t.reward || 0);
      App.user.tasksCompleted = Number(App.user.tasksCompleted || 0) + 1;
      UI.toast(`Earned ${UI.money(t.reward)}!`, "success");
      renderTasks();
    } catch (e) { UI.toast("Could not complete task.", "error"); }
  }

  /* ---------------- ADS ---------------- */
  async function renderAds() {
    const s = App.settings;
    const reward = Number(s.adReward || 0.5);
    const limit = Number(s.adDailyLimit || 20);
    const watched = Number(App.user.adsWatchedToday || 0);
    const c = content();
    c.innerHTML = pageHeader("Watch & Earn", "Earn rewards by watching ads") + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-6 text-center mb-4 relative overflow-hidden">
          <div class="absolute inset-0 brand-grad opacity-10"></div>
          <div class="text-5xl mb-2">📺</div>
          <p class="text-soft text-sm">Reward per ad</p>
          <p class="text-3xl font-extrabold brand-text">${UI.money(reward)}</p>
          <p class="text-xs text-soft mt-2">Watched today: <b>${watched}/${limit}</b></p>
          <button id="watchAd" class="btn-primary rounded-2xl px-6 py-3 mt-4 font-bold w-full">▶ Watch Ad</button>
        </div>
        <h2 class="font-bold mb-2">Ad History</h2>
        <div id="adHistory">${UI.skeletonList(3)}</div>
      </div>`;
    $("#watchAd").addEventListener("click", () => watchAd(reward, limit, watched));
    const hist = await DB.list("transactions", { where: [["userId","==",App.user.id],["type","==","ad"]], orderBy:["createdAt","desc"], limit: 15 }).catch(()=>[]);
    $("#adHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(txRow).join("")}</div>` : UI.emptyState("No ads watched yet.", "📺");
  }
  async function watchAd(reward, limit, watched) {
    if (!requireActivated()) return;
    if (watched >= limit) { UI.toast("Daily ad limit reached.", "warn"); return; }
    const btn = $("#watchAd"); btn.disabled = true; btn.textContent = "Loading ad…";
    // Hook your ad-network SDK here (e.g. show rewarded ad, resolve on reward).
    setTimeout(async () => {
      try {
        await DB.adjustBalance(App.user.id, "mainBalance", reward);
        await DB.adjustBalance(App.user.id, "totalEarnings", reward);
        await DB.updateDoc("users", App.user.id, { adsWatchedToday: DB.inc(1) });
        await DB.tx(App.user.id, "ad", reward, {});
        App.user.mainBalance = Number(App.user.mainBalance||0)+reward;
        App.user.adsWatchedToday = Number(App.user.adsWatchedToday||0)+1;
        UI.toast(`+${UI.money(reward)} earned!`, "success");
        renderAds();
      } catch(e){ UI.toast("Ad reward failed.", "error"); btn.disabled=false; btn.textContent="▶ Watch Ad"; }
    }, 1500);
  }

  /* ---------------- WALLET ---------------- */
  function renderWallet() {
    const u = App.user, c = content();
    c.innerHTML = pageHeader("Wallet", "Manage your balances") + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-5 mb-4">
          <p class="text-soft text-xs">Main Balance</p>
          <p class="text-3xl font-extrabold">${UI.money(u.mainBalance)}</p>
          <div class="grid grid-cols-2 gap-2 mt-3">
            ${miniBal("Deposit Balance", UI.money(u.depositBalance))}
            ${miniBal("Referral Balance", UI.money(u.referralBalance))}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <button data-go="deposit" class="btn-primary rounded-2xl py-4 font-bold">📥 Deposit</button>
          <button data-go="withdraw" class="glass rounded-2xl py-4 font-bold">📤 Withdraw</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button data-go="activation" class="glass rounded-2xl py-3.5 font-semibold text-sm">🚀 Activation</button>
          <button data-go="history" class="glass rounded-2xl py-3.5 font-semibold text-sm">🧾 History</button>
        </div>
      </div>`;
    c.querySelectorAll("[data-go]").forEach((b)=>b.addEventListener("click",()=>go(b.getAttribute("data-go"))));
  }

  /* ---------------- ACTIVATION ---------------- */
  async function renderActivation() {
    const s = App.settings, u = App.user, c = content();
    const fee = Number(s.activationFee || 0);
    const enabled = s.activationEnabled !== false;
    c.innerHTML = pageHeader("Account Activation", "Unlock all features", true) + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-6 text-center mb-4">
          <div class="text-5xl mb-2">${u.activated ? "✅" : "🔒"}</div>
          <p class="font-bold text-lg">${u.activated ? "Account Activated" : "Activation Required"}</p>
          <p class="text-soft text-sm mt-1">${u.activated ? "You have full access to all features." : "Activate your account to unlock withdrawals, tasks and more."}</p>
          ${!u.activated ? `<div class="chip rounded-2xl p-3 mt-4"><p class="text-xs text-soft">Activation Fee</p><p class="text-2xl font-extrabold brand-text">${UI.money(fee)}</p></div>` : `<span class="badge-premium inline-block mt-3 text-xs font-bold px-4 py-2 rounded-full">★ PREMIUM MEMBER</span>`}
          ${!u.activated && enabled ? `<button id="activateBtn" class="btn-primary rounded-2xl w-full py-3 mt-4 font-bold">Request Activation</button>` : ""}
          ${!enabled && !u.activated ? `<p class="text-xs status-pending rounded-xl py-2 mt-3">Activation is currently disabled.</p>` : ""}
        </div>
        <h2 class="font-bold mb-2">Activation History</h2>
        <div id="actHistory">${UI.skeletonList(2)}</div>
      </div>`;
    bindBack();
    const ab = $("#activateBtn");
    if (ab) ab.addEventListener("click", () => requestActivation(fee));
    const hist = await DB.list("activationRequests", { where: [["userId","==",u.id]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#actHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(reqRow).join("")}</div>` : UI.emptyState("No activation requests yet.", "🚀");
  }
  async function requestActivation(fee) {
    if (Number(App.user.depositBalance||0) < fee && Number(App.user.mainBalance||0) < fee) {
      UI.toast("Insufficient balance. Please deposit first.", "warn"); return;
    }
    try {
      await DB.addDoc("activationRequests", { userId: App.user.id, username: App.user.username, fee, status: "pending", createdAt: DB.now() });
      await DB.notify(App.user.id, "Activation requested", "Your activation request is under review.", "info");
      UI.toast("Activation request submitted!", "success");
      renderActivation();
    } catch(e){ UI.toast("Request failed.", "error"); }
  }
  function reqRow(r) {
    return `<div class="glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
      <div><p class="text-sm font-semibold">${UI.money(r.fee||r.amount||0)}</p>
      <p class="text-[11px] text-soft">${UI.dateTime(r.createdAt)}</p></div>${UI.statusPill(r.status)}</div>`;
  }

  /* ---------------- REFERRAL ---------------- */
  async function renderReferral() {
    const s = App.settings, u = App.user, c = content();
    const bot = s.botUsername || "YourBot";
    const link = `https://t.me/${bot}?start=ref_${u.id}`;
    const reward = Number(s.referralReward || 0);
    const required = Number(s.requiredReferrals || 0);
    c.innerHTML = pageHeader("Referral Program", "Invite friends & earn", true) + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-5 mb-4">
          <div class="grid grid-cols-3 gap-2 text-center mb-4">
            ${miniBal("Referrals", UI.num(u.referralCount))}
            ${miniBal("Earned", UI.money(u.referralBalance))}
            ${miniBal("Per Invite", UI.money(reward))}
          </div>
          <p class="text-xs text-soft mb-1">Your referral link</p>
          <div class="flex gap-2">
            <input id="refLink" readonly value="${link}" class="flex-1 rounded-xl px-3 py-2.5 text-xs" />
            <button id="copyRef" class="btn-primary rounded-xl px-4 text-sm font-semibold">Copy</button>
          </div>
          <button id="shareRef" class="chip rounded-xl w-full py-2.5 mt-2 text-sm font-semibold">📤 Share to Telegram</button>
          ${required ? `<p class="text-[11px] text-soft mt-3 text-center">Need <b>${required}</b> referrals to unlock withdrawals.</p>` : ""}
        </div>
        <h2 class="font-bold mb-2">Referral History</h2>
        <div id="refHistory">${UI.skeletonList(3)}</div>
      </div>`;
    bindBack();
    $("#copyRef").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); UI.toast("Link copied!", "success"); }
      catch { $("#refLink").select(); document.execCommand("copy"); UI.toast("Link copied!", "success"); }
    });
    $("#shareRef").addEventListener("click", () => {
      const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join me and start earning! 🚀")}`;
      const tg = UI.telegram(); if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
    });
    const hist = await DB.list("referrals", { where: [["referrerId","==",u.id]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#refHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(refRow).join("")}</div>` : UI.emptyState("No referrals yet — share your link!", "🎁");
  }
  function refRow(r) {
    return `<div class="glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg chip grid place-items-center">👤</div>
      <div><p class="text-sm font-semibold">User ${UI.escapeHtml(String(r.referredId||"").slice(-5))}</p>
      <p class="text-[11px] text-soft">${UI.timeAgo(r.createdAt)}</p></div></div>
      ${UI.statusPill(r.status)}</div>`;
  }

  /* ---------------- DEPOSIT ---------------- */
  async function renderDeposit() {
    const s = App.settings, c = content();
    c.innerHTML = pageHeader("Deposit", "Add funds to your account", true) +
      `<div class="view"><div id="depMethods" class="mb-4">${UI.skeletonList(2)}</div>
       <h2 class="font-bold mb-2">Deposit History</h2><div id="depHistory">${UI.skeletonList(2)}</div></div>`;
    bindBack();
    const methods = await DB.list("settings_depositMethods", { orderBy: ["createdAt","asc"] }).catch(()=>[]);
    const mhost = $("#depMethods");
    if (!methods.length) mhost.innerHTML = UI.emptyState("No deposit methods configured yet.", "💳");
    else mhost.innerHTML = methods.map(depMethodCard).join("");
    mhost.querySelectorAll("[data-dep]").forEach((b)=>b.addEventListener("click",()=>openDepositForm(methods.find(m=>m.id===b.getAttribute("data-dep")), s)));
    const hist = await DB.list("deposits", { where:[["userId","==",App.user.id]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#depHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(moneyRow).join("")}</div>` : UI.emptyState("No deposits yet.", "📥");
  }
  function depMethodCard(m) {
    return `<div class="glass rounded-2xl p-4 mb-2 card-hover">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl brand-grad grid place-items-center text-white text-lg">${m.icon || "💳"}</div>
        <div class="flex-1"><p class="font-bold">${UI.escapeHtml(m.name)}</p>
        <p class="text-[11px] text-soft">${UI.escapeHtml(m.account || "")}</p></div>
        <button data-dep="${m.id}" class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Deposit</button>
      </div>
      ${m.instructions ? `<p class="text-[11px] text-soft mt-2">${UI.escapeHtml(m.instructions)}</p>` : ""}</div>`;
  }
  function openDepositForm(m, s) {
    if (!m) return;
    const min = Number(s.minDeposit||0), max = Number(s.maxDeposit||0);
    const mod = UI.modal(`Deposit via ${m.name}`, `
      <div class="space-y-3">
        ${m.account ? `<div class="chip rounded-xl p-3 text-sm"><b>Send to:</b> ${UI.escapeHtml(m.account)}</div>` : ""}
        ${m.instructions ? `<p class="text-xs text-soft">${UI.escapeHtml(m.instructions)}</p>` : ""}
        <div><label class="text-xs text-soft">Amount ${min?`(min ${UI.money(min)})`:""}${max?` (max ${UI.money(max)})`:""}</label>
        <input id="depAmt" type="number" inputmode="decimal" placeholder="0.00" class="w-full rounded-xl px-3 py-2.5 mt-1" /></div>
        <div><label class="text-xs text-soft">Transaction ID / Sender</label>
        <input id="depTxn" placeholder="e.g. TXN12345" class="w-full rounded-xl px-3 py-2.5 mt-1" /></div>
        <div><label class="text-xs text-soft">Payment screenshot</label>
        <input id="depFile" type="file" accept="image/*" class="w-full rounded-xl px-3 py-2.5 mt-1 text-xs" /></div>
        <button id="depSubmit" class="btn-primary rounded-xl w-full py-3 font-bold">Submit Deposit</button>
      </div>`);
    $("#depSubmit", mod.el).addEventListener("click", async () => {
      const amt = Number($("#depAmt", mod.el).value);
      const txn = $("#depTxn", mod.el).value.trim();
      if (!amt || amt <= 0) return UI.toast("Enter a valid amount.", "warn");
      if (min && amt < min) return UI.toast(`Minimum deposit is ${UI.money(min)}.`, "warn");
      if (max && amt > max) return UI.toast(`Maximum deposit is ${UI.money(max)}.`, "warn");
      const btn = $("#depSubmit", mod.el); btn.disabled = true; btn.textContent = "Submitting…";
      try {
        let screenshot = "";
        const f = $("#depFile", mod.el).files[0];
        if (f && DB.ready() && DB.FB.storage) {
          const ref = DB.FB.storage.ref(`deposits/${App.user.id}/${Date.now()}_${f.name}`);
          await ref.put(f); screenshot = await ref.getDownloadURL();
        }
        await DB.addDoc("deposits", { userId: App.user.id, username: App.user.username, method: m.name, amount: amt, txnId: txn, screenshot, status: "pending", createdAt: DB.now() });
        await DB.notify(App.user.id, "Deposit submitted", `Your ${UI.money(amt)} deposit is pending review.`, "info");
        mod.close(); UI.toast("Deposit submitted for review!", "success"); renderDeposit();
      } catch(e){ console.error(e); UI.toast("Submission failed.", "error"); btn.disabled=false; btn.textContent="Submit Deposit"; }
    });
  }

  /* ---------------- WITHDRAW ---------------- */
  async function renderWithdraw() {
    const s = App.settings, u = App.user, c = content();
    const enabled = s.withdrawEnabled !== false;
    c.innerHTML = pageHeader("Withdraw", "Cash out your earnings", true) + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-5 mb-4">
          <p class="text-soft text-xs">Available to withdraw</p>
          <p class="text-3xl font-extrabold">${UI.money(u.mainBalance)}</p>
          <div class="grid grid-cols-2 gap-2 mt-3 text-[11px] text-soft">
            <div class="chip rounded-xl p-2">Min: <b>${UI.money(s.minWithdraw||0)}</b></div>
            <div class="chip rounded-xl p-2">Max: <b>${UI.money(s.maxWithdraw||0)}</b></div>
            <div class="chip rounded-xl p-2">Fee: <b>${Number(s.withdrawFee||0)}%</b></div>
            <div class="chip rounded-xl p-2">VAT: <b>${Number(s.vat||0)}%</b></div>
          </div>
        </div>
        ${enabled ? `<div id="wMethods" class="mb-4">${UI.skeletonList(2)}</div>` : `<div class="glass-strong rounded-2xl p-4 text-center status-pending mb-4">Withdrawals are temporarily disabled.</div>`}
        <h2 class="font-bold mb-2">Withdraw History</h2>
        <div id="wHistory">${UI.skeletonList(2)}</div>
      </div>`;
    bindBack();
    if (enabled) {
      const methods = await DB.list("settings_withdrawMethods", { orderBy:["createdAt","asc"] }).catch(()=>[]);
      const host = $("#wMethods");
      if (!methods.length) host.innerHTML = UI.emptyState("No withdraw methods configured yet.", "🏦");
      else host.innerHTML = methods.map((m)=>`<div class="glass rounded-2xl p-4 mb-2 card-hover flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl brand-grad grid place-items-center text-white text-lg">${m.icon||"🏦"}</div>
        <div class="flex-1"><p class="font-bold">${UI.escapeHtml(m.name)}</p></div>
        <button data-w="${m.id}" class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Withdraw</button></div>`).join("");
      host.querySelectorAll("[data-w]").forEach((b)=>b.addEventListener("click",()=>openWithdrawForm(methods.find(m=>m.id===b.getAttribute("data-w")), s)));
    }
    const hist = await DB.list("withdrawals", { where:[["userId","==",u.id]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#wHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(moneyRow).join("")}</div>` : UI.emptyState("No withdrawals yet.", "📤");
  }
  function openWithdrawForm(m, s) {
    if (!m) return;
    if (!requireActivated()) return;
    const required = Number(s.requiredReferrals||0);
    if (required && Number(App.user.referralCount||0) < required) {
      return UI.toast(`You need ${required} referrals to withdraw.`, "warn");
    }
    const min = Number(s.minWithdraw||0), max = Number(s.maxWithdraw||0);
    const feePct = Number(s.withdrawFee||0), vatPct = Number(s.vat||0);
    const mod = UI.modal(`Withdraw via ${m.name}`, `
      <div class="space-y-3">
        <div><label class="text-xs text-soft">Amount</label>
        <input id="wAmt" type="number" inputmode="decimal" placeholder="0.00" class="w-full rounded-xl px-3 py-2.5 mt-1" /></div>
        <div><label class="text-xs text-soft">Your ${UI.escapeHtml(m.name)} account / number</label>
        <input id="wAcc" placeholder="account details" class="w-full rounded-xl px-3 py-2.5 mt-1" /></div>
        <div id="wCalc" class="chip rounded-xl p-3 text-xs text-soft hide"></div>
        <button id="wSubmit" class="btn-primary rounded-xl w-full py-3 font-bold">Request Withdraw</button>
      </div>`);
    const amtEl = $("#wAmt", mod.el), calc = $("#wCalc", mod.el);
    amtEl.addEventListener("input", () => {
      const a = Number(amtEl.value||0);
      if (!a) { calc.classList.add("hide"); return; }
      const fee = a*feePct/100, vat = a*vatPct/100, net = a-fee-vat;
      calc.classList.remove("hide");
      calc.innerHTML = `Amount: <b>${UI.money(a)}</b><br>Fee (${feePct}%): -${UI.money(fee)}<br>VAT (${vatPct}%): -${UI.money(vat)}<br><span class="text-emerald-400">You receive: <b>${UI.money(net)}</b></span>`;
    });
    $("#wSubmit", mod.el).addEventListener("click", async () => {
      const a = Number(amtEl.value), acc = $("#wAcc", mod.el).value.trim();
      if (!a || a<=0) return UI.toast("Enter a valid amount.", "warn");
      if (min && a<min) return UI.toast(`Minimum withdraw is ${UI.money(min)}.`, "warn");
      if (max && a>max) return UI.toast(`Maximum withdraw is ${UI.money(max)}.`, "warn");
      if (a > Number(App.user.mainBalance||0)) return UI.toast("Insufficient balance.", "warn");
      if (!acc) return UI.toast("Enter your account details.", "warn");
      const fee=a*feePct/100, vat=a*vatPct/100, net=a-fee-vat;
      const btn = $("#wSubmit", mod.el); btn.disabled=true; btn.textContent="Submitting…";
      try {
        await DB.adjustBalance(App.user.id, "mainBalance", -a);
        await DB.addDoc("withdrawals", { userId: App.user.id, username: App.user.username, method: m.name, account: acc, amount: a, fee, vat, net, status: "pending", createdAt: DB.now() });
        await DB.tx(App.user.id, "withdraw", a, { method: m.name });
        await DB.notify(App.user.id, "Withdraw requested", `Your ${UI.money(a)} withdrawal is pending.`, "info");
        App.user.mainBalance = Number(App.user.mainBalance||0)-a;
        mod.close(); UI.toast("Withdraw request submitted!", "success"); renderWithdraw();
      } catch(e){ UI.toast("Request failed.", "error"); btn.disabled=false; btn.textContent="Request Withdraw"; }
    });
  }
  function moneyRow(r) {
    return `<div class="glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
      <div><p class="text-sm font-semibold">${UI.money(r.amount)} <span class="text-[11px] text-soft">· ${UI.escapeHtml(r.method||"")}</span></p>
      <p class="text-[11px] text-soft">${UI.dateTime(r.createdAt)}</p></div>${UI.statusPill(r.status)}</div>`;
  }

  /* ---------------- MARKETPLACE ---------------- */
  async function renderMarketplace() {
    const c = content();
    c.innerHTML = pageHeader("Marketplace", "Buy & sell with the community", true) + `
      <div class="view">
        <div class="grid grid-cols-2 gap-2 mb-4">
          <button id="tabBuy" class="btn-primary rounded-xl py-2.5 text-sm font-semibold">🛒 Buy</button>
          <button id="tabSell" class="chip rounded-xl py-2.5 text-sm font-semibold">🏷️ Sell</button>
        </div>
        <div id="mktBody">${UI.skeletonList(3)}</div>
      </div>`;
    bindBack();
    const buy = $("#tabBuy"), sell = $("#tabSell");
    buy.addEventListener("click", () => { buy.className="btn-primary rounded-xl py-2.5 text-sm font-semibold"; sell.className="chip rounded-xl py-2.5 text-sm font-semibold"; loadBuy(); });
    sell.addEventListener("click", () => { sell.className="btn-primary rounded-xl py-2.5 text-sm font-semibold"; buy.className="chip rounded-xl py-2.5 text-sm font-semibold"; loadSell(); });
    loadBuy();
  }
  async function loadBuy() {
    const host = $("#mktBody"); host.innerHTML = UI.skeletonList(3);
    const items = await DB.list("marketplaceListings", { where:[["status","==","approved"]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    items.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
    host.innerHTML = items.length ? `<div class="space-y-3">${items.map(listingCard).join("")}</div>` : UI.emptyState("No listings yet.", "🛒");
    host.querySelectorAll("[data-buy]").forEach((b)=>b.addEventListener("click",()=>buyListing(items.find(i=>i.id===b.getAttribute("data-buy")))));
  }
  function listingCard(i) {
    return `<div class="glass rounded-2xl p-4 card-hover">
      <div class="flex items-start gap-3">
        ${i.image ? `<img src="${UI.escapeHtml(i.image)}" class="w-14 h-14 rounded-xl object-cover" />` : `<div class="w-14 h-14 rounded-xl brand-grad grid place-items-center text-white text-xl">📦</div>`}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2"><p class="font-bold truncate">${UI.escapeHtml(i.title)}</p>
          ${i.featured?`<span class="badge-premium text-[9px] px-1.5 py-0.5 rounded-full font-bold">★</span>`:""}</div>
          <p class="text-soft text-xs mt-0.5 line-clamp-2">${UI.escapeHtml(i.description||"")}</p>
          <p class="font-bold brand-text mt-1">${UI.money(i.price)}</p>
        </div>
        <button data-buy="${i.id}" class="btn-primary rounded-xl px-3 py-2 text-xs font-semibold self-center">Buy</button>
      </div></div>`;
  }
  async function buyListing(i) {
    if (!i) return; if (!requireActivated()) return;
    if (Number(App.user.mainBalance||0) < Number(i.price||0)) return UI.toast("Insufficient balance.", "warn");
    UI.confirm(`Buy "${i.title}" for ${UI.money(i.price)}?`, async () => {
      try {
        await DB.adjustBalance(App.user.id, "mainBalance", -Number(i.price));
        await DB.tx(App.user.id, "buy", i.price, { listingId: i.id, title: i.title });
        await DB.notify(App.user.id, "Purchase complete", `You bought "${i.title}".`, "success");
        App.user.mainBalance = Number(App.user.mainBalance||0)-Number(i.price);
        UI.toast("Purchase successful!", "success");
      } catch(e){ UI.toast("Purchase failed.", "error"); }
    }, { confirmText: "Buy now" });
  }
  async function loadSell() {
    const host = $("#mktBody");
    host.innerHTML = `<button id="newListing" class="btn-primary rounded-xl w-full py-3 font-bold mb-4">＋ Create Listing</button>
      <h2 class="font-bold mb-2">My Listings</h2><div id="myListings">${UI.skeletonList(2)}</div>`;
    $("#newListing").addEventListener("click", openListingForm);
    const mine = await DB.list("marketplaceListings", { where:[["sellerId","==",App.user.id]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#myListings").innerHTML = mine.length ? `<div class="space-y-2">${mine.map((i)=>`<div class="glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
      <div><p class="text-sm font-semibold">${UI.escapeHtml(i.title)}</p><p class="text-[11px] text-soft">${UI.money(i.price)}</p></div>${UI.statusPill(i.status)}</div>`).join("")}</div>` : UI.emptyState("You have no listings.", "🏷️");
  }
  function openListingForm() {
    const mod = UI.modal("Create Listing", `
      <div class="space-y-3">
        <input id="lTitle" placeholder="Title" class="w-full rounded-xl px-3 py-2.5" />
        <textarea id="lDesc" placeholder="Description" rows="3" class="w-full rounded-xl px-3 py-2.5"></textarea>
        <input id="lPrice" type="number" placeholder="Price" class="w-full rounded-xl px-3 py-2.5" />
        <input id="lImg" type="file" accept="image/*" class="w-full rounded-xl px-3 py-2.5 text-xs" />
        <button id="lSubmit" class="btn-primary rounded-xl w-full py-3 font-bold">Submit for Approval</button>
      </div>`);
    $("#lSubmit", mod.el).addEventListener("click", async () => {
      const title = $("#lTitle", mod.el).value.trim();
      const desc = $("#lDesc", mod.el).value.trim();
      const price = Number($("#lPrice", mod.el).value);
      if (!title || !price) return UI.toast("Title and price required.", "warn");
      const btn = $("#lSubmit", mod.el); btn.disabled=true; btn.textContent="Submitting…";
      try {
        let image = "";
        const f = $("#lImg", mod.el).files[0];
        if (f && DB.ready() && DB.FB.storage) { const ref = DB.FB.storage.ref(`listings/${App.user.id}/${Date.now()}_${f.name}`); await ref.put(f); image = await ref.getDownloadURL(); }
        await DB.addDoc("marketplaceListings", { sellerId: App.user.id, sellerName: App.user.username, title, description: desc, price, image, status: "pending", featured: false, boosted: false, createdAt: DB.now() });
        mod.close(); UI.toast("Listing submitted for approval!", "success"); loadSell();
      } catch(e){ UI.toast("Submit failed.", "error"); btn.disabled=false; btn.textContent="Submit for Approval"; }
    });
  }

  /* ---------------- LEADERBOARD ---------------- */
  async function renderLeaderboard() {
    const c = content();
    c.innerHTML = pageHeader("Leaderboard", "Top performers", true) + `
      <div class="view">
        <div class="grid grid-cols-2 gap-2 mb-4">
          <button id="lbEarn" class="btn-primary rounded-xl py-2.5 text-sm font-semibold">💰 Top Earners</button>
          <button id="lbRef" class="chip rounded-xl py-2.5 text-sm font-semibold">🎁 Top Referrers</button>
        </div>
        <div id="lbBody">${UI.skeletonList(5)}</div>
      </div>`;
    bindBack();
    const be = $("#lbEarn"), br = $("#lbRef");
    be.addEventListener("click", ()=>{ be.className="btn-primary rounded-xl py-2.5 text-sm font-semibold"; br.className="chip rounded-xl py-2.5 text-sm font-semibold"; loadLb("totalEarnings"); });
    br.addEventListener("click", ()=>{ br.className="btn-primary rounded-xl py-2.5 text-sm font-semibold"; be.className="chip rounded-xl py-2.5 text-sm font-semibold"; loadLb("referralCount"); });
    loadLb("totalEarnings");
  }
  async function loadLb(field) {
    const host = $("#lbBody"); host.innerHTML = UI.skeletonList(5);
    const top = await DB.leaderboard(field, 30).catch(()=>[]);
    if (!top.length) { host.innerHTML = UI.emptyState("No ranking data yet.", "🏆"); return; }
    host.innerHTML = `<div class="space-y-2">${top.map((u,i)=>{
      const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`<span class="text-soft text-sm font-bold">#${i+1}</span>`;
      const val = field==="referralCount"?UI.num(u.referralCount):UI.money(u.totalEarnings);
      return `<div class="glass rounded-2xl px-3 py-2.5 flex items-center gap-3 ${u.id===App.user.id?"ring-2 ring-violet-500/40":""}">
        <div class="w-8 text-center">${medal}</div>
        <div class="w-9 h-9 rounded-xl chip grid place-items-center">👤</div>
        <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${UI.escapeHtml(u.firstName||u.username||("User "+String(u.id).slice(-4)))}</p></div>
        <p class="text-sm font-bold brand-text">${val}</p></div>`;
    }).join("")}</div>`;
  }

  /* ---------------- PROMO ---------------- */
  async function renderPromo() {
    const c = content();
    c.innerHTML = pageHeader("Promo Codes", "Redeem for bonus rewards", true) + `
      <div class="view">
        <div class="glass-strong rounded-3xl p-5 mb-4">
          <div class="flex gap-2">
            <input id="promoInput" placeholder="ENTER CODE" class="flex-1 rounded-xl px-3 py-3 uppercase tracking-wider font-semibold" />
            <button id="redeemBtn" class="btn-primary rounded-xl px-5 font-bold">Redeem</button>
          </div>
        </div>
        <h2 class="font-bold mb-2">Promo History</h2>
        <div id="promoHistory">${UI.skeletonList(2)}</div>
      </div>`;
    bindBack();
    $("#redeemBtn").addEventListener("click", redeemPromo);
    const hist = await DB.list("transactions", { where:[["userId","==",App.user.id],["type","==","promo"]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#promoHistory").innerHTML = hist.length ? `<div class="space-y-2">${hist.map(txRow).join("")}</div>` : UI.emptyState("No promo codes redeemed.", "🎟️");
  }
  async function redeemPromo() {
    const code = $("#promoInput").value.trim().toUpperCase();
    if (!code) return UI.toast("Enter a promo code.", "warn");
    const codes = await DB.list("promoCodes", { where:[["code","==",code]] }).catch(()=>[]);
    const promo = codes[0];
    if (!promo) return UI.toast("Invalid promo code.", "error");
    if (promo.active === false) return UI.toast("This code is disabled.", "warn");
    if (promo.expiresAt && UI.tsToDate(promo.expiresAt) < new Date()) return UI.toast("This code has expired.", "warn");
    if (promo.usageLimit && Number(promo.usedCount||0) >= Number(promo.usageLimit)) return UI.toast("Usage limit reached.", "warn");
    const used = await DB.list("transactions", { where:[["userId","==",App.user.id],["type","==","promo"]] }).catch(()=>[]);
    if (used.some((t)=>t.meta && t.meta.code===code)) return UI.toast("You already used this code.", "warn");
    try {
      await DB.adjustBalance(App.user.id, "mainBalance", Number(promo.reward||0));
      await DB.adjustBalance(App.user.id, "totalEarnings", Number(promo.reward||0));
      await DB.tx(App.user.id, "promo", promo.reward, { code });
      await DB.updateDoc("promoCodes", promo.id, { usedCount: DB.inc(1) });
      App.user.mainBalance = Number(App.user.mainBalance||0)+Number(promo.reward||0);
      UI.toast(`Redeemed! +${UI.money(promo.reward)}`, "success");
      renderPromo();
    } catch(e){ UI.toast("Redeem failed.", "error"); }
  }

  /* ---------------- NOTICES ---------------- */
  async function renderNotices() {
    const c = content();
    c.innerHTML = pageHeader("Notice Center", "Announcements & updates", true) + `<div id="noticeList">${UI.skeletonList(3)}</div>`;
    bindBack();
    const items = await DB.list("notices", { orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#noticeList").innerHTML = items.length ? `<div class="space-y-3">${items.map((n)=>`
      <div class="glass rounded-2xl p-4 card-hover">
        <div class="flex items-center gap-2 mb-1"><span class="text-lg">${n.icon||"📢"}</span>
        <p class="font-bold">${UI.escapeHtml(n.title)}</p></div>
        <p class="text-soft text-sm">${UI.escapeHtml(n.body||"")}</p>
        <p class="text-[11px] text-soft mt-2">${UI.dateTime(n.createdAt)}</p></div>`).join("")}</div>` : UI.emptyState("No notices yet.", "📢");
  }

  /* ---------------- HISTORY ---------------- */
  async function renderHistory() {
    const c = content();
    c.innerHTML = pageHeader("History Center", "All your records", true) + `
      <div class="view">
        <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3" id="histTabs">
          ${["All","Deposit","Withdraw","Referral","Ad","Task","Promo"].map((t,i)=>`<button data-h="${t.toLowerCase()}" class="${i===0?"btn-primary":"chip"} rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap">${t}</button>`).join("")}
        </div>
        <div id="histBody">${UI.skeletonList(4)}</div>
      </div>`;
    bindBack();
    const tabs = c.querySelectorAll("[data-h]");
    tabs.forEach((b)=>b.addEventListener("click", ()=>{
      tabs.forEach((x)=>x.className="chip rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap");
      b.className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap";
      loadHistory(b.getAttribute("data-h"));
    }));
    loadHistory("all");
  }
  async function loadHistory(type) {
    const host = $("#histBody"); host.innerHTML = UI.skeletonList(4);
    let rows = [];
    if (type==="deposit") rows = (await DB.list("deposits",{where:[["userId","==",App.user.id]],orderBy:["createdAt","desc"]}).catch(()=>[])).map(moneyRow);
    else if (type==="withdraw") rows = (await DB.list("withdrawals",{where:[["userId","==",App.user.id]],orderBy:["createdAt","desc"]}).catch(()=>[])).map(moneyRow);
    else if (type==="referral") rows = (await DB.list("referrals",{where:[["referrerId","==",App.user.id]],orderBy:["createdAt","desc"]}).catch(()=>[])).map(refRow);
    else {
      const where = [["userId","==",App.user.id]];
      if (["ad","task","promo"].includes(type)) where.push(["type","==",type]);
      const tx = await DB.list("transactions",{where,orderBy:["createdAt","desc"],limit:50}).catch(()=>[]);
      rows = tx.map(txRow);
    }
    host.innerHTML = rows.length ? `<div class="space-y-2">${rows.join("")}</div>` : UI.emptyState("No records found.", "🧾");
  }

  /* ---------------- NOTIFICATIONS ---------------- */
  async function renderNotifications() {
    const c = content();
    c.innerHTML = pageHeader("Notifications", "Your updates", true) + `<div id="notifList">${UI.skeletonList(3)}</div>`;
    bindBack();
    let items = App._notifs;
    if (!items) items = await DB.list("notifications", { where:[["userId","==",App.user.id]], orderBy:["createdAt","desc"], limit:30 }).catch(()=>[]);
    $("#notifList").innerHTML = items.length ? `<div class="space-y-2">${items.map((n)=>`
      <div class="glass rounded-2xl p-3.5 ${n.read?"":"ring-1 ring-violet-500/30"}">
        <div class="flex items-center gap-2"><span>${({success:"✅",error:"⚠️",info:"ℹ️"})[n.kind]||"🔔"}</span>
        <p class="font-semibold text-sm flex-1">${UI.escapeHtml(n.title)}</p>
        <span class="text-[10px] text-soft">${UI.timeAgo(n.createdAt)}</span></div>
        ${n.body?`<p class="text-soft text-xs mt-1">${UI.escapeHtml(n.body)}</p>`:""}</div>`).join("")}</div>` : UI.emptyState("No notifications yet.", "🔔");
    // mark read
    if (App.user.id !== "preview") {
      (items||[]).filter((n)=>!n.read).forEach((n)=>DB.updateDoc("notifications", n.id, { read: true }).catch(()=>{}));
    }
  }

  /* ---------------- PROFILE ---------------- */
  function renderProfile() {
    const u = App.user, c = content();
    c.innerHTML = `<div class="view">
      <div class="glass-strong rounded-3xl p-6 text-center mb-4 relative overflow-hidden">
        <div class="absolute -top-10 -right-10 w-40 h-40 brand-grad opacity-20 blur-3xl rounded-full"></div>
        ${u.photoUrl?`<img src="${UI.escapeHtml(u.photoUrl)}" class="w-20 h-20 rounded-2xl mx-auto object-cover" />`:`<div class="w-20 h-20 rounded-2xl brand-grad grid place-items-center text-white text-2xl font-extrabold mx-auto">${(u.firstName||"U").charAt(0).toUpperCase()}</div>`}
        <p class="font-extrabold text-lg mt-3">${UI.escapeHtml((u.firstName||"")+" "+(u.lastName||""))}</p>
        <p class="text-soft text-sm">@${UI.escapeHtml(u.username||"user")}</p>
        <div class="flex items-center justify-center gap-2 mt-2">
          ${u.activated?`<span class="badge-premium text-[11px] font-bold px-3 py-1 rounded-full">★ PREMIUM</span>`:`<span class="chip status-pending text-[11px] font-semibold px-3 py-1 rounded-full">Not Activated</span>`}
          <span class="chip text-[11px] px-3 py-1 rounded-full font-semibold ${u.status==="active"?"status-approved":"status-rejected"}">${UI.escapeHtml((u.status||"active").toUpperCase())}</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        ${statCard("💰","Total Earnings",UI.money(u.totalEarnings))}
        ${statCard("📥","Total Deposits",UI.money(u.totalDeposit))}
        ${statCard("📤","Total Withdraw",UI.money(u.totalWithdraw))}
        ${statCard("👥","Total Referrals",UI.num(u.referralCount))}
      </div>
      <div class="glass rounded-2xl divide-y divide-white/5 mb-4">
        ${profRow("🆔","Telegram ID",String(u.id))}
        ${profRow("📅","Joined",UI.shortDate(u.joinedAt))}
        ${profRow("💎","Premium TG",u.isPremium?"Yes":"No")}
      </div>
      <div class="grid grid-cols-3 gap-3">
        ${quick("🎁","Referral","referral")}${quick("🧾","History","history")}${quick("📢","Notices","notices")}
        ${quick("🎟️","Promo","promo")}${quick("🏆","Ranks","leaderboard")}${quick("🛒","Market","marketplace")}
      </div>
      <button id="themeToggle2" class="chip rounded-2xl w-full py-3 mt-4 font-semibold">🌓 Toggle Theme</button>
    </div>`;
    c.querySelectorAll("[data-go]").forEach((b)=>b.addEventListener("click",()=>go(b.getAttribute("data-go"))));
    $("#themeToggle2").addEventListener("click", ()=>{ const t=UI.toggleTheme(); $("#btnTheme").textContent=t==="dark"?"🌙":"☀️"; });
  }
  function profRow(icon, label, val) {
    return `<div class="flex items-center gap-3 px-4 py-3"><span>${icon}</span>
      <span class="text-sm text-soft flex-1">${label}</span>
      <span class="text-sm font-semibold">${UI.escapeHtml(val)}</span></div>`;
  }

  /* ---------------- helpers ---------------- */
  function requireActivated() {
    if (App.user && App.user.activated) return true;
    if (App.settings.activationEnabled === false) return true;
    UI.toast("Activate your account first.", "warn");
    go("activation");
    return false;
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
