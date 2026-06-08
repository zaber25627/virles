/* ============================================================
 *  ADMIN PANEL — Premium Telegram Mini App
 * ============================================================ */
(function () {
  "use strict";

  const Admin = { settings: {}, route: "dashboard", unsubs: [] };
  window.Admin = Admin;
  const $ = (s, r) => (r || document).querySelector(s);
  const content = () => document.getElementById("adminContent");

  const NAV = [
    ["dashboard", "📊", "Dashboard"],
    ["users", "👥", "User Management"],
    ["activation", "🚀", "Activation"],
    ["deposits", "📥", "Deposits"],
    ["withdrawals", "📤", "Withdrawals"],
    ["referral", "🎁", "Referral"],
    ["tasks", "🎯", "Tasks"],
    ["ads", "📺", "Ads"],
    ["marketplace", "🛒", "Marketplace"],
    ["promo", "🎟️", "Promo Codes"],
    ["notices", "📢", "Notices"],
    ["currency", "💱", "Currency"],
    ["bot", "🤖", "Bot Settings"],
    ["logs", "🧾", "Activity Logs"]
  ];

  /* ---------------- BOOT / ACCESS ---------------- */
  async function boot() {
    UI.applyTheme();
    UI.initTelegram();
    await DB.ensureAuth().catch(() => {});

    Admin.settings = Object.assign({}, UI.state.settings, await DB.getSettings().catch(() => ({})));
    UI.state.settings.currencySymbol = Admin.settings.currencySymbol || UI.state.settings.currencySymbol;

    const tg = UI.telegramUser();
    const adminIds = (window.ADMIN_IDS || []).map(String);
    let allowed = false;
    let previewMode = false;

    if (!window.FB || !window.FB.configured) { allowed = true; previewMode = true; }
    else if (tg && adminIds.includes(String(tg.id))) allowed = true;
    else if (tg) {
      const a = await DB.getDoc("admins", String(tg.id)).catch(() => null);
      if (a) allowed = true;
    } else if (adminIds.length === 0) { allowed = true; previewMode = true; }

    document.getElementById("loader").classList.add("hide");
    if (!allowed) {
      $("#denied").classList.remove("hide");
      $("#myId").textContent = tg ? `Your Telegram ID: ${tg.id}` : "Open this panel from inside Telegram.";
      return;
    }
    Admin.previewMode = previewMode;
    Admin.adminId = tg ? String(tg.id) : "admin";

    document.getElementById("admin").classList.remove("hide");
    applyBranding();
    buildNav();
    wireChrome();
    go("dashboard");
  }

  function applyBranding() {
    const logo = (Admin.settings.logoText || "PM").slice(0,2).toUpperCase();
    ["loaderLogo","sideLogo"].forEach((id)=>{ const n=document.getElementById(id); if(n) n.textContent=logo; });
    $("#sideName").textContent = Admin.settings.appName || "Premium";
  }

  function buildNav() {
    $("#navList").innerHTML = NAV.map(([k,i,l])=>`
      <button data-r="${k}" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left font-medium text-soft hover:text-[var(--text)]">
        <span class="text-base">${i}</span><span>${l}</span></button>`).join("");
    $("#navList").querySelectorAll("[data-r]").forEach((b)=>b.addEventListener("click",()=>{ go(b.getAttribute("data-r")); closeSidebar(); }));
  }
  function wireChrome() {
    $("#adminTheme").addEventListener("click", ()=>{ const t=UI.toggleTheme(); $("#adminTheme").textContent=t==="dark"?"🌙":"☀️"; });
    $("#adminTheme").textContent = document.documentElement.classList.contains("dark")?"🌙":"☀️";
    $("#menuBtn").addEventListener("click", ()=>{ const s=$("#sidebar"); s.classList.toggle("hidden"); });
  }
  function closeSidebar() { if (window.innerWidth < 768) $("#sidebar").classList.add("hidden"); }

  const ROUTES = {
    dashboard: rDashboard, users: rUsers, activation: rActivation, deposits: rDeposits,
    withdrawals: rWithdrawals, referral: rReferral, tasks: rTasks, ads: rAds,
    marketplace: rMarketplace, promo: rPromo, notices: rNotices, currency: rCurrency,
    bot: rBot, logs: rLogs
  };
  function go(r) {
    Admin.route = r;
    const meta = NAV.find((x)=>x[0]===r);
    $("#pageTitle").textContent = meta ? meta[2] : "Admin";
    document.querySelectorAll(".nav-item").forEach((b)=>{
      const active = b.getAttribute("data-r")===r;
      b.classList.toggle("glass-strong", active);
      b.classList.toggle("text-[var(--text)]", active);
    });
    content().scrollTop = 0;
    (ROUTES[r]||rDashboard)();
  }

  /* ---------------- shared bits ---------------- */
  function previewBadge() {
    return Admin.previewMode ? `<div class="glass-strong rounded-2xl px-4 py-2.5 text-xs status-pending mb-4">⚙️ Preview mode — configure Firebase in firebase-config.js to load live data.</div>` : "";
  }
  function statBig(icon, label, val, grad) {
    return `<div class="glass rounded-2xl p-4 card-hover">
      <div class="w-10 h-10 rounded-xl ${grad||"brand-grad"} grid place-items-center text-white text-lg mb-2">${icon}</div>
      <p class="text-soft text-xs">${label}</p><p class="text-2xl font-extrabold mt-0.5">${val}</p></div>`;
  }
  function section(title, body) {
    return `<div class="glass rounded-2xl p-4 mb-4"><h3 class="font-bold mb-3">${UI.escapeHtml(title)}</h3>${body}</div>`;
  }
  function field(label, id, type, value, ph) {
    if (type === "checkbox") {
      return `<label class="flex items-center justify-between gap-3 py-2"><span class="text-sm">${label}</span>
        <input id="${id}" type="checkbox" ${value?"checked":""} class="w-5 h-5 accent-violet-600" /></label>`;
    }
    return `<label class="block mb-3"><span class="text-xs text-soft">${label}</span>
      <input id="${id}" type="${type||"text"}" value="${value!=null?UI.escapeHtml(String(value)):""}" placeholder="${ph||""}" class="w-full rounded-xl px-3 py-2.5 mt-1" /></label>`;
  }
  function saveBtn(id, label) {
    return `<button id="${id}" class="btn-primary rounded-xl px-5 py-2.5 font-semibold text-sm">${label||"Save Changes"}</button>`;
  }
  async function saveSettings(patch, msg) {
    try { await DB.saveSettings(patch); Admin.settings = Object.assign(Admin.settings, patch);
      UI.state.settings.currencySymbol = Admin.settings.currencySymbol || UI.state.settings.currencySymbol;
      UI.toast(msg||"Settings saved!", "success"); }
    catch(e){ console.error(e); UI.toast("Save failed.", "error"); }
  }

  /* ---------------- DASHBOARD ---------------- */
  async function rDashboard() {
    const c = content();
    c.innerHTML = previewBadge() + `<div id="statGrid" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">${UI.skeletonList(0)}</div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="glass rounded-2xl p-4"><h3 class="font-bold mb-3">Pending Deposits</h3><div id="pendDep">${UI.skeletonList(2)}</div></div>
        <div class="glass rounded-2xl p-4"><h3 class="font-bold mb-3">Pending Withdrawals</h3><div id="pendW">${UI.skeletonList(2)}</div></div>
      </div>`;
    const [users, deposits, withdrawals, tx, ads] = await Promise.all([
      DB.list("users", { limit: 1000 }).catch(()=>[]),
      DB.list("deposits", { limit: 1000 }).catch(()=>[]),
      DB.list("withdrawals", { limit: 1000 }).catch(()=>[]),
      DB.list("transactions", { limit: 1000 }).catch(()=>[]),
      DB.list("transactions", { where:[["type","==","ad"]], limit:1000 }).catch(()=>[])
    ]);
    const sum = (arr, f, st) => arr.filter((x)=>!st||x.status===st).reduce((a,b)=>a+Number(b[f]||0),0);
    const totalDep = sum(deposits, "amount", "approved");
    const totalW = sum(withdrawals, "amount", "approved");
    $("#statGrid").innerHTML = [
      statBig("👥","Total Users",UI.num(users.length)),
      statBig("🟢","Active Users",UI.num(users.filter(u=>u.status==="active").length),"bg-emerald-500"),
      statBig("★","Premium Users",UI.num(users.filter(u=>u.activated).length),"badge-premium"),
      statBig("📥","Total Deposits",UI.money(totalDep)),
      statBig("📤","Total Withdrawals",UI.money(totalW)),
      statBig("💰","Net Revenue",UI.money(totalDep-totalW),"bg-blue-500"),
      statBig("🎯","Tasks Done",UI.num(tx.filter(t=>t.type==="task").length),"bg-fuchsia-500"),
      statBig("📺","Ad Views",UI.num(ads.length),"bg-cyan-500")
    ].join("");
    const pd = deposits.filter(d=>d.status==="pending").slice(0,5);
    $("#pendDep").innerHTML = pd.length ? pd.map(d=>miniReq(d,"deposits")).join("") : UI.emptyState("No pending deposits.","📥");
    const pw = withdrawals.filter(w=>w.status==="pending").slice(0,5);
    $("#pendW").innerHTML = pw.length ? pw.map(w=>miniReq(w,"withdrawals")).join("") : UI.emptyState("No pending withdrawals.","📤");
    c.querySelectorAll("[data-approve],[data-reject]").forEach(wireApproval);
  }
  function miniReq(r, col) {
    return `<div class="chip rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold">${UI.money(r.amount)} <span class="text-[11px] text-soft">@${UI.escapeHtml(r.username||r.userId)}</span></p>
      <p class="text-[10px] text-soft">${UI.escapeHtml(r.method||"")} · ${UI.timeAgo(r.createdAt)}</p></div>
      <button data-approve="${col}:${r.id}" class="status-approved rounded-lg px-2 py-1 text-xs font-semibold">✓</button>
      <button data-reject="${col}:${r.id}" class="status-rejected rounded-lg px-2 py-1 text-xs font-semibold">✕</button></div>`;
  }

  /* approval engine for deposits/withdrawals/activation/listings */
  function wireApproval(btn) {
    const approve = btn.hasAttribute("data-approve");
    const [col, id] = (btn.getAttribute(approve?"data-approve":"data-reject")||"").split(":");
    btn.addEventListener("click", async () => {
      try {
        const doc = await DB.getDoc(col, id);
        if (!doc) { UI.toast("Record not found.", "error"); return; }
        const status = approve ? "approved" : "rejected";
        await DB.updateDoc(col, id, { status, reviewedAt: DB.now(), reviewedBy: Admin.adminId });
        if (approve) await applyApprovalEffect(col, doc);
        else if (col === "withdrawals") await DB.adjustBalance(doc.userId, "mainBalance", Number(doc.amount||0)); // refund
        await DB.notify(doc.userId, `${col.replace(/s$/,"")} ${status}`, `Your request of ${UI.money(doc.amount||doc.fee||0)} was ${status}.`, approve?"success":"error").catch(()=>{});
        await DB.log(Admin.adminId, `${status}_${col}`, `${doc.userId} · ${doc.amount||doc.fee||""}`).catch(()=>{});
        UI.toast(`Marked ${status}.`, approve?"success":"info");
        go(Admin.route);
      } catch(e){ console.error(e); UI.toast("Action failed.", "error"); }
    });
  }
  async function applyApprovalEffect(col, doc) {
    if (col === "deposits") {
      await DB.adjustBalance(doc.userId, "depositBalance", Number(doc.amount||0));
      await DB.adjustBalance(doc.userId, "totalDeposit", Number(doc.amount||0));
      await DB.tx(doc.userId, "deposit", doc.amount, { method: doc.method });
    } else if (col === "withdrawals") {
      await DB.adjustBalance(doc.userId, "totalWithdraw", Number(doc.amount||0));
    } else if (col === "activationRequests") {
      await DB.updateDoc("users", doc.userId, { activated: true, isPremium: true });
      const reward = Number(Admin.settings.referralReward||0);
      const u = await DB.getDoc("users", doc.userId);
      if (u && u.referredBy && reward) {
        await DB.adjustBalance(u.referredBy, "referralBalance", reward);
        await DB.adjustBalance(u.referredBy, "mainBalance", reward);
        await DB.updateDoc("users", u.referredBy, { referralCount: DB.inc(1) });
        await DB.tx(u.referredBy, "referral", reward, { from: doc.userId });
        await DB.notify(u.referredBy, "Referral reward", `You earned ${UI.money(reward)} from a referral!`, "success").catch(()=>{});
      }
    } else if (col === "marketplaceListings") { /* already set approved */ }
  }

  /* ---------------- USERS ---------------- */
  async function rUsers() {
    const c = content();
    c.innerHTML = previewBadge() + `
      <div class="glass rounded-2xl p-3 mb-4 flex gap-2">
        <input id="userSearch" placeholder="Search by name, username or ID…" class="flex-1 rounded-xl px-3 py-2.5 text-sm" />
      </div>
      <div id="userList">${UI.skeletonList(5)}</div>`;
    const all = await DB.list("users", { orderBy:["joinedAt","desc"], limit: 500 }).catch(()=>[]);
    const render = (rows) => {
      $("#userList").innerHTML = rows.length ? rows.map(userCard).join("") : UI.emptyState("No users found.","👥");
      $("#userList").querySelectorAll("[data-user]").forEach((b)=>b.addEventListener("click",()=>openUser(all.find(u=>u.id===b.getAttribute("data-user")))));
    };
    render(all);
    $("#userSearch").addEventListener("input", (e)=>{
      const q = e.target.value.toLowerCase().trim();
      render(all.filter(u=>[u.firstName,u.lastName,u.username,u.id].join(" ").toLowerCase().includes(q)));
    });
  }
  function userCard(u) {
    return `<div data-user="${u.id}" class="glass rounded-2xl p-3 mb-2 flex items-center gap-3 card-hover cursor-pointer">
      ${u.photoUrl?`<img src="${UI.escapeHtml(u.photoUrl)}" class="w-10 h-10 rounded-xl object-cover" />`:`<div class="w-10 h-10 rounded-xl chip grid place-items-center">👤</div>`}
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">${UI.escapeHtml((u.firstName||"")+" "+(u.lastName||""))} ${u.activated?'<span class="badge-premium text-[9px] px-1.5 py-0.5 rounded-full">★</span>':""}</p>
      <p class="text-[11px] text-soft">@${UI.escapeHtml(u.username||"-")} · ID ${UI.escapeHtml(String(u.id))}</p></div>
      <div class="text-right"><p class="text-sm font-bold">${UI.money(u.mainBalance)}</p>
      <span class="text-[10px] font-semibold ${u.status==="active"?"text-emerald-400":"text-rose-400"}">${UI.escapeHtml(u.status||"active")}</span></div></div>`;
  }
  function openUser(u) {
    if (!u) return;
    const mod = UI.modal(`@${u.username||u.id}`, `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2 text-center">
          <div class="chip rounded-xl p-2"><p class="text-[10px] text-soft">Main</p><p class="font-bold text-sm">${UI.money(u.mainBalance)}</p></div>
          <div class="chip rounded-xl p-2"><p class="text-[10px] text-soft">Referrals</p><p class="font-bold text-sm">${UI.num(u.referralCount)}</p></div>
        </div>
        ${field("Set Main Balance","euBal","number",u.mainBalance)}
        ${field("Set Referral Count","euRef","number",u.referralCount)}
        <div class="flex flex-wrap gap-2">
          <button data-act="activate" class="status-approved rounded-xl px-3 py-2 text-xs font-semibold">${u.activated?"Deactivate":"Activate"}</button>
          <button data-act="ban" class="status-rejected rounded-xl px-3 py-2 text-xs font-semibold">${u.status==="banned"?"Unban":"Ban"}</button>
          <button data-act="suspend" class="status-pending rounded-xl px-3 py-2 text-xs font-semibold">${u.status==="suspended"?"Unsuspend":"Suspend"}</button>
        </div>
        <button id="euSave" class="btn-primary rounded-xl w-full py-2.5 font-semibold">Save Balance & Referrals</button>
      </div>`);
    $("#euSave", mod.el).addEventListener("click", async () => {
      try {
        await DB.updateDoc("users", u.id, { mainBalance: Number($("#euBal",mod.el).value||0), referralCount: Number($("#euRef",mod.el).value||0) });
        await DB.log(Admin.adminId, "edit_user", u.id);
        UI.toast("User updated.", "success"); mod.close(); rUsers();
      } catch(e){ UI.toast("Update failed.", "error"); }
    });
    mod.el.querySelectorAll("[data-act]").forEach((b)=>b.addEventListener("click", async ()=>{
      const act = b.getAttribute("data-act");
      try {
        if (act==="activate") await DB.updateDoc("users", u.id, { activated: !u.activated, isPremium: !u.activated });
        if (act==="ban") await DB.updateDoc("users", u.id, { status: u.status==="banned"?"active":"banned" });
        if (act==="suspend") await DB.updateDoc("users", u.id, { status: u.status==="suspended"?"active":"suspended" });
        await DB.log(Admin.adminId, act+"_user", u.id);
        UI.toast("Done.", "success"); mod.close(); rUsers();
      } catch(e){ UI.toast("Action failed.", "error"); }
    }));
  }

  /* ---------------- ACTIVATION ---------------- */
  async function rActivation() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() +
      section("Activation Settings", `
        ${field("Enable Activation","actEnabled","checkbox", s.activationEnabled!==false)}
        ${field("Activation Fee","actFee","number", s.activationFee||0)}
        ${saveBtn("actSave")}`) +
      section("Pending Activation Requests", `<div id="actReqs">${UI.skeletonList(2)}</div>`);
    $("#actSave").addEventListener("click", ()=>saveSettings({ activationEnabled: $("#actEnabled").checked, activationFee: Number($("#actFee").value||0) }));
    const reqs = await DB.list("activationRequests", { where:[["status","==","pending"]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#actReqs").innerHTML = reqs.length ? reqs.map(r=>`<div class="chip rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
      <div class="flex-1"><p class="text-sm font-semibold">@${UI.escapeHtml(r.username||r.userId)}</p><p class="text-[10px] text-soft">${UI.money(r.fee)} · ${UI.timeAgo(r.createdAt)}</p></div>
      <button data-approve="activationRequests:${r.id}" class="status-approved rounded-lg px-2 py-1 text-xs font-semibold">Approve</button>
      <button data-reject="activationRequests:${r.id}" class="status-rejected rounded-lg px-2 py-1 text-xs font-semibold">Reject</button></div>`).join("") : UI.emptyState("No pending requests.","🚀");
    c.querySelectorAll("[data-approve],[data-reject]").forEach(wireApproval);
  }

  /* ---------------- DEPOSITS ---------------- */
  async function rDeposits() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() +
      section("Deposit Settings", `
        <div class="grid grid-cols-2 gap-3">${field("Min Deposit","minDep","number",s.minDeposit||0)}${field("Max Deposit","maxDep","number",s.maxDeposit||0)}</div>
        ${field("Global Deposit Instructions","depInstr","text",s.depositInstructions||"","Shown on deposit page")}
        ${saveBtn("depSave")}`) +
      section("Deposit Methods", `<div id="depMethods" class="mb-3">${UI.skeletonList(2)}</div>
        <button id="addDepMethod" class="chip rounded-xl px-4 py-2 text-sm font-semibold">＋ Add Method</button>`) +
      section("Pending Deposits", `<div id="depPending">${UI.skeletonList(2)}</div>`);
    $("#depSave").addEventListener("click", ()=>saveSettings({ minDeposit:Number($("#minDep").value||0), maxDeposit:Number($("#maxDep").value||0), depositInstructions:$("#depInstr").value }));
    $("#addDepMethod").addEventListener("click", ()=>methodForm("settings_depositMethods"));
    await loadMethods("settings_depositMethods", "depMethods");
    const pend = await DB.list("deposits", { where:[["status","==","pending"]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#depPending").innerHTML = pend.length ? pend.map(d=>reqFull(d,"deposits")).join("") : UI.emptyState("No pending deposits.","📥");
    c.querySelectorAll("[data-approve],[data-reject]").forEach(wireApproval);
    c.querySelectorAll("[data-shot]").forEach((b)=>b.addEventListener("click",()=>UI.modal("Screenshot",`<img src="${b.getAttribute("data-shot")}" class="rounded-xl w-full" />`)));
  }
  function reqFull(r, col) {
    return `<div class="chip rounded-xl px-3 py-2.5 mb-2">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0"><p class="text-sm font-semibold">${UI.money(r.amount)} <span class="text-[11px] text-soft">@${UI.escapeHtml(r.username||r.userId)}</span></p>
        <p class="text-[10px] text-soft">${UI.escapeHtml(r.method||r.account||"")} ${r.txnId?("· "+UI.escapeHtml(r.txnId)):""} · ${UI.timeAgo(r.createdAt)}</p></div>
        ${r.screenshot?`<button data-shot="${UI.escapeHtml(r.screenshot)}" class="chip rounded-lg px-2 py-1 text-xs">🖼️</button>`:""}
        <button data-approve="${col}:${r.id}" class="status-approved rounded-lg px-2 py-1 text-xs font-semibold">✓</button>
        <button data-reject="${col}:${r.id}" class="status-rejected rounded-lg px-2 py-1 text-xs font-semibold">✕</button>
      </div></div>`;
  }
  async function loadMethods(col, hostId) {
    const host = $("#"+hostId);
    const methods = await DB.list(col, { orderBy:["createdAt","asc"] }).catch(()=>[]);
    host.innerHTML = methods.length ? methods.map(m=>`<div class="chip rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
      <span>${m.icon||"💳"}</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold">${UI.escapeHtml(m.name)}</p><p class="text-[10px] text-soft truncate">${UI.escapeHtml(m.account||"")}</p></div>
      <button data-edit="${m.id}" class="chip rounded-lg px-2 py-1 text-xs">✏️</button>
      <button data-del="${m.id}" class="status-rejected rounded-lg px-2 py-1 text-xs">🗑️</button></div>`).join("") : UI.emptyState("No methods.","💳");
    host.querySelectorAll("[data-edit]").forEach((b)=>b.addEventListener("click",()=>methodForm(col, methods.find(m=>m.id===b.getAttribute("data-edit")))));
    host.querySelectorAll("[data-del]").forEach((b)=>b.addEventListener("click",()=>UI.confirm("Delete this method?", async ()=>{ await DB.deleteDoc(col,b.getAttribute("data-del")); UI.toast("Deleted.","info"); go(Admin.route); })));
  }
  function methodForm(col, m) {
    m = m || {};
    const mod = UI.modal((m.id?"Edit":"Add")+" Method", `
      <div class="space-y-3">
        ${field("Name","mName","text",m.name,"e.g. bKash / USDT")}
        ${field("Icon (emoji)","mIcon","text",m.icon||"💳")}
        ${field("Account / Address","mAcc","text",m.account)}
        ${field("Instructions","mInstr","text",m.instructions)}
        <button id="mSave" class="btn-primary rounded-xl w-full py-2.5 font-semibold">Save Method</button>
      </div>`);
    $("#mSave", mod.el).addEventListener("click", async () => {
      const data = { name:$("#mName",mod.el).value.trim(), icon:$("#mIcon",mod.el).value.trim()||"💳", account:$("#mAcc",mod.el).value.trim(), instructions:$("#mInstr",mod.el).value.trim() };
      if (!data.name) return UI.toast("Name required.","warn");
      try { if (m.id) await DB.updateDoc(col,m.id,data); else await DB.addDoc(col,data);
        UI.toast("Saved.","success"); mod.close(); go(Admin.route); }
      catch(e){ UI.toast("Save failed.","error"); }
    });
  }

  /* ---------------- WITHDRAWALS ---------------- */
  async function rWithdrawals() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() +
      section("Withdraw Settings", `
        ${field("Enable Withdrawals","wEnabled","checkbox", s.withdrawEnabled!==false)}
        <div class="grid grid-cols-2 gap-3">${field("Min Withdraw","minW","number",s.minWithdraw||0)}${field("Max Withdraw","maxW","number",s.maxWithdraw||0)}</div>
        <div class="grid grid-cols-2 gap-3">${field("Withdraw Fee %","wFee","number",s.withdrawFee||0)}${field("VAT %","vat","number",s.vat||0)}</div>
        ${saveBtn("wSave")}`) +
      section("Withdraw Methods", `<div id="wMethods" class="mb-3">${UI.skeletonList(2)}</div>
        <button id="addWMethod" class="chip rounded-xl px-4 py-2 text-sm font-semibold">＋ Add Method</button>`) +
      section("Pending Withdrawals", `<div id="wPending">${UI.skeletonList(2)}</div>`);
    $("#wSave").addEventListener("click", ()=>saveSettings({ withdrawEnabled:$("#wEnabled").checked, minWithdraw:Number($("#minW").value||0), maxWithdraw:Number($("#maxW").value||0), withdrawFee:Number($("#wFee").value||0), vat:Number($("#vat").value||0) }));
    $("#addWMethod").addEventListener("click", ()=>methodForm("settings_withdrawMethods"));
    await loadMethods("settings_withdrawMethods", "wMethods");
    const pend = await DB.list("withdrawals", { where:[["status","==","pending"]], orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#wPending").innerHTML = pend.length ? pend.map(w=>reqFull(w,"withdrawals")).join("") : UI.emptyState("No pending withdrawals.","📤");
    c.querySelectorAll("[data-approve],[data-reject]").forEach(wireApproval);
  }

  /* ---------------- REFERRAL ---------------- */
  function rReferral() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() + section("Referral Settings", `
      ${field("Enable Referral System","refEnabled","checkbox", s.referralEnabled!==false)}
      ${field("Referral Reward (per activated invite)","refReward","number",s.referralReward||0)}
      ${field("Required Referrals For Withdraw","reqRef","number",s.requiredReferrals||0)}
      ${field("Bot Username (for links, no @)","botUser","text",s.botUsername||"","YourBot")}
      ${saveBtn("refSave")}`);
    $("#refSave").addEventListener("click", ()=>saveSettings({ referralEnabled:$("#refEnabled").checked, referralReward:Number($("#refReward").value||0), requiredReferrals:Number($("#reqRef").value||0), botUsername:$("#botUser").value.trim().replace(/^@/,"") }));
  }

  /* ---------------- TASKS ---------------- */
  async function rTasks() {
    const c = content();
    c.innerHTML = previewBadge() + `<button id="addTask" class="btn-primary rounded-xl px-5 py-2.5 font-semibold text-sm mb-4">＋ Add Task</button><div id="taskList">${UI.skeletonList(3)}</div>`;
    $("#addTask").addEventListener("click", ()=>taskForm());
    const tasks = await DB.list("tasks", { orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#taskList").innerHTML = tasks.length ? tasks.map(t=>`<div class="glass rounded-2xl p-3 mb-2 flex items-center gap-3">
      <span class="text-xl">${t.icon||"🎯"}</span>
      <div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">${UI.escapeHtml(t.title)}</p><p class="text-[11px] text-soft">+${UI.money(t.reward)} · ${t.active?"Active":"Disabled"}</p></div>
      <button data-edit="${t.id}" class="chip rounded-lg px-2 py-1 text-xs">✏️</button>
      <button data-del="${t.id}" class="status-rejected rounded-lg px-2 py-1 text-xs">🗑️</button></div>`).join("") : UI.emptyState("No tasks yet.","🎯");
    $("#taskList").querySelectorAll("[data-edit]").forEach((b)=>b.addEventListener("click",()=>taskForm(tasks.find(t=>t.id===b.getAttribute("data-edit")))));
    $("#taskList").querySelectorAll("[data-del]").forEach((b)=>b.addEventListener("click",()=>UI.confirm("Delete task?", async ()=>{ await DB.deleteDoc("tasks",b.getAttribute("data-del")); UI.toast("Deleted.","info"); rTasks(); })));
  }
  function taskForm(t) {
    t = t || {};
    const mod = UI.modal((t.id?"Edit":"Add")+" Task", `
      <div class="space-y-3">
        ${field("Title","tTitle","text",t.title)}
        ${field("Description","tDesc","text",t.description)}
        ${field("Icon (emoji)","tIcon","text",t.icon||"🎯")}
        ${field("Reward","tReward","number",t.reward||0)}
        ${field("Link (optional)","tUrl","text",t.url)}
        ${field("Active","tActive","checkbox", t.active!==false)}
        <button id="tSave" class="btn-primary rounded-xl w-full py-2.5 font-semibold">Save Task</button>
      </div>`);
    $("#tSave", mod.el).addEventListener("click", async ()=>{
      const data = { title:$("#tTitle",mod.el).value.trim(), description:$("#tDesc",mod.el).value.trim(), icon:$("#tIcon",mod.el).value.trim()||"🎯", reward:Number($("#tReward",mod.el).value||0), url:$("#tUrl",mod.el).value.trim(), active:$("#tActive",mod.el).checked };
      if (!data.title) return UI.toast("Title required.","warn");
      try { if (t.id) await DB.updateDoc("tasks",t.id,data); else await DB.addDoc("tasks",data); UI.toast("Saved.","success"); mod.close(); rTasks(); }
      catch(e){ UI.toast("Save failed.","error"); }
    });
  }

  /* ---------------- ADS ---------------- */
  function rAds() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() + section("Ads Settings", `
      ${field("Enable Ads","adsEnabled","checkbox", s.adsEnabled!==false)}
      <div class="grid grid-cols-2 gap-3">${field("Reward Per Ad","adReward","number",s.adReward||0)}${field("Daily Ad Limit","adLimit","number",s.adDailyLimit||0)}</div>
      ${field("Rewarded Ad Unit ID","adRewardId","text",s.adRewardedId)}
      ${field("Interstitial Ad Unit ID","adInterId","text",s.adInterstitialId)}
      ${field("Banner Ad Unit ID","adBannerId","text",s.adBannerId)}
      ${saveBtn("adsSave")}`);
    $("#adsSave").addEventListener("click", ()=>saveSettings({ adsEnabled:$("#adsEnabled").checked, adReward:Number($("#adReward").value||0), adDailyLimit:Number($("#adLimit").value||0), adRewardedId:$("#adRewardId").value.trim(), adInterstitialId:$("#adInterId").value.trim(), adBannerId:$("#adBannerId").value.trim() }));
  }

  /* ---------------- MARKETPLACE ---------------- */
  async function rMarketplace() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() +
      section("Marketplace Settings", `${field("Enable Marketplace","mktEnabled","checkbox", s.marketplaceEnabled!==false)}${saveBtn("mktSave")}`) +
      section("Pending Listings", `<div id="mktPending">${UI.skeletonList(2)}</div>`) +
      section("All Listings", `<div id="mktAll">${UI.skeletonList(2)}</div>`);
    $("#mktSave").addEventListener("click", ()=>saveSettings({ marketplaceEnabled:$("#mktEnabled").checked }));
    const all = await DB.list("marketplaceListings", { orderBy:["createdAt","desc"] }).catch(()=>[]);
    const pend = all.filter(i=>i.status==="pending");
    $("#mktPending").innerHTML = pend.length ? pend.map(i=>`<div class="chip rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${UI.escapeHtml(i.title)}</p><p class="text-[10px] text-soft">${UI.money(i.price)} · @${UI.escapeHtml(i.sellerName||i.sellerId)}</p></div>
      <button data-approve="marketplaceListings:${i.id}" class="status-approved rounded-lg px-2 py-1 text-xs font-semibold">✓</button>
      <button data-reject="marketplaceListings:${i.id}" class="status-rejected rounded-lg px-2 py-1 text-xs font-semibold">✕</button></div>`).join("") : UI.emptyState("No pending listings.","🛒");
    $("#mktAll").innerHTML = all.length ? all.map(i=>`<div class="chip rounded-xl px-3 py-2 flex items-center gap-2 mb-2">
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${UI.escapeHtml(i.title)} ${i.featured?"★":""}</p><p class="text-[10px] text-soft">${UI.money(i.price)} · ${UI.escapeHtml(i.status)}</p></div>
      <button data-feat="${i.id}" class="chip rounded-lg px-2 py-1 text-xs">${i.featured?"Unfeature":"Feature"}</button>
      <button data-deli="${i.id}" class="status-rejected rounded-lg px-2 py-1 text-xs">🗑️</button></div>`).join("") : UI.emptyState("No listings.","🛒");
    c.querySelectorAll("[data-approve],[data-reject]").forEach(wireApproval);
    c.querySelectorAll("[data-feat]").forEach((b)=>b.addEventListener("click", async ()=>{ const i=all.find(x=>x.id===b.getAttribute("data-feat")); await DB.updateDoc("marketplaceListings",i.id,{featured:!i.featured}); UI.toast("Updated.","success"); rMarketplace(); }));
    c.querySelectorAll("[data-deli]").forEach((b)=>b.addEventListener("click", ()=>UI.confirm("Delete listing?", async ()=>{ await DB.deleteDoc("marketplaceListings",b.getAttribute("data-deli")); UI.toast("Deleted.","info"); rMarketplace(); })));
  }

  /* ---------------- PROMO ---------------- */
  async function rPromo() {
    const c = content();
    c.innerHTML = previewBadge() + `<button id="addPromo" class="btn-primary rounded-xl px-5 py-2.5 font-semibold text-sm mb-4">＋ Create Promo</button><div id="promoList">${UI.skeletonList(3)}</div>`;
    $("#addPromo").addEventListener("click", ()=>promoForm());
    const codes = await DB.list("promoCodes", { orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#promoList").innerHTML = codes.length ? codes.map(p=>`<div class="glass rounded-2xl p-3 mb-2 flex items-center gap-3">
      <div class="flex-1 min-w-0"><p class="font-bold text-sm tracking-wider">${UI.escapeHtml(p.code)}</p>
      <p class="text-[11px] text-soft">+${UI.money(p.reward)} · used ${UI.num(p.usedCount||0)}/${p.usageLimit||"∞"} · ${p.active===false?"Disabled":"Active"}</p></div>
      <button data-edit="${p.id}" class="chip rounded-lg px-2 py-1 text-xs">✏️</button>
      <button data-del="${p.id}" class="status-rejected rounded-lg px-2 py-1 text-xs">🗑️</button></div>`).join("") : UI.emptyState("No promo codes.","🎟️");
    $("#promoList").querySelectorAll("[data-edit]").forEach((b)=>b.addEventListener("click",()=>promoForm(codes.find(p=>p.id===b.getAttribute("data-edit")))));
    $("#promoList").querySelectorAll("[data-del]").forEach((b)=>b.addEventListener("click",()=>UI.confirm("Delete code?", async ()=>{ await DB.deleteDoc("promoCodes",b.getAttribute("data-del")); UI.toast("Deleted.","info"); rPromo(); })));
  }
  function promoForm(p) {
    p = p || {};
    const exp = p.expiresAt ? (UI.tsToDate(p.expiresAt)||"") : "";
    const expStr = exp ? new Date(exp).toISOString().slice(0,10) : "";
    const mod = UI.modal((p.id?"Edit":"Create")+" Promo", `
      <div class="space-y-3">
        ${field("Code","pCode","text",p.code,"WELCOME50")}
        ${field("Reward","pReward","number",p.reward||0)}
        ${field("Usage Limit (0 = unlimited)","pLimit","number",p.usageLimit||0)}
        ${field("Expiry Date","pExp","date",expStr)}
        ${field("Active","pActive","checkbox", p.active!==false)}
        <button id="pSave" class="btn-primary rounded-xl w-full py-2.5 font-semibold">Save Code</button>
      </div>`);
    $("#pSave", mod.el).addEventListener("click", async ()=>{
      const code = $("#pCode",mod.el).value.trim().toUpperCase();
      if (!code) return UI.toast("Code required.","warn");
      const data = { code, reward:Number($("#pReward",mod.el).value||0), usageLimit:Number($("#pLimit",mod.el).value||0), active:$("#pActive",mod.el).checked };
      const ev = $("#pExp",mod.el).value; data.expiresAt = ev ? new Date(ev).toISOString() : null;
      if (!p.id) data.usedCount = 0;
      try { if (p.id) await DB.updateDoc("promoCodes",p.id,data); else await DB.addDoc("promoCodes",data); UI.toast("Saved.","success"); mod.close(); rPromo(); }
      catch(e){ UI.toast("Save failed.","error"); }
    });
  }

  /* ---------------- NOTICES ---------------- */
  async function rNotices() {
    const c = content();
    c.innerHTML = previewBadge() + `<button id="addNotice" class="btn-primary rounded-xl px-5 py-2.5 font-semibold text-sm mb-4">＋ Create Notice</button><div id="noticeList">${UI.skeletonList(3)}</div>`;
    $("#addNotice").addEventListener("click", ()=>noticeForm());
    const items = await DB.list("notices", { orderBy:["createdAt","desc"] }).catch(()=>[]);
    $("#noticeList").innerHTML = items.length ? items.map(n=>`<div class="glass rounded-2xl p-3 mb-2 flex items-center gap-3">
      <span class="text-xl">${n.icon||"📢"}</span><div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">${UI.escapeHtml(n.title)}</p><p class="text-[11px] text-soft truncate">${UI.escapeHtml(n.body||"")}</p></div>
      <button data-edit="${n.id}" class="chip rounded-lg px-2 py-1 text-xs">✏️</button>
      <button data-del="${n.id}" class="status-rejected rounded-lg px-2 py-1 text-xs">🗑️</button></div>`).join("") : UI.emptyState("No notices.","📢");
    $("#noticeList").querySelectorAll("[data-edit]").forEach((b)=>b.addEventListener("click",()=>noticeForm(items.find(n=>n.id===b.getAttribute("data-edit")))));
    $("#noticeList").querySelectorAll("[data-del]").forEach((b)=>b.addEventListener("click",()=>UI.confirm("Delete notice?", async ()=>{ await DB.deleteDoc("notices",b.getAttribute("data-del")); UI.toast("Deleted.","info"); rNotices(); })));
  }
  function noticeForm(n) {
    n = n || {};
    const mod = UI.modal((n.id?"Edit":"Create")+" Notice", `
      <div class="space-y-3">
        ${field("Title","nTitle","text",n.title)}
        ${field("Icon (emoji)","nIcon","text",n.icon||"📢")}
        <label class="block"><span class="text-xs text-soft">Body</span><textarea id="nBody" rows="4" class="w-full rounded-xl px-3 py-2.5 mt-1">${UI.escapeHtml(n.body||"")}</textarea></label>
        ${field("Also send as push notification to all users","nPush","checkbox", false)}
        <button id="nSave" class="btn-primary rounded-xl w-full py-2.5 font-semibold">Save Notice</button>
      </div>`);
    $("#nSave", mod.el).addEventListener("click", async ()=>{
      const data = { title:$("#nTitle",mod.el).value.trim(), icon:$("#nIcon",mod.el).value.trim()||"📢", body:$("#nBody",mod.el).value.trim() };
      if (!data.title) return UI.toast("Title required.","warn");
      try {
        if (n.id) await DB.updateDoc("notices",n.id,data); else await DB.addDoc("notices",data);
        if ($("#nPush",mod.el).checked) {
          const users = await DB.list("users", { limit: 1000 }).catch(()=>[]);
          await Promise.all(users.map(u=>DB.notify(u.id, data.title, data.body, "info").catch(()=>{})));
          UI.toast(`Pushed to ${users.length} users.`,"success");
        }
        UI.toast("Saved.","success"); mod.close(); rNotices();
      } catch(e){ UI.toast("Save failed.","error"); }
    });
  }

  /* ---------------- CURRENCY ---------------- */
  function rCurrency() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() + section("Currency Settings", `
      <p class="text-xs text-soft mb-3">Changing these updates the symbol & name across the entire app.</p>
      ${field("Currency Name","curName","text",s.currencyName||"Coins")}
      ${field("Currency Symbol","curSym","text",s.currencySymbol||"₵")}
      ${saveBtn("curSave")}`);
    $("#curSave").addEventListener("click", ()=>saveSettings({ currencyName:$("#curName").value.trim(), currencySymbol:$("#curSym").value.trim() }, "Currency updated across app!"));
  }

  /* ---------------- BOT SETTINGS ---------------- */
  function rBot() {
    const s = Admin.settings, c = content();
    c.innerHTML = previewBadge() + section("Bot / App Settings", `
      ${field("App / Bot Name","botName","text",s.appName)}
      ${field("Logo Text (initials)","logoTxt","text",s.logoText||"PM")}
      ${field("Bot Username (no @)","botUser2","text",s.botUsername)}
      <label class="block mb-3"><span class="text-xs text-soft">Welcome Message</span><textarea id="welcome" rows="3" class="w-full rounded-xl px-3 py-2.5 mt-1">${UI.escapeHtml(s.welcomeMessage||"")}</textarea></label>
      ${field("Maintenance Mode","maint","checkbox", !!s.maintenanceMode)}
      ${saveBtn("botSave")}`) +
      section("Feature Toggles", `
        ${field("Tasks Enabled","ftTasks","checkbox", s.tasksEnabled!==false)}
        ${field("Ads Enabled","ftAds","checkbox", s.adsEnabled!==false)}
        ${field("Marketplace Enabled","ftMkt","checkbox", s.marketplaceEnabled!==false)}
        ${field("Referral Enabled","ftRef","checkbox", s.referralEnabled!==false)}
        ${saveBtn("ftSave","Save Toggles")}`);
    $("#botSave").addEventListener("click", ()=>{ saveSettings({ appName:$("#botName").value.trim(), logoText:$("#logoTxt").value.trim(), botUsername:$("#botUser2").value.trim().replace(/^@/,""), welcomeMessage:$("#welcome").value.trim(), maintenanceMode:$("#maint").checked }, "Bot settings saved!"); applyBranding(); });
    $("#ftSave").addEventListener("click", ()=>saveSettings({ tasksEnabled:$("#ftTasks").checked, adsEnabled:$("#ftAds").checked, marketplaceEnabled:$("#ftMkt").checked, referralEnabled:$("#ftRef").checked }, "Feature toggles saved!"));
  }

  /* ---------------- LOGS ---------------- */
  async function rLogs() {
    const c = content();
    c.innerHTML = previewBadge() + `<div id="logList">${UI.skeletonList(6)}</div>`;
    const logs = await DB.list("activityLogs", { orderBy:["createdAt","desc"], limit: 100 }).catch(()=>[]);
    $("#logList").innerHTML = logs.length ? `<div class="space-y-2">${logs.map(l=>`<div class="glass rounded-xl px-3 py-2 flex items-center gap-3">
      <span class="text-soft text-xs w-28 shrink-0">${UI.dateTime(l.createdAt)}</span>
      <span class="chip rounded-md px-2 py-0.5 text-[11px] font-semibold">${UI.escapeHtml(l.action)}</span>
      <span class="text-xs text-soft flex-1 truncate">${UI.escapeHtml(l.detail||l.userId||"")}</span></div>`).join("")}</div>` : UI.emptyState("No activity logs yet.","🧾");
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
