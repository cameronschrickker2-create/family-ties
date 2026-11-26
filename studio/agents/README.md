# Ensign crew

Five agents run Ensign Studio's outreach and back office. Their shared memory and live deck is **Ensign HQ**: https://claude.ai/artifact/AgAXqWGyP4a174XFErEL3h

| Agent | Job | Schedule (SAST) | Tools |
| --- | --- | --- | --- |
| Lookout | Finds and scores small businesses with weak online presence | Weekdays 06:47 | Firecrawl, HQ |
| Herald | Sends first emails and lawful follow-ups (cap in HQ settings) | Weekdays 08:23 | Gmail, HQ |
| Signalman | Tracks replies, bounces, opt-outs; drafts replies to interested leads | Daily 09:13, 12:13, 15:13, 20:13 | Gmail, HQ |
| Quartermaster | Client stages, next actions, stalled work, Friday report draft | Weekdays 19:37 | Gmail, HQ |
| Purser | Matches payments to invoices, drafts overdue reminders | Daily 07:52 | Gmail, HQ |

Shifts fire into one dedicated session ("Ensign Crew") that holds the Gmail and Firecrawl connectors.
`_common.md` is shared by every agent; `<agent>.md` is each role; `prompt-<agent>.txt` is the assembled shift message.

Outreach rules: South African leads get one email only (POPIA); UK/AU/US at most two follow-ups; only publicly listed business addresses; every email has an opt-out and opt-outs are permanent; US only with a postal address in settings. The kill switch is Settings → "Herald may send emails" in HQ.
