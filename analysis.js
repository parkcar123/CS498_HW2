
const http = require("http");

const INSTANCE_A = "http://34.63.253.158:8080";  // us-central1
const INSTANCE_B = "http://35.241.163.145:8080";  // europe-west1


function request(url, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


async function measureLatency() {
  console.log("\n=== Part A: Latency Measurement ===");

  const TRIALS = 10;
  const instances = [
    { label: "Instance A (us-central1)", base: INSTANCE_A },
    { label: "Instance B (europe-west1)", base: INSTANCE_B },
  ];

  for (const { label, base } of instances) {
    const registerLatencies = [];
    for (let i = 0; i < TRIALS; i++) {
      const username = `latency_test_${i}_${Date.now()}`;
      const start = Date.now();
      await request(`${base}/register`, "POST", { username });
      registerLatencies.push(Date.now() - start);
    }
    const registerAvg = (registerLatencies.reduce((a, b) => a + b, 0) / TRIALS).toFixed(1);
    const registerMin = Math.min(...registerLatencies);
    const registerMax = Math.max(...registerLatencies);
    console.log(`${label} /register: avg=${registerAvg}ms, min=${registerMin}ms, max=${registerMax}ms`);

    const listLatencies = [];
    for (let i = 0; i < TRIALS; i++) {
      const start = Date.now();
      await request(`${base}/list`);
      listLatencies.push(Date.now() - start);
    }
    const listAvg = (listLatencies.reduce((a, b) => a + b, 0) / TRIALS).toFixed(1);
    const listMin = Math.min(...listLatencies);
    const listMax = Math.max(...listLatencies);
    console.log(`${label} /list:     avg=${listAvg}ms, min=${listMin}ms, max=${listMax}ms`);
  }

  await request(`${INSTANCE_A}/clear`, "POST");
}


async function measureConsistency() {
  console.log("\n=== Part B: Eventual Consistency (100 iterations) ===");

  await request(`${INSTANCE_A}/clear`, "POST");
  await sleep(1000);

  const ITERATIONS = 100;
  let notFoundCount = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const username = `consistency_${i}_${Date.now()}`;

    // Register on Instance A
    await request(`${INSTANCE_A}/register`, "POST", { username });

    // Immediately check Instance B
    const listRes = await request(`${INSTANCE_B}/list`);
    const found = listRes.users && listRes.users.includes(username);
    if (!found) notFoundCount++;

    if ((i + 1) % 10 === 0) {
      console.log(`  Completed ${i + 1}/100 iterations, not found so far: ${notFoundCount}`);
    }
  }


  await request(`${INSTANCE_A}/clear`, "POST");
}


(async () => {
  console.log("Starting Performance & Consistency Analysis...");
  console.log(`Instance A: ${INSTANCE_A}`);
  console.log(`Instance B: ${INSTANCE_B}`);

  try {
    await measureLatency();
    await measureConsistency();
  } catch (err) {
  }
})();
