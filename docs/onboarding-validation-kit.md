# Onboarding validation kit

Qualitative only — no instrumentation, per the project ground rules. The goal:
a genuinely new user reaches their first generated report without external help.

## Recruiting

- 2–3 participants who have **never seen the app** and don't know the maintainer's involvement in its design.
- Ideal: one solo ecommerce seller, one technically comfortable volunteer.
- Give them only the Releases link and their own machine. Never the README first.

## Task script (say this, nothing more)

> "Download and install Open Merchant from this page. Use it to decide whether
> a product you're actually curious about selling is worth pursuing. Think
> out loud. If you get stuck, that's the product being tested, not you."

Do not help. Do not hint. Note everything.

## Capture sheet (per participant)

| Observation | Notes |
| --- | --- |
| Time from install to first generated report | |
| Was the first-run welcome card noticed? Read or dismissed blind? | |
| Did the six-step walkthrough guide get followed, ignored, or closed? | |
| Did the AI settings screen stop them (looking for a key they don't have)? | |
| Where did they hesitate longest? | |
| Anything they expected that wasn't there? | |
| Did they trust the economics numbers? What made that trust (or broke it)? | |
| Post-task: what would they tell a friend this tool is for? | |

## After each session

1. Write up the friction list within the hour, while memory is fresh.
2. Classify each item: confusion (copy/UX), missing affordance, or real gap.
3. Confusion and affordance items become small renderer-only fixes with tests.
4. If two or more participants hit the same wall, it blocks the "Onboarding"
   roadmap done-criteria — fix, then re-run one session to confirm.
