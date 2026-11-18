// Shared domain types for DropOS. Every module reads/writes these through the workspace store.

export type ProductStatus = "idea" | "shortlisted" | "sourcing" | "live" | "dropped";

export interface ProductScores {
  demand: number; // 0-10, how many people want it (search/social buzz)
  margin: number; // 0-10, room between landed cost and a believable price
  rtoRisk: number; // 0-10, HIGHER = riskier (impulse COD buys, fragile, size issues)
  competition: number; // 0-10, HIGHER = more saturated
  wow: number; // 0-10, thumb-stopping factor for a Reel
}

export interface Product {
  id: string;
  name: string;
  category: string;
  why: string; // why it can sell now
  targetAudience: string;
  sourcingCost: number; // INR per unit, estimated wholesale
  sellingPrice: number; // INR, suggested MRP on the store
  shippingCost: number; // INR forward shipping per order
  scores: ProductScores;
  risks: string[];
  indiamartQuery: string; // what to search on IndiaMART
  status: ProductStatus;
  createdAt: number;
  // Catalogue details (optional; filled when a team adds/edits a product by hand)
  description?: string;
  images?: string[]; // image URLs
  compareAtPrice?: number; // MRP shown struck-through
  sku?: string;
  variants?: string[]; // e.g. ["Black", "Beige"] or ["S", "M", "L"]
  tags?: string[];
}

// ---- AI website builder ----

export type SiteTheme = "fresh" | "bold" | "luxe" | "playful";

export interface SiteContent {
  brandName: string;
  tagline: string;
  announcement: string; // top bar, e.g. "Free shipping · Cash on Delivery available"
  hero: { headline: string; subheadline: string; cta: string; badge?: string };
  benefits: { icon: string; title: string; text: string }[]; // icon = single emoji
  howItWorks: { title: string; text: string }[];
  specs: { label: string; value: string }[];
  offer: { price: number; compareAtPrice?: number; bullets: string[] };
  faq: { q: string; a: string }[];
  guarantee: string;
  reviews: { name: string; city: string; text: string; rating: number }[]; // REAL reviews only: empty until the team adds them
  footerNote: string;
}

export interface Website {
  id: string;
  productId: string;
  slug: string; // published at /s/<slug>
  theme: SiteTheme;
  language: "English" | "Hinglish" | "Hindi";
  content: SiteContent;
  imageUrl?: string;
  publishedAt?: number;
  updatedAt: number;
}

export type SupplierStage = "found" | "contacted" | "quoted" | "sampling" | "finalized" | "rejected";

export interface Quote {
  unitPrice: number; // INR per unit ex-GST
  moq: number;
  gstPercent: number;
  shippingPerUnit: number; // INR the supplier charges to ship to the end customer
  dispatchDays: number;
  dropshipSupported: boolean; // ships direct to customer
  codSupported: boolean;
  blindShipping: boolean; // no supplier branding on the parcel
  samplePrice?: number;
  returnPolicy: string;
  notes: string;
  landedCost: number; // unitPrice * (1+gst) + shippingPerUnit
}

export interface Supplier {
  id: string;
  productId: string;
  name: string;
  city: string;
  url?: string;
  priceRange?: string;
  moq?: string;
  gstVerified?: boolean;
  trustSeal?: boolean;
  yearsInBusiness?: number;
  rating?: number; // 0-5
  phone?: string;
  source: "indiamart-live" | "sample";
  stage: SupplierStage;
  outreach?: { channel: "whatsapp" | "email" | "indiamart"; message: string; sentAt?: number };
  quote?: Quote;
  rawReply?: string;
  notes?: string;
}

export interface Creative {
  id: string;
  productId: string;
  angle: string; // e.g. "Problem → Solution", "Gift", "UGC unboxing"
  hook: string; // first 3 seconds / first line
  primaryText: string;
  headline: string;
  cta: string;
  reelScript: string[]; // shot list
  visualIdea: string;
  language: "English" | "Hinglish" | "Hindi";
  createdAt: number;
}

export interface AdSetRow {
  id: string;
  productId: string;
  name: string;
  creativeAngle: string;
  audience: string;
  dailyBudget: number;
  spend: number;
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
}

export type PaymentMode = "COD" | "Prepaid";

export interface Order {
  id: string; // e.g. #1042
  productId?: string;
  createdAt: string; // ISO
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  amount: number;
  payment: PaymentMode;
  quantity: number;
  source?: "demo" | "shopify" | "website";
  status: "new" | "confirmed" | "converted-prepaid" | "cancelled" | "shipped" | "delivered" | "rto";
}

export interface EconomicsSettings {
  codShare: number; // fraction of orders that are COD (0-1)
  rtoCod: number; // fraction of COD orders returned (0-1)
  rtoPrepaid: number; // fraction of prepaid orders returned (0-1)
  codFeePct: number; // courier COD remittance fee, % of order value on delivered COD
  gatewayPct: number; // payment gateway fee on prepaid, % of order value
  rtoShipping: number; // INR reverse shipping per RTO
  rtoProductLossPct: number; // share of RTO units damaged / not resellable (0-1)
  packaging: number; // INR per order
  cpa: number; // INR ad spend per order placed
}

export interface Workspace {
  teamName: string;
  activeProductId?: string;
  products: Product[];
  suppliers: Supplier[];
  creatives: Creative[];
  adsets: AdSetRow[];
  orders: Order[];
  websites: Website[];
  economics: EconomicsSettings;
}
