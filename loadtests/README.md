# Load tests

`run.sh` seeds a throwaway database called `taptapsell_load`, starts the API in production mode with
Redis, runs a k6 script from Docker, prints the slowest database queries, then drops the database.
The seed refuses any database whose name does not contain "load".

```bash
docker compose up -d
loadtests/run.sh tap-storm.js 150   # script, peak virtual users
```

`tap-storm.js` is a busy lunch hour: 200 stampers across 20 businesses, 5,000 customers and 200,000
past stamps. Each user taps, collects the stamp, and waits 0.2–0.5 seconds.

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
