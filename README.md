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

### DropOS: AI co-pilot for the Masters' Union Dropship Challenge

- **Team:** Cuck Coderz (Arnav Sharma, Aarush Goel, Sshaurya Aggarwal)
- **Track:** 03 · Build in Your Area of Expertise (`area-of-expertise`)

#### Problem: who faces it and why it happens

In the Masters' Union Dropship Challenge, first-year students run a real D2C dropshipping business in a few weeks: pick a product, find a supplier on IndiaMART, build a Shopify store, make creatives, run Meta ads and ship COD orders across India. Almost none of them have done it before, and the same three mistakes sink most teams:

1. **They judge a product by naive margin** (price − cost − shipping). In India about 70% of first-time buyers pay COD, and 20–40% of COD orders come back (RTO). Every RTO still costs forward and reverse shipping plus the ad that produced it. A product with a "69% margin" can lose money on every order placed.
2. **Sourcing is manual and slow.** They message dozens of IndiaMART sellers, get replies like *"rate 180 + 18% gst, moq 20 pcs, dispatch 2 din me, cod nahi"*, and can't compare quotes on what actually matters for dropshipping: direct-to-customer shipping, COD, blind packing, dispatch time and landed cost.
3. **They ship every COD order blindly** and run ads on gut feel, with no break-even CPA to say which ad sets to kill.

The knowledge exists, but it lives in experienced operators' heads and spreadsheets. Nothing connects the steps, so a bad assumption at step 1 shows up as a loss at step 5.

#### What we built: the core workflow

One CRM that walks a team through the whole challenge, with the **active product's RTO-adjusted unit economics feeding every step**:

| Step | What DropOS does |
|---|---|
| **1 · Product research** | Claude suggests products for the Indian market and scores demand, margin, RTO risk, competition and "wow". The economics panel contrasts *what beginners calculate* (naive margin) with *what you actually make per order placed* after COD share, RTO, reverse shipping, COD fees and CPA, plus break-even CPA, max tolerable COD RTO and break-even ROAS. |
| **2 · Suppliers & quotes** | Finds IndiaMART suppliers (Claude web search restricted to `indiamart.com`), drafts Hinglish WhatsApp / email / IndiaMART outreach, parses messy Hinglish replies into structured quotes, and ranks them by landed cost and real profit per order, with flags for no dropship, no COD, no blind shipping, slow dispatch and high MOQ. A stage pipeline (found → contacted → quoted → sampling → finalized) tracks every supplier. |
| **3 · Ad creatives** | Generates distinct angles (problem→solution, price anchor, gift, UGC…), with hooks, primary text, headlines and Reel shot lists in English, Hinglish or Hindi, rendered as Instagram feed-ad mockups. |
| **4 · Meta ads** | Builds an ABO testing plan from the break-even CPA, tracks ad sets, and gives each one a KILL / WAIT / KEEP / SCALE verdict with reasons, using RTO-adjusted ROAS rather than Meta's reported ROAS. |
| **5 · Orders & RTO** | Imports a Shopify order export and scores every COD order for RTO risk before it ships. It shows why each order is risky and the action an operator would take (ship, confirm + prepaid offer, call + ₹99 advance, hold), drafts the WhatsApp message, and estimates the RTO and money saved on the batch. |
| **Command center** | Pipeline status across all five steps and a "next best action" list. |

#### The hardest part: how we solved it

**Making the RTO reality visible and actionable, end to end.**

- **Unit economics per order *placed*, not per order delivered** (`web/src/lib/economics.ts`). Expected revenue is `delivered% × price`. Costs include product for delivered orders plus lost RTO units, forward shipping on *every* order, reverse shipping on RTOs, COD remittance on delivered COD, gateway fees on prepaid, packaging, and CPA. Because profit is linear in the COD RTO rate, we solve for the exact RTO at which the product stops making money. Break-even CPA from this model drives the Meta ads verdicts and the supplier quote ranking.
- **An explainable RTO risk engine** (`web/src/lib/rto.ts`). Each order is scored from the signals operators check by hand: payment mode, pincode zone (metro hubs vs postal regions with historically high COD refusal), invalid or fake phones, junk or vague addresses, gibberish names, late-night impulse orders, high-value and bulk COD, duplicates within 24h, and customers who refused before. Every signal shows its points, so students learn *why*. The score maps to an RTO probability and an action. A portfolio model compares "ship everything blindly" with "follow DropOS" on the pending batch. The weights are heuristic, and teams can tune them as their own delivery data comes in.
- **Messy Hinglish supplier replies → structured quotes**: Claude structured outputs (zod schemas), backed by a deterministic regex parser so the feature still works offline.
- **AI that never breaks the demo**: every Claude call (`web/src/lib/ai.ts`, model `claude-opus-5-5`, structured outputs) has a seeded fallback. A badge marks each result as *Live AI* or *Demo data*.

#### How to run it

```bash
cd web
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for live Claude; without it, seeded demo output is used
npm run dev                   # http://localhost:3000
```

Open the Command center and click **Load demo workspace** to fill every screen with a realistic mid-challenge team. On *Orders & RTO*, you can also import a real Shopify **Orders → Export** CSV.

#### Demo / screenshots

**Live:** https://hack.icedoutai.com (click **Load demo workspace** on the Command center)


Demo path: **Command center** → **Product research** (naive margin 69% vs real profit per order) → **Suppliers** (paste a Hinglish reply, see the parsed quote and best pick) → **Creatives** → **Meta ads** (simulate 3 days, KILL/SCALE) → **Orders & RTO** (riskiest-first dispatch queue, WhatsApp draft).

**Not built yet:** live Meta Marketing API sync, Shopify Admin API sync, and courier (Shiprocket/Delhivery) NDR webhooks. Data is entered, imported via CSV, or simulated today.
