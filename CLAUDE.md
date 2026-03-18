# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npx expo start            # Start Expo dev server
npx expo start --ios      # iOS simulator
npx expo start --android  # Android emulator

# Tests
npm test                  # Run all tests once
npm run test:watch        # Watch mode
npm test -- --testPathPattern=auth  # Run a single test file by name pattern

# EAS builds
eas build --profile development --platform ios
eas build --profile production --platform ios
```

TypeScript path alias `@/*` maps to the repo root.

## Architecture

**Stack**: React Native + Expo, TypeScript, Supabase (PostgreSQL + Auth + Storage), Expo Router (file-based navigation), Zustand.

### Navigation & Auth Guard

`app/_layout.tsx` is the root. It subscribes to `supabase.auth.onAuthStateChange` and also runs `checkInitialSession` on mount. The routing logic:
- No session → do nothing (screens show sign-in prompts inline; no redirect to login)
- Session + profile `status === 'pending'` → `/pending-approval`
- Session + profile `status === 'denied'` → `/pending-approval?status=denied`
- Session + profile `status === 'active'` + onboarding not done → `/onboarding`
- Session + profile `status === 'active'` + onboarding done → `/(tabs)`

Push notification response handler (`lib/notifications/push.ts`) is registered once in the root layout. It deep-links to ticket detail or notifications tab based on `data.type` in the notification payload.

### Tab Structure

`app/(tabs)/` has five tabs: Home (map), Tickets, Contacts, Notifications, Profile. The tab layout (`app/(tabs)/_layout.tsx`) handles font loading with a 5-second timeout fallback, registers the push token on focus, and shows the unread notification badge.

`app/(tabs)/tickets.tsx` re-exports from `app/tickets/index.tsx` — tickets screens live under `app/tickets/` and are also accessible as a stack outside the tabs.

### User Roles

Five roles stored in `profiles.role` as snake_case: `owner`, `project_manager`, `subcontractor`, `designer`, `developer`. Role display labels and picker options are in `lib/constants/tickets.ts` (`PROFILE_ROLES`, `ROLE_TYPE_OPTIONS`). Subcontractors additionally have a `trade` field (see `TRADE_LABELS` in the same file).

### Home Screen / Unit Map

`app/(tabs)/index.tsx` renders a map image (`assets/labeledmap.jpeg`, 1924×1657 px) scaled to screen width. Units from Supabase have `tl_x`, `tl_y`, `br_x`, `br_y` pixel coordinates in that image's coordinate space. These are scaled by `(screenWidth / MAP_IMAGE_WIDTH)` to render clickable overlays. Unit numbers are sorted using `lib/utils/unitSort.ts` (`compareUnitNumbers`) which groups by prefix (e.g. "Downhill", "Uphill") then numeric parts then letter suffix.

### Tickets

- `app/tickets/index.tsx` — ticket list with filtering
- `app/tickets/create.tsx` — create ticket (image picker → upload → form with building element, priority, assignees)
- `app/tickets/[id].tsx` — ticket detail
- `app/tickets/[id]/comments.tsx` — ticket comments subscreen

Photo upload (`lib/services/tickets.ts`): resizes to max 1200px wide, compresses to JPEG via `expo-image-manipulator`, reads as base64 via `expo-file-system/legacy`, uploads bytes to the `ticket-photos` Supabase Storage bucket at `{userId}/{uuid}.jpg`. Signed URLs expire after 1 hour.

### Admin

`app/admin/add.tsx` and `app/admin/comments.tsx` — admin-only screens accessible from the profile tab for approving/denying pending users and managing comments.

### Onboarding

`lib/onboarding.ts` tracks completion in AsyncStorage with versioned keys (current version: `v4`). A 3-step home demo (units → tickets → notifications) runs after the initial onboarding flow. Bump `ONBOARDING_VERSION` when onboarding content changes to force all users through it again.

### Notifications

- **Push**: Expo push tokens saved to `profiles.expo_push_token`. Dispatched from Supabase Edge Function `send-push-notification`. Notification data types: `new_ticket`, `ticket_assigned`, `user_approval`.
- **SMS**: Supabase Edge Function `send-sms-notification` using Twilio. Requires secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.

### Key Files

| Path | Purpose |
|------|---------|
| `lib/supabase/client.ts` | Supabase client (AsyncStorage-backed session persistence) |
| `lib/constants/config.ts` | Supabase URL and anon key |
| `lib/constants/tickets.ts` | TRADE_LABELS, BUILDING_LABELS, PRIORITY_LABELS, PROFILE_ROLES, ROLE_TYPE_OPTIONS |
| `lib/services/auth.ts` | signIn, signUp, signOut, getCurrentUser, getSession, resetPasswordForEmail |
| `lib/services/tickets.ts` | uploadTicketPhoto, getSignedTicketPhotoUrl |
| `lib/notifications/push.ts` | registerAndSavePushToken, setNotificationResponseHandler |
| `lib/onboarding.ts` | AsyncStorage-backed onboarding state |
| `lib/utils/unitSort.ts` | unitSortKey, compareUnitNumbers |
| `lib/utils/phone.ts` | formatPhoneNumberDisplay, formatPhoneNumberInput |
| `lib/navigation.ts` | navigateToSignIn helper |
| `components/CustomPicker.tsx` | Single-select picker component |
| `components/CustomMultiPicker.tsx` | Multi-select picker component |
| `components/TicketPhoto.tsx` | Photo display with signed URL loading |

### Tests

Tests live in `__tests__/` subdirectories next to source. Jest runs in Node environment (not React Native runtime). Covered: auth service, ticket photo upload/signing, unit sort, and constants.
