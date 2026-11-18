import type { Product } from "./types";

export type ProductIdea = Omit<Product, "id" | "status" | "createdAt">;

interface Seed extends ProductIdea {
  tags: string[];
}

// Seeded fallback for offline demos. Prices are realistic IndiaMART wholesale / Indian D2C retail estimates.
const SEEDS: Seed[] = [
  {
    name: "Adjustable Posture Corrector Belt",
    category: "Health & Fitness",
    why: "Work-from-home and student desk posture is a constant Reel topic; a before/after shoulder shot sells it in 3 seconds.",
    targetAudience: "Students and desk workers 18-35 in metros, especially women 22-30",
    sourcingCost: 140,
    sellingPrice: 699,
    shippingCost: 65,
    scores: { demand: 8, margin: 8, rtoRisk: 5, competition: 7, wow: 6 },
    risks: ["Size mismatch → returns; push a 'free size, adjustable' message", "Heavily advertised; needs a fresh hook"],
    indiamartQuery: "posture corrector belt",
    tags: ["fitness", "health", "posture", "wellness", "office", "students", "back"],
  },
  {
    name: "USB Rechargeable Portable Blender (380ml)",
    category: "Kitchen & Fitness",
    why: "Gym-goers and hostel students want protein shakes anywhere; blending in a car or classroom is a strong visual hook.",
    targetAudience: "Gym-goers and hostel students 18-30",
    sourcingCost: 320,
    sellingPrice: 1199,
    shippingCost: 80,
    scores: { demand: 8, margin: 7, rtoRisk: 4, competition: 6, wow: 8 },
    risks: ["Glass/plastic jar can crack in transit: insist on bubble wrap", "Battery quality varies by supplier; order a sample"],
    indiamartQuery: "portable usb juicer blender",
    tags: ["fitness", "gym", "kitchen", "protein", "students", "hostel", "health"],
  },
  {
    name: "Magnetic Car Phone Mount (MagSafe style)",
    category: "Auto Accessories",
    why: "Every new car owner and cab driver needs one; the 'snap' moment is satisfying on video.",
    targetAudience: "Car owners 22-45, cab and delivery drivers",
    sourcingCost: 95,
    sellingPrice: 499,
    shippingCost: 55,
    scores: { demand: 7, margin: 8, rtoRisk: 3, competition: 6, wow: 7 },
    risks: ["Low price point means CPA must stay under ~₹150", "Weak magnets on cheap lots; test with a heavy phone"],
    indiamartQuery: "magnetic car mobile holder",
    tags: ["car", "auto", "gadget", "phone", "tech", "drivers"],
  },
  {
    name: "RGB LED Strip Lights with App + Remote (5m)",
    category: "Home Decor",
    why: "Room makeover Reels for Diwali and dorm rooms; the transformation shot does the selling.",
    targetAudience: "Teens and young adults 16-28 decorating rooms and hostels",
    sourcingCost: 260,
    sellingPrice: 899,
    shippingCost: 70,
    scores: { demand: 9, margin: 7, rtoRisk: 5, competition: 8, wow: 9 },
    risks: ["Very saturated: Amazon sells at ₹500-700, so differentiate on bundle/app", "Adhesive complaints → refund requests"],
    indiamartQuery: "rgb led strip light with remote",
    tags: ["home", "decor", "room", "lights", "diwali", "festive", "students", "gadget"],
  },
  {
    name: "Cordless Mini Car Vacuum Cleaner",
    category: "Auto Accessories",
    why: "Dirty car seats are a universal pain; a crumbs-to-clean demo works without words.",
    targetAudience: "Car owners and parents 25-45 in tier 1-2 cities",
    sourcingCost: 480,
    sellingPrice: 1499,
    shippingCost: 90,
    scores: { demand: 7, margin: 7, rtoRisk: 4, competition: 5, wow: 7 },
    risks: ["Suction power varies wildly; video your own unit", "Higher AOV means more COD hesitation, so push prepaid"],
    indiamartQuery: "portable car vacuum cleaner rechargeable",
    tags: ["car", "auto", "cleaning", "home", "gadget", "parents"],
  },
  {
    name: "Reusable Pet Hair Remover Roller",
    category: "Pet Care",
    why: "Pet ownership is booming in Indian metros; the one-swipe sofa clean is a viral format.",
    targetAudience: "Pet parents 22-40 in metros",
    sourcingCost: 110,
    sellingPrice: 549,
    shippingCost: 60,
    scores: { demand: 7, margin: 8, rtoRisk: 3, competition: 5, wow: 8 },
    risks: ["Smaller audience; target pet-interest audiences precisely", "Copycat listings on Meesho at ₹199"],
    indiamartQuery: "pet hair remover roller",
    tags: ["pet", "pets", "dog", "cat", "cleaning", "home"],
  },
  {
    name: "Waterproof Anti-Skid Sneaker Protector Spray",
    category: "Fashion Care",
    why: "Sneakerheads protect white shoes from monsoon mud; the water-beading test is pure thumb-stop.",
    targetAudience: "Sneaker-loving men 18-30",
    sourcingCost: 120,
    sellingPrice: 599,
    shippingCost: 60,
    scores: { demand: 6, margin: 8, rtoRisk: 4, competition: 4, wow: 8 },
    risks: ["Aerosols can't ship by air with some couriers, so confirm surface shipping", "Seasonal (monsoon peak)"],
    indiamartQuery: "shoe protector spray waterproof",
    tags: ["fashion", "shoes", "sneakers", "men", "monsoon", "care"],
  },
  {
    name: "Skincare Ice Roller for Face",
    category: "Beauty",
    why: "Depuffing morning routines trend on Instagram; low cost, high perceived value, giftable.",
    targetAudience: "Women 18-32 into skincare",
    sourcingCost: 90,
    sellingPrice: 499,
    shippingCost: 55,
    scores: { demand: 8, margin: 9, rtoRisk: 4, competition: 6, wow: 6 },
    risks: ["Leaky gel cores in cheap lots", "Beauty claims must stay modest under ad policy"],
    indiamartQuery: "face ice roller skin care",
    tags: ["beauty", "skincare", "women", "self-care", "wellness", "gift"],
  },
  {
    name: "LCD Writing & Drawing Tablet for Kids (10\")",
    category: "Kids & Toys",
    why: "Parents want screen-free activities; 'save 1000 sheets of paper' is an easy hook for moms.",
    targetAudience: "Parents of kids 3-10, mostly mothers 26-40",
    sourcingCost: 150,
    sellingPrice: 599,
    shippingCost: 60,
    scores: { demand: 8, margin: 8, rtoRisk: 4, competition: 6, wow: 7 },
    risks: ["Screen can crack if poorly packed", "Gifting peaks around festivals and birthdays"],
    indiamartQuery: "lcd writing tablet for kids",
    tags: ["kids", "toys", "parents", "education", "gift", "screen-free"],
  },
  {
    name: "Electric Lint Remover for Clothes",
    category: "Home & Fashion Care",
    why: "Revives pilled sweaters and sofas before winter; the before/after fabric shot is extremely clear.",
    targetAudience: "Women 22-45 and hostel students, North India winter",
    sourcingCost: 170,
    sellingPrice: 649,
    shippingCost: 60,
    scores: { demand: 7, margin: 8, rtoRisk: 3, competition: 5, wow: 8 },
    risks: ["Blade guards break in cheap lots; check sample", "Peaks Nov-Jan only"],
    indiamartQuery: "electric lint remover rechargeable",
    tags: ["home", "fashion", "winter", "clothes", "cleaning", "students"],
  },
  {
    name: "Silver-Plated Oxidised Jhumka Set (Festive)",
    category: "Jewellery",
    why: "Wedding and festive season demand; jewellery is light, cheap to ship and photographs well.",
    targetAudience: "Women 18-35, tier 1-3 cities",
    sourcingCost: 85,
    sellingPrice: 449,
    shippingCost: 50,
    scores: { demand: 8, margin: 9, rtoRisk: 7, competition: 8, wow: 6 },
    risks: ["High impulse-COD RTO in jewellery: confirm every COD order", "Quality looks different in person"],
    indiamartQuery: "oxidised jhumka earrings",
    tags: ["jewellery", "fashion", "women", "festive", "wedding", "diwali", "gift"],
  },
  {
    name: "Motivational Time-Marker Water Bottle (1L)",
    category: "Health & Fitness",
    why: "Hydration-tracking bottles are a cheap motivation buy for students and office-goers.",
    targetAudience: "Students and office-goers 18-30",
    sourcingCost: 110,
    sellingPrice: 449,
    shippingCost: 65,
    scores: { demand: 6, margin: 7, rtoRisk: 4, competition: 7, wow: 5 },
    risks: ["Low wow factor; relies on creative", "Bulky, so check volumetric shipping weight"],
    indiamartQuery: "motivational water bottle time marker",
    tags: ["fitness", "health", "students", "office", "gym", "wellness"],
  },
];

export function compositeScore(s: Product["scores"]) {
  // Weighted toward what kills first-time stores in India: RTO and margin.
  const v = s.demand * 0.25 + s.margin * 0.25 + (10 - s.rtoRisk) * 0.2 + (10 - s.competition) * 0.15 + s.wow * 0.15;
  return Math.round(v * 10) / 10;
}

export function demoProducts(niche = "", audience = "", n = 5): ProductIdea[] {
  const words = `${niche} ${audience}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const ranked = SEEDS.map((s) => {
    const hay = `${s.tags.join(" ")} ${s.name} ${s.category} ${s.targetAudience}`.toLowerCase();
    const hits = words.filter((w) => hay.includes(w)).length;
    return { s, rank: hits * 10 + compositeScore(s.scores) };
  }).sort((a, b) => b.rank - a.rank);
  return ranked.slice(0, n).map(({ s }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tags, ...idea } = s;
    return idea;
  });
}
