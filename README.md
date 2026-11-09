## Lanche do Mega

QR ordering and a kitchen display for a Brazilian burger shop. The app is mobile-first and supports a local demo mode plus Supabase Realtime.

### Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/mesa/04` for table 04 or `http://localhost:3000/cozinha` for the kitchen. Without Supabase environment variables, orders use browser local storage and sync between tabs on the same origin. Submit an order in one tab and watch it appear in the kitchen tab.

### Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202611090001_init.sql` in the Supabase SQL editor or with the Supabase CLI.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
4. Create an email/password user in Supabase Auth for each kitchen operator.
5. Add each operator to `public.kitchen_staff` using their Auth user UUID:

```sql
insert into public.kitchen_staff (user_id)
values ('AUTH_USER_UUID');
```

Restart the dev server after changing environment variables. Guest submissions go through the `create_customer_order` database function, which calculates prices from the seeded catalog. Kitchen reads and status updates require an authenticated user listed in `kitchen_staff`; order rows are published through Supabase Realtime.

### Routes and structure

- `src/app/mesa/[table_id]`: QR-linked customer menu, customization, cart, and order submit.
- `src/app/cozinha`: staff KDS with live timers, chronological tickets, audio alert, and status flow.
- `src/lib`: shared menu, order types, demo storage, and Supabase client.
- `supabase/migrations`: PostgreSQL schema, seed menu, RPC, RLS, and Realtime publication.
- `public/sw.js` and `src/app/manifest.ts`: installable PWA shell and offline fallback.

The customer menu and add-on prices in `src/lib/menu.ts` are mirrored in the migration seed; keep both in sync when editing the catalog. The food illustrations are local PNGs. Activate the kitchen sound control after opening the dashboard; browsers require a user gesture before playing audio.

### Checks

```bash
npm run lint
npm run build
```
