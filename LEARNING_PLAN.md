# Fireside Field Reporting App - Learning Plan

This is a step-by-step guide to build the Fireside South Peak Field Reporting App from scratch. Follow each phase in order, and don't move to the next until you understand what you've built.

## Prerequisites

- Basic React/React Native knowledge
- TypeScript basics
- Understanding of REST APIs
- Expo basics (or willingness to learn)

## Phase 1: Project Setup & Understanding (Day 1)

### 1.1 Understand the Project Structure
- Review the spec document
- Understand the 5 user roles and their permissions
- Map out the user flows (login → map → create report → view tickets)

### 1.2 Set Up Your Development Environment
- Ensure Node.js 18+ is installed
- Install Expo CLI: `npm install -g expo-cli` (optional, you can use npx)
- Verify your Supabase project is set up
- Test that `npm install` works

### 1.3 Create Basic Project Structure
Create these folders:
```
fireside/
├── app/              # Expo Router screens
├── components/       # Reusable UI components
├── lib/              # Business logic & utilities
│   ├── supabase/    # Supabase client
│   └── services/    # API services
├── types/           # TypeScript types
└── constants/       # App constants
```

### 1.4 Create Your First Screen
- Create `app/index.tsx` with a simple "Hello World" screen
- Test it runs: `npx expo start`
- Understand Expo Router file-based routing

**Learning Goal:** Get comfortable with Expo Router and see your first screen render.

---

## Phase 2: Supabase Setup & Types (Day 2)

### 2.1 Set Up Supabase Client
- Create `lib/supabase/client.ts`
- Initialize Supabase client with your keys
- Test connection with a simple query

**Resources:**
- [Supabase JS Client Docs](https://supabase.com/docs/reference/javascript/introduction)
- [Expo + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)

### 2.2 Create TypeScript Types
- Create `types/database.ts`
- Define types for: User, Unit, Ticket, TicketAssignment, UnitAssignment
- Match types to your database schema
- Use these types throughout your app

**Learning Goal:** Understand how TypeScript types help catch errors early.

### 2.3 Create Constants
- Create `constants/colors.ts` - Define your color palette
- Create `constants/trades.ts` - List of building trades
- Create `constants/roles.ts` - User roles and permissions

**Learning Goal:** Centralize configuration for easy maintenance.

---

## Phase 3: Authentication Flow (Days 3-4)

### 3.1 Create Auth Service
- Create `lib/services/auth.ts`
- Implement: `signUp()`, `signIn()`, `signOut()`, `getCurrentUser()`
- Handle errors gracefully
- Test each function

**Key Concepts:**
- Supabase Auth API
- Async/await patterns
- Error handling

### 3.2 Build Login Screen
- Create `app/(auth)/login.tsx`
- Add email/password inputs
- Add "Create Account" and "Forgot Password" links
- Connect to your auth service
- Handle loading and error states

**Learning Goal:** Understand form handling and state management in React Native.

### 3.3 Build Registration Screen
- Create `app/(auth)/register.tsx`
- Add all required fields (name, email, phone, password, role, trade)
- Implement role-based trade selection (only show for subcontractors)
- Create user in Supabase Auth + users table
- Set status to 'pending'
- Show confirmation message

**Learning Goal:** Learn conditional rendering and form validation.

### 3.4 Set Up Auth Guard
- Create `app/_layout.tsx`
- Check if user is authenticated
- Redirect to login if not authenticated
- Check user status (pending/denied users can't access)
- Set up navigation structure

**Learning Goal:** Understand protected routes and navigation guards.

---

## Phase 4: Home Screen - Unit Map (Days 5-6)

### 4.1 Create Basic Map Layout
- Create `app/(tabs)/index.tsx`
- Display your map image
- Set up basic styling

### 4.2 Create Unit Map Data
- Create `constants/unitMap.ts`
- Map each unit to coordinates (x, y, width, height as percentages)
- This will take time - measure your map image carefully
- Start with 2-3 units to test, then add the rest

**Tip:** Use an image editor to find pixel coordinates, then convert to percentages.

### 4.3 Load Units from Supabase
- Create `lib/services/units.ts` (or add to tickets service)
- Query units table
- Display units on map as clickable overlays
- Show unit numbers

### 4.4 Add Status Indicators
- Query ticket counts per unit
- Color code units: Green (0 tickets), Yellow (1-5), Red (6+)
- Update colors when ticket counts change

**Learning Goal:** Learn data fetching, state management, and conditional styling.

---

## Phase 5: Report Creation Flow (Days 7-9)

### 5.1 Camera Integration
- Create `app/create-report/index.tsx`
- Use `expo-camera` to capture photos
- Handle permissions
- Allow retake/use photo

**Resources:**
- [Expo Camera Docs](https://docs.expo.dev/versions/latest/sdk/camera/)

### 5.2 Details Screen
- Create `app/create-report/details.tsx`
- Display captured photo
- Add building element dropdown
- Add notes textarea (500 char limit)
- Add priority selector (Low/Medium/High)
- Validate inputs

### 5.3 Contact Selection
- Create `app/create-report/recipients.tsx`
- Load contacts from Supabase
- Filter by role, trade, unit
- Implement search functionality
- Multi-select contacts
- Auto-add unit's project manager

**Learning Goal:** Learn complex filtering, search, and multi-select patterns.

### 5.4 Confirmation & Send
- Create `app/create-report/confirm.tsx`
- Display summary of report
- Upload photo to Supabase Storage
- Create ticket in database
- Create ticket assignments
- Send notifications (we'll do this in Phase 7)

**Learning Goal:** Learn file uploads and database transactions.

---

## Phase 6: Tickets Management (Days 10-11)

### 6.1 Create Tickets Service
- Create `lib/services/tickets.ts`
- Implement: `createTicket()`, `getTicketsForUser()`, `getTicketById()`, `completeTicket()`
- Handle role-based filtering (subcontractors see only assigned, PMs see their units, etc.)

### 6.2 Tickets List Screen
- Create `app/(tabs)/tickets.tsx`
- Display tickets with filtering/sorting
- Show ticket cards with key info
- Implement pull-to-refresh
- Handle empty states

### 6.3 Ticket Detail Screen
- Create `app/ticket/[id].tsx`
- Display full ticket information
- Show photo with zoom capability
- Display assigned contacts
- Add "Mark as Complete" button (conditional based on permissions)
- Implement completion flow with notes

**Learning Goal:** Learn dynamic routes, detail views, and permission-based UI.

---

## Phase 7: Notifications (Days 12-13)

### 7.1 Set Up Push Notifications
- Create `lib/hooks/usePushNotifications.ts`
- Request permissions
- Get Expo push token
- Register token with user account
- Handle notification taps

**Resources:**
- [Expo Notifications Docs](https://docs.expo.dev/push-notifications/overview/)

### 7.2 Create Notification Service
- Create `lib/services/notifications.ts`
- Implement SMS sending (via Supabase Edge Function)
- Implement email sending (via Supabase Edge Function)
- Implement push notifications (via Supabase Edge Function)

### 7.3 Create Supabase Edge Functions
- Create `supabase/functions/send-sms/index.ts`
- Create `supabase/functions/send-email/index.ts`
- Create `supabase/functions/send-push/index.ts`
- Deploy functions to Supabase
- Test each notification type

**Learning Goal:** Learn serverless functions and external API integrations.

---

## Phase 8: Contacts & Profile (Day 14)

### 8.1 Contacts Directory
- Create `app/(tabs)/contacts.tsx`
- Create `lib/services/contacts.ts`
- Display all contacts with search/filter
- Show contact cards with call/email options
- Implement role-based filtering

### 8.2 Profile Screen
- Create `app/(tabs)/profile.tsx`
- Display user information
- Add logout functionality
- For admins: Show pending approvals section
- Implement approve/deny functionality

**Learning Goal:** Learn admin features and conditional UI based on roles.

---

## Phase 9: Polish & Testing (Days 15-16)

### 9.1 UI/UX Improvements
- Add loading states everywhere
- Improve error messages
- Add empty states
- Ensure consistent styling
- Test on both iOS and Android

### 9.2 Testing
- Test all user flows
- Test each role's permissions
- Test error scenarios (network failures, etc.)
- Get feedback from potential users

### 9.3 Performance
- Optimize image loading
- Add caching where appropriate
- Ensure smooth navigation

---

## Learning Resources

### Essential Docs
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### When You Get Stuck
1. Read the error message carefully
2. Check the official documentation
3. Search Stack Overflow
4. Check Expo/Supabase Discord communities
5. Use console.log() to debug

---

## Key Concepts to Master

1. **State Management**: useState, useEffect, Context API
2. **Navigation**: Expo Router file-based routing
3. **Data Fetching**: Async/await, error handling
4. **Forms**: Controlled inputs, validation
5. **Permissions**: Camera, notifications, etc.
6. **File Uploads**: Supabase Storage
7. **Real-time Updates**: Supabase Realtime (optional)
8. **TypeScript**: Types, interfaces, generics

---

## Tips for Success

1. **Build incrementally**: Don't try to build everything at once
2. **Test frequently**: After each feature, test it works
3. **Read error messages**: They usually tell you what's wrong
4. **Use TypeScript**: It will catch many errors before runtime
5. **Keep it simple**: Don't over-engineer early features
6. **Ask questions**: When stuck, ask for help (but try to solve it first)

---

## Project Checklist

Use this to track your progress:

- [ ] Phase 1: Project setup
- [ ] Phase 2: Supabase & types
- [ ] Phase 3: Authentication
- [ ] Phase 4: Unit map
- [ ] Phase 5: Report creation
- [ ] Phase 6: Tickets management
- [ ] Phase 7: Notifications
- [ ] Phase 8: Contacts & profile
- [ ] Phase 9: Polish & testing

---

Good luck! Take your time, understand each concept before moving on, and don't hesitate to experiment. Building this app will teach you a lot about React Native, Expo, and full-stack development.
