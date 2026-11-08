# Firecrawl compatibility

Tested with @mendable/firecrawl-js **4.52.0**, using `new Firecrawl({apiKey, apiUrl: baseUrl + '/compat/firecrawl'})` followed by `client.scrape(url, {formats:['markdown'], onlyMainContent:true, maxAge:0})`. This is one tested subset, not universal drop-in compatibility.

| Option | Support |
|---|---|
| url | Public HTTP(S), guarded and tenant-metered |
| markdown/html/links | String formats only, maximum three |
| onlyMainContent | true or omitted; false rejected |
| waitFor | 0 only; waiting is not implemented |
| timeout | 20000 or omitted; bounded synchronous wait |
| maxAge | Milliseconds 0..86,400,000 mapped down to whole seconds |
| origin | Bounded SDK attribution; never forwarded to targets |
| Idempotency-Key | Native replay contract |
| actions, headers, cookies, proxies, extraction, other formats/options | UNSUPPORTED_OPTION; never silently ignored |
| Other endpoints | Not implemented |

HTTP page 1 credit; cache hit 0. Account/connection caps apply. Content is bounded to 32,000 characters and native retained result handles/cursors are returned under aihackr metadata. At synchronous deadline, cancellation stops future work; the returned job ID exposes final settlement. Started work may still finish. No arbitrary client retry is claimed idempotent without a stable key.
