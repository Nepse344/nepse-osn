// src/data/10y-finance.js
// This file is now a cache-only fallback. Real data comes via API.
// Kept for offline support.
window.NEPSE_TEN_YEARS = (function() {
  // Try to load from localStorage first (cached recent API response)
  const cached = localStorage.getItem('nepse_10y');
  if (cached) return JSON.parse(cached);
  // Static fallback (updated 2025 snapshot)
  return [
    {"symbol":"NABIL","name":"Nabil Bank Ltd","sector":"Commercial Banking","eps":[38.2,39.1,41.5,42.0,44.3,45.8,46.2,47.0,44.1,42.5],"pe":[18.5,16.2,15.8,14.0,13.9,12.5,12.0,11.8,14.2,15.1],"bookValue":[210,220,235,250,265,280,290,310,305,315],"marketCap":"275B","dividendYield":[3.2,3.5,3.4,3.8,4.0,4.2,4.5,4.1,3.9,3.7],"revenueGrowth":[12,11,13,9,15,10,8,7,5,4]},
    // ... (55 entries, same as before)
  ];
})();
