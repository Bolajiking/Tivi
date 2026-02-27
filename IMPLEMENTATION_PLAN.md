# TVinBio — Next Stage Implementation Plan

## Context

TVinBio is a personalized streaming platform where creators stream, monetize, and own their audience. The core architecture (Next.js 14 + Livepeer + Supabase + Privy + Redux) is in place and functional. This plan addresses the next stage: refining user flows, improving UI/UX design quality, fixing streaming/subscriber route reliability, and ensuring video functionality works end-to-end. The `frontend-design` skill will be used for all visual redesign work.

---

## Phase 1: Foundation Fixes (Functional Reliability)

> Fix broken data flows before redesigning UI — ensures video and streaming work end-to-end.

### 1.1 Fix Asset/Video Supabase Enrichment

| | |
|---|---|
| **Problem** | Streams get enriched with Supabase metadata (O(1) Map lookup), but video assets do NOT. Videos lack titles, pricing, creator info when displayed. |
| **Files** | `src/features/assetsAPI.ts`, `src/features/assetsSlice.ts` |
| **Action** | Add Supabase enrichment to `getAssets()` thunk (mirror the pattern from `getAllStreams()` in `streamAPI.ts`) |
| **Status** | [x] Completed |

### 1.2 Align useAssetGate with useStreamGate

| | |
|---|---|
| **Problem** | `useAssetGate` sets `error="Video not found"` for missing videos, while `useStreamGate` tolerates missing streams gracefully. Inconsistent UX. |
| **Files** | `src/app/hook/useAssetGate.ts` |
| **Action** | Match `useStreamGate`'s pattern — treat missing video as empty state, not error |
| **Status** | [x] Completed |

### 1.3 Fix Stream Update to Sync Supabase

| | |
|---|---|
| **Problem** | `updateLivestream` in `streamAPI.ts` updates Livepeer but doesn't update Supabase metadata (title, viewMode, amount, etc.) |
| **Files** | `src/features/streamAPI.ts` |
| **Action** | Add Supabase `updateStream()` call after Livepeer update |
| **Status** | [x] Completed |

### 1.4 Extract Wallet Address Hook

| | |
|---|---|
| **Problem** | Identical wallet extraction logic duplicated across 3 payment gate components (~20 lines each) |
| **Files** | Create `src/app/hook/useWalletAddress.ts`, update `CreatorPaymentGate.tsx`, `StreamPaymentGate.tsx`, `VideoPaymentGate.tsx` |
| **Action** | Extract into `useWalletAddress()` custom hook, import in all 3 gates |
| **Status** | [x] Completed |

### 1.5 Switch Chat from Polling to Realtime

| | |
|---|---|
| **Problem** | Chat polls every 5 seconds. Supabase realtime subscription already exists in `supabase-service.ts` (`subscribeToChatMessages()`) but is unused. |
| **Files** | `src/components/templates/player/player/Player.tsx`, `src/features/chatSlice.ts` |
| **Action** | Replace polling `setInterval` with `subscribeToChatMessages()` realtime listener. Add cleanup on unmount. |
| **Status** | [x] Completed |

### 1.6 Clean Up Dead Code

| | |
|---|---|
| **Problem** | `useSolPrice` hook unused (Ethereum-only), `userSlice.solanaWalletAddress` vestigial, `isEnabled` in `StreamContext` unused |
| **Files** | `src/app/hook/useSolPrice.ts` (delete), `src/features/userSlice.ts` (rename field), `src/context/StreamContext.tsx` (remove `isEnabled`) |
| **Action** | Remove dead code, rename `solanaWalletAddress` → `walletAddress` |
| **Status** | [x] Completed |

---

## Phase 2: UI/UX Redesign (Visual Polish)

> Use `frontend-design` skill for each component group. Keep existing wireframe structure, improve design quality and consistency.

### 2.1 Dashboard Redesign

| | |
|---|---|
| **Components** | `Dashboard.tsx`, `Header.tsx`, `DashboardBroadcast.tsx` |
| **Issues** | Basic card styling, header dropdown needs polish, loading states are plain spinners, empty states lack visual design |
| **Action** | Use `frontend-design` skill to redesign: polished channel card with better status indicators, refined tab navigation (Videos/Livestreams), better empty states with illustrations/messaging, improved loading skeletons, header profile dropdown with better spacing and visual hierarchy |
| **Status** | [x] Completed |

### 2.2 Player & Chat Redesign

| | |
|---|---|
| **Components** | `Player.tsx` (player controls, chat panel, gate modal) |
| **Issues** | Chat panel styling basic, controls could be more polished, gate modal overlay needs refinement |
| **Action** | Use `frontend-design` skill to redesign: chat panel with better message bubbles/sender differentiation, refined player controls bar, improved stream gate/payment modal overlay, better viewer count badge |
| **Status** | [~] In progress |

### 2.3 Creator Profile Redesign

| | |
|---|---|
| **Components** | `CreatorProfile.tsx`, `CreatorChannelCard.tsx` |
| **Issues** | Profile header basic, social links could be more prominent, subscribe button styling |
| **Action** | Use `frontend-design` skill for: enhanced creator header (avatar, stats, social links), better subscribe/unsubscribe button states, improved video/stream grid on profile, polished tab navigation |
| **Status** | [~] In progress |

### 2.4 Sidebar & Navigation Redesign

| | |
|---|---|
| **Components** | `Sidebar.tsx`, `BottomNav.tsx`, `SidebarBottomLinks.tsx` |
| **Issues** | Sidebar channel list basic, bottom nav icons need refinement, add channel modal needs polish |
| **Action** | Use `frontend-design` skill for: better channel list items with live indicators, refined collapsed sidebar state, improved bottom nav with better icon styling, polish add channel dialog |
| **Status** | [~] In progress |

### 2.5 Cards & Shared Components

| | |
|---|---|
| **Components** | `Card.tsx`, `ChannelCardRedesign.tsx`, `VideoCard` (in `Card.tsx`) |
| **Issues** | Inconsistent card styling between video and stream cards, thumbnail handling |
| **Action** | Use `frontend-design` skill for: unified card design system (consistent borders, shadows, hover states), better thumbnail/preview image handling, refined live status badges, consistent metadata display (date, views, duration) |
| **Status** | [~] In progress |

### 2.6 Monetization Page Theme Fix

| | |
|---|---|
| **Components** | `Monetization.tsx` |
| **Issues** | Uses white background — breaks dark theme consistency |
| **Action** | Convert to dark theme matching rest of app. Use `frontend-design` skill for tab styling refinement. |
| **Status** | [~] In progress |

### 2.7 Settings & Profile Customization

| | |
|---|---|
| **Components** | `Settings.tsx`, `ProfileCustomization` component |
| **Issues** | Limited preview, basic form layout |
| **Action** | Use `frontend-design` skill for: better form layout with live preview, improved avatar upload UI, social links editor refinement |
| **Status** | [~] In progress |

### 2.8 Landing Page Polish

| | |
|---|---|
| **Components** | `Hero.tsx`, `Footer.tsx` |
| **Issues** | Good foundation but can be elevated |
| **Action** | Use `frontend-design` skill for subtle refinements: enhanced hero visual/browser mockup, better feature card hover states, refined CTA section |
| **Status** | [x] Completed |

---

## Phase 3: Streaming & Subscriber Route Improvements

> Harden the streaming lifecycle and build subscriber management.

### 3.1 Stream Creation Error Recovery

| | |
|---|---|
| **Problem** | If Supabase save fails after Livepeer stream creation, the stream is orphaned in Livepeer |
| **Files** | `src/features/streamAPI.ts` |
| **Action** | Add retry logic for Supabase save. If retry fails, delete the Livepeer stream to rollback. Show clear error toast. |
| **Status** | [x] Completed |

### 3.2 Stream Termination Cleanup

| | |
|---|---|
| **Problem** | `terminateStream` calls Livepeer but doesn't update Supabase stream status |
| **Files** | `src/features/streamAPI.ts`, `src/lib/supabase-service.ts` |
| **Action** | Update Supabase stream record with terminated status after Livepeer termination |
| **Status** | [x] Completed |

### 3.3 Subscriber List for Creators

| | |
|---|---|
| **Problem** | Subscriptions are stored in Supabase but creators have no way to view their subscriber list |
| **Files** | `src/lib/supabase-service.ts`, `Dashboard.tsx` or `Settings.tsx` |
| **Action** | Add `getSubscribers(creatorId)` function to supabase-service.ts, add subscriber count display on dashboard, add subscriber list view in settings/channel management |
| **Status** | [x] Completed |

### 3.4 Channel Persistence

| | |
|---|---|
| **Problem** | Selected channel in `ChannelContext` resets on page refresh (no persistence) |
| **Files** | `src/context/ChannelContext.tsx` |
| **Action** | Persist `selectedChannelId` to `localStorage`, restore on mount |
| **Status** | [x] Completed |

### 3.5 Integrate Clip Creation

| | |
|---|---|
| **Problem** | `createStreamClip()` exists in `livepeer.ts` but has no UI integration |
| **Files** | `src/components/templates/player/player/Player.tsx`, `src/lib/livepeer.ts` |
| **Action** | Wire up the existing Clip button in player controls to call `createStreamClip()` |
| **Status** | [x] Completed |

---

## Phase 4: Video End-to-End Flow

> Ensure video upload → processing → playback → gating works completely.

### 4.1 Video Upload Error Handling

| | |
|---|---|
| **Problem** | If TUS upload succeeds but Supabase save fails, orphaned video in Livepeer |
| **Files** | `src/components/UploadVideoAsset.tsx` |
| **Action** | Add error handling — if Supabase save fails, show retry option. Don't close modal until both succeed. |
| **Status** | [x] Completed |

### 4.2 Video Metadata on Creator Profile

| | |
|---|---|
| **Problem** | Videos on creator profile page may not show full metadata (title, pricing, description) |
| **Files** | `src/components/templates/creator/CreatorProfile.tsx` |
| **Action** | Ensure video cards pull enriched data (from Phase 1.1 fix), display properly |
| **Status** | [x] Completed |

### 4.3 Video Playback Integration

| | |
|---|---|
| **Problem** | Video player on dashboard and creator profile needs consistent behavior |
| **Files** | `src/components/templates/dashboard/Dashboard.tsx`, `CreatorProfile.tsx` |
| **Action** | Ensure clicking a video card opens proper playback with gating (if paid), consistent across dashboard and creator profile |
| **Status** | [x] Completed |

### 4.4 Video Payment Gate Consistency

| | |
|---|---|
| **Problem** | `VideoPaymentGate` may not handle all payment scenarios identically to `StreamPaymentGate` |
| **Files** | `src/components/VideoPaymentGate.tsx` |
| **Action** | Ensure monthly subscription logic, localStorage persistence, and Supabase subscription recording all work identically to stream payment gate (using shared `useWalletAddress` hook from Phase 1.4) |
| **Status** | [x] Completed |

---

## Phase 5: Polish & Integration Testing

> Final pass for consistency and completeness.

### 5.1 Loading & Error States Audit
- [ ] Review all pages for consistent loading skeletons and error states
- [ ] Replace remaining plain `<Spinner />` with contextual loading skeletons
- [x] Add error boundaries for critical routes

### 5.2 Mobile Responsiveness Pass
- [ ] Test all redesigned components at mobile breakpoints
- [ ] Ensure chat panel, player controls, and modals work on small screens
- [ ] Verify bottom nav interactions

### 5.3 Toast Notifications Consistency
- [ ] Audit all user actions for proper success/error toast feedback
- [ ] Ensure Sonner toasts match dark theme

### 5.4 End-to-End Flow Testing
- [ ] **Stream flow**: Create → Go Live → View → Chat → Gate → Pay → Watch → Terminate
- [ ] **Video flow**: Upload → Process → Display → Gate → Pay → Watch

---

## Phase 6: XMTP Channel Group Chat (New)

> Build a dedicated channel chat experience in the middle section, backed by XMTP groups with creator-admin controls.

### 6.1 Dedicated Chat Routing

| | |
|---|---|
| **Goal** | Clicking `Chat` in bottom nav opens dedicated chat page in middle section for creator/viewer routes |
| **Files** | `src/components/BottomNav.tsx`, `src/app/dashboard/[creatorId]/chat/page.tsx`, `src/app/creator/[creatorId]/chat/page.tsx`, `src/components/templates/dashboard/Dashboard.tsx`, `src/components/templates/creator/CreatorProfile.tsx` |
| **Status** | [x] Completed |
| **Notes** | Supports username routes and `channelId` query fallback to selected/default channel |

### 6.2 XMTP Client + Realtime Messaging Layer

| | |
|---|---|
| **Goal** | Add XMTP browser client bootstrap, conversation creation/lookup, history load, live stream subscription, and sending |
| **Files** | `src/lib/xmtp-chat.ts` |
| **Status** | [x] Completed |
| **Notes** | Uses browser EOA signer flow with Privy wallet provider, conversation stream with reconnect retry, dedupe, and ordered message state |

### 6.3 Channel-to-Group Mapping Persistence

| | |
|---|---|
| **Goal** | Persist one XMTP group per channel playback ID |
| **Files** | `src/lib/supabase-service.ts`, `src/lib/supabase-types.ts`, `supabase/channel-chat-schema.sql` |
| **Status** | [x] Completed |
| **Notes** | Preferred storage: `channel_chat_groups` table. Fallback: hidden marker in stream notifications for environments without migration |

### 6.4 Access Control + Subscriber Membership Sync

| | |
|---|---|
| **Goal** | Creator is group admin, subscribers are granted access, non-subscribers blocked |
| **Files** | `src/components/templates/chat/ChannelChatExperience.tsx`, `src/lib/supabase-service.ts`, `src/lib/xmtp-chat.ts` |
| **Status** | [x] Completed |
| **Notes** | Viewer access checks `users.Channels`; creator flow syncs subscriber addresses into XMTP group membership |

### 6.5 Immersive Chat UI

| | |
|---|---|
| **Goal** | Build a modern, fun, immersive group chat interface with polished UX/motion and mobile-ready layout |
| **Files** | `src/components/templates/chat/ChannelChatExperience.tsx` |
| **Status** | [x] Completed |
| **Notes** | Includes atmospheric layered background, reaction strip, sticky composer, message bubble hierarchy, and explicit access/connect states |

### 6.6 Validation Tasks (Pending)

- [ ] Run live multi-user XMTP verification with creator + at least one subscriber wallet in browser
- [ ] Apply `supabase/channel-chat-schema.sql` in production Supabase for durable mapping without fallback marker
- [ ] Confirm subscriber auto-access for new subscribers after creator membership sync event
- [ ] **Subscriber flow**: Subscribe → View content → Unsubscribe
- [ ] **Profile flow**: Create → Edit → View public profile
- [ ] **Auth flow**: Login → Dashboard → Logout → Login again

---

## Execution Order & Dependencies

```
Phase 1 (Foundation) ← Must complete first
  ↓
Phase 2 (UI Redesign) ← Can start after Phase 1, uses frontend-design skill
  ↓
Phase 3 (Streaming Routes) ← Can run parallel with Phase 2
  ↓
Phase 4 (Video E2E) ← Depends on Phase 1.1 (asset enrichment)
  ↓
Phase 5 (Polish) ← Final pass after all phases
```

## Key Files Reference

| Area | Files |
|------|-------|
| **Streaming** | `src/features/streamAPI.ts`, `src/features/streamSlice.ts` |
| **Video/Assets** | `src/features/assetsAPI.ts`, `src/features/assetsSlice.ts` |
| **Chat** | `src/features/chatAPI.ts`, `src/features/chatSlice.ts` |
| **Profile** | `src/features/profileAPI.ts`, `src/features/profileSlice.ts` |
| **User State** | `src/features/userSlice.ts` |
| **Redux Store** | `src/store/store.ts` |
| **Supabase Service** | `src/lib/supabase-service.ts`, `src/lib/supabase-types.ts` |
| **Livepeer** | `src/utils/api.ts`, `src/lib/livepeer.ts` |
| **Hooks** | `src/app/hook/useStreamGate.ts`, `useAssetGate.ts`, `useProfile.ts`, `usePlaybckInfo.ts`, `useViewerMetrics.ts`, `useLivepeerAnalytics.ts` |
| **Contexts** | `src/context/ChannelContext.tsx`, `src/context/StreamContext.tsx` |
| **Auth** | `src/components/AuthGuard.tsx`, `src/app/auth/login/page.tsx` |
| **Payment Gates** | `src/components/CreatorPaymentGate.tsx`, `StreamPaymentGate.tsx`, `VideoPaymentGate.tsx` |
| **Dashboard** | `src/components/templates/dashboard/Dashboard.tsx`, `Header.tsx`, `Analytics.tsx`, `DashboardBroadcast.tsx` |
| **Player** | `src/components/templates/player/player/Player.tsx` |
| **Creator** | `src/components/templates/creator/CreatorProfile.tsx`, `CreatorChannelCard.tsx` |
| **Landing** | `src/components/templates/landing/Hero.tsx` |
| **Navigation** | `src/components/Sidebar.tsx`, `src/components/BottomNav.tsx` |
| **Monetization** | `src/components/templates/monetization/Monetization.tsx` |
| **Settings** | `src/components/templates/settings/Settings.tsx` |
| **Cards** | `src/components/Card/Card.tsx`, `ChannelCardRedesign.tsx` |

## Verification Checklist

- [ ] Run `npm run build` after each phase to verify no regressions
- [ ] Test each user flow manually in dev (`npm run dev`)
- [ ] Verify dark theme consistency across all pages
- [ ] Test mobile layouts at 375px and 768px breakpoints
- [ ] Verify payment gating works for free, one-time, and monthly modes

---

## Recent Implementation Log (Handover)

> Last updated: **February 26, 2026**

### Completed / Updated Since Initial Plan

1. **Dedicated livestream route architecture stabilized**
- Added dedicated creator/viewer live routes:
  - `/dashboard/:creatorId/live/:playbackId`
  - `/creator/:creatorId/live/:playbackId`
- Preserved canonical username routing and reduced route churn/reloads.
- Files:
  - `src/app/dashboard/[creatorId]/live/[playbackId]/page.tsx`
  - `src/app/creator/[creatorId]/live/[playbackId]/page.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`

2. **Livestream playback reliability hardening**
- Improved source handling and failover behavior in live playback hook to reduce false offline/reset loops.
- Updated stream activity syncing between creator broadcast status and viewer-facing state.
- Files:
  - `src/app/hook/useLivePlaybackInfo.ts`
  - `src/components/templates/dashboard/DashboardBroadcast.tsx`
  - `src/lib/supabase-service.ts`

3. **Viewer/creator live page UX redesign**
- Built immersive live layout: dominant video panel, donation strip, and right-side live chat panel.
- Added mobile-first optimizations for video, chat, and donation interactions.
- Files:
  - `src/components/templates/player/player/Player.tsx`
  - `src/components/templates/dashboard/DashboardBroadcast.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`

4. **Desktop chat collapse + expanded livestream viewport**
- Added collapsible right chat rail on desktop for both creator and viewer live pages.
- Added collapsed-state unread indicators.
- Files:
  - `src/components/templates/player/player/Player.tsx`
  - `src/components/templates/dashboard/DashboardBroadcast.tsx`

5. **Legacy livestream links normalized**
- Updated old `/view/:playbackId` behavior to redirect into dedicated creator live route where possible.
- Updated share/play links in cards and broadcast surfaces to point to canonical live routes.
- Files:
  - `src/app/view/[playbackId]/page.tsx`
  - `src/components/templates/creator/PublicStreamCard.tsx`
  - `src/components/Card/Card.tsx`
  - `src/components/templates/stream/broadcast/Broadcast.tsx`

6. **Invite-code-gated creator access at channel creation**
- Enforced creator invite access before channel creation while keeping regular viewer signup intact.
- Added redeem flow in settings/profile customization path.
- Files:
  - `src/components/templates/settings/ProfileCustomization.tsx`
  - `src/lib/supabase-service.ts`

7. **Creator/video URL and navigation consistency**
- Moved video playback to dedicated URLs under creator namespace.
- Added creator-aware back-label behavior and dashboard routing.
- Files:
  - `src/components/templates/creator/CreatorProfile.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`

8. **Livestream mode management moved into Dashboard Settings**
- Added `Livestream Mode` toggle in **Stream & Video Settings** (`Free` / `Paid`).
- Paid amount input now shown only when mode is paid; hidden when free.
- Removed mode selection buttons from stream setup modal.
- Stream setup modal now follows configured settings mode and only shows paid amount field when applicable.
- Files:
  - `src/components/templates/settings/ProfileCustomization.tsx`
  - `src/components/StreamSetupModal.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`

9. **Navigation update: channel settings moved out of bottom nav**
- Removed `Channel Settings` from mobile bottom navigation, leaving three actions: `Shop`, `Watch`, `Chat`.
- Added `Settings` into owned-channel three-dot menu with exact order: `Settings`, `Install`, `Share`.
- Wired `Settings` action to route creators to dashboard settings with channel context (`/dashboard/settings?channelId=<playbackId>`).
- Files:
  - `src/components/BottomNav.tsx`
  - `src/components/ChannelOptionsMenu.tsx`
  - `src/components/Sidebar.tsx`

10. **Mobile UX optimization for new channel menu behaviors**
- Increased mobile tap target size for channel option triggers in sidebar channel rows.
- Improved mobile bottom-sheet interactions:
  - consistent close behavior on action
  - safe-area-aware bottom padding
  - cleaner toast-based feedback for share/install flow
- Preserved menu order and creator-only settings visibility in mobile options sheet.
- Files:
  - `src/components/Sidebar.tsx`
  - `src/components/MobileSidebar.tsx`

11. **Creator channel tile sizing consistency**
- Standardized creator-owned channel tiles to use the same compact visual size as subscriber-side channel tiles.
- Applied to both owner dashboard and owner view of creator profile.
- Files:
  - `src/components/templates/dashboard/Dashboard.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`

12. **Sidebar compact redesign (desktop + shared channel lists)**
- Reduced desktop sidebar footprint for a denser, cleaner layout.
- Moved/anchored visual hierarchy in header: small logo top-left, collapse control top-right.
- Tightened owned/subscribed channel list cards, text, avatar sizes, and bottom action links to match compact aesthetic.
- Applied consistently across dashboard layout, creator profile layout, and streamviews layout.
- Files:
  - `src/app/dashboard/layout.tsx`
  - `src/app/streamviews/page.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/SidebarBottomLinks.tsx`
  - `src/components/Logo.tsx`

13. **Viewer livestream gifting UX refresh**
- Reworded viewer-facing livestream tip flow from `Donate` to `Gift`.
- Replaced static donation preset strip with progressive interaction:
  - single `Gift` CTA button
  - smooth transition into a 2x2 gift amount grid on click
  - close action to collapse back to single `Gift` button
- Updated success/error and notification copy to use gift terminology while preserving existing payment plumbing.
- File:
  - `src/components/templates/player/player/Player.tsx`

14. **XMTP chat initialization reliability hardening**
- Fixed repeated `Connecting to XMTP room...` timeout regressions by removing rejected-client cache lock-in.
- Increased XMTP client init timeout and reduced startup overhead (`disableDeviceSync`) for better first-connect reliability.
- Switched local dev runtime from Turbopack to standard Next dev server to avoid XMTP worker/runtime instability in this project setup.
- Files:
  - `src/lib/xmtp-chat.ts`
  - `package.json`

15. **XMTP room bootstrap guard + missing-table fallback hardening**
- Serialized chat initialization to avoid duplicate concurrent XMTP bootstraps in development strict mode.
- Added defensive handling for `channel_chat_groups` raw 404/throw paths so lookup safely falls back instead of aborting.
- Updated viewer flow to resolve room mapping before XMTP client registration; if mapping is missing, viewer is blocked with provisioning guidance instead of entering a failing connect loop.
- Files:
  - `src/components/templates/chat/ChannelChatExperience.tsx`
  - `src/lib/supabase-service.ts`

16. **XMTP stream stability patch (WASM closure-drop mitigation)**
- Replaced manual `for await` message stream consumption with XMTP browser SDK callback-based `conversation.stream({ onValue })`.
- Added idempotent stream close handling to avoid recursive/duplicate `return()` calls during teardown/reconnect.
- Retained compatibility fallback for older `streamMessages()` implementations.
- File:
  - `src/lib/xmtp-chat.ts`

17. **Bottom navigation active-state exclusivity fix**
- Replaced per-item broad route matching with a single derived active key so only one bottom-nav item can be highlighted at a time.
- Added explicit active priority (`Shop` modal > `Chat` routes > `Watch` routes) to prevent dual highlight on chat pages.
- Excluded dashboard settings route from watch highlight.
- File:
  - `src/components/BottomNav.tsx`

18. **Subscriber auto-access hardening for channel XMTP chat**
- Made profile/subscription lookups wallet-case-insensitive (`ilike`) to avoid false "not subscribed" blocks caused by checksum/lowercase mismatch.
- Added case-insensitive channel membership logic for subscribe/unsubscribe and subscriber list resolution, including fallback scan for legacy mixed-case `Channels` entries.
- Added dedicated `isUserSubscribedToCreator(...)` helper and wired chat access checks to it.
- Added creator-side background membership sync (30s cadence while chat is open) so newly subscribed users are automatically added without requiring manual creator refresh.
- Added subscriber-side self-membership sync attempt on chat open for faster join when permissions allow.
- Files:
  - `src/lib/supabase-service.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

19. **Channel chat subscriber eligibility expanded to paid memberships**
- Extended chat eligibility checks to include both:
  - creator-follow subscriptions (`users.Channels`)
  - active paid stream subscriptions (`streams.subscriptions` / `streams.Users`) for the specific channel playback.
- Updated creator-side XMTP member sync source to include all eligible chat addresses from both subscription models.
- Added subscriber-side post-auth sync retry window to reduce false provisioning blocks during eventual membership propagation.
- Files:
  - `src/lib/supabase-service.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

20. **Automatic subscriber chat access retry loop (no manual retry required)**
- Replaced provisioning hard-block path with automatic background access retries for subscribers.
- Subscriber flow now stays in connecting/syncing state and re-attempts room join until membership propagation completes.
- Increased creator-side background XMTP member sync cadence from 30s to 10s for faster inclusion of newly subscribed wallets.
- Added XMTP conversation lookup fallback (`listGroups`/`list`) when direct `getConversationById` is briefly stale after membership updates.
- Files:
  - `src/components/templates/chat/ChannelChatExperience.tsx`
  - `src/lib/xmtp-chat.ts`

21. **XMTP member invite propagation upgrade**
- Updated creator membership sync to invite subscribers by XMTP identifiers (wallet addresses) in addition to inbox-id based adds.
- This avoids missed adds when inbox resolution is delayed and improves welcome/invite delivery for newly registered subscriber wallets.
- Kept inbox-id add path as fallback for compatibility and completeness.
- File:
  - `src/lib/xmtp-chat.ts`

22. **XMTP installation limit resilience (10/10)**
- Switched XMTP client storage from ephemeral (`dbPath: null`) to deterministic persistent DB path per wallet/environment so page reloads reuse installation identity.
- Added automatic recovery for installation-cap errors:
  - resolve inbox ID from wallet identifier
  - fetch inbox installation state
  - revoke stale installations via `Client.revokeInstallations(...)`
  - retry client creation once
- Added explicit user-facing error fallback when recovery cannot complete.
- File:
  - `src/lib/xmtp-chat.ts`

23. **Group chat message delivery + persistent history reliability**
- Updated group send flow to non-optimistic send + explicit publish to improve cross-member message delivery consistency.
- Added paginated XMTP history loading (descending windows with sent timestamp cursor) to retain larger persistent message history per channel room.
- Added client-side periodic history reconciliation poll as a fallback in case realtime stream misses transient updates.
- Files:
  - `src/lib/xmtp-chat.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

24. **XMTP transient cursor-sync error hardening**
- Added shared transient XMTP error detection helper and guarded the initialization path against cursor/sync spikes.
- Made `getConversationById` resilient to transient direct-lookup failures by continuing into list-based fallback instead of throwing.
- Made paginated history loading tolerate transient sync/cursor errors by returning partial history rather than failing initialization.
- Updated channel chat init error handling to auto-retry transient sync failures in connecting state instead of switching to terminal error state.
- Files:
  - `src/lib/xmtp-chat.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

25. **XMTP client init URL error mitigation**
- Removed custom `dbPath` override from XMTP client options and reverted to SDK-managed default persistent database path.
- This avoids browser URL-construction failures observed during `Client.create(...)` while preserving persistent installation storage.
- File:
  - `src/lib/xmtp-chat.ts`

26. **XMTP duplicate welcome / membership re-invite suppression**
- Expanded transient XMTP sync detection to include duplicate welcome cursor cases (`already processed`, `welcome with cursor`, `already in group`).
- Refactored group member sync to compute existing members first and only invite truly missing members, reducing repeated welcome processing loops.
- Kept identifier-based adds for unresolved inbox IDs as fallback while preserving duplicate-safe handling.
- File:
  - `src/lib/xmtp-chat.ts`

27. **Group chat sender identifiers upgraded to usernames**
- Added XMTP inbox-to-wallet resolution helper via `preferences.getInboxStates(...)` to map message sender inbox IDs to Ethereum wallet identifiers.
- Added chat-side sender label cache that resolves wallet addresses to app usernames (`users.displayName`) and falls back to short wallet/inbox labels.
- Message bubbles now display usernames (or stable wallet fallback) instead of raw inbox-id prefixes.
- Files:
  - `src/lib/xmtp-chat.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

28. **Persistent channel chat history + creator clear control**
- Added durable group-chat persistence writes to Supabase `chats` table with duplicate guard (`stream_id + sender_identifier + message + timestamp`).
- Updated XMTP channel chat initialization to hydrate persisted history on load/re-auth and merge with live XMTP history.
- Added channel chat clear marker persistence on stream notifications and enforced UI filtering so pre-clear messages remain hidden after reload.
- Added creator-only `Clear history` action in channel chat header; clears persisted rows and advances clear marker.
- Added realtime clear-marker sync via stream row subscriptions so open viewer/creator chat sessions clear immediately when creator clears history.
- Files:
  - `src/lib/supabase-service.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

29. **Supabase chats schema bootstrap**
- Added `supabase/chats-schema.sql` for environments missing the `chats` table (resolves 404 on `/rest/v1/chats` and enables persistent chat history).
- Includes table creation, indexes, and baseline RLS policies for read/insert/delete.
- File:
  - `supabase/chats-schema.sql`

30. **Duplicate sent-message rendering fix (chat frontend)**
- Removed optimistic local append on send to prevent immediate local echo + XMTP stream echo duplication.
- Strengthened in-memory merge deduping with:
  - exact id dedupe
  - exact sender/timestamp/content signature dedupe
  - near-duplicate guard for same sender+content within a short time window.
- File:
  - `src/components/templates/chat/ChannelChatExperience.tsx`

31. **XMTP image sharing in channel group chat**
- Added image attachment send support through XMTP Browser SDK attachment flow (`conversation.sendAttachment(...)`) with size guard for direct attachment limits.
- Extended chat message normalization to decode attachment payloads, classify image/file types, and expose image data URLs for inline rendering.
- Added image picker button to the composer and inline image rendering in message bubbles.
- File:
  - `src/lib/xmtp-chat.ts`
  - `src/components/templates/chat/ChannelChatExperience.tsx`

32. **WASM closure crash guard for XMTP message normalization**
- Hardened all XMTP message extraction helpers (`id`, `content`, `sender`, `timestamp`, `attachment`) with defensive try/catch so malformed or dropped wasm-backed message objects do not throw into UI callbacks.
- Wrapped history and stream normalization loops to skip problematic messages instead of propagating runtime exceptions.
- Goal: prevent `closure invoked recursively or after being dropped` from crashing the chat page.
- File:
  - `src/lib/xmtp-chat.ts`

33. **Stability-first chat update path (polling fallback)**
- Removed live XMTP stream callback subscription from channel chat UI to avoid wasm callback lifecycle crashes in browser runtime.
- Switched to fast history polling (`1.5s`) for near-realtime updates without callback-closure instability.
- File:
  - `src/components/templates/chat/ChannelChatExperience.tsx`

34. **WASM closure crash mitigation via durable chat transport split**
- Removed recurring XMTP history reads from the viewer UI path (no repeated `conversation.messages(...)` calls during active chat session).
- Kept XMTP for message send/membership, but moved live chat rendering to Supabase persisted history + realtime inserts (`subscribeToChatMessages`) with periodic DB reconciliation poll.
- Added initialization run-generation guards to prevent stale async XMTP setup steps from mutating state after cleanup/HMR cycles.
- Updated outbound send/image flows to:
  - send through XMTP,
  - append locally immediately,
  - persist once to Supabase for cross-user realtime delivery and reload persistence.
- Ensured outbound persisted sender labels use creator/subscriber display names (or short wallet fallback), never local-only labels like `"You"`.
- Added image URL rendering from XMTP text prefix (`__image__:`) so image sharing stays stable without wasm attachment callbacks.
- File:
  - `src/components/templates/chat/ChannelChatExperience.tsx`

35. **Cross-member chat visibility + persistence hardening**
- Added dual-source chat hydration so members always see each other:
  - Supabase `chats` realtime + periodic DB refresh (fast shared updates),
  - XMTP group history sync fallback every few seconds (covers DB policy/migration gaps and preserves group message continuity).
- Added in-flight guards for XMTP history sync to avoid overlapping reads.
- Updated chat persistence service to fail-open for Supabase RLS/permission errors (401/403/42501) so group chat remains functional instead of hard-failing sends.
- Updated chat realtime subscription error handling to detect and mark persistence-unavailable sessions cleanly.
- Updated `supabase/chats-schema.sql` to allow `anon` + `authenticated` insert/delete policies for this wallet-auth (non-Supabase-auth) client architecture.
- Files:
  - `src/components/templates/chat/ChannelChatExperience.tsx`
  - `src/lib/supabase-service.ts`
  - `supabase/chats-schema.sql`

36. **Username-first sender identity in channel group chat**
- Upgraded sender label resolution to map both wallet addresses and XMTP inbox IDs to app usernames.
- Added inbox-id to wallet resolution via XMTP inbox state lookup, then profile-name resolution for display.
- Updated outbound message persistence to always resolve and save sender usernames (fallback short wallet), removing id-like sender labels from viewer-side chat bubbles.
- File:
  - `src/components/templates/chat/ChannelChatExperience.tsx`

37. **Viewer-side sender name fallback reliability**
- Added deterministic known-member inbox mapping:
  - resolves channel eligible wallet members to XMTP inbox IDs,
  - caches inbox->wallet mappings locally,
  - resolves wallets to usernames for both live and historical chat messages.
- Added technical-label filtering so persisted/realtime sender labels that look like IDs/truncated ids do not override resolved usernames.
- Added fallback profile resolution for realtime rows with wallet sender IDs but missing clean labels.
- Files:
  - `src/components/templates/chat/ChannelChatExperience.tsx`
  - `src/lib/xmtp-chat.ts`

38. **Seamless groupchat image upload bucket fallback**
- Updated shared `uploadImage(...)` helper to auto-fallback across available buckets when requested bucket is missing/unavailable.
- New behavior attempts preferred bucket first, then cached working bucket, then known fallbacks (`user-avatars`, `stream-logos`) without interrupting user flow.
- Added clearer terminal error messaging only when all buckets are unavailable or blocked by storage policy.
- File:
  - `src/lib/supabase-service.ts`

39. **Livepeer key exposure reduction + server-only analytics proxying**
- Removed client-side Livepeer bearer injection from shared API utility and routed all Livepeer API calls through `/api/livepeer`.
- Updated analytics hook to use server proxy (`/api/livepeer/stream/:id/metrics`) instead of direct browser calls with public API keys.
- Removed server fallback to `NEXT_PUBLIC_STUDIO_API_KEY`; server Livepeer client now requires `LIVEPEER_API_KEY` only.
- Files:
  - `src/utils/api.ts`
  - `src/app/hook/useLivepeerAnalytics.ts`
  - `src/lib/livepeer.ts`

40. **Livepeer proxy route hardening (path/method/payload controls)**
- Added strict allowlisting for read/write Livepeer proxy paths:
  - read: stream metadata + analytics data endpoints only
  - write: stream create, stream patch, stream delete/terminate only
- Added payload field allowlisting for write calls:
  - create: `name`, `record`, `playbackPolicy`, `creatorId`
  - patch: `name`, `record`, `playbackPolicy`
- Added creator-bound write checks:
  - required `x-creator-id` for write operations
  - stream-owner verification for patch/delete/terminate against Livepeer stream creator metadata.
- Files:
  - `src/app/api/livepeer/[...path]/route.ts`
  - `src/features/streamAPI.ts`

41. **Dynamic icon SVG sanitization**
- Sanitized creator avatar URLs to `http/https` only before embedding in generated SVG.
- Removed inline SVG `onerror` script attribute and normalized initials fallback to alphanumeric.
- Added icon-size bounds enforcement (`64..1024`) to prevent oversized render/memory abuse via untrusted query params.
- File:
  - `src/app/api/icon/[creatorId]/route.ts`

42. **UI regression fix after Livepeer proxy hardening**
- Restored required Livepeer proxy coverage for existing UI paths that were unintentionally blocked:
  - read: `/asset`, `/asset/:id`, `/playback/:id`
  - write: `/asset/request-upload`, `/asset/:id` (delete)
- Kept write-path security intact by requiring and validating `x-creator-id` on asset writes and enforcing owner checks on asset delete operations.
- Updated asset upload/delete callers to pass creator header consistently so upload, dashboard asset loading, and deletion flows do not break.
- Files:
  - `src/app/api/livepeer/[...path]/route.ts`
  - `src/features/assetsAPI.ts`
  - `src/components/UploadVideoAsset.tsx`

43. **Channel chat page: compact channel info tile**
- Added a dedicated compact presentation mode for channel profile tiles when chat is open, so the chat timeline gets more vertical space.
- Reduced tile density (avatar/text/padding), suppressed non-essential blocks (bio/social links), and kept quick URL copy + action affordances.
- Applied compact behavior consistently for both creator dashboard chat route and viewer creator chat route.
- Files:
  - `src/components/templates/creator/CreatorChannelCard.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`

44. **Privy migration compatibility for channel creation**
- Added environment fallback so `PrivyProvider` supports both `NEXT_PUBLIC_PRIVY_ENVIRONMENT_ID` and `NEXT_PUBLIC_PRIVY_APP_ID`.
- Hardened wallet address resolution to include `user.wallet.address` fallback (in addition to linked wallets/accounts) for newer Privy onboarding shapes.
- Unified creator address resolution in channel access/setup flows to use shared `useWalletAddress()` hook.
- This prevents false "wallet not connected" / blocked create-channel flows after rotating to a fresh Privy app key.
- Files:
  - `src/app/layout.tsx`
  - `src/app/hook/useWalletAddress.ts`
  - `src/components/SidebarBottomLinks.tsx`
  - `src/components/templates/settings/ProfileCustomization.tsx`

45. **Privy wallet compatibility rollout across core app flows**
- Replaced remaining `linkedAccounts`-only wallet derivation with shared `useWalletAddress()` in primary navigation, dashboard, creator/profile, setup, and settings paths.
- Updated wallet-dependent creator flows (channel setup, stream creation, upload metadata save, viewer/creator route resolution) to avoid breaking when Privy account shape differs after key/app migration.
- Preserved existing video/livestream/chat logic and behavior while hardening wallet identity resolution.
- Files:
  - `src/components/Sidebar.tsx`
  - `src/components/BottomNav.tsx`
  - `src/components/templates/dashboard/Dashboard.tsx`
  - `src/components/UserSetupModal.tsx`
  - `src/components/templates/settings/settings.tsx`
  - `src/components/UploadVideoAsset.tsx`
  - `src/components/Header.tsx`
  - `src/components/templates/creator/CreatorProfile.tsx`
  - `src/components/templates/dashboard/ProfileColumn.tsx`
  - `src/app/dashboard/profile/page.tsx`
  - `src/app/dashboard/order-history/page.tsx`
  - `src/components/templates/analytics/Analytics.tsx`
  - `src/components/CreateLivestream.tsx`
  - `src/components/templates/stream/broadcast/Broadcast.tsx`

46. **Creator invite access hardening for mixed-case wallets**
- Fixed invite-access checks to avoid false denials caused by mixed-case wallet IDs across old/new Privy account states.
- Updated creator invite verification to:
  - canonicalize wallet IDs,
  - keep RPC checks,
  - fallback to case-insensitive grant lookup when RPC returns false for legacy-cased rows.
- Updated invite redemption to persist canonicalized creator IDs consistently.
- Improved livestream creation error surfacing so API 4xx reasons are shown directly in the UI.
- Files:
  - `src/lib/supabase-service.ts`
  - `src/features/streamAPI.ts`
  - `src/components/CreateLivestream.tsx`

47. **Dev UI rendering stability hardening (stale chunk/cache mitigation)**
- Fixed service worker behavior to prevent stale app shell/chunk caching from breaking localhost rendering.
- New behavior:
  - In development: `/api/sw` returns a self-unregistering worker that clears caches and disables SW persistence.
  - In production: SW caches only selected static assets; it explicitly bypasses `/_next/*` and `/api/*` requests.
- Hardened Livepeer proxy route with network error handling to return structured `502` responses instead of uncaught exceptions during upstream timeouts.
- Files:
  - `src/app/api/sw/route.ts`
  - `src/app/api/livepeer/[...path]/route.ts`

### Current Open Work / Next Handover Targets

1. **Formal E2E validation sweep**
- Run full manual scenarios for creator and viewer across:
  - Free livestream
  - Paid livestream
  - Video payment paths

2. **Remaining Phase 5 checklist items**
- Build verification (`npm run build`) and final cross-breakpoint UX QA.
- Toast/message consistency review.

3. **Optional cleanup**
- Consolidate legacy livestream route surfaces once all entry points fully migrate to canonical creator live URLs.
