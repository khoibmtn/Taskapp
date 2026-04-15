# Chat Feature Design Spec — TaskApp (FINAL v3)

> **Ngày tạo**: 2026-04-14
> **Trạng thái**: FINAL — Đã qua 3 vòng review (AG ↔ ChatGPT)
> **Phạm vi**: Tính năng Chat cho ứng dụng giao việc TaskApp
> **Tech stack**: React 19 + Vite + Tailwind CSS v4 + Firebase Firestore (named DB: `taskapp`) + Cloud Functions Gen2 + FCM + Firebase Storage

---

## 1. Tổng quan

### 1.1 Hai luồng Chat

1. **Task Chat**: Gắn trực tiếp với 1 công việc. Chỉ người tham gia công việc đó (người giao, người nhận, giám sát, trưởng khoa, admin) mới được tham gia.
2. **Direct Message (DM)**: Chat riêng giữa 2 người bất kỳ trong hệ thống.

### 1.2 Quy mô & Bối cảnh
- Người dùng hoạt động: 3-5 hiện tại, scale tới ~10.
- Tần suất: Ngắn gọn, xoay quanh tiến độ công việc.
- PWA trên iOS là platform chính.

### 1.3 Phân pha
- **Phase 1**: Task Chat + DM cơ bản + gửi ảnh/file + thông báo realtime + Mentions (@nickname) cơ bản.
- **Phase 2**: Tag/nhắc công việc trong DM, typing indicator, emoji reactions, short-lived signed URLs cho file nhạy cảm.

---

## 2. Firestore Data Model

### 2.1 Collection: `conversations`

```
conversations/{conversationId}
│
├── type: "task" | "dm"
├── taskId: string | null              // Chỉ khi type="task"
├── participants: string[]             // Danh sách UID có quyền tham gia
├── participantNames: {                // Denormalized cache
│     [uid]: string
│   }
├── lastMessage: {
│     text: string                     // Nội dung / "[Ảnh]" / "[File: tên]"
│     senderUid: string
│     senderName: string
│     createdAt: Timestamp
│   }
├── lastReadAt: {                      // 🔑 Source of truth cho unread
│     [uid]: Timestamp                 // Timestamp lần cuối user đọc
│   }
├── unreadCounts: {                    // Denormalized cache cho badge display
│     [uid]: number
│   }
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### 2.2 Subcollection: `conversations/{id}/messages`

```
messages/{messageId}
│
├── clientMessageId: string            // 🔑 Client-generated UUID, chống duplicate khi retry
├── text: string
├── senderUid: string
├── senderName: string
├── type: "text" | "image" | "file"
├── attachments: [                     // Chỉ khi type != "text"
│     {
│       name: string                   // Tên file gốc
│       url: string                    // Firebase Storage download URL
│       size: number                   // Bytes
│       contentType: string            // MIME type
│     }
│   ]
├── createdAt: Timestamp               // Server timestamp (authoritative)
├── clientCreatedAt: number            // 🔑 Date.now() fallback cho ordering khi serverTimestamp chưa resolve
├── isDeleted: boolean                 // Soft delete
├── deletedAt: Timestamp | null        // Khi nào bị xóa
└── mentions: [                        // (MỚI) Cache thông tin user được tag (@) để hiển thị
      {
        uid: string
        nickname: string | null
        fullName: string
      }
    ]
```

**Defensive fields giải thích:**
- `clientMessageId`: Client tạo UUID trước khi gửi. Cloud Function **enforce dedup**: query `where(clientMessageId == id).limit(1)` — nếu tồn tại thì skip toàn bộ processing. Tránh gửi trùng khi retry/reconnect.
- `clientCreatedAt`: `serverTimestamp()` có delay nhỏ (đặc biệt offline). Client ghi `Date.now()` để UI sort chính xác ngay lập tức.
- `deletedAt`: Hiển thị "Tin nhắn đã bị thu hồi" kèm thời gian.

**🔑 Quy tắc UI ordering (bắt buộc):**
```
Sort messages by: createdAt (server) ?? clientCreatedAt (fallback)
```
- Mặc định sort theo `createdAt` (server timestamp, authoritative).
- Khi `createdAt` chưa resolve (offline, optimistic) → fallback sang `clientCreatedAt`.
- Developers KHÔNG được sort theo field khác.

### 2.3 Collection: `presence` (MỚI — tách khỏi users)

```
presence/{uid}
│
├── activeConversationIds: string[]    // Hỗ trợ multi-tab/multi-device
└── lastActiveAt: Timestamp            // Heartbeat client gửi mỗi 15s
```

**Lý do tách riêng:** Tránh overwrite khi user mở app trên cả mobile lẫn desktop. Array cho phép track nhiều conversation cùng lúc. Tách khỏi `users` document giữ đúng separation of concerns (user profile ≠ session state).

### 2.4 Quy tắc Conversation ID

| Loại | Format | Ví dụ |
|------|--------|-------|
| Task Chat | `task_{taskId}` | `task_abc123def` |
| DM | `dm_{sortedUid1}_{sortedUid2}` | `dm_abc_xyz` (uid1 < uid2 alphabetically) |

> ⚠️ **Documented constraint**: Deterministic DM ID gắn chặt với 2 UIDs. Nếu tương lai cần group chat hoặc merge account, sẽ cần migration strategy. Chấp nhận cho Phase 1 vì lợi ích O(1) lookup vượt trội so với query.

### 2.5 Lazy Conversation Creation

| Loại | Thời điểm tạo |
|------|---------------|
| **Task Chat** | Lần đầu ai đó bấm icon chat trên task card. Không tạo sẵn khi task được tạo. |
| **DM** | Khi gửi tin nhắn đầu tiên, hoặc nếu conversation đã tồn tại → mở lại. |

### 2.6 Participants Logic (Task Chat)

Khi tạo Task Chat, `participants` bao gồm:
- `createdBy` (người giao việc)
- Tất cả `assignees` UIDs
- `supervisorId` (nếu có)
- Managers của khoa/phòng (`departmentId` → query role="manager")
- Admins (role="admin")

**Participant sync** (khi task thay đổi): Xử lý bởi Cloud Function `syncChatParticipants` — xem Section 7.

> ⚠️ **Permissions**: Phase 1 tất cả participants quyền ngang nhau (đọc + gửi). Nếu tương lai cần moderation/audit → bổ sung `participantsMeta` với roles.

---

## 3. Firebase Storage

### 3.1 Structure

```
chat-attachments/
  └── {conversationId}/
        └── {messageId}/
              └── {fileName}
```

### 3.2 Constraints

| Rule | Giá trị |
|------|---------|
| Max file size | 5 MB |
| Max attachments per message | 3 |
| Allowed image types | jpg, jpeg, png, gif, webp |
| Allowed file types | pdf, doc, docx, xls, xlsx, txt |

### 3.3 Upload-First Flow (Atomic Guarantee)

```
1. User chọn file → validate (size + type)
2. Hiển thị preview + progress bar
3. Upload lên Firebase Storage → CHỜ hoàn tất → lấy download URL
4. CHỈ KHI upload xong → tạo message document chứa URL
5. Upload fail → KHÔNG tạo message → hiện lỗi + nút "Thử lại"
```

> **Tại sao?** Nếu ghi message trước rồi upload sau, message có thể "broken" (text có nhưng file thiếu). Upload-first đảm bảo atomicity.

### 3.4 Security (3 lớp)

| Layer | Bảo vệ gì |
|-------|-----------|
| **Firebase Storage rules** | Auth required + file size + content type |
| **Firestore security rules** | Chỉ participants đọc messages → chỉ participants có URL |
| **Application-level** | Client validate participant trước khi upload |

```javascript
// Storage rules
match /chat-attachments/{conversationId}/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.resource.size < 5 * 1024 * 1024
    && request.resource.contentType.matches('image/.*|application/pdf|application/msword|application/vnd.openxmlformats.*|text/plain');
}
```

> ⚠️ **Documented limitation (Phase 1)**: Firebase Storage download URLs chứa long-lived token — nếu URL bị leak, ai có link đều tải được. Với 10 nhân viên nội bộ BV, rủi ro thấp chấp nhận được.
>
> **Phase 2 enhancement**: Cloud Function proxy tạo short-lived signed URLs on demand cho file nhạy cảm.

---

## 4. UI/UX Design

### 4.1 Entry Points

#### Header (Top Bar)
```
[Logo TaskApp]  [Khoa/Phòng ▾]  ...  [💬 badge] [🔔 badge]  [Xin chào, Tên]
```
- 💬 (MessageSquare): Badge = tổng unread từ TẤT CẢ conversations.
- Click → Navigate đến `/app/messages`.
- Hoàn toàn tách biệt với 🔔.

#### Sidebar (Left Panel)
```
Dashboard          (badge)
Dashboard Quản lý
Giao việc mới
Công việc
Tin nhắn           (badge)     ← MỚI
Quản lý Nhân sự
Cài đặt
```

#### Bottom Navigation (Mobile)
```
[Dashboard] [Tasks] [+Create] [💬 Messages] [Menu]
```

### 4.2 Task Chat UI

#### Icon trên Task Card
- Mỗi task card: icon 💬 nhỏ ở góc phải.
- Có tin nhắn chưa đọc → badge đỏ với số.
- Chưa có conversation → icon xám nhạt.

#### Mobile: Full-Screen Overlay
```
┌─────────────────────────────┐
│ ← Chat: {Task Title}    ✕   │
│─────────────────────────────│
│                              │
│  [Messages scroll area]      │
│                              │
│  ┌── Hương ─────────────┐    │
│  │ Đã xong phần A rồi   │    │
│  └───────── 10:30 ──────┘    │
│       ┌──────── Bạn ──┐      │
│       │ OK, kiểm tra   │      │
│       └──── 10:32 ────┘      │
│─────────────────────────────│
│ [📎] [Nhập tin nhắn...] [➤] │
└─────────────────────────────┘
```
- Tự đóng khi navigate sang trang khác (Phase 1).

#### Desktop: Side Panel (320px)
```
┌──────────────┬──────────────────────────────┬─────────────┐
│  Sidebar     │       Main Content           │  Chat Panel │
│              │                              │  (320px)    │
│              │                              │  ┌────────┐ │
│              │                              │  │Messages│ │
│              │                              │  │        │ │
│              │                              │  │[Input] │ │
│              │                              │  └────────┘ │
└──────────────┴──────────────────────────────┴─────────────┘
```
- Bấm chat task khác → panel chuyển nội dung.
- Nút ✕ để đóng panel.

### 4.3 Direct Message UI

#### Desktop Layout (`/app/messages`)
```
┌──────────────┬───────────────────┬──────────────────────────┐
│  Sidebar     │ Conversation List │   Active Chat            │
│              │                   │                          │
│              │ 🔍 Tìm kiếm...  │  ┌────────────────────┐   │
│              │ [+ Tạo cuộc mới] │  │ Nguyễn T.T. Hương  │   │
│              │                   │  │ Online • Khoa GMHS │   │
│              │ ┌──────────────┐  │  ├────────────────────┤   │
│              │ │ Hương    2m  │  │  │                    │   │
│              │ │ OK, check (2)│  │  │  [Messages...]     │   │
│              │ ├──────────────┤  │  │                    │   │
│              │ │ Hà      1h   │  │  ├────────────────────┤   │
│              │ │ File...      │  │  │ [📎] [Input] [➤]  │   │
│              │ └──────────────┘  │  └────────────────────┘   │
└──────────────┴───────────────────┴──────────────────────────┘
```

#### Mobile Layout
- Mặc định: danh sách conversations (full width).
- Bấm vào 1 cuộc → full-screen chat (nút ← quay lại).

#### Tạo cuộc chat mới
- Nút "+" → modal chọn user (search by name, exclude self).
- Nếu DM đã tồn tại → mở conversation cũ (deterministic ID check).

### 4.4 Optimistic UI cho tin nhắn

```
User gửi → Tin nhắn hiện ngay (spinner nhỏ góc tin nhắn)
├── Firestore write OK → spinner biến mất
└── Firestore write FAIL → hiện ⚠️ + nút "Gửi lại"
```

Tương tự cho file:
```
User chọn file → Preview + progress bar
├── Upload OK → Tạo message → hiện bình thường
└── Upload FAIL → Auto retry (tối đa 2 lần) → vẫn fail → hiện ⚠️ + nút "Thử lại"
```

> Không dùng field `status` trên Firestore. Document tồn tại = đã gửi thành công. Trạng thái "sending" xử lý hoàn toàn client-side. `clientMessageId` (UUID) giúp detect duplicate nếu message bị gửi 2 lần do retry.

---

## 5. Component Architecture

### 5.1 Shared Components

| Component | Mô tả |
|-----------|--------|
| `ChatMessageList` | Render tin nhắn, auto-scroll, load thêm khi scroll lên |
| `ChatInput` | Input + nút đính kèm + nút gửi + Xử lý Autocomplete Mentions (@) |
| `ChatBubble` | 1 tin nhắn (text/image/file), phân biệt gửi/nhận, timestamp, highlight @Mentions |
| `AttachmentPreview` | Ảnh: thumbnail inline. File: icon + tên + size + download |
| `ChatBadge` | Badge số chưa đọc (dùng nhiều nơi) |
| `ErrorBoundary` | (MỚI) Lớp khiên bảo vệ bắt lỗi crash component (được bọc trong `ChatBubble` và `ChatInput`) tránh trắng trang. |

### 5.2 Task Chat Components

| Component | Mô tả |
|-----------|--------|
| `TaskChatIcon` | Icon 💬 + badge trên task card |
| `TaskChatOverlay` | Full-screen overlay (mobile) |
| `TaskChatPanel` | Side panel 320px (desktop) |

### 5.3 DM Components

| Component | Mô tả |
|-----------|--------|
| `DirectMessages` | Page `/app/messages` |
| `ConversationList` | Sidebar: danh sách + search + nút tạo mới |
| `ConversationItem` | 1 item (avatar, tên, last message, badge, time) |
| `NewChatModal` | Modal chọn user |

### 5.4 Hooks

| Hook | Mô tả |
|------|--------|
| `useConversation(conversationId)` | Subscribe realtime messages + auto mark read |
| `useChatList(currentUserUid)` | Subscribe danh sách conversations |
| `useTotalUnread(currentUserUid)` | Tổng unread cho badge header/sidebar |
| `useSendMessage()` | Gửi tin nhắn (text/image/file) với upload-first flow |
| `usePresence(conversationId)` | Manage presence: heartbeat + cleanup on unmount |

---

## 6. Notification System

### 6.1 Nguyên tắc "Đang chat = Không thông báo"

**Detection flow (Cloud Function):**

```javascript
// 1. Đọc presence/{uid}
const presenceSnap = await taskDb.collection("presence").doc(uid).get();
const presence = presenceSnap.data();

// 2. Check: user đang active trong conversation này?
const isActive = presence
  && presence.activeConversationIds?.includes(conversationId)
  && presence.lastActiveAt?.toMillis() > (Date.now() - 30_000); // 30s timeout

// 3. Nếu active → skip push + skip unreadCount increment
if (isActive) return;
```

**Client-side heartbeat (`usePresence` hook):**
- Khi mở chat → add `conversationId` vào `presence/{uid}.activeConversationIds`
- Mỗi 15s → update `lastActiveAt` (CHỈ khi `document.visibilityState === "visible"`)
- Khi tab bị ẩn (`visibilitychange` event) → ngừng heartbeat, giữ nguyên data
- Khi tab hiện lại → resume heartbeat ngay lập tức
- Khi đóng chat (unmount) → remove `conversationId` từ array + update `lastActiveAt`

> **Tại sao throttle khi hidden?** Tránh ghi Firestore vô ích khi tab background. Và 30s timeout sẽ tự động coi user là inactive nếu heartbeat dừng.

### 6.2 Push Notification Format

```javascript
{
  notification: {
    title: senderName,                           // "Nguyễn Thị Thu Hương"
    body: messagePreview                         // "Đã xong phần A" / "[Ảnh]" / "[File: báo cáo.pdf]"
  },
  webpush: {
    headers: { Urgency: "high", TTL: "86400" },
    fcm_options: { link: `https://app.url/app/messages/${conversationId}` }
  },
  data: {
    type: "chat_message",
    conversationId: "...",
    conversationType: "task" | "dm"
  }
}
```

Push FCM gửi bằng hàm `sendNotificationToUser` hiện có — reuse infrastructure, nhưng **KHÔNG** ghi vào collection `notifications` (tách biệt badge).

### 6.3 Badge Logic

| Vị trí | Nguồn dữ liệu |
|--------|----------------|
| Icon 💬 header | Tổng `unreadCounts[myUid]` từ tất cả conversations |
| Menu "Tin nhắn" sidebar | Giống header |
| Icon chat trên Task Card | `unreadCounts[myUid]` của conversation tương ứng |
| Item trong DM list | `unreadCounts[myUid]` của conversation đó |

### 6.4 Mark as Read

```javascript
// Client gọi khi mở conversation
await updateDoc(doc(db, "conversations", conversationId), {
  [`lastReadAt.${myUid}`]: serverTimestamp(),
  [`unreadCounts.${myUid}`]: 0
});
```

### 6.5 unreadCounts Update Strategy (Hybrid Optimized)

`unreadCounts` là denormalized cache. Hai chế độ cập nhật:

**Chế độ 1 — Fast path (bình thường):** Cloud Function dùng `increment(1)` cho tốc độ:

```javascript
// Nhanh, 1 write, không query messages
updates[`unreadCounts.${uid}`] = admin.firestore.FieldValue.increment(1);
```

**Chế độ 2 — Recalculation (khi mark as read):** Client mark read → Cloud Function recalc chính xác:

```javascript
// Chỉ chạy khi user mark as read, không chạy mỗi message
const lastRead = conversationData.lastReadAt?.[uid]?.toMillis() || 0;
const unreadSnap = await messagesRef
  .where("createdAt", ">", Timestamp.fromMillis(lastRead))
  .count()
  .get();
updates[`unreadCounts.${uid}`] = unreadSnap.data().count;
```

> **Tại sao hybrid?** Full recalc mỗi message gây N queries/message (ChatGPT chỉ đúng). Increment bình thường đủ nhanh và chính xác, recalc chỉ cần khi "reset" (mark read) để sửa drift.
>
> Backup: Scheduled Cloud Function recalculate weekly nếu phát hiện bất thường.

---

## 7. Cloud Functions

### 7.1 `onChatMessage` — Push + Unread

```
Trigger: onCreate trên conversations/{conversationId}/messages/{messageId}
```

**Step 0 — Idempotency guard (bắt buộc):**

```javascript
// Check duplicate bằng clientMessageId
const clientMsgId = messageData.clientMessageId;
if (clientMsgId) {
  const existing = await messagesRef
    .where("clientMessageId", "==", clientMsgId)
    .limit(2)
    .get();
  // Nếu có > 1 doc với cùng clientMessageId → đây là duplicate, xóa doc mới và return
  if (existing.size > 1) {
    await event.data.ref.delete(); // Xóa bản duplicate
    return;
  }
}
```

**Step 1–5 — Main processing:**

1. Đọc conversation document → `participants`
2. Đọc `presence/{uid}` cho mỗi participant
3. Với mỗi participant (trừ sender):
   - Check active (presence + 30s timeout)
   - Nếu KHÔNG active: `increment(1)` unreadCounts + gửi FCM push
   - Nếu active: skip push + skip increment
   - ⚡ **Lazy cleanup**: Nếu `lastActiveAt > 30s` nhưng `activeConversationIds` chưa rỗng → xóa conversation khỏi array
4. Update `conversations/{id}.lastMessage`
5. Update `conversations/{id}.unreadCounts` (batch)

> **Tại sao không dùng `processedMessages` collection?** Với quy mô 10 user, `clientMessageId` dedup + Cloud Functions Gen2 built-in dedup (`eventId`) đủ tin cậy. Thêm collection là over-engineering.

### 7.2 `syncChatParticipants` — Sync khi Task thay đổi

```
Trigger: onDocumentUpdated trên tasks/{taskId}
```

1. So sánh before/after assignees + supervisorId
2. Nếu khác → rebuild participants list
3. Update `conversations/task_{taskId}.participants`
4. Removed users: xóa `lastReadAt[uid]`, set `unreadCounts[uid] = 0`
5. Added users: set `lastReadAt[uid] = now`

### 7.3 Hệ thống cleanup (optional, Phase 1 nice-to-have)

Scheduled function dọn dẹp presence stale:

```javascript
// Mỗi 5 phút: xóa presence entries có lastActiveAt > 2 phút
```

---

## 8. Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "participants", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 9. Firestore Security Rules (Bổ sung)

```javascript
match /conversations/{conversationId} {
  allow read: if request.auth.uid in resource.data.participants;
  allow update: if request.auth.uid in resource.data.participants;
  allow create: if request.auth.uid in request.resource.data.participants;

  match /messages/{messageId} {
    allow read: if request.auth.uid in
      get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    allow create: if request.auth.uid == request.resource.data.senderUid
      && request.auth.uid in
      get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
  }
}

match /presence/{uid} {
  allow read, write: if request.auth.uid == uid;
}
```

---

## 10. Routing

```jsx
// Bổ sung vào App.jsx, trong <Route path="/app">
<Route path="messages" element={<DirectMessages />} />
<Route path="messages/:conversationId" element={<DirectMessages />} />
```

---

## 11. Performance

| Concern | Solution |
|---------|----------|
| Message loading | 30 tin nhắn gần nhất, scroll lên → thêm 30 (`startAfter`) |
| Conversation list | Real-time listener, `limit(20)`, sort `updatedAt desc` |
| Badge display | Đọc `unreadCounts` denormalized field → 0 extra queries |
| Image loading | Thumbnail lazy load (Intersection Observer) |
| Offline text | Firestore SDK offline persistence (built-in auto retry) |
| Offline file | Upload-first flow → nếu offline → hiện "Đang chờ kết nối..." |
| Presence writes | Batched heartbeat mỗi 15s, không spam Firestore |

---

## 12. Phân pha triển khai

### Phase 1A: Foundation (Backend + Data)
- [ ] Firestore schema: `conversations`, `messages`, `presence`
- [ ] Firebase Storage setup (`chat-attachments/`)
- [ ] Cloud Function `onChatMessage` (push + unread recalculate)
- [ ] Cloud Function `syncChatParticipants`
- [ ] Firestore indexes + security rules
- [ ] Storage security rules

### Phase 1B: Task Chat
- [ ] `TaskChatIcon` (badge trên task card)
- [ ] `TaskChatOverlay` (mobile) + `TaskChatPanel` (desktop)
- [ ] Shared: `ChatMessageList`, `ChatInput`, `ChatBubble`
- [ ] File/Image upload (upload-first flow)
- [ ] `AttachmentPreview` (inline image + file download)
- [ ] Presence hook (heartbeat + cleanup)
- [ ] "Đang chat = không thông báo" logic

### Phase 1C: Direct Messages
- [ ] Trang `/app/messages` (ConversationList + ChatArea)
- [ ] `NewChatModal` (tạo cuộc chat mới)
- [ ] Header icon 💬 + sidebar menu + bottom nav
- [ ] Mobile responsive (list ↔ chat full-screen)
- [ ] Badge tổng hợp (header + sidebar)

### Phase 2 (Tương lai):
- [ ] Tag/nhắc công việc trong DM
- [ ] Xem luồng task-chat từ trong DM
- [ ] Typing indicator
- [ ] Emoji reactions
- [ ] Short-lived signed URLs cho file nhạy cảm
- [ ] Message search
- [ ] Chat roles / moderation
- [ ] Message ordering guarantee (serverTimestamp + clientCreatedAt reconciliation)
- [ ] Duplicate message prevention enforcement (clientMessageId unique index)

---

## 13. Rủi ro & Limitations đã document

| # | Rủi ro | Mức độ | Mitigation |
|---|--------|--------|------------|
| 1 | Storage URL leak | Thấp (nội bộ BV) | Phase 2: signed URL proxy |
| 2 | Deterministic DM ID khó migrate | Thấp (Phase 1 scope) | Document constraint, plan migration nếu cần group chat |
| 3 | unreadCounts drift | Thấp | Increment fast-path + recalc on mark-read + optional weekly cron |
| 4 | Presence stale | Thấp | 30s timeout + lazy cleanup trong onChatMessage |
| 5 | iOS PWA file picker hạn chế | Trung bình | Test trên thiết bị thật, fallback graceful |
| 6 | Race condition mark-read vs new message | Rất thấp | Cloud Function là authority cho unreadCounts, client set 0 là optimistic |
| 7 | Duplicate message khi retry | Thấp | `clientMessageId` UUID field cho dedup |
| 8 | Participant removed vẫn có cached URL | Thấp (nội bộ) | Firestore rules block new reads, cached data expire tự nhiên |
