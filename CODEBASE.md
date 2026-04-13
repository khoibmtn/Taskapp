# CODEBASE.md - TaskApp

> Last updated: 2026-04-13

## Project Overview
- **Type:** Vite + React 19 + JavaScript + Tailwind CSS v4
- **Purpose:** A clinical/hospital task management system for assigning, tracking, and completing tasks across departments. Features an administration console, role-based access, and robust notification systems (in-app and PWA push).
- **Deployment:** Vercel (Frontend) + Firebase Cloud Functions (Gen 2 Backend)
- **Database:** Firebase Firestore (Named Database: "taskapp", strictly enforced)

## Key Architecture

### Directory Structure
- `src/` - Primary React application code
  - `components/` - Shared UI components (Layout, Dropdowns, Route Guard)
  - `contexts/` - Global state (AuthContext with Firebase Auth listener)
  - `hooks/` - Custom shared logic (e.g., useNotifications)
  - `pages/` - Main route views (Login, Tasks, Dashboard, AdminManagement)
  - `utils/` - Helpers (audio logic, query utilities)
- `functions/` - Node.js Firebase Cloud Functions for backend triggers
- `public/` - Static assets including service workers for PWA/FCM
- `scripts/` - Development and migration nodes scripts

### Key Services/Modules
- **Authentication:** Firebase Auth directly tied to Firestore user documents to enforce application-specific data models (role, departmentIds).
- **Notification System (Triple Defense):**
  - Robust PWA Web Push logic via `firebase-messaging-sw.js` and Apple/iOS-compliant WebPush configurations in Cloud Functions.
  - Native iOS app badge counting synced with in-app unread counts via modern web APIs (`navigator.setAppBadge`).
  - Fallbacks to prevent application crashes when FCM/Push context is strictly blocked or unsupported by the browser (iOS Safari, Private Browsing).
- **Custom UI Standardization:** Transitioned to clean, modern, Firebase-Console styled interactive elements to override clunky native device selects (e.g., `FirebaseDropdown.jsx`).

## Known Issues / TODOs
- VAPID keys currently reside directly inside `AuthContext.jsx`; move these to `.env` before public release.
- Consider further migration of native `<select>` form elements across the app to `FirebaseDropdown`.
- Ensure new backend indices are consistently applied in `firestore.indexes.json` when adding complex queries.

## Environment
- **Repo:** https://github.com/khoibmtn/Taskapp.git
- **Deploy:** (Vercel automatic deployment)
