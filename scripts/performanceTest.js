const axios = require("axios");

async function performanceTest() {
  const baseURL = "http://localhost:8000/api/v1";
  const endpoints = [
    "/categories",
    "/categories/with-counts",
    "/products?limit=20",
    "/products/featured",
    "/search/global?q=phone",
  ];

  console.log("🚀 Starting performance tests...\n");

  for (const endpoint of endpoints) {
    const url = `${baseURL}${endpoint}`;
    const iterations = 10;
    const times = [];

    console.log(`Testing: ${endpoint}`);

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await axios.get(url);
        const duration = Date.now() - start;
        times.push(duration);
        process.stdout.write(".");
      } catch (error) {
        process.stdout.write("❌");
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`\n  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTime}ms, Max: ${maxTime}ms\n`);
  }

  console.log("✅ Performance tests completed");
}

module.exports = {
  performanceTest,
};
