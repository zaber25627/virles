# Premium Telegram Mini App

A production-ready **Telegram Mini App** with a full **User Panel** and an **Advanced Admin Panel**, powered by **Firebase** (Authentication, Firestore, Storage). Built with plain HTML + Tailwind (CDN) + the Firebase compat SDK — **no build step required**.

> Modern glassmorphism UI · Dark/Light mode · Mobile-first · Professional loading screen · Real-time data.

---

## ✨ Features

### User Panel (`index.html`)
- **Home dashboard** — main / deposit / referral balances, total earnings, withdraw, deposit, referrals, tasks, recent activity, stat cards.
- **Account activation** — locked accounts, activation fee, request flow, premium badge, activation history.
- **Referral system** — unique link, rewards, stats, history, required-referrals-for-withdraw, anti-fake (reward only on referred user's activation).
- **Ads reward system** — watch & earn, daily limit, reward per ad, ad history (hook your ad SDK in `watchAd`).
- **Task center** — active / completed tasks, rewards, history.
- **Deposit system** — dynamic payment methods, instructions, screenshot upload, history with pending/approved/rejected.
- **Withdraw system** — dynamic methods, min/max, fee %, VAT %, live calculation, history.
- **Marketplace** — buy / sell, listing submission + approval, featured listings, my listings.
- **Leaderboard** — top earners, top referrers.
- **Promo codes** — redeem for bonus rewards, usage limits, expiry, history.
- **Notice center** — global announcements.
- **Profile** — Telegram info, premium status, lifetime stats.
- **History center** — unified deposit / withdraw / referral / ad / task / promo history.
- **Real-time notifications** — live unread badge.

### Admin Panel (`admin.html`)
- **Secure access** — only Telegram IDs listed in `ADMIN_IDS` (or in the `admins` collection) can open it.
- **Dashboard** — total/active/premium users, deposits, withdrawals, revenue, tasks, ad views + pending queues.
- **User management** — search, ban / unban / suspend / activate, edit balance & referral count.
- **Activation, Deposit, Withdraw, Referral, Task, Ads, Marketplace, Promo, Notice** settings & approvals.
- **Currency settings** — change name/symbol → updates the whole app.
- **Bot settings** — app name, logo, welcome message, maintenance mode, feature toggles.
- **Activity logs**.

---

## 🚀 Setup (5 minutes)

### 1. Create a Firebase project
1. Go to the [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. **Build → Authentication → Get started →** enable **Anonymous** sign-in.
3. **Build → Firestore Database → Create database** (production mode).
4. **Build → Storage → Get started**.

### 2. Paste your credentials
Open **`firebase-config.js`** and replace the placeholders with your own config
(Console → ⚙️ Project Settings → *Your apps* → *SDK setup and configuration → Config*):

```js
window.firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…"
};

// Your Telegram numeric id(s) — only these can open admin.html
window.ADMIN_IDS = [ 123456789 ];
```

> Don't know your Telegram ID? Open `admin.html` inside Telegram — the access screen shows your ID.

### 3. Deploy the security rules
- **Firestore rules:** copy the contents of `firestore.rules` into Console → Firestore → **Rules** → Publish.
- **Storage rules:** copy `storage.rules` into Console → Storage → **Rules** → Publish.

Make yourself an admin in Firestore by creating a document:
```
Collection: admins   Document ID: <your auth uid or telegram id>   { role: "owner" }
```
(For convenience, `ADMIN_IDS` already grants access to the admin UI; the `admins` collection is what the **security rules** check for write access.)

### 4. Host it
Any static host works (no build):
- **Firebase Hosting:** `firebase init hosting` → set public dir to this folder → `firebase deploy`.
- Or GitHub Pages / Netlify / Vercel / Cloudflare Pages — just upload the files.

### 5. Connect to Telegram
1. Talk to [@BotFather](https://t.me/BotFather) → create a bot.
2. `/newapp` (or Bot Settings → **Menu Button / Web App**) → set the Web App URL to your hosted `index.html`.
3. Set the bot username in **Admin → Referral / Bot Settings** so referral links work.

---

## 🗂️ Project structure
```
telegram-mini-app/
├── index.html              # User mini app
├── admin.html              # Admin panel
├── firebase-config.js      # ← paste YOUR credentials here
├── firestore.rules         # Firestore security rules
├── storage.rules           # Storage security rules
├── README.md
└── assets/
    ├── css/styles.css      # Theme, glassmorphism, animations
    └── js/
        ├── firebase-init.js # Initializes Firebase (graceful fallback)
        ├── common.js        # UI helpers (toast, modal, format, theme, Telegram)
        ├── db.js            # Firestore data layer
        ├── app.js           # User app logic
        └── admin.js         # Admin panel logic
```

## 🧱 Firestore collections
`users`, `admins`, `settings` (+ `settings_depositMethods`, `settings_withdrawMethods`),
`deposits`, `withdrawals`, `activationRequests`, `tasks`, `referrals`, `marketplaceListings`,
`promoCodes`, `notices`, `notifications`, `transactions`, `activityLogs`.

## 🔌 Hooking up real ads
Open `assets/js/app.js` → `watchAd()` and replace the `setTimeout` stub with your ad-network
rewarded-ad call (e.g. Monetag / Adsgram). Grant the reward only in the SDK's success callback.

## ⚠️ Notes
- Before you add credentials the app runs in **preview mode** (UI renders, no live data).
- Anonymous auth is used so users don't need to log in; the Telegram user id is the document id.
- Balance mutations are done client-side for simplicity. For maximum integrity, move
  approvals/credits into **Firebase Functions** (the data layer in `db.js` is structured to make
  that migration straightforward).
