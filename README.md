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

For step-by-step instructions on setting up and running unit tests (without example test code), see **[TESTING.md](./TESTING.md)**. Run tests with `npm test`.

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
