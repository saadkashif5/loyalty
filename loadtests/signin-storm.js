// A crowd signing in at once (say, after a promotion): each asks for an email
// code, then sends it back wrong once and gives up. Exercises the code store,
// the per-email and per-address limits, and email sending (to a sink).
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const API = __ENV.API_URL || "http://host.docker.internal:4600/api/v1";
const SECRET = __ENV.INTERNAL_API_SECRET;
const PEAK = Number(__ENV.PEAK_VUS || 100);

const requestTime = new Trend("code_request_ms", true);
const verifyTime = new Trend("code_verify_ms", true);
const limited = new Counter("rate_limited");

export const options = {
  stages: [
    { duration: "15s", target: Math.round(PEAK / 2) },
    { duration: "40s", target: PEAK },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    code_request_ms: ["p(95)<800"],
    code_verify_ms: ["p(95)<300"],
    // Refusals by the limits are expected behaviour, not failures.
    "http_req_failed{expected_response:true}": ["rate<0.01"],
  },
};

export default function () {
  const email = `storm-${__VU}-${__ITER}@load.local`;
  const headers = {
    "Content-Type": "application/json",
    "X-Internal-Secret": SECRET,
    "X-Client-IP": `10.2.${__VU % 250}.${(__ITER % 250) + 1}`,
  };
  const params = {
    headers,
    responseCallback: http.expectedStatuses(200, 201, 400, 401, 429),
  };

  const asked = http.post(`${API}/auth/email-code`, JSON.stringify({ email }), params);
  requestTime.add(asked.timings.duration);
  if (asked.status === 429) limited.add(1);
  check(asked, { "code sent or limited": (r) => r.status === 200 || r.status === 429 });

  const challengeId = asked.status === 200 ? asked.json("data.challengeId") : null;
  if (challengeId) {
    const wrong = http.post(
      `${API}/auth/email-code/verify`,
      JSON.stringify({ email, challengeId, code: "000000" }),
      params,
    );
    verifyTime.add(wrong.timings.duration);
    check(wrong, { "wrong code refused": (r) => r.status === 400 || r.status === 401 });
  }
  sleep(0.5 + Math.random());
}
