// src/utils/presets.js

export const PRESETS = {
    'Quick (10%, 30%, 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 30 },
      { pause: { duration: '1m' } },
      { setWeight: 100 },
    ],
    'Balanced (10%, 30%, 60%, 100%)': [
      { setWeight: 10 },
      { pause: {} },
      { setWeight: 30 },
      { pause: { duration: '2m' } },
      { setWeight: 60 },
      { pause: { duration: '2m' } },
      { setWeight: 100 },
    ],
    'SRE Recommend (10%, 25%, 50%, 75%, 100%)': [
      { setWeight: 10 },
      { pause: {} },
      { setWeight: 25 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '3m' } },
      { setWeight: 75 },
      { pause: { duration: '3m' } },
      { setWeight: 100 },
    ],
    'Progressive Safe (5%, 10%, 25%, 50%, 100%)': [
      { setWeight: 5 },
      { pause: {} },
      { setWeight: 10 },
      { pause: { duration: '2m' } },
      { setWeight: 25 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '3m' } },
      { setWeight: 100 },      
    ],
    'Rapid Majority (10% → 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 100 },
    ],    
  };