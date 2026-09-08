async function testConnectivity() {
  console.log('Testing local & LAN connectivity for MTS Lab...');

  const urls = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.66:3000',
    'http://192.168.1.66:3000/tracking',
    'http://192.168.1.66:3000/api/track?phone=9801998877'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      console.log(`✅ [${res.status} ${res.statusText}] Connected successfully to: ${url}`);
    } catch (err: any) {
      console.error(`❌ [FAILED] Could not connect to: ${url} ->`, err.message || err);
    }
  }
}

testConnectivity();
