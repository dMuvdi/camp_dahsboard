-- Staff devices subscribed to Web Push notifications from the Revelation Camp staff app (PWA).
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Each signed-in staff member manages only their own devices.
-- The server reads every row with the service role key (src/app/api/notify-signed).
create policy "Staff manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
