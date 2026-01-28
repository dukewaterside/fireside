# Tickets functionality + Tickets page — what to do

This doc outlines how to add full ticket functionality and a Tickets screen. Right now:

- **Home screen:** “Create a ticket” in the unit popup opens the camera; the photo and unit are not yet saved or sent anywhere.
- **Supabase:** You already have a `tickets` table and related tables.

---

## 1. What you already have

### Supabase `tickets` table

| Column           | Type      | Notes                                   |
|------------------|-----------|-----------------------------------------|
| id               | uuid      | PK, default gen_random_uuid()          |
| unit_id          | uuid      | FK → units.id                           |
| created_by       | uuid      | FK → profiles.id (auth user)            |
| photo_url        | text      | URL of ticket photo                     |
| building_element | text      | e.g. 'framing', 'electrical', 'plumbing'|
| priority         | text      | 'low', 'medium', 'high'; default medium |
| notes            | text      | Optional                                |
| status           | text      | 'open', 'completed'; default open       |
| completion_notes | text      | Optional                                |
| completed_by     | uuid      | Optional FK                             |
| created_at       | timestamptz| default now()                           |
| updated_at       | timestamptz| default now()                           |
| completed_at     | timestamptz| Optional                                |

Other relevant tables: `units` (id, unit_number, map_x, map_y, …), `profiles` (id = auth.users.id), and RLS is enabled.

---


## 2. Target behavior

1. **Tickets screen (new)**  
   - New tab or route that lists tickets (e.g. for the current user, or filterable).
   - Each row: unit name, photo thumbnail, building element, priority, status, created date.
   - Tapping a row opens ticket detail (later).

2. **Create-ticket flow**  
   - From Home: user selects a unit → “Create a ticket” → camera opens (already done).  
   - After taking a photo:  
     - Upload image to Supabase Storage (e.g. bucket `ticket-photos`).  
     - Insert a row in `tickets` with:  
       - `unit_id` = selected unit’s id  
       - `created_by` = current user’s id  
       - `photo_url` = public URL of uploaded file  
       - `building_element` = chosen in a small form (or default)  
       - `priority` = chosen or default  
       - `notes` = optional  
       - `status` = 'open'  
   - Then redirect to Tickets screen or show success and stay on Home.

3. **Home “Tickets” button**  
   - Navigate to the new Tickets screen (tab or stack route).

---

## 3. Step-by-step implementation

### Step 1: Add a Tickets screen

- **Option A — New tab**  
  - Add a file under tabs, e.g. `app/(tabs)/tickets.tsx`.  
  - In `app/(tabs)/_layout.tsx`, add a `Tabs.Screen` for `tickets` (e.g. between Home and Contacts if you want).  
  - Use a “ticket” or “list” icon and title “Tickets”.

- **Option B — Stack route (no new tab)**  
  - Create `app/tickets.tsx` (or `app/tickets/index.tsx`).  
  - From Home, “Tickets” does `router.push('/tickets')` (or your path).  
  - Tickets list is a separate screen, not a tab.

Choose one and stick to it for nav consistency.

### Step 2: Wire Home “Tickets” to Tickets screen

- In `app/(tabs)/index.tsx`, find the “Tickets” button (below the map).
- Replace `console.log('Navigate to Tickets')` with:
  - `router.push('/(tabs)/tickets')` if Tickets is a tab, or  
  - `router.push('/tickets')` if it’s a stack route.

### Step 3: Storage bucket for ticket photos

- In Supabase: **Storage** → create a bucket, e.g. `ticket-photos`.
- Set policy so authenticated users can:
  - **INSERT** (upload) objects (e.g. under `{user_id}/{ticket_id}/…` or `{user_id}/…`).
  - **SELECT** (read) objects you need for thumbnails and detail.
- Decide path convention, e.g. `{user_id}/{ticket_id}/photo.jpg` or `{user_id}/{uuid}.jpg`.

### Step 4: Create-ticket flow after camera

Right now “Create a ticket” closes the modal and opens the camera. Add a “post-camera” flow:

1. **Keep unit and photo in app state**  
   - When user taps “Create a ticket”, store `selectedUnit` (or at least `unit.id`) in a ref/state or pass via route params.
   - After `launchCameraAsync`, if `!result.canceled && result.assets[0]`, you have a local URI (and optional base64).

2. **Upload photo to Storage**  
   - Use Supabase client:  
     `supabase.storage.from('ticket-photos').upload(path, fileBody, { contentType, upsert: false })`.  
   - For React Native, you usually upload the file from local URI (e.g. via `expo-file-system` read as base64 or blob, or a small helper that turns URI into Blob/File).  
   - Build `photo_url` via `supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl` (if public) or use signed URL if private.

3. **Get current user id**  
   - `const { data: { user } } = await supabase.auth.getUser();`  
   - Use `user?.id` for `created_by`.

4. **Insert ticket**  
   - `supabase.from('tickets').insert({ unit_id, created_by: user.id, photo_url, building_element, priority, notes, status: 'open' })`.  
   - `building_element` and `priority` can come from a small form (modal or next screen) or defaults.

5. **Then**  
   - Navigate to Tickets screen and/or show “Ticket created” and close modal.

You can do “camera → simple form (building element, priority) → upload → insert → navigate” in one new screen, or in a modal that stays on Home.

### Step 5: Tickets screen — list

- On load, run something like:
  - `supabase.from('tickets').select('*, units(unit_number)').order('created_at', { ascending: false })`
- Optionally filter by `created_by = auth.uid()` if you only show “my tickets”.
- Render a list (FlatList or ScrollView + map) showing at least:
  - Unit name (`units.unit_number`),
  - Thumbnail (from `photo_url`),
  - `building_element`,
  - `priority`,
  - `status`,
  - `created_at`.
- Add empty state when there are no tickets.

### Step 6: RLS and auth

- Ensure `tickets` (and `units` if needed) RLS policies allow:
  - **SELECT** for the rows the current user is allowed to see (e.g. `created_by = auth.uid()` or per-role rules).
  - **INSERT** for authenticated users, with `created_by = auth.uid()`.
- Storage policies must match the bucket design (who can upload/read).

### Step 7: Optional — ticket detail

- Add a route like `app/tickets/[id].tsx` (or under tabs).
- Load one ticket by id (with unit, creator, etc.) and show full photo, notes, status, completion fields.
- Later you can add “Complete” and “Assign” actions that update `tickets` (and maybe `ticket_assignments`).

---

## 4. Suggested order of work

1. Add the Tickets screen (tab or route) and wire Home “Tickets” to it.
2. Create Storage bucket and policies, then implement upload from a local photo URI.
3. Add a minimal “create ticket” path: unit + photo → upload → insert with defaults (e.g. `building_element: 'other'`, `priority: 'medium'`).
4. Tickets screen: fetch and list tickets, show unit name and photo.
5. Extend create flow with a real building_element (and optional priority) choice before insert.
6. Add ticket detail and any extra actions (complete, assign, etc.).

---

## 5. Small implementation notes

- **Passing unit + photo from Home to create flow**  
  - E.g. after camera: `router.push({ pathname: '/create-ticket', params: { unitId: unit.id, unitName: unit.unit_number, photoUri: result.assets[0].uri } })`  
  - Or use a global/store (e.g. Zustand) to hold “pending ticket: unit + photo” and have CreateTicket screen read from there.

- **Upload from React Native**  
  - `expo-file-system` can read the camera file URI and give base64 or a format Supabase accepts.  
  - Or use `decode` from base64 and pass to `storage.upload`; or a small `fetch(uri)` → blob pipeline if supported.

- **building_element**  
  - Your schema allows e.g. 'framing', 'electrical', 'plumbing', 'hvac', 'countertops', 'flooring', 'painting', 'windows_doors', 'roofing', 'insulation', 'drywall', 'other'. Use a picker or segmented control on the create-ticket step.

If you tell me whether you want Tickets as a tab or a separate route, and whether the create flow should be a new screen or a modal, I can outline the exact file changes and code snippets next.
