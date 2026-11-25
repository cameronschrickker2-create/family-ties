---
name: brand-build
description: Run the studio's full Brand Build for a business, from intake to launch. Use whenever the user says things like "let's build a brand management plan for <business>", "brand build for <business>", "do the full package for <client>", or asks for a business's brand plan together with any of a website, shop, ordering app, CRM, dashboard or marketing video.
---

# Brand Build

The studio sells one connected package: research, brand identity, website, shop and ordering, operations apps, CRM and dashboards, motion-graphics ads, and launch. This skill runs it the way the Northside build was run. Work through the phases in order, show the client-facing result of each phase as soon as it exists, and do not stop to ask between phases unless a decision is genuinely the user's.

Reference build (copy from it, don't reinvent): GitHub repo `cameronschrickker2-create/family-ties`, branch `claude/cannabis-delivery-video-mptejm`:
- `marketing/video.html`, `marketing/render.js`, `marketing/music.py`: code-rendered motion-graphics ad and its synthesized score
- `northside-app/`: website, shop, live tracking, driver app, admin CRM, end-to-end test
- Public site build: repo `cameronschrickker2-create/northside`, folder `docs/`

## 0. Intake

Ask once, in one message (or one AskUserQuestion round for the choices). Skip anything the user already said.

- Business name, what it sells or does, and where (suburbs, radius, delivery or visit)
- Who buys, how they order today, average order or job value
- Products or services with prices and options
- Competitors, businesses they admire, names to avoid
- Assets they have: logo, photos, domain, social accounts, payment methods
- Rules that apply: age limits, licences, health or financial rules, POPIA
- Package: Launch Kit (research, identity, website, one ad), Growth Build (+ shop, CRM, dashboards, two ads), or Full Build (all modules incl. tracking and staff/driver app)

## 1. Research and name check

- Research the market, competitors, prices and the area with web search and Firecrawl data providers. Open the pages you cite.
- **Name and trademark check before any design.** Search for existing businesses using the name, tagline or slogan in the same region. Northside had to drop "the spot" late because another store used it; catch this on day one.
- Note any legal limits for the industry and tell the user plainly.

## 2. Brand management plan (Claude Docs)

Create a doc titled `<Business>: Brand Management Plan` with sections: positioning in one sentence, audience, competitors, name and tagline, identity (palette, type, logo idea, tone of voice), channels and content plan, the modules in scope with dates, KPIs to track, risks. Fill one section per call while the user watches.

## 3. Identity

- Pick a palette as tokens (ink, accent, paper, one pop colour) and three type roles (display, body, mono). Choose for this business; avoid stock AI looks. Fonts from Google Fonts or `@fontsource`.
- Logo mark: a simple SVG (the Northside pin with an initial is the pattern). Put tokens in one `base.css` that every app imports, so a rebrand is one edit.

## 4. Marketing video (motion graphics, 9:16, ~26 s)

- Build scenes on a single canvas in `video.html` with `draw(t)`; render frames with Playwright (`render.js`) and pipe to ffmpeg. Beat structure at 112 BPM: cold open, names flashing on the beat, the product or service in action, how it works, logo, legal end card.
- Look that reads as human-made: film grain, camera shake on hits, masked text reveals, kinetic type, a real map or real place names, no AI footage.
- Music: synthesize an original track with `music.py` (numpy/scipy), loudness -14 LUFS. Voiceover: ElevenLabs with a voice that fits the market; if generation is busy, ship without and offer it after.
- Export: master, a social copy (~15 MB), a share copy under 10 MB, and a 540p web copy for the site.

## 5. Website

- Static site: hero with a three.js product or object (floating, lit in the accent colour), sections that echo the ad, the depth-of-field carousel (`js/flow.js`), the ad embedded, the age gate if the industry needs it.
- Public hosting: GitHub Pages. Ask the user to create a public repo named after the brand with `https://github.com/new?name=<brand>&visibility=public`, attach it with `add_repo`, push the site to `main` in `docs/`, then have them enable Settings → Pages → `main` + `/docs`. URL: `https://<user>.github.io/<brand>/`. Poll it until it returns 200, then give the link.
- A claude.ai artifact link is not a public website; use it only as a private preview.

## 6. Shop, ordering, operations, CRM (Growth and Full)

Copy `northside-app/` and rebrand: products and options in `db.js`, zones and fees in settings, copy and tokens in `public/`. It already has server-side pricing, age checks, live tracking over WebSockets, a GPS driver app, the admin board, customer CRM, CSV export and a webhook for HubSpot or Zapier. Remove what the client doesn't need. Run `npm test` (Playwright end-to-end) and keep it green. For live ordering the server needs a host with a persistent disk (Render, Railway, a VPS) and an `ADMIN_PASSWORD`.

## 7. Dashboards

The admin CRM covers day-to-day stats. For an owner-facing dashboard to share, use the Artifact "Data" type with the business's real numbers and sources.

## 8. Launch and handover

Send: the public site link, the ad files, the brand plan doc, the admin and driver links with setup steps, and a short checklist of what the client must do (domain, hosting, legal). Commit and push everything.

## Lessons that save time

- This cloud session cannot open a public tunnel, cannot control the user's computer unless Remote Control actually connects, and connector uploads are capped at about 4 MB per call. Plan around these instead of retrying.
- The user prefers fast, visible progress: show screenshots or links after each phase, keep chat short, and avoid long back-and-forth.
- Never pick names, slogans or looks that copy an existing business or brand.
