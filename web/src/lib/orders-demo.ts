import type { Order, PaymentMode } from "./types";

// Demo orders (ids start with #D so the UI never opens WhatsApp to these numbers).
// They mix clean metro prepaid orders, typical tier-2/3 COD orders, and the junk patterns operators see every day.
type Row = [string, string, string, string, string, string, string, number, PaymentMode, number, string, Order["status"]?];

const ROWS: Row[] = [
  // name, phone, address, city, state, pincode, created (IST), amount, payment, qty, note
  ["Riya Malhotra", "+91 98110 42xx7", "Flat 1204, Tower B, DLF Park Place, Sector 54", "Gurugram", "Haryana", "122002", "2026-11-17T14:12", 799, "Prepaid", 1, "clean metro prepaid"],
  ["Aditya Kulkarni", "9823041177", "B-3/14 Kumar Pacific Society, Shankar Sheth Road, Swargate", "Pune", "Maharashtra", "411042", "2026-11-17T19:40", 799, "COD", 1, "metro COD, good address"],
  ["Sneha Iyer", "9840011223", "22, 3rd Cross Street, Besant Nagar", "Chennai", "Tamil Nadu", "600090", "2026-11-17T11:05", 1398, "Prepaid", 2, ""],
  ["Rahul", "9935xx1100", "gorakhpur", "Gorakhpur", "Uttar Pradesh", "273001", "2026-11-18T01:47", 799, "COD", 1, "bad phone, 1-word address, late night"],
  ["Mohd Arif Khan", "8299310045", "H.No 45, Ward 12, Near Jama Masjid, Rasulpur", "Azamgarh", "Uttar Pradesh", "276001", "2026-11-17T21:30", 799, "COD", 1, "eastern UP COD"],
  ["Pooja Sharma", "7006123456", "Lane 3, Gandhi Nagar", "Jammu", "Jammu & Kashmir", "180004", "2026-11-17T16:20", 1598, "COD", 2, "J&K high value COD"],
  ["test test", "9999999999", "abc", "Patna", "Bihar", "800001", "2026-11-18T02:10", 799, "COD", 1, "junk"],
  ["Vikram Singh Rathore", "9414055123", "Plot 18, Shastri Nagar, Near Hanuman Mandir", "Jodhpur", "Rajasthan", "342003", "2026-11-17T13:55", 799, "COD", 1, "west Rajasthan"],
  ["Ananya Das", "9831022446", "14/2 Lake Road, Ballygunge", "Kolkata", "West Bengal", "700029", "2026-11-17T10:15", 799, "COD", 1, "metro COD"],
  ["Suresh Kumar", "9431277810", "Vill Rampur, Post Bhagwanpur", "Muzaffarpur", "Bihar", "842001", "2026-11-17T23:58", 2397, "COD", 3, "bihar bulk high value"],
  ["Kavya Reddy", "9000312456", "Flat 302, Aparna Towers, Kondapur", "Hyderabad", "Telangana", "500084", "2026-11-17T18:22", 799, "Prepaid", 1, ""],
  ["Rahul", "9935xx1100", "gorakhpur up", "Gorakhpur", "Uttar Pradesh", "273001", "2026-11-18T01:55", 799, "COD", 1, "duplicate of the earlier Rahul"],
  ["Neha Gupta", "9876501234", "House 221, Sector 15A", "Noida", "Uttar Pradesh", "201301", "2026-11-17T20:05", 799, "COD", 1, "noida metro COD"],
  ["Bikash Gogoi", "9101445566", "Near Post Office, Chabua", "Dibrugarh", "Assam", "786184", "2026-11-17T15:40", 799, "COD", 1, "north-east"],
  ["Imran Shaikh", "9867043210", "Room 7, Patel Chawl, LBS Marg, Kurla West", "Mumbai", "Maharashtra", "400070", "2026-11-17T22:10", 799, "COD", 1, ""],
  ["Deepak Yadav", "8340123987", "Hospital Road", "Ranchi", "Jharkhand", "834001", "2026-11-17T12:30", 799, "COD", 1, "jharkhand, no house no"],
  ["Meera Joshi", "9426012345", "A-12 Shivalik Bungalows, Satellite", "Ahmedabad", "Gujarat", "380015", "2026-11-17T09:45", 799, "Prepaid", 1, ""],
  ["Karan Mehta", "9811234567", "C-45, Lajpat Nagar 2", "New Delhi", "Delhi", "110024", "2026-11-17T17:00", 799, "COD", 1, "repeat good customer"],
  ["Sunita Devi", "6201234598", "Mohalla Kazipur", "Gaya", "Bihar", "823001", "2026-11-17T19:15", 799, "COD", 1, "prior RTO customer"],
  ["Arjun Nair", "9447012345", "TC 25/1412, Statue Road", "Thiruvananthapuram", "Kerala", "695001", "2026-11-17T14:50", 799, "COD", 1, "tier-2 good address"],
  ["xyzz", "12345", "near market", "Lucknow", "Uttar Pradesh", "226", "2026-11-18T03:20", 799, "COD", 1, "invalid pin + phone"],
  ["Harpreet Kaur", "9815012345", "House 556, Phase 3B2, Mohali", "Mohali", "Punjab", "160059", "2026-11-17T16:45", 1598, "Prepaid", 2, ""],
];

// History used for repeat-customer signals (previous challenge weeks).
const HISTORY: Row[] = [
  ["Karan Mehta", "9811234567", "C-45, Lajpat Nagar 2", "New Delhi", "Delhi", "110024", "2026-11-03T12:00", 649, "COD", 1, "", "delivered"],
  ["Sunita Devi", "6201234598", "Mohalla Kazipur", "Gaya", "Bihar", "823001", "2026-11-05T12:00", 649, "COD", 1, "", "rto"],
];

function toOrder(r: Row, i: number, prefix: string): Order {
  const [customerName, phoneRaw, address, city, state, pincode, created, amount, payment, quantity, , status] = r;
  // Fill masked digits deterministically so demo phones are well-formed.
  const phone = phoneRaw.replace(/x/g, "4");
  return {
    id: `${prefix}${1001 + i}`,
    createdAt: new Date(`${created}:00+05:30`).toISOString(),
    customerName,
    phone,
    address,
    city,
    state,
    pincode,
    amount,
    payment,
    quantity,
    status: status ?? "new",
  };
}

export function demoOrders(productId?: string): Order[] {
  const history = HISTORY.map((r, i) => ({ ...toOrder(r, i, "#DH"), productId }));
  const current = ROWS.map((r, i) => ({ ...toOrder(r, i, "#D"), productId }));
  return [...history, ...current];
}

// ---- Shopify "Export orders" CSV import ----

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Accepts Shopify's order export (one row per line item; first row of each order carries the details). */
export function ordersFromShopifyCSV(text: string, productId?: string): Order[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {
    name: col("Name", "Order", "Order ID"),
    created: col("Created at", "Created At", "Date"),
    total: col("Total", "Amount"),
    fin: col("Financial Status"),
    method: col("Payment Method", "Payment Gateway"),
    qty: col("Lineitem quantity", "Quantity"),
    sname: col("Shipping Name", "Customer Name", "Billing Name"),
    a1: col("Shipping Address1", "Shipping Street", "Address"),
    a2: col("Shipping Address2"),
    city: col("Shipping City", "City"),
    zip: col("Shipping Zip", "Pincode", "Zip"),
    prov: col("Shipping Province Name", "Shipping Province", "State"),
    phone: col("Shipping Phone", "Phone", "Billing Phone"),
    email: col("Email"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const seen = new Map<string, Order>();
  for (const r of rows.slice(1)) {
    const id = get(r, idx.name) || `#${seen.size + 1}`;
    const existing = seen.get(id);
    if (existing) {
      existing.quantity += Number(get(r, idx.qty)) || 0;
      continue;
    }
    const method = `${get(r, idx.method)} ${get(r, idx.fin)}`.toLowerCase();
    const isCod = /cod|cash|pending/.test(method);
    const created = get(r, idx.created);
    const d = created ? new Date(created.replace(" ", "T")) : new Date();
    seen.set(id, {
      id,
      productId,
      createdAt: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
      customerName: get(r, idx.sname),
      phone: get(r, idx.phone).replace(/^'/, ""),
      email: get(r, idx.email) || undefined,
      address: [get(r, idx.a1), get(r, idx.a2)].filter(Boolean).join(", "),
      city: get(r, idx.city),
      state: get(r, idx.prov),
      pincode: get(r, idx.zip).replace(/^'/, "").replace(/\s/g, ""),
      amount: Number(get(r, idx.total).replace(/[^\d.]/g, "")) || 0,
      payment: isCod ? "COD" : "Prepaid",
      quantity: Number(get(r, idx.qty)) || 1,
      status: "new",
    });
  }
  return [...seen.values()];
}
