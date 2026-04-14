# CODEBASE.md - TaskApp

> Last updated: 2026-04-14

## Project Overview
- **Type:** Vite + React 19 + JavaScript + Tailwind CSS v4
- **Purpose:** A clinical/hospital task management system for assigning, tracking, and completing tasks across departments. Features an administration console, role-based access, robust notification systems (in-app and PWA push), and a direct messaging system (Chat).
- **Deployment:** Vercel (Frontend) + Firebase Cloud Functions (Gen 2 Backend)
- **Database:** Firebase Firestore (Named Database: "taskapp", strictly enforced)

## Key Architecture

### Directory Structure
- `src/` - Primary React application code
  - `components/` - Shared UI components (Layout, Dropdowns, Route Guard)
  - `components/chat/` - Chat system components (DirectMessages core, ChatInput, ChatBubble, overlays, attachment logic, mentions)
  - `contexts/` - Global state (AuthContext with Firebase Auth listener)
  - `hooks/` - Custom shared logic (e.g., useNotifications, useChatList, useSendMessage)
  - `pages/` - Main route views (Login, Tasks, Dashboard, AdminManagement, DirectMessages)
  - `utils/` - Helpers (audio logic, query utilities)
- `functions/` - Node.js Firebase Cloud Functions for backend triggers
- `public/` - Static assets including service workers for PWA/FCM
- `scripts/` - Development and migration nodes scripts

### Key Services/Modules
- **Authentication & Security:** Firebase Auth directly tied to Firestore user documents to enforce application-specific data models (role, departmentIds). Firestore Security Rules are tightly configured to restrict unauthenticated access, while allowing targeted lookups for features like Registration validation.
- **Notification System (Triple Defense):**
  - Robust PWA Web Push logic via `firebase-messaging-sw.js` and Apple/iOS-compliant WebPush configurations in Cloud Functions.
  - Native iOS app badge counting synced with in-app unread counts via modern web APIs (`navigator.setAppBadge`).
  - Fallbacks to prevent application crashes when FCM/Push context is strictly blocked or unsupported by the browser (iOS Safari, Private Browsing).
- **Real-time Chat System:** 
  - Comprehensive peer-to-peer and group messaging features.
  - Implements rich features: `@` mentions with real-time autocompletion, Firebase Storage integrations for attachments, emoji support, message deletion algorithms, and contextual conversation routing.
- **Custom UI Standardization:** Transitioned to clean, modern, Firebase-Console styled interactive elements to override clunky native device selects (e.g., `FirebaseDropdown.jsx`).

## File Dependencies
- `DirectMessages.jsx` acts as the primary layout router for chat contexts. It heavily relies on `ChatMessageList.jsx` and `ChatInput.jsx`.
- `ChatInput.jsx` maintains its own intricate state mapping referencing `db` structure to provide `@` mention lookups.
- `ChatBubble.jsx` manages message-specific rending, formatting, mapping mentions to highlighted tags.

## Recent Changes
- Fixed runtime React errors inside `ChatInput` caused by a missing import (`useMemo`) and mistakenly removed state (`showEmoji`). Added lightweight Error Boundaries to isolate and trace component catastrophic crashes to prevent white-screen UX.
- Implemented and stabilized a refined `@` mention autocomplete capability with real-time lookup mapping against `fullname` and `nickname`, matching Telegram-like styling in rendering via `ChatBubble`.
- Enforced Registration security flows: User `nickname` is now mandatory, duplicate nicknames/phones are verified real-time (via `onBlur`) directly against the Firestore via unauthenticated rate-limited rule queries (`limit(1) / limit(2)`).

## Known Issues / TODOs
- VAPID keys currently reside directly inside `AuthContext.jsx`; move these to `.env` before public release.
- Consider further migration of native `<select>` form elements across the app to `FirebaseDropdown`.
- Ensure new backend indices are consistently applied in `firestore.indexes.json` when adding complex queries.

## Environment
- **Repo:** https://github.com/khoibmtn/Taskapp.git
- **Deploy:** (Vercel automatic deployment)
