import type { ArticleType } from "@/lib/pipeline/types";

export const DEFAULT_CONTENT_BRIEF_PLACEHOLDER =
  "e.g. Write for players comparing licensed online casinos; cover bonuses, payout speed, and game variety; include a pros/cons table; end with responsible gambling note.";

export const POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER = `Write an online casino review for [Site Name].

## Goal
Help the reader make a concrete decision: is this casino worth considering, who is it good for, and who should avoid it. The review should feel like advice from an experienced player — not an operator's landing page, not a general gambling encyclopedia.

## Length
Match the length to the number of sections in the outline (each section is written to its full
budget). Be concise — every sentence must earn its place; do not pad to hit a number.

## Tone
Natural, expert, specific. You are writing for someone comparing several casinos with 5 minutes to spare. Do not market, do not scaremonger, do not moralize. Judge honestly.

## Fact rule (highest priority)
You have access to data from the content brief (operator, bonus terms, limits, licence). Use it.
If a specific value is NOT in the brief — state that once in the relevant section and move on.
Do not repeat "please verify in the terms" warnings across multiple sections.
Do not turn missing data into filler content.

## Structure (cover these topics where the outline includes them, in this order)

### 1. Quick verdict and ratings summary
Max 4 sentences: clear judgement (good / average / avoid), who it is for, one concrete pro, one concrete con.
Ratings table: Bonus | Withdrawals | Games | Mobile | Trust | Support — use 1–5 scale or Strong / Average / Weak.
If data is missing for a category — write "No data" without further explanation.

### 2. Who this casino suits
Two short lists: who will benefit, who should pick something else.
Give specific reasons, not generic statements.

### 3. Welcome bonus and wagering
State: amount, free spins, minimum deposit, wagering requirement, max bet during playthrough,
excluded games, bonus withdrawal cap, expiry, bonus code if applicable.
Explain wagering with a simple numerical example.
Give a clear verdict: is the bonus worthwhile after accounting for the conditions?
If data is missing — say so once, then assess what is known.

### 4. Registration, KYC and payments
Sign-up requirements, KYC documents and timing, effect on first withdrawal.
Available payment methods (highlight locally relevant ones), withdrawal timeframes, limits, fees.
One comparative comment: faster / slower / similar to typical competition. Maximum 2 paragraphs.

### 5. Games and providers
Library size, 3–5 key providers, live casino strength, search/filters, one sentence on mobile.
Do not list every provider.

### 6. Trust, licence and responsible gambling
Operator, jurisdiction, licence number if available, responsible gambling tools.
One specific red flag if it exists — or confirmation that nothing concerning was found.
Brief UX note: navigation, bonus terms visibility, cashier transparency, support responsiveness.

### 7. Pros, cons and final verdict
Maximum 5 pros and 5 cons — each specific, not repeating earlier sections.
Optional compact comparison table vs. 2 typical competitors (wagering, withdrawal speed, providers, mobile, licence).
Final verdict: 3–4 sentences with clear assessment.
Responsible CTA only: "Check bonus terms before registering" — never "Sign up now".

### 8. FAQ
Maximum 4 questions. Questions must be specific to this casino — no generic wagering or KYC
questions that would apply equally to any casino. Each answer: 2 sentences max.

## What to avoid
- Repeating "check the terms" more than once per section
- Paragraphs describing what a good casino should look like instead of evaluating this specific one
- FAQ questions that are identical to body content
- Restating the same warning in different words across sections
- Filler sentences that explain why something is important rather than assessing whether
  this casino does it well or poorly
- Any claim about legality for specific countries unless explicitly confirmed in the brief
- Phrases implying guaranteed wins, easy money, or financial motivation to gamble`;

export const POLISH_CASINO_COMMERCIAL_CONTENT_BRIEF_PLACEHOLDER = `Write a commercial page in the online casino / gambling niche for the Polish market — a ranking, comparison, guide, or category page. Match the shape to the target keyword.

## Identify the subject from the keyword (do this first)
The "options" the page compares or explains depend on the keyword:
- casinos (e.g. "najlepsze kasyna online", "top 10 kasyn") → rank/compare casinos
- bonuses (e.g. "bonus bez depozytu", "najlepszy bonus") → compare/explain bonus offers and types
- games / slots (e.g. "najlepsze sloty", "automaty online") → present/compare games or providers
- payment methods (e.g. "kasyna BLIK") → compare/explain payment methods
Build the page around that subject and OMIT sections that do not apply.

## Goal
Help the reader quickly choose or understand the best options for their query. The page should read like guidance from an experienced player — not an operator's landing page and not a gambling encyclopedia. State the selection/ranking basis up front.

## Length
Match the length to the number of sections in the outline (each section is written to its full budget). Be concise — every sentence must earn its place; do not pad to hit a number.

## Tone
Natural, expert, specific — written for a Polish reader with a few minutes to spare. Do not market, do not scaremonger, do not moralize. Be honest. Use PLN / złotówki for amounts.

## Fact rule (highest priority)
Use the facts from the content brief (option names, bonuses, wagering, payments, licence, game details). If a specific value is NOT in the brief, omit it — state it once where relevant and move on. Never invent options, ranking positions, figures, or licence details. Do not repeat "sprawdź regulamin" warnings across multiple sections.

## Structure (use the sections relevant to the subject, in this order; skip the rest)

### 1. Intro and selection basis
2-4 sentences: what the page covers and the concrete criteria used to rank/select (depends on the subject — e.g. for casinos: licence, bonus value, withdrawal speed; for bonuses: wagering, value, terms; for games: RTP, volatility, provider). State this once.

### 2. Comparison/overview table (ONLY when comparing discrete options)
A scannable Markdown table. Columns depend on the subject — include only those you have data for:
- casinos: Kasyno | Bonus powitalny | Warunek obrotu | Czas wypłat | Min. depozyt | BLIK | Licencja
- bonusy: Oferta | Warunek obrotu | Min. depozyt | Ważność | Kod
- gry/sloty: Gra / dostawca | RTP | Zmienność | Funkcje
- metody płatności: Metoda | Czas wpłaty/wypłaty | Limity | Opłaty
Only include rows for options named in the brief.

### 3. Featured / compared options (ONLY when comparing discrete options)
One short, parallel block per option: what it is best for, its key fact/figure (only if provided), and 1-2 specific pros and cons. Never reuse the same wording across options.

### 4. Breakdown by type / key criteria for the topic
For bonuses: bonus powitalny, bonus bez depozytu, darmowe spiny, kody promocyjne, cashback, program VIP (with a worked wagering example). For games: typy gier (automaty, gry stołowe, kasyno na żywo), RTP/zmienność. For casinos: the core evaluation criteria. Adapt to the subject.

### 5. How to choose / what to look for
Practical checklist for the subject (e.g. for casinos: licence, payout speed, payments, game range, mobile, support; for bonuses: realistic wagering, max bet, expiry; for games: RTP, volatility, demo availability).

### 6. Payments for Polish players (where relevant)
Cover locally relevant methods first: BLIK, then przelew, Visa/Mastercard, Skrill/MiFinity, Paysafecard, kryptowaluty. Note typical deposit/withdrawal speeds where known.

### 7. Licensing and legality in Poland (where relevant)
Explain the Polish licence (Ministerstwo Finansów) vs offshore licences (Curaçao, MGA, Gibraltar, UKGC). Do NOT claim an offshore casino is "legal in Poland" unless the brief states it. Neutral, factual.

### 8. Responsible gambling
One short note: 18+, graj odpowiedzialnie, available self-control tools. Once — not repeated in every section.

### 9. FAQ
Maximum 4 questions specific to this page (e.g. which option is best for a given need, fastest withdrawals, supports BLIK). Each answer 2 sentences max.

## What to avoid
- Declaring offshore casinos "legal" in Poland unless explicitly stated in the brief
- Hype or urgency language ("zarejestruj się teraz", "oferta ograniczona czasowo")
- Repeating the same pro/con wording across multiple options
- Inventing options, ranks, figures, or licence numbers not in the brief
- Citing third-party review/aggregator sites or "safety index" scores
- Phrases implying guaranteed wins, easy money, or financial motivation to gamble
- Responsible CTA only: "Sprawdź warunki przed rejestracją" — never "Zarejestruj się teraz"`;

/** Registry of (language, articleType) pairs that have a default editorial template. */
const DEFAULT_CONTENT_BRIEFS: { language: string; articleType: ArticleType; template: string }[] = [
  {
    language: "pl",
    articleType: "casino_review",
    template: POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER,
  },
  {
    language: "pl",
    articleType: "casino_commercial",
    template: POLISH_CASINO_COMMERCIAL_CONTENT_BRIEF_PLACEHOLDER,
  },
];

/** True when a default editorial template exists for this language + article type. */
export function hasDefaultContentBrief(
  articleLanguage: string,
  articleType: ArticleType
): boolean {
  return DEFAULT_CONTENT_BRIEFS.some(
    (entry) =>
      entry.language === articleLanguage && entry.articleType === articleType
  );
}

export function getDefaultContentBrief(
  articleLanguage: string,
  articleType: ArticleType
): string {
  const entry = DEFAULT_CONTENT_BRIEFS.find(
    (e) => e.language === articleLanguage && e.articleType === articleType
  );
  return entry?.template ?? "";
}

/** True when the brief matches ANY known default template (so it can be cleared on switch). */
export function isDefaultContentBriefTemplate(contentBrief: string): boolean {
  return DEFAULT_CONTENT_BRIEFS.some((entry) => entry.template === contentBrief);
}

export function getContentBriefPlaceholder(
  articleLanguage: string,
  articleType: ArticleType
): string {
  if (hasDefaultContentBrief(articleLanguage, articleType)) {
    return "Edit the loaded template below…";
  }
  return DEFAULT_CONTENT_BRIEF_PLACEHOLDER;
}
