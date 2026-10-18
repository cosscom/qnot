import { COMPANIES } from './schema';

const NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara', 'Ken', 'Radia', 'Dennis', 'Frances', 'Edsger', 'Hedy'];
const WORDS = ['harbor', 'keel', 'mast', 'tide', 'reef', 'anchor', 'sail', 'buoy'];
const CITIES = ['London', 'Berlin', 'Paris', 'New York', 'São Paulo', 'Tokyo', 'Bengaluru', 'Manchester'];
const PLANS = ['free', 'pro', 'team', 'enterprise'] as const;
const TAGS = ['vip', 'beta', 'churn-risk', 'partner', 'newsletter'] as const;
const COUNTRIES = ['de', 'gb', 'fr', 'us', 'br', 'jp', 'in'] as const;
const PRODUCTS = ['Mast', 'Sail', 'Keel', 'Rudder', 'Anchor'] as const;
const STATUSES = ['paid', 'paid', 'pending', 'refunded'] as const;

// Deterministic PRNG so the sample data is stable between reloads.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Customer {
  name: string | null;
  email: string | null;
  age: number | null;
  minAge: number;
  plan: string;
  tags: string[];
  region: string;
  company: string;
  verified: boolean;
  satisfaction: number;
  distanceKm: number;
  opensAt: string | null;
  lastSeen: string;
  signedUp: string;
  notes: string;
  address: { city: string; zip: string };
  orders: { product: string; qty: number; status: string }[];
}

/** Sample customers with nested address objects and order arrays, matching `fields`. */
export function sampleRows(count = 1000): Customer[] {
  const rand = rng(42);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const first = pick(NAMES);
    return {
      name: rand() < 0.03 ? null : `${first} ${pick(WORDS)}`,
      email: rand() < 0.03 ? null : `${first.toLowerCase()}.${i}@${pick(WORDS)}.dev`,
      age: rand() < 0.04 ? null : 16 + Math.floor(rand() * 60),
      minAge: 18 + Math.floor(rand() * 30),
      plan: pick(PLANS),
      tags: TAGS.filter(() => rand() < 0.25),
      region: pick(COUNTRIES),
      company: pick(COMPANIES),
      verified: rand() < 0.6,
      satisfaction: Math.floor(rand() * 11),
      distanceKm: Math.round(rand() * 12000),
      opensAt: rand() < 0.1 ? null : `${String(6 + Math.floor(rand() * 5)).padStart(2, '0')}:${rand() < 0.5 ? '00' : '30'}`,
      lastSeen: new Date(now - rand() * 60 * 864e5).toISOString(),
      signedUp: new Date(Date.UTC(2020, 0, 1) + rand() * 6 * 365 * 864e5).toISOString().slice(0, 10),
      notes: '',
      address: { city: pick(CITIES), zip: String(10000 + Math.floor(rand() * 89999)) },
      orders: Array.from({ length: Math.floor(rand() * 5) }, () => ({ product: pick(PRODUCTS), qty: 1 + Math.floor(rand() * 4), status: pick(STATUSES) })),
    };
  });
}
