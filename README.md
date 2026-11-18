# 🚀 Buildathon: Make Wednesdays Great Again

**Masters' Union · For AI Developers · Winner gets Rs. 25,000**

> **Every team must build in a fork of this repository.** Projects not built in a fork of this repo won't be judged.

| | |
|---|---|
| **Date** | Wednesday, 18 November 2026 |
| **Hacking** | **3:00 PM – 7:00 PM IST** (code freeze at 7:00 PM sharp) |
| **Venue** | CDS Audi, 8th floor |
| **Prize** | Rs. 25,000 to the winning team |
| **Register your fork** | 👉 **[https://forms.gle/ZJUYKwTYjsMsVB2b9](https://forms.gle/ZJUYKwTYjsMsVB2b9)** (**deadline 3:30 PM IST**) |
| **Final submission** | Your fork as it stands at **7:00 PM IST**. There's nothing else to submit. |

> 🤖 **Using an AI coding agent?** Point it at [`AGENTS.md`](AGENTS.md). It has the full event brief, tracks, judging and rules in a form agents can read directly. Claude Code loads it automatically through `CLAUDE.md`, and Codex reads `AGENTS.md` natively.

---

## 🎯 Pick one build track

| # | Track | Brief |
|---|---|---|
| **01** | **Build for the Physical World** | Make a real-world task easier, faster or more reliable. Show it in a realistic scenario. |
| **02** | **Build for AI Agents** | Find something an agent struggles with. Build the tool that fixes it, then demo the agent using it. |
| **03** | **Build in Your Area of Expertise** | Pick a field you know firsthand. Ship a working product that improves how people handle it today. |

## ⚖️ How you'll be judged (each criterion is ⅓ of your score)

| Criterion | The question judges ask |
|---|---|
| **Working product** | Does it do what you say it does? Show the core workflow in your demo. |
| **Problem insight** | Who faces this problem, and why does it happen? |
| **Depth of execution** | How well did you solve the hardest part of the build? |

---

## Why fork this repo?

Everyone starts from the same commit (the **genesis commit**) at the same time. Organizers can then check that:
- all code was written **during** the Buildathon and not brought in from an earlier project,
- teams commit steadily instead of pasting in one huge AI-generated dump at the end,
- every repo stays public and visible while you build.

The organizers track every fork automatically: commits, timing and activity. Read [RULES.md](RULES.md) before you write any code.

---

## ✅ Setup (about 5 minutes, do it at 3:00 PM)

**In short:** fork → register your fork in the form **by 3:30 PM** → build → push before 7:00 PM.

### 1. Fork this repo
Click **Fork** (top right). On the fork screen:
- **Owner:** one team member's personal account. Only **one fork per team**.
- **Repository name:** `buildathon-<team-name>`, for example `buildathon-byte-bandits`
- Click **Create fork**.

> ⚠️ Don't download a ZIP or copy the files into a new repo. **It has to be a real GitHub fork**, or the tracker can't see you.

### 2. Keep it public
Forks of a public repo are public. **Don't make it private, archive it, or delete it** until judging is over.

### 3. Add your teammates
In your fork: **Settings → Collaborators → Add people**. Add each teammate's GitHub account so their commits count toward the team.

### 4. Enable Actions
Open the **Actions** tab of your fork and click **"I understand my workflows, go ahead and enable them"**. This runs the automatic check on every push.

### 5. Make your registration commit (your first commit)
Fill in [`team.json`](team.json). `track` must be one of `physical-world`, `ai-agents` or `area-of-expertise`. Then:

```bash
git clone https://github.com/<your-username>/buildathon-<team-name>.git
cd buildathon-<team-name>
# edit team.json
git add team.json
git commit -m "register: <team name>"
git push
```

The **Hackathon check** in the Actions tab should go green ✅. If it's red, open the run to see what's wrong in `team.json`.

### 6. Register your fork (deadline: 3:30 PM IST)
👉 **[https://forms.gle/ZJUYKwTYjsMsVB2b9](https://forms.gle/ZJUYKwTYjsMsVB2b9)**

It's a 4-question Google Form: team name, fork link, track, team members. It connects your repo to the organizers' live tracker.

- Fill it in **once per team**, right after forking, and **no later than 3:30 PM IST**. **Teams that don't register can't be tracked.**
- Paste your **fork's** URL (`https://github.com/<you>/buildathon-<team-name>`), not this starter repo's.
- Need to change something? Use the **"Edit your response"** link on the confirmation page. Don't fill it in twice.
- **Final submission is automatic.** Whatever is pushed to your fork at 7:00 PM IST is what gets judged.

---

## 🛠 While you build (3:00 – 7:00 PM)

- Put your code anywhere in the repo (`app/`, `src/`, `frontend/`, `backend/`…). There's no required layout.
- **Commit early, commit often**, at least every 30 minutes of real work, with messages that say what changed.
- **Push regularly.** Commits you never push don't exist to the tracker.
- AI coding tools (Claude Code, Codex, Cursor, Copilot…) are **allowed and encouraged**. Keep `AGENTS.md` and `CLAUDE.md` in the repo; they keep your agent within the rules.
- Before 7:00 PM, replace the "Your project" section below with your project's README.

## 🧊 Code freeze: 7:00 PM IST

At 7:00 PM the tracker takes a snapshot of every fork. **Commits pushed after code freeze are ignored.** Judges look at your last commit before 7:00 PM.

## ❌ Things that get you flagged

- Rewriting history (`git push --force`, rebasing away the genesis commit, squashing everything into one commit)
- Commits dated before 3:00 PM
- One or two giant commits containing most of the project
- A repo that isn't a fork of this one, or that's private or deleted

See [RULES.md](RULES.md) for the full list.

---

## Your project

### DropOS: an MCP server that runs a student dropshipping business from inside Claude

- **Team:** Cuck Coderz (Arnav Sharma, Aarush Goel, Sshaurya Aggarwal)
- **Track:** 03 · Build in Your Area of Expertise (`area-of-expertise`)
- **Live:** https://hack.icedoutai.com (create a team, get your connector URLs)

#### Problem: who faces it and why it happens

In the Masters' Union Dropship Challenge, first-year students run a real D2C dropshipping business in a few weeks: pick products, source from IndiaMART, build a store, run Meta ads and ship COD orders across India. Almost none of them have done it before, and the same mistakes sink most teams:

1. **They judge products by naive margin** (price − cost − shipping). In India about 70% of first-time buyers pay COD, and 20–40% of COD orders come back (RTO). Every RTO still costs forward and reverse shipping plus the ad that produced it, so a "69% margin" product can lose money on every order placed.
2. **Sourcing is manual chaos.** Dozens of IndiaMART sellers reply on WhatsApp in Hinglish (*"rate 180 + 18% gst, moq 20 pcs, dispatch 2 din me, cod nahi"*), and nobody compares quotes on what matters for dropshipping: direct-to-customer shipping, COD, blind packing, dispatch time and landed cost.
3. **They ship every COD order blindly, run ads on gut feel, and lose track of who on the team did what.**

They already use Claude every day, but a general chatbot can't do this job alone: it guesses Indian COD economics, forgets the team's suppliers and orders between chats, can't publish a store or book a courier, and every teammate's chat is a separate silo.

#### What we built

**DropOS is a remote MCP server.** A team creates itself on the setup page and each member gets a personal connector URL. They add it to their own Claude account (**Settings → Connectors → Add custom connector**) and then just talk to Claude about their store. Claude does the thinking and writing; DropOS gives it the tools it lacks:

- **Shared, persistent team state** on our server. Every teammate's Claude reads and writes the same products, suppliers, quotes, creatives, ad sets, orders and shipments, and every change is attributed to the person who made it (`team_activity`: "what did Aarush do today?").
- **Computed, not guessed, India dropshipping math.** RTO-adjusted unit economics per order *placed*, break-even CPA, the max COD RTO a product survives, and break-even ROAS.
- **Domain engines.** A Hinglish supplier-quote parser and quote ranking, KILL / WAIT / KEEP / SCALE ad decisions against break-even CPA, and an explainable per-order RTO risk score with the operator action (ship, confirm + prepaid offer, call + ₹99 advance, hold).
- **Real-world actions.**
  - Publishing a live store page with Cash-on-Delivery checkout at `/s/<store>`. Claude writes the copy; DropOS refuses invented reviews, ratings, sales counts or scarcity.
  - Syncing the orders it receives, and importing Shopify order CSVs.
  - Creating shipments with Shiprocket, Delhivery or a demo courier, and tracking them.
  - Sending customers WhatsApp (Meta Cloud API) and email (Resend) updates with a public tracking page at `/t/<id>`.

All tools are deterministic and run on our VM, so **the server needs no LLM API key**. The intelligence is the team's own Claude.

#### The hardest part: how we solved it

1. **Getting the economics right, then making every tool use them.** `web/src/lib/economics.ts` models expected profit per order placed:
   - **Revenue:** delivered% × price.
   - **Costs:** product cost for delivered units plus lost RTO units, forward shipping on every order, reverse shipping on RTOs, COD remittance and gateway fees, packaging, and CPA.
   - **Break-even RTO:** profit is linear in COD RTO, so we solve exactly for the RTO at which a product stops making money.

   The same break-even CPA drives quote ranking, ad decisions and the overview's next actions.
2. **Explainable RTO scoring** (`web/src/lib/rto.ts`). Every pending order is scored from the signals operators check by hand: payment mode, pincode zone, fake or invalid phones, vague or junk addresses, gibberish names, late-night impulse orders, high-value or bulk COD, duplicates, and customers who refused a parcel before (fed automatically by courier tracking). Each signal shows its points, so the agent can explain *why* an order is risky, and the batch impact shows the ₹ saved.
3. **A multi-user MCP server with correct shared state.** The endpoint is stateless JSON-RPC over MCP Streamable HTTP (`web/src/app/mcp/[token]/route.ts`).
   - **Identity:** each URL token maps to a team and member (`web/src/mcp/context.ts`).
   - **Safe concurrent writes:** every write is a per-team serialized read-modify-write (`ctx.update`), so two teammates' Claudes acting at once never lose each other's changes.
   - **Attribution:** activity is derived from the diff of each write.

#### How to run it

```bash
cd web
npm install
npm run build && npx next start -p 3100   # MCP at /mcp/<token>, setup page at /
```

We expose it at https://hack.icedoutai.com through a Cloudflare Tunnel. Runtime data (teams, stores, orders, shipments, per-team integration credentials) lives in `web/data/`, which is not committed.

#### Demo

1. Open https://hack.icedoutai.com, create a team, and copy a member's connector URL.
2. In Claude, go to **Settings → Connectors → Add custom connector** and paste the URL.
3. Talk to Claude:
   - "Here are our 6 product ideas…": it runs `add_products` and `analyze_products`. You see naive margin vs real profit per order, and which products to drop.
   - "This supplier replied: *rate 180 + 18% gst…*": `record_quote` → `compare_quotes` → `finalize_supplier`.
   - "Write and publish our store page in Hinglish": `publish_store_page` returns a live URL. Place a COD order on it.
   - "Sync orders and tell me what not to ship": `sync_website_orders` / `import_orders` → `rto_check`.
   - "Ship the safe ones and notify customers": `create_shipment` → `track_shipments`, with a customer tracking link.
   - "What did my teammates do today?": `team_activity`.

**Limits:** courier, WhatsApp and Resend calls are implemented but were only tested against their auth errors, since we had no live credentials during the event. Until a team connects them, messages are queued with one-click send links. Meta Ads numbers are logged through Claude rather than pulled from the Marketing API.
