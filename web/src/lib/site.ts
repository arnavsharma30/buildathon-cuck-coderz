import type { Product, SiteContent, SiteTheme } from "./types";

// Full literal Tailwind class strings: Tailwind v4 only generates classes it can find verbatim in source.
export interface ThemeClasses {
  label: string;
  swatch: string; // small preview chip in the builder
  page: string; // page background + text
  announcement: string;
  header: string;
  brand: string;
  heroBg: string;
  heroFallback: string; // gradient block when there is no image
  accentText: string;
  button: string;
  card: string;
  muted: string;
  section: string; // alternate section background
  badge: string;
  font: string;
  footer: string;
}

export const THEMES: Record<SiteTheme, ThemeClasses> = {
  fresh: {
    label: "Fresh",
    swatch: "bg-gradient-to-br from-emerald-400 to-teal-500",
    page: "bg-white text-zinc-900",
    announcement: "bg-emerald-600 text-white",
    header: "bg-white border-b border-zinc-100",
    brand: "text-emerald-700",
    heroBg: "bg-gradient-to-b from-emerald-50 to-white",
    heroFallback: "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 text-white",
    accentText: "text-emerald-600",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    card: "bg-white border border-emerald-100 shadow-sm",
    muted: "text-zinc-500",
    section: "bg-emerald-50/60",
    badge: "bg-emerald-100 text-emerald-800",
    font: "font-sans",
    footer: "bg-zinc-900 text-zinc-300",
  },
  bold: {
    label: "Bold",
    swatch: "bg-gradient-to-br from-zinc-900 to-yellow-400",
    page: "bg-zinc-950 text-white",
    announcement: "bg-yellow-400 text-black",
    header: "bg-zinc-950 border-b border-zinc-800",
    brand: "text-yellow-400",
    heroBg: "bg-zinc-950",
    heroFallback: "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-black",
    accentText: "text-yellow-400",
    button: "bg-yellow-400 text-black hover:bg-yellow-300",
    card: "bg-zinc-900 border border-zinc-800",
    muted: "text-zinc-400",
    section: "bg-zinc-900",
    badge: "bg-yellow-400 text-black",
    font: "font-sans",
    footer: "bg-black text-zinc-400",
  },
  luxe: {
    label: "Luxe",
    swatch: "bg-gradient-to-br from-stone-200 to-amber-600",
    page: "bg-stone-50 text-stone-900",
    announcement: "bg-stone-900 text-amber-100",
    header: "bg-stone-50 border-b border-stone-200",
    brand: "text-stone-900 tracking-[0.2em] uppercase",
    heroBg: "bg-gradient-to-b from-stone-100 to-stone-50",
    heroFallback: "bg-gradient-to-br from-stone-300 via-amber-200 to-amber-500 text-stone-900",
    accentText: "text-amber-700",
    button: "bg-stone-900 text-amber-50 hover:bg-stone-700",
    card: "bg-white border border-stone-200",
    muted: "text-stone-500",
    section: "bg-stone-100",
    badge: "bg-amber-100 text-amber-900",
    font: "font-serif",
    footer: "bg-stone-900 text-stone-300",
  },
  playful: {
    label: "Playful",
    swatch: "bg-gradient-to-br from-pink-400 to-violet-500",
    page: "bg-pink-50 text-violet-950",
    announcement: "bg-violet-600 text-white",
    header: "bg-white/80 border-b border-pink-100",
    brand: "text-violet-700",
    heroBg: "bg-gradient-to-br from-pink-100 via-fuchsia-50 to-violet-100",
    heroFallback: "bg-gradient-to-br from-pink-400 via-fuchsia-500 to-violet-600 text-white",
    accentText: "text-pink-600",
    button: "bg-pink-500 text-white hover:bg-pink-400",
    card: "bg-white border border-pink-100 shadow-sm",
    muted: "text-violet-900/60",
    section: "bg-white",
    badge: "bg-pink-100 text-pink-700",
    font: "font-sans",
    footer: "bg-violet-950 text-violet-200",
  },
};

export const THEME_KEYS = Object.keys(THEMES) as SiteTheme[];

export function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function defaultBrandName(p: Pick<Product, "name">) {
  const words = (p.name || "My Store").replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean);
  return words.slice(-2).join(" ") || "My Store";
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Deterministic store copy built from the product fields: used when Claude is unavailable. */
export function fallbackSiteContent(
  p: Product,
  opts: { brandName?: string; language?: "English" | "Hinglish" | "Hindi" } = {},
): SiteContent {
  const brand = opts.brandName?.trim() || defaultBrandName(p);
  const hinglish = opts.language !== "English";
  const audience = p.targetAudience || "everyday Indian homes";
  const variants = p.variants?.length ? p.variants.join(", ") : "One size / standard";
  const desc = p.description || p.why || `${p.name}, picked for ${audience}.`;
  // Short display name: drop "(380ml)"-style suffixes and adjectives, keep the last 3 words.
  const short = p.name.replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(-3).join(" ");

  return {
    brandName: brand,
    tagline: hinglish ? "Roz ki life, thodi aasaan." : `Made for ${audience.split(",")[0].toLowerCase()}.`,
    announcement: "🚚 Free shipping across India · 💵 Cash on Delivery available",
    hero: {
      headline: hinglish ? `${short} jo sach mein kaam aaye` : `Meet the ${short}`,
      subheadline: desc,
      cta: hinglish ? "Abhi order karein (COD)" : "Order now: Cash on Delivery",
      badge: p.category || "New arrival",
    },
    benefits: [
      { icon: "✨", title: hinglish ? "Turant fark dikhe" : "See the difference", text: p.why || desc },
      { icon: "🎯", title: hinglish ? "Aapke liye bana" : "Built for you", text: `Designed for ${audience}.` },
      { icon: "🧳", title: hinglish ? "Easy to use" : "Easy to use", text: hinglish ? "Box kholo, use karo. Koi setup nahi." : "Open the box and start using it. No setup." },
      { icon: "💸", title: hinglish ? "Sahi daam" : "Fair price", text: p.compareAtPrice ? `${inr(p.sellingPrice)} instead of ${inr(p.compareAtPrice)}.` : `Just ${inr(p.sellingPrice)}, delivered free.` },
    ],
    howItWorks: [
      { title: hinglish ? "Order karein" : "Place your order", text: hinglish ? "Form bharein, COD select hai. Advance kuch nahi." : "Fill the form below. Pay nothing in advance." },
      { title: hinglish ? "WhatsApp pe confirm" : "Confirm on WhatsApp", text: hinglish ? "Hum WhatsApp pe order confirm karenge." : "We confirm your order on WhatsApp." },
      { title: hinglish ? "Delivery pe pay karein" : "Pay on delivery", text: hinglish ? "3-6 din mein delivery, cash ya UPI se pay karein." : "Delivered in 3-6 days. Pay cash or UPI at the door." },
    ],
    specs: [
      { label: "Product", value: p.name },
      { label: "Category", value: p.category || "General" },
      { label: "Options", value: variants },
      { label: "In the box", value: `1 × ${p.name}` },
      { label: "Delivery", value: "3-6 business days, all India" },
    ],
    offer: {
      price: p.sellingPrice,
      compareAtPrice: p.compareAtPrice,
      bullets: ["Cash on Delivery available", "Free shipping across India", "7-day replacement on damaged or wrong items"],
    },
    faq: [
      { q: hinglish ? "Kya Cash on Delivery available hai?" : "Is Cash on Delivery available?", a: hinglish ? "Haan, poore India mein COD available hai. Delivery pe cash ya UPI se pay karein." : "Yes. Pay by cash or UPI when the parcel arrives." },
      { q: hinglish ? "Delivery mein kitna time lagega?" : "How long does delivery take?", a: hinglish ? "Order confirm hone ke baad 3-6 working days." : "3-6 working days after we confirm your order." },
      { q: hinglish ? "Agar product damaged aaye toh?" : "What if my product arrives damaged?", a: hinglish ? "Unboxing video ke saath 7 din ke andar WhatsApp karein, hum replace kar denge." : "Message us on WhatsApp within 7 days with an unboxing video and we'll replace it." },
      { q: hinglish ? "Kaunse options available hain?" : "Which options are available?", a: variants },
      { q: hinglish ? "Order confirm kaise hoga?" : "How is my order confirmed?", a: hinglish ? "Order ke baad hum WhatsApp pe message karenge. Reply karke confirm karein." : "We send a WhatsApp message after you order. Reply to confirm." },
    ],
    guarantee: hinglish ? "Damaged ya galat item mila? 7 din mein free replacement." : "Damaged or wrong item? Free replacement within 7 days.",
    reviews: [],
    footerNote: `© ${new Date().getFullYear()} ${brand}. Questions? Message us on WhatsApp.`,
  };
}
