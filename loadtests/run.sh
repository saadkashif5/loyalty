#!/usr/bin/env bash
# Seeds a throwaway database, runs the API in production mode, and runs one k6
# script from Docker. Needs `docker compose up -d`. Numbers from a laptop only
# compare one build with another; they do not predict production capacity.
#   loadtests/run.sh [script] [peak virtual users]
set -u
SCRIPT=${1:-tap-storm.js}
PEAK=${2:-150}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRET=load-test-internal-secret-that-is-long-enough
export MONGODB_URI="mongodb://localhost:27017/taptapsell_load?directConnection=true"
export REDIS_URL=redis://localhost:6379
export NODE_ENV=production PORT=4600 RATE_LIMIT_MAX=1000000
export INTERNAL_API_SECRET=$SECRET CORS_ORIGINS=http://localhost:3000
export JWT_ACCESS_SECRET=load-test-access-secret-that-is-long-enough
export JWT_REFRESH_SECRET=load-test-refresh-secret-that-is-long-enough
export MFA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
export EMAIL_TRANSPORT=smtp SMTP_URL=smtp://localhost:2525 EMAIL_FROM=load@example.com
# api/.env may switch two-step verification off for local testing; production refuses that.
export SKIP_MFA=false

docker exec taptapsell-mongo mongosh --quiet taptapsell_load --eval 'db.dropDatabase().ok' > /dev/null
# Production mode sends real email; this accepts it and throws it away.
node "$ROOT/loadtests/smtp-sink.js" 2525 > "$ROOT/loadtests/.data/smtp.log" 2>&1 &
SINK=$!
cd "$ROOT/api"
NODE_ENV=development npx tsx src/scripts/seedLoad.ts || exit 1

npx tsx "${SERVER_ENTRY:-src/server.ts}" > "$ROOT/loadtests/.data/api.log" 2>&1 &
until curl -s -o /dev/null http://localhost:4600/health; do sleep 1; done

# Records queries over 5 ms; printed below, slowest total first.
mongo() { docker exec taptapsell-mongo mongosh --quiet taptapsell_load --eval "$1"; }
mongo 'db.setProfilingLevel(1, { slowms: 5 }).ok' > /dev/null

MSYS_NO_PATHCONV=1 docker run --rm -v "$ROOT/loadtests:/scripts" \
  -e INTERNAL_API_SECRET=$SECRET -e PEAK_VUS=$PEAK \
  grafana/k6:0.54.0 run --quiet --summary-trend-stats="avg,med,p(95),p(99),max" "/scripts/$SCRIPT"
STATUS=$?

echo "--- slow queries (count, total ms, operation)"
mongo 'db.system.profile.aggregate([{$group:{_id:{ns:"$ns",op:"$op",plan:"$planSummary",keys:{$objectToArray:{$ifNull:["$command.filter",{}]}}},n:{$sum:1},ms:{$sum:"$millis"}}},{$sort:{ms:-1}},{$limit:14}]).forEach(r=>print(r.n,r.ms,r._id.ns.split(".")[1],r._id.op,r._id.plan||"",r._id.keys.map(k=>k.k).join(",")))'

PID=$(netstat -ano | grep LISTENING | grep ":4600 " | awk '{print $NF}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F > /dev/null
kill "$SINK" 2> /dev/null
docker exec taptapsell-mongo mongosh --quiet taptapsell_load --eval 'db.dropDatabase().ok' > /dev/null
exit $STATUS
