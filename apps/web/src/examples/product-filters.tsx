'use client';
import { compile, defineFields, f } from '@trawlnet/core';
import { HeadphonesIcon, HouseIcon, LaptopIcon, MountainIcon, StarIcon, WatchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { pickWith, rng, useExampleStore, useLiveQuery } from './shared';



const CATEGORIES = ['Audio', 'Wearables', 'Home', 'Outdoor', 'Office'] as const;
const BRANDS = ['Northwind', 'Lumen', 'Harbor & Co', 'Tidewater', 'Keel'] as const;
const COLORS = ['Black', 'White', 'Sand', 'Navy', 'Olive'] as const;

const fields = defineFields({
  category: f.enum(CATEGORIES),
  brand: f.enum(BRANDS),
  price: f.number({ min: 0, label: 'Price ($)' }),
  rating: f.number({ min: 0, max: 5, label: 'Rating' }),
  inStock: f.boolean({ label: 'In stock' }),
  color: f.enum(COLORS),
  released: f.date({ label: 'Release date' }),
  name: f.text({ label: 'Product name' }),
});

const NOUNS: Record<(typeof CATEGORIES)[number], string[]> = {
  Audio: ['Headphones', 'Earbuds', 'Speaker', 'Soundbar'],
  Wearables: ['Watch', 'Band', 'Ring', 'Tracker'],
  Home: ['Lamp', 'Kettle', 'Diffuser', 'Thermostat'],
  Outdoor: ['Lantern', 'Bottle', 'Daypack', 'Tent'],
  Office: ['Keyboard', 'Monitor arm', 'Desk mat', 'Webcam'],
};
const ICONS = { Audio: HeadphonesIcon, Wearables: WatchIcon, Home: HouseIcon, Outdoor: MountainIcon, Office: LaptopIcon };
const TINTS = { Black: 'from-zinc-700 to-zinc-900', White: 'from-zinc-100 to-zinc-300', Sand: 'from-amber-100 to-amber-300', Navy: 'from-blue-800 to-indigo-950', Olive: 'from-lime-700 to-emerald-900' };

const rand = rng(7);
const pick = pickWith(rand);
const PRODUCTS = Array.from({ length: 60 }, (_, i) => {
  const category = pick(CATEGORIES);
  const brand = pick(BRANDS);
  return {
    id: i,
    name: `${brand} ${pick(NOUNS[category])} ${['Mini', 'Pro', 'Air', 'Max', 'One'][i % 5]}`,
    category,
    brand,
    price: Math.round((19 + rand() * 480) / 5) * 5 - 0.01,
    rating: Math.round((2.8 + rand() * 2.2) * 10) / 10,
    inStock: rand() > 0.25,
    color: pick(COLORS),
    released: new Date(Date.UTC(2023, 0, 1) + rand() * 1000 * 864e5).toISOString().slice(0, 10),
  };
});


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [
      { kind: 'rule', field: 'category', operator: 'in', value: ['Audio', 'Wearables'] },
      { kind: 'rule', field: 'price', operator: 'between', value: [50, 300] },
      { kind: 'rule', field: 'inStock', operator: 'eq', value: true },
    ],
  });
  const query = useLiveQuery(store);
  const { rows, ms } = useMemo(() => {
    const t0 = performance.now();
    const rows = PRODUCTS.filter(compile(fields, query));
    return { rows, ms: performance.now() - t0 };
  }, [query]);
  return (
    <>
      <div className="flex flex-col gap-4">
        <CossQueryBuilder store={store} />
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">
            {rows.length} of {PRODUCTS.length} products
          </Badge>
          <span className="text-muted-foreground text-xs">filtered in {ms.toFixed(2)} ms</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => {
            const Icon = ICONS[p.category];
            return (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-background" data-product>
                <div className={`flex aspect-[4/3] items-center justify-center bg-linear-to-br ${TINTS[p.color]}`}>
                  <Icon className={`size-10 ${p.color === 'White' || p.color === 'Sand' ? 'text-zinc-700' : 'text-white/90'}`} strokeWidth={1.25} />
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <div className="truncate font-medium text-sm">{p.name}</div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <StarIcon className="size-3 fill-current text-amber-500" /> {p.rating} · {p.category}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-semibold tabular-nums">${p.price.toFixed(2)}</span>
                    {!p.inStock && <Badge variant="secondary">Sold out</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
