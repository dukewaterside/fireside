# Fireside South Peak Field Reporting App

A React Native mobile application for field reporting on the Fireside South Peak construction project.

## Getting Started

1. **Read the Learning Plan**: Open `LEARNING_PLAN.md` and follow it step by step
2. **Install Dependencies**: `npm install`
3. **Start Development**: `npx expo start`

## Project Structure

```
fireside/
├── app/              # Expo Router screens & routes
│   ├── (tabs)/       # Tab screens (Home, Contacts, Notifications, Profile)
│   ├── tickets/     # Ticket list, detail, create
│   ├── sign-in.tsx
│   ├── create-account.tsx
│   ├── reset-password.tsx
│   └── pending-approval.tsx
├── components/      # Reusable UI components
├── lib/              # Business logic & utilities
│   ├── constants/    # App constants (config, tickets)
│   ├── services/    # Auth, tickets, etc.
│   ├── supabase/    # Supabase client
│   └── navigation.ts
├── assets/           # Images, icons, splash
└── docs/             # Planning docs
```

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Language**: TypeScript
- **Navigation**: Expo Router

## Learning Approach

This project is designed for learning. Follow the `LEARNING_PLAN.md` guide which breaks down the build into manageable phases. Don't rush - understand each concept before moving on.

## Testing

Run unit tests with `npm test` (or `npm run test:watch` for watch mode). After `npm install`, Jest runs all tests under `**/__tests__/**/*.test.ts`.

**What’s covered:**

- **Auth** (`lib/services/__tests__/auth.test.ts`): signIn, signOut, signUp, resetPasswordForEmail (including rate limit and email-not-authorized message rewriting), getCurrentUser, getSession.
- **Tickets** (`lib/services/__tests__/tickets.test.ts`): uploadTicketPhoto, getSignedTicketPhotoUrl (success, null/empty, signing failure, non-bucket URL).
- **Unit sort** (`lib/utils/__tests__/unitSort.test.ts`): unitSortKey and compareUnitNumbers so “Downhill 6-7” and similar unit labels sort correctly in the All Units list.
- **Constants** (`lib/constants/__tests__/tickets.test.ts`): TRADE_LABELS, BUILDING_LABELS, PRIORITY_LABELS, PROFILE_ROLES, ROLE_TYPE_OPTIONS.

## Notifications Setup

### Push notifications (Expo + APNs)

This project sends push notifications from Supabase Edge Function `send-push-notification` and registers Expo tokens in `profiles.expo_push_token`.

For iOS production/TestFlight push, provide:

- Apple **Team ID**
- APNs auth key file (`.p8`)
- APNs **Key ID** (example: `QS96372U5W`)
- Apple account access to configure EAS iOS credentials

### SMS notifications (Twilio)

This project sends SMS notifications from Supabase Edge Function `send-sms-notification` (triggered on `public.notifications` inserts).

Set these Edge Function secrets in Supabase:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (E.164, e.g. `+18601234567`)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Current Status

- ✅ Project initialized
- ✅ Dependencies installed
- ⏳ Ready for you to start building!

Follow `LEARNING_PLAN.md` to begin.
