# LYNK Developer Guide

This guide reflects the *real, current state* of the LYNK codebase as of August 2026. It is intended for the project owner to understand the architecture, data model, and security rules that have been implemented through autonomous AI agents.

## 1. Architecture Overview

LYNK is a mobile-first web application built for the IEEE CCE event.
- **Framework:** Next.js 15 (App Router) using React Server Components and Server Actions.
- **Styling:** Tailwind CSS v4.0 with a custom Neo-Brutalist design system.
- **Backend (BaaS):** Supabase provides PostgreSQL (database), GoTrue (Authentication via Google OAuth), and Storage (for selfies).
- **Request Flow:** Browser/Client components ↔ Next.js Route Handlers / Server Actions ↔ Supabase (via `@supabase/ssr` cookies and API calls).

## 2. Environment & Local Setup

### Environment Variables (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., `https://[PROJECT_ID].supabase.co`). Safe to expose to the client.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public anonymous key for Supabase. Safe to expose to the client.
- `SUPABASE_SERVICE_ROLE_KEY`: **CRITICAL**. This is a server-only key that completely bypasses Row Level Security (RLS) in Supabase. Never prefix this with `NEXT_PUBLIC_`.

### Local Setup
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env.local` file at the root with the three variables above.
4. Run `npm run dev` to start the Turbopack development server on `http://localhost:3000`.

## 3. Authentication Flow — Explained Step by Step

LYNK operates a closed-list authentication system via Google OAuth.
1. **Initiation:** User clicks "Continue with Google" on `/`. The frontend calls `supabase.auth.signInWithOAuth()`.
2. **Google Consent:** The user authorizes the app via Google's OAuth UI.
3. **The Callback Route (`src/app/api/auth/callback/route.ts`):** 
   - Google redirects the user back to `/api/auth/callback?code=...`.
   - The route exchanges the code for a Supabase session using `supabase.auth.exchangeCodeForSession(code)`.
   - It fetches the authenticated user's email.
   - It checks the `config` table using the Service Role Key. If the email is in the `admins` array, the user gets `role = 'admin'`.
   - It queries the `participants` table. If the email doesn't match an invited participant (and the user isn't an admin), they are rejected with `/?error=NotRegistered`.
   - If the participant row is already claimed by another `uid`, they are rejected with `/?error=AlreadyClaimed`.
   - On success, it creates/updates a record in the `users` table and links the `participants` row by updating `claimed_by_uid`.
   - Finally, the user is redirected to `/home`.

## 4. Data Model

The schema is defined in `schema.sql`.
- **`participants`:** Pre-loaded attendee data. 
  - *Columns:* `id`, `name`, `email`, `department`, `paper_title`, `interest`, `clue_text`, `unique_code`, `claimed_by_uid`, `connections_made_count`, `created_at`. 
  - *Note:* Completely locked down by RLS. The client can *never* query this directly; it uses RPCs.
- **`users`:** Represents logged-in accounts.
  - *Columns:* `uid` (FK to auth.users), `display_name`, `email`, `photo_url`, `participant_id`, `role`, `created_at`.
- **`connections`:** The log of verified (and rejected) human bingo connections.
  - *Columns:* `id`, `from_uid`, `to_participant_id`, `fact_learned`, `selfie_url`, `status` (pending/verified/rejected), `submitted_code`, `created_at`, `verified_at`.
  - *Constraints:* A unique index exists on `(from_uid, to_participant_id)` where `status = 'verified'` to prevent duplicates.
- **`config`:** Global event settings.
  - *Columns:* `id` ('main'), `admins` (text array), `event_active`, `leaderboard_visible`, `total_participants`.

## 5. Feature Breakdown, Page by Page

- **`/` (Login):** The landing page. Contains only the Google Auth button. Handled by `page.tsx`.
- **`/home`:** The main grid of clues. Users tap clues to open the connection modal. Powered by `get_clue_grid()` RPC.
- **`/leaderboard`:** A ranked list of top connectors. Powered by `get_leaderboard()` RPC.
- **`/scrapbook`:** A personalized timeline of the user's verified connections, showing the target's real name, department, fact, and uploaded selfie. Powered by `get_scrapbook()` RPC.
- **`/profile`:** Shows the user's Google avatar, role (Participant/Admin), total connections, and a sign-out button.
- **`/admin`:** Admin dashboard. Visible only if `userProfile.role === 'admin'`.

## 6. The Core Game Loop — Connection Flow End to End

1. **Discovery:** User sees a clue (e.g., "Ask me about Quantum Computing") on `/home`.
2. **Interaction:** User taps the clue, opening the `ConnectionModal`.
3. **Capture:** User takes or uploads a photo. The image is compressed in the client and uploaded to the public Supabase Storage `selfies` bucket using their `uid` as the folder name.
4. **Data Entry:** User enters the unique 4-letter code (provided by the target in person) and a fact they learned.
5. **Submission:** The client calls the `submit_connection` RPC.
6. **Server-Side RPC (`submit_connection`):**
   - Fetches the true `unique_code` from the `participants` table.
   - Checks the rate limit (if >= 5 recent rejected connections for this target, returns 'too_many_attempts').
   - If the code matches, it inserts a `verified` connection row, increments the target's `connections_made_count`, and returns 'verified'.
   - If incorrect, it logs a `rejected` connection and returns 'rejected'.
7. **Resolution:** The modal shows a success or error state based on the RPC return value.

## 7. Admin Capabilities

> **IMPORTANT**: The buttons visible on the `/admin` page (CSV Import, Event Controls, Selfie Moderation, Export Data) are **UI mockups only**. The backend infrastructure (the `config` table) exists to support them, but the frontend React logic for these tools was never built. 
> 
> Currently, to perform admin actions (like updating the participant list or toggling the leaderboard), you must use the Supabase Dashboard's Table Editor or SQL Editor.

## 8. Security Model

- **Row Level Security (RLS):** Enabled on all tables. 
- **`participants` Table:** Denies all access to anon and authenticated users. This is critical to prevent malicious clients from scraping the raw table to steal `unique_code`s or real names.
- **RPCs (Security Definer):** Because `participants` is locked down, the app exposes specific data via strictly controlled stored procedures:
  - `get_clue_grid()`: Returns only clues and connection statuses. Names/Codes are hidden.
  - `get_leaderboard()`: Returns names and scores, but *only* if the `config.leaderboard_visible` flag is true.
  - `get_scrapbook()`: Returns names and photos, but *only* for participants the caller has successfully verified a connection with.
- **`users` Recursion Fix:** The RLS policy on the `users` table uses a dedicated `get_user_role()` function to prevent infinite Postgres recursion when an admin queries the table.

## 9. Design System

The app utilizes a strictly defined Neo-Brutalist design system. If you want to change colors, fonts, or borders, you only need to edit **one file**: `src/app/globals.css`.

Relevant CSS tokens in the `@theme` block:
- **Primary Color:** `--color-primary: #00629B` (IEEE Blue)
- **Backgrounds:** `--color-bg: #FFFFFF` and `--color-bg-alt: #F7F7F2`
- **Borders:** `--border-thick: 3px` and `--border-thicker: 4px`
- **Shadows:** `--shadow-hard: 4px 4px 0px #000000` (Hard offset, zero blur).
- **Fonts:** Space Grotesk (headings) and Inter (body).

## 10. What's Easily Changeable — Configuration Points

| What to change | Where to change it |
| :--- | :--- |
| **Admin Email Allowlist** | Supabase Dashboard → Table Editor → `config` table (`admins` array). |
| **Leaderboard Visibility** | Supabase Dashboard → Table Editor → `config` table (`leaderboard_visible` boolean). |
| **Rate-Limit Threshold** | `schema.sql` (Line 119) inside `submit_connection` RPC (`IF v_recent_failures >= 5 THEN`). |
| **Theme Colors/Shadows** | `src/app/globals.css` (Lines 4-35). |
| **Fonts** | `src/app/layout.tsx` (to load the Google font) AND `src/app/globals.css` (to apply it to CSS variables). |

## 11. Known Issues & Tech Debt

- **Admin UI:** As noted in Section 7, the admin dashboard is entirely cosmetic. CSV parsing and config mutation must be built if you want to avoid using the Supabase dashboard manually on event day.
- **QA Artifacts:** The dev auth-bypass route (`api/auth/backdoor`) and the `test-agent@example.com` dummy user were **successfully deleted** during QA. The application is currently secure and running strict production auth.
- **DB Column Mismatch handled via RPC:** In `schema.sql`, the `connections` table has a column named `fact_learned`. The frontend originally expected `fact_text`. This was resolved inside the `get_scrapbook` RPC by aliasing `c.fact_learned as fact_text` rather than migrating the table schema.

## 12. Deployment

To deploy to Vercel:
1. Push this repository to GitHub.
2. In Vercel, click "Add New Project" and import the repo.
3. In the Environment Variables settings, you **must** add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Required for the Next.js API routes to bypass RLS during auth callbacks).
4. Deploy. Vercel will automatically run `npm run build` using Turbopack.

## 13. Troubleshooting

If you encounter issues during future development, reference these known bugs we already solved:
- **Turbopack CSS Panics:** Do not put `@import url(...)` (like Google Fonts) underneath the `@import "tailwindcss"` directive in `globals.css`. Next.js 15 Turbopack will crash. Load fonts via `next/font/google` in `layout.tsx` instead.
- **Postgres Infinite Recursion:** If you edit RLS policies on the `users` table and try to query `users` from within the policy, Postgres will throw a `stack depth limit exceeded` error. Use a `SECURITY DEFINER` RPC function to fetch the role instead.
- **`400 Bad Request` on connections:** The frontend profile page was querying `.eq("connector_uid")`. The correct column name in the database is `from_uid`.
- **Google OAuth token exchange fails (`4/0A` error):** This means the Client Secret in the Supabase Dashboard does not match the one in the Google Cloud Console. Regenerate it in Google Cloud and paste the new secret into Supabase.
