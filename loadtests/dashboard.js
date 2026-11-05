// Owners and managers on the dashboard at closing time: overview, analytics,
// customer list and activity, for every business at once. These are the
// heaviest reads (aggregations over stamp history).
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

const API = __ENV.API_URL || "http://host.docker.internal:4600/api/v1";
const SECRET = __ENV.INTERNAL_API_SECRET;
const PEAK = Number(__ENV.PEAK_VUS || 60);

const owners = new SharedArray("owners", () => JSON.parse(open("./.data/seed.json")).owners);
const times = {
  overview: new Trend("overview_ms", true),
  analytics: new Trend("analytics_ms", true),
  customers: new Trend("customers_ms", true),
  activity: new Trend("activity_ms", true),
};

export const options = {
  stages: [
    { duration: "15s", target: Math.round(PEAK / 2) },
    { duration: "45s", target: PEAK },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    overview_ms: ["p(95)<800"],
    analytics_ms: ["p(95)<1000"],
    customers_ms: ["p(95)<500"],
    activity_ms: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const owner = owners[(__VU - 1) % owners.length];
  const params = {
    headers: {
      Authorization: `Bearer ${owner.token}`,
      "X-Internal-Secret": SECRET,
      "X-Client-IP": `10.1.${__VU % 250}.${(__ITER % 250) + 1}`,
    },
  };
  const base = `${API}/businesses/${owner.businessId}`;
  const get = (path, trend) => {
    const res = http.get(`${base}${path}`, params);
    trend.add(res.timings.duration);
    check(res, { [`${path} 200`]: (r) => r.status === 200 });
  };

  get("/analytics/overview", times.overview);
  get("/analytics/stamps", times.analytics);
  get("/analytics/near-completion", times.analytics);
  get("/customers?limit=25", times.customers);
  get("/stamps?limit=25", times.activity);
  sleep(1 + Math.random() * 2);
}
