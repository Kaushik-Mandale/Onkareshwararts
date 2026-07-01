# Onkareshwararts Business Manager

A responsive internal business management PWA for Onkareshwararts. It helps manage idol inventory, customer CRM, bookings, payments, invoices, QR-based delivery confirmation, notifications, reports, and business settings from one dashboard.

## Features

- Secure admin/staff login with Firebase Authentication
- Role-based protected routes for admin-only settings
- Dashboard with revenue, stock, booking, and delivery summaries
- Inventory management with product stock, pricing, barcode text, import/export, and low-stock tracking
- Multi-step booking workflow with cart, customer lookup, billing, GST, discounts, split payments, and invoice generation
- QR code delivery scanner for pickup confirmation
- Orders module with payment updates, refunds, invoice PDF, and WhatsApp sharing
- Customers CRM with tags, dues, visit history, and lifetime spend
- Payments ledger for cash, UPI, online, card, and refund entries
- Reports with charts plus Excel/PDF export
- Notification center for low stock, bookings, payments, and deliveries
- Business settings for invoice details, tax, bank details, staff users, and backups
- PWA manifest and service worker support

## Tech Stack

- React 18 + TypeScript
- Vite
- Firebase Auth, Firestore, and Storage
- Tailwind CSS
- Framer Motion
- Recharts
- jsPDF
- QRCode and html5-qrcode
- XLSX export
- Sonner toast notifications

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Create a `.env.local` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

This repository includes `firestore.rules` and `storage.rules` for Firebase setup.

In Firebase Console:

1. Enable **Authentication > Email/Password**
2. Create or open **Firestore Database**
3. Publish the rules from `firestore.rules`
4. Open **Storage**
5. Publish the rules from `storage.rules`

### 3. Run locally

```bash
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Default Login

The app can self-provision these default users on first login after Firebase Auth and Firestore rules are configured:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `vivek2026` | `vivek@26` |
| Staff | `ram2026` | `ram@26` |

After setup, change passwords and manage staff access from the Settings module.

## Available Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Deploying To Vercel

When deploying on Vercel, add these environment variables in **Project Settings > Environment Variables**:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

After saving the variables, redeploy the project from Vercel. The included `vercel.json` sends all routes back to `index.html`, which keeps React Router pages working after refresh.

## Project Structure

```text
src/
  components/      Shared UI, layout, search, notifications, route guards
  contexts/        Auth context and session handling
  firebase/        Firebase configuration and Firestore operations
  pages/           Dashboard, inventory, bookings, orders, customers, reports, settings
  types/           Application TypeScript models
public/            PWA manifest, icons, service worker
```

## Notes

- `.env.local` is ignored by Git and should not be committed.
- Firebase client API keys are safe to use in frontend apps, but Firestore and Storage security rules must be configured carefully.
- This project is intended for internal business operations, not a public storefront.
