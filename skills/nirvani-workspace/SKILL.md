---
name: nirvani-workspace
description: Use when the user asks about their Nirvani workspace or customers: contacts, leads, deals, pipelines, appointments, calendars, conversations, texts, or emails. Covers lookups, updates, booking, and messaging through the Nirvani connector tools (nirvani_*).
---

# Working in a Nirvani workspace

The Nirvani connector exposes eighteen tools prefixed `nirvani_`. Read tools never change data. Write tools create or change customer records and send real messages, so treat them carefully.

## Start every task from an id

- Contacts: call `nirvani_contacts_search` with the name, email, phone, or company the user gave you. Confirm the match when more than one contact comes back. Use `nirvani_contact_get` for the full profile.
- Deals: call `nirvani_pipelines_list` once to learn pipeline and stage ids, then `nirvani_opportunities_search`. Stage names in the user's words map to stage ids from the pipeline list.
- Appointments: call `nirvani_calendars_list` for calendar ids, then `nirvani_calendar_free_slots` before booking with `nirvani_appointment_book`.
- Conversations: `nirvani_conversations_search` by contact id, then `nirvani_conversation_messages` for the thread.
- Unsure which workspace is connected: call `nirvani_whoami`.

## Before any write

State exactly what will change and ask the user to confirm: the contact, the field values, the stage or status, the appointment time and calendar, or the message text and channel. Then call one write tool. After it returns, report the record id so the user can refer to it later.

## Messages

- SMS needs a plain text message. Keep it short and include the business name when the contact may not recognize the number.
- Email needs a subject plus a plain text body (html is optional). Do not send marketing to many contacts from this connector; it is for one conversation at a time.

## Reading results

Tool results carry a one line summary followed by JSON. Summarize for the user in prose or a short table: names, stage, value, next appointment, last message. Do not paste raw JSON unless the user asks for it.

## When a tool reports an error

- "connection is read-only": the user connected without write access. Ask them to reconnect Nirvani in Claude and allow write access.
- "workspace connection needs attention": the workspace's platform connection must be reconnected by the Nirvani admin. Tell the user; nothing on their side fixes it.
- "no longer enabled" or "access was removed": the workspace or the user's membership was revoked by the Nirvani admin.
- Validation messages name the field to fix. Adjust and retry once.

## Dates and times

Use ISO 8601 with the workspace timezone offset when booking or listing appointments, for example `2026-11-03T14:00:00-06:00`. `nirvani_whoami` reports the workspace timezone.
