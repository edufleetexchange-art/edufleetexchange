# Go-To-Market Spec — Winning the First 10 Customers

**Date:** 2026-06-14
**Author:** strategy spec for the founder
**Status:** Draft for action
**Wedge decided:** Teacher hiring, one city, founder-led
**Reality check:** ~1 year of building, **0 customers, 0 customer conversations**

---

## 0. The one thing to internalize

> You do not have a product problem. You have a **demand-discovery** problem.

In a year you have written a great deal of software and spoken to **zero** customers about it. That is the entire reason you have no customers. No feature, redesign, or audit changes this. The only thing that changes it is **you talking to schools and teachers, and personally making hires happen by hand.**

This spec is therefore **mostly not about the product.** It is about you, a phone, a notebook, and a single city. The product is the tool you use *after* you've proven people want the transaction.

**Stop building. Start selling. Come back to code only when a paying customer asks for something specific.**

---

## 1. Why a year produced nothing (honest diagnosis)

1. **Five marketplaces, zero liquidity.** eduFleet is at once a school-bus market, a teacher job board, a supplier directory, and a placement tool. Each needs both a buyer and seller side to be useful. Building all five means none reached the critical mass where it's worth using. Marketplaces die from empty rooms, not missing features.
2. **Product-first in a relationship-first market.** Indian schools do not find a SaaS marketplace and self-onboard. A person calls, visits, earns trust, and closes. That person is you. There is no shortcut around the first 10.
3. **"Signup" was mistaken for "customer."** A free account is a ghost. A customer is a completed transaction — a teacher hired, money changed hands.
4. **No feedback loop.** With zero conversations, every feature was a guess. You've been answering questions nobody asked.

---

## 2. The wedge: teacher placement, one city, you as the agent

Forget vehicles, suppliers, and self-serve for 90 days. One sentence describes the business:

> **"I find screened teachers for schools in <your city>, and the school pays me a fee when they hire one."**

Why this wedge wins the cold-start:
- **Supply is free and easy.** Teachers looking for jobs will give you their profile for nothing — they want jobs. You can gather 50 in a week from WhatsApp/Telegram groups and B.Ed colleges.
- **Demand is frequent and pays.** Schools, and especially **coaching/tuition centres and preschools**, hire constantly and already pay recruitment agencies a placement fee (commonly ~half-a-month to one-month of the teacher's salary, or a flat ₹3k–₹15k per hire).
- **You can manufacture the first transaction by hand.** Collect teachers → call schools → hand-match → one gets hired → you invoice. No "platform" required to start.
- **The consultant tooling you already built is the ops system for exactly this.** You are Consultant #1. Roster = your teachers. Placements = your pipeline. Interviews = your scheduling. The product finally has a real user: you.

> Seasonality note: peak school hiring in India is **Feb–June** (before the June academic year). It's now mid-June, so the K-12 season is closing. **Target year-round hirers first** — coaching/tuition centres, preschools/daycares, and replacement/mid-year vacancies — and use the next 6 months to be the obvious choice when the Feb–June wave hits.

---

## 3. Define success (the only metrics that matter)

| Stage | Metric | Target (90 days) |
|---|---|---|
| Discovery | Customer conversations had | **20 schools + 30 teachers** |
| Liquidity | Vetted teachers in roster | 50 |
| Proof | **Paid placements completed** | **3** |
| Validation | A school that hires a **2nd** time | 1 |

A "customer" = **a school that paid you for a successful hire.** Not a signup. If you get 3 of these, you have a business to scale. If you can't get 1 in 90 days of real effort, the wedge or the city is wrong — and that's a finding worth more than another year of code.

---

## 4. The 30-day concierge playbook (do things that don't scale)

### Week 1 — Seed supply (free, fast)
- Join 10–15 **teacher-jobs WhatsApp/Telegram/Facebook groups** for your city. They exist for every Indian metro.
- Post a simple message (script §7a). Goal: **50 teacher profiles** (name, subject, experience, location, expected salary, phone). Put them in the eduFleet roster as you go.
- Visit 1–2 **B.Ed / D.El.Ed colleges** near you; ask the placement officer if you can list their graduating students.

### Week 2 — Find demand (the hard, essential part)
- Build a list of **50 schools/coaching centres/preschools** in your city (Google Maps, JustDial, local directories). Capture name, phone, area, and the decision-maker (owner/principal/centre head).
- **Call or visit 30 of them this week.** Use the script (§7b). You are not selling software. You are asking one question: *"Are you hiring any teachers right now, or will you soon?"*
- Target outcome: find **3–5 schools with an open position.**

### Week 3 — Make the match by hand
- For each open position, hand-pick 3 candidates from your roster, call them to confirm interest, and send the school a one-page shortlist (name, subject, experience, expected salary).
- Schedule interviews (use the eduFleet interview scheduler — now it has a real user). Show up helpful: confirm the teacher attends, follow up same day.

### Week 4 — Close the first hire and get paid
- Push one match to an offer. The moment a school says "we'll take her," send a **simple invoice** for the placement fee (§6).
- Collect the payment. **That is your first customer.** Screenshot it. It changes everything psychologically and as proof.
- Ask the happy school: *"Who else do you know that's hiring?"* Referrals are the second customer.

Repeat the loop. Tighten the script with every "no." Twenty "no"s teach you the real objection (price? trust? timing? quality?) — which is the data you've been missing for a year.

---

## 5. What to STOP and what to BUILD

### Stop building (park indefinitely)
- The vehicle/bus marketplace, the supplier directory, ads, new personas, visual polish, more dashboards. None of it produces a teacher hire. Freeze it.

### Build only these (and only when they block a real hire)
1. **A dead-simple "share shortlist" output** — a clean PDF/WhatsApp-able list of 3 candidates for a principal. (This is your actual sales artifact.)
2. **WhatsApp-first everything.** Indian schools live on WhatsApp, not email. The "contact" and "interview invite" flows should produce a WhatsApp message/link, not assume email.
3. **A one-screen "post a vacancy" that a non-technical principal can fill in <60 seconds** (or that you fill in for them on a call).
4. **Placement fee + invoice tracking** on the consultant side — so when you scale to 10 placements you know who owes you.
5. **Teacher quick-add** — capture a profile from a WhatsApp forward in seconds (you'll do this 50+ times).

Everything else waits until a paying customer asks for it by name.

---

## 6. Pricing & offer (remove all risk for the school)

Schools won't pay upfront to an unknown platform. So don't ask them to.

- **Offer:** *"Free to post your vacancy. Free to interview my candidates. You only pay me ₹X when you actually hire someone — and if they leave within 30 days, I replace them free."*
- **Price:** start at a **flat, legible fee per hire** (e.g. ₹5,000–₹10,000 for a school teacher; lower for preschool/coaching). Flat beats "% of salary" early — easier to say yes to.
- **Risk reversal** (the 30-day free replacement) is what makes a stranger trust you. It costs you nothing if your screening is decent and wins the deal.
- Teachers pay **nothing**, ever, at this stage. They are your free supply; don't tax it.

Subscriptions, plans, the bank-transfer card — **switch all of that off for now.** One transaction, one fee, paid on success.

---

## 7. Scripts (you have zero conversations — here are the words)

### 7a. Teacher recruitment (post in WhatsApp/Telegram groups)
> *"Hi everyone — I help teachers in <city> get placed in good schools, free for teachers. If you're looking for a teaching job (any subject, any board), send me your name, subject, years of experience, area, and expected salary. I'll match you to schools that are hiring. DM me."*

### 7b. School cold call / walk-in (the only pitch that matters)
> *"Hello, I run a teacher placement service in <city>. I have a list of screened, ready-to-join teachers — math, science, English, primary, whatever you need. Are you hiring any teachers right now, or expecting a vacancy soon? … Great — I can send you 3 candidates today, you interview them free, and you only pay me if you actually hire one. Shall I send them on WhatsApp?"*

### 7c. After a successful hire (get the next customer)
> *"So glad it worked out. I'd love to help more schools like yours — is there a principal or owner you'd recommend I speak to? And whenever you have your next vacancy, just WhatsApp me one line and I'll send candidates the same day."*

---

## 8. 30 / 60 / 90 day milestones

| Day | Milestone |
|---|---|
| **30** | 50 teachers in roster; 30 schools contacted; **first paid placement closed.** |
| **60** | 3 paid placements; pitch + price validated against ~20 "no"s; the 5 product fixes (§5) shipped. |
| **90** | A school that hired **twice**; a repeatable script; a clear read on whether to expand the wedge (more cities, then maybe self-serve). |

If by day 90 you cannot get **one** school to pay for **one** hire after genuinely working the playbook, the honest conclusion is the wedge/city/price is wrong — and you pivot the *go-to-market*, still not the code.

---

## 9. The mindset shift

For a year, "progress" meant a commit. Starting now, **progress means a conversation or a rupee.** A day with no school called and no teacher added is a day of zero progress, no matter how much code you wrote. Track *conversations and placements* on your wall, not features.

The platform we built is good. It's been waiting for its first real user — and that user is **you, running a placement service by hand, this month.** Make 10 hires happen the slow way. Then, and only then, automate them.

---

### Immediate next 3 actions (today/this week)
1. **Join 10 teacher-jobs WhatsApp/Telegram groups** for your city and post script §7a.
2. **List 50 schools/coaching centres** in your city with a phone number for each.
3. **Call 10 of them tomorrow** with script §7b. Goal: find one open vacancy.
