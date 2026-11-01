// A busy lunch hour: customers tap a stamper, then collect the stamp.
// Each virtual user holds one stamper, so tap counters only ever rise, and
// sends a different client address per visit, as the portal server does.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

const API = __ENV.API_URL || "http://host.docker.internal:4600/api/v1";
const SECRET = __ENV.INTERNAL_API_SECRET;
const PEAK = Number(__ENV.PEAK_VUS || 150);

const seed = new SharedArray("seed", () => [JSON.parse(open("./.data/seed.json"))]);
const tapTime = new Trend("tap_ms", true);
const stampTime = new Trend("stamp_ms", true);

export const options = {
  stages: [
    { duration: "20s", target: Math.round(PEAK / 3) },
    { duration: "30s", target: PEAK },
    { duration: "40s", target: PEAK },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    tap_ms: ["p(95)<300"],
    stamp_ms: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

function headers(extra) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return {
    "Content-Type": "application/json",
    "X-Internal-Secret": SECRET,
    "X-Client-IP": `10.${octet()}.${octet()}.${octet()}`,
    ...extra,
  };
}

// Set in the setup step so a rerun against the same data keeps counters rising.
const startCounter = Math.floor(Date.now() / 1000) % 8_000_000;

export default function () {
  const { stampers, customers } = seed[0];
  const stamper = stampers[(__VU - 1) % stampers.length];
  const pool = customers[stamper.business];
  const token = pool[Math.floor(Math.random() * pool.length)];
  const counter = (startCounter + __ITER + 1).toString(16).toUpperCase().padStart(6, "0");

  const tap = http.post(
    `${API}/taps`,
    JSON.stringify({
      deviceIdentifier: stamper.deviceIdentifier,
      params: { m: `${stamper.tagUid}x${counter}` },
    }),
    { headers: headers() },
  );
  tapTime.add(tap.timings.duration);
  if (!check(tap, { "tap accepted": (r) => r.status === 201 })) return;

  const stamp = http.post(
    `${API}/stamps`,
    JSON.stringify({ tapToken: tap.json("data.tapToken") }),
    {
      headers: headers({
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": `load-${__VU}-${__ITER}-${startCounter}`,
      }),
    },
  );
  stampTime.add(stamp.timings.duration);
  check(stamp, { "stamp recorded": (r) => r.status === 201 });

  sleep(0.2 + Math.random() * 0.3);
}
