/* ============================================================
 *  DATA LAYER — Firestore wrapper with graceful fallback.
 *  Collections: users, admins, settings, deposits, withdrawals,
 *  tasks, ads, referrals, notices, promoCodes, notifications,
 *  activationRequests, transactions, marketplaceListings,
 *  activityLogs.
 * ============================================================ */
window.DB = (function () {
  "use strict";

  const FB = window.FB || {};
  const ready = () => FB && FB.ready && FB.db;
  const now = () => (ready() ? FB.serverTimestamp() : new Date().toISOString());
  const inc = (n) => (ready() ? FB.FieldValue.increment(n) : { __inc: n });

  /* ---- low level ---- */
  async function getDoc(col, id) {
    if (!ready()) return null;
    const s = await FB.db.collection(col).doc(id).get();
    return s.exists ? { id: s.id, ...s.data() } : null;
  }
  async function setDoc(col, id, data, merge) {
    if (!ready()) return { id, ...data };
    await FB.db.collection(col).doc(id).set(data, { merge: merge !== false });
    return { id, ...data };
  }
  async function addDoc(col, data) {
    if (!ready()) return { id: UI.uid(col), ...data };
    const ref = await FB.db.collection(col).add({ createdAt: now(), ...data });
    return { id: ref.id, ...data };
  }
  async function updateDoc(col, id, data) {
    if (!ready()) return;
    await FB.db.collection(col).doc(id).update(data);
  }
  async function deleteDoc(col, id) {
    if (!ready()) return;
    await FB.db.collection(col).doc(id).delete();
  }
  async function list(col, opts) {
    if (!ready()) return [];
    opts = opts || {};
    let q = FB.db.collection(col);
    if (opts.where) opts.where.forEach((w) => { q = q.where(w[0], w[1], w[2]); });
    if (opts.orderBy) q = q.orderBy(opts.orderBy[0], opts.orderBy[1] || "desc");
    if (opts.limit) q = q.limit(opts.limit);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  function listen(col, opts, cb) {
    if (!ready()) { cb([]); return () => {}; }
    opts = opts || {};
    let q = FB.db.collection(col);
    if (opts.where) opts.where.forEach((w) => { q = q.where(w[0], w[1], w[2]); });
    if (opts.orderBy) q = q.orderBy(opts.orderBy[0], opts.orderBy[1] || "desc");
    if (opts.limit) q = q.limit(opts.limit);
    return q.onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { console.error("[listen]", col, err); cb([]); }
    );
  }

  /* ---- settings ---- */
  async function getSettings() {
    const s = await getDoc("settings", "config");
    return s || {};
  }
  async function saveSettings(patch) {
    return setDoc("settings", "config", { ...patch, updatedAt: now() }, true);
  }

  /* ---- auth / users ---- */
  async function ensureAuth() {
    if (!ready() || !FB.auth) return null;
    return new Promise((resolve) => {
      const unsub = FB.auth.onAuthStateChanged(async (u) => {
        unsub();
        if (u) return resolve(u);
        try { const cred = await FB.auth.signInAnonymously(); resolve(cred.user); }
        catch (e) { console.error("[auth]", e); resolve(null); }
      });
    });
  }

  async function getOrCreateUser(tgUser, referrerId) {
    if (!tgUser) return null;
    const existing = await getDoc("users", tgUser.id);
    if (existing) {
      await updateDoc("users", tgUser.id, { lastSeen: now() }).catch(() => {});
      return existing;
    }
    const profile = {
      id: tgUser.id,
      firstName: tgUser.firstName,
      lastName: tgUser.lastName,
      username: tgUser.username,
      photoUrl: tgUser.photoUrl,
      isPremium: false,
      activated: false,
      status: "active", // active | banned | suspended
      mainBalance: 0,
      depositBalance: 0,
      referralBalance: 0,
      totalEarnings: 0,
      totalWithdraw: 0,
      totalDeposit: 0,
      referralCount: 0,
      referredBy: referrerId && referrerId !== tgUser.id ? referrerId : null,
      adsWatchedToday: 0,
      tasksCompleted: 0,
      device: navigator.userAgent.slice(0, 180),
      joinedAt: now(),
      lastSeen: now()
    };
    await setDoc("users", tgUser.id, profile, false);
    if (profile.referredBy) {
      await addDoc("referrals", { referrerId: profile.referredBy, referredId: tgUser.id, status: "pending", reward: 0 }).catch(() => {});
    }
    await log(tgUser.id, "signup", "New account created");
    return profile;
  }

  async function adjustBalance(userId, field, amount) {
    await updateDoc("users", userId, { [field]: inc(amount) });
  }

  /* ---- transactions / logs / notifications ---- */
  async function tx(userId, type, amount, meta) {
    return addDoc("transactions", { userId, type, amount: Number(amount || 0), meta: meta || {}, createdAt: now() });
  }
  async function log(userId, action, detail) {
    return addDoc("activityLogs", { userId, action, detail: detail || "", createdAt: now() });
  }
  async function notify(userId, title, body, kind) {
    return addDoc("notifications", { userId, title, body: body || "", kind: kind || "info", read: false, createdAt: now() });
  }

  /* ---- leaderboard ---- */
  async function leaderboard(field, lim) {
    return list("users", { orderBy: [field || "totalEarnings", "desc"], limit: lim || 20 });
  }

  return {
    FB, ready, now, inc,
    getDoc, setDoc, addDoc, updateDoc, deleteDoc, list, listen,
    getSettings, saveSettings,
    ensureAuth, getOrCreateUser, adjustBalance,
    tx, log, notify, leaderboard
  };
})();
