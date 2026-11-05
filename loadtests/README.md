# Load tests

`run.sh` seeds a throwaway database called `taptapsell_load`, starts the API in production mode with
Redis, runs a k6 script from Docker, prints the slowest database queries, then drops the database.
The seed refuses any database whose name does not contain "load".

```bash
docker compose up -d
loadtests/run.sh tap-storm.js 150   # script, peak virtual users
```

| Script | What it is |
| --- | --- |
| `tap-storm.js` | A busy lunch hour: 200 stampers across 20 businesses, 5,000 customers and 200,000 past stamps. Each user taps, collects the stamp, and waits 0.2–0.5 seconds. |
| `dashboard.js` | Owners on the dashboard at closing time: overview, analytics, customers and activity for every business, 1–3 seconds apart. |
| `signin-storm.js` | A crowd asking for sign-in codes at once, then sending one wrong code. Email goes to `smtp-sink.js`, which `run.sh` starts and which keeps nothing. |

The hourly billing run is not an HTTP load, so it has its own script. It seeds subscriptions due
for invoicing, lapsing and suspension, and times the job until it has nothing left to do:

```bash
cd api
MONGODB_URI="mongodb://localhost:27017/taptapsell_load?directConnection=true"   LOAD_SUBSCRIPTIONS=2000 npx tsx src/scripts/benchBilling.ts
```

## Reading the numbers

Results from a laptop compare one build with another. They do not predict production capacity,
because the API, MongoDB, Redis and k6 all share the machine.

Tap storm on a 4-core laptop:

| Build                     | Users | Requests/s | Tap p95 | Stamp p95 | Failed |
| ------------------------- | ----- | ---------- | ------- | --------- | ------ |
| Before caching            | 150   | 41         | 2.26 s  | 3.07 s    | 0.87%  |
| With caching and fewer reads | 150   | 56         | 1.14 s  | 1.28 s    | 0.37%  |
| With caching and fewer reads | 50    | 52         | 420 ms  | 584 ms    | 0%     |

The script's thresholds (300 ms and 500 ms) are the target for staging, and are not met here. What
limits this machine is the cost of each write, about 60 ms under load, and the single API process.
The connection failures at 150 users appear in k6 as `EOF` and have not been traced.

Dashboard, 40 users, same laptop:

| Build | Overview p95 | Analytics p95 | Customers p95 | Activity p95 | Failed |
| --- | --- | --- | --- | --- | --- |
| Before | 538 ms | 367 ms | 422 ms | 1.05 s | 0% |
| Paging indexes with `_id` tie-break | 212 ms | 193 ms | 221 ms | 226 ms | 0% |

The activity list sorts by time and then id; without the id in the index, MongoDB sorted every
stamp the business had on each request.

Sign-in code storm, 60 users: about 2,000 codes sent, code request p95 314 ms, wrong-code check
p95 118 ms, nothing failed.

Billing run, 2,000 subscriptions: every one invoiced, a third moved to past due and a third
suspended, about 96 ms per business (3 minutes for the run), 3,333 emails queued. Before the fix,
the run re-read the same first 500 subscriptions every hour and never invoiced the rest. Most of
the time goes on one invoice at a time (settings, counter, business, invoice, audit, owner emails).
