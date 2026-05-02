# Invite Operations

Who That!? is invite-only for the friends-and-family phase. There is deliberately no admin UI in v1; invite access is managed through the `whitelisted_emails` table.

Run these snippets from the Supabase SQL editor against the production project. Replace placeholder values before running.

## Add an Invitee

```sql
insert into public.whitelisted_emails (email)
values (lower(trim('friend@example.com')))
on conflict (email) do nothing
returning email, invited_by, created_at;
```

If you want to record who added the invitee, set `invited_by` to the operator/admin user UUID:

```sql
insert into public.whitelisted_emails (email, invited_by)
values (lower(trim('friend@example.com')), '00000000-0000-0000-0000-000000000000')
on conflict (email) do nothing
returning email, invited_by, created_at;
```

After adding the email, ask the invitee to sign in with that exact email address. Supabase sends the magic link.

## Remove an Invitee

```sql
delete from public.whitelisted_emails
where email = lower(trim('friend@example.com'))
returning email, created_at;
```

Removing an email from `whitelisted_emails` prevents `/api/me` from allowing that email on future app entry checks. It does not invalidate already-issued Supabase sessions by itself. For immediate revocation, also invalidate the user's Supabase session from the Supabase dashboard.

## Find a User's Encounters

Use this when an invited user asks for support and you need to inspect only their records.

```sql
select
  e.id,
  e.user_id,
  u.email,
  e.name,
  e.location,
  e.datetime,
  e.context,
  e.created_at
from public.encounters e
left join auth.users u on u.id = e.user_id
where lower(u.email) = lower('friend@example.com')
order by e.datetime desc;
```

For a name or context search within that user's encounters:

```sql
select
  e.id,
  e.user_id,
  u.email,
  e.name,
  e.location,
  e.datetime,
  e.context,
  e.created_at
from public.encounters e
left join auth.users u on u.id = e.user_id
where lower(u.email) = lower('friend@example.com')
  and (
    e.name ilike '%' || 'sam' || '%'
    or e.location ilike '%' || 'sam' || '%'
    or coalesce(e.context, '') ilike '%' || 'sam' || '%'
  )
order by e.datetime desc;
```

## Handle a Subject-Deletion Request

A subject-deletion request comes from someone whose name appears in another user's encounter, even if the subject is not a Who That!? user. Friends-and-family v1 handles this manually.

First, search for likely matching records. Use the subject's name plus any known location/context to narrow matches.

```sql
select
  e.id,
  e.user_id,
  u.email as owner_email,
  e.name,
  e.location,
  e.datetime,
  e.context,
  e.created_at
from public.encounters e
left join auth.users u on u.id = e.user_id
where e.name ilike '%' || 'subject name' || '%'
   or coalesce(e.context, '') ilike '%' || 'subject name' || '%'
order by e.created_at desc;
```

Review the result set before deleting. Do not delete by name alone if there are ambiguous matches. Once the exact encounter IDs are confirmed, delete only those IDs:

```sql
delete from public.encounters
where id in (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111'
)
returning id, user_id, name, location, datetime;
```

If the request should remove every likely mention across all owners, repeat the search with additional known details and delete only the confirmed matches.

## Invite-Only Message Locations

Non-allow-listed users are surfaced in these places:

- Server: `/api/me` returns HTTP 403 with `error: "invite_only"` and the message `Your email isn't on the invite list yet. Request access from the operator and try again.`
- Client: `client/src/App.tsx` shows the signed-in invite-only screen after `/api/me` returns 403.
- Client: `client/src/pages/sign-in.tsx` warns that early access is invite-only before the user requests a magic link.

When debugging a screenshot from a blocked user, confirm the email they used for Supabase sign-in exactly matches the email in `public.whitelisted_emails`.
