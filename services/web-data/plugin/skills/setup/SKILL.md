---
name: aihackr-setup
description: Connect AIHackr and inspect its public-web capabilities, prices, limits, and prepaid balance before a first request.
---

Use the host's account connection flow. Never ask for an API key in chat. The packaged production origin is proposed and requires deployment; do not claim it is live from installation alone.

Call aihackr_capabilities to identify fixture mode and unavailable providers. After account linking, call aihackr_usage. Explain that successful retrieval consumes prepaid credits within the account owner's caps, while quotes, status and pagination are free. No tool can buy credits or change caps.

Use a known public URL for the first small scrape, with a stable idempotencyKey and explicit maxCredits. Poll aihackr_job with the returned delay, then read aihackr_get_result. Report source URL, observation time, actual charge and any partial coverage. A packaged plugin is not proof of a tested connection.
