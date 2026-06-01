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

export function usesPolishCasinoReviewBrief(
  articleLanguage: string,
  articleType: ArticleType
): boolean {
  return articleLanguage === "pl" && articleType === "casino_review";
}

export function getDefaultContentBrief(
  articleLanguage: string,
  articleType: ArticleType
): string {
  if (usesPolishCasinoReviewBrief(articleLanguage, articleType)) {
    return POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER;
  }
  return "";
}

export function isPolishCasinoReviewTemplate(contentBrief: string): boolean {
  return contentBrief === POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER;
}

export function getContentBriefPlaceholder(
  articleLanguage: string,
  articleType: ArticleType
): string {
  if (usesPolishCasinoReviewBrief(articleLanguage, articleType)) {
    return "Edit the loaded template below…";
  }
  return DEFAULT_CONTENT_BRIEF_PLACEHOLDER;
}
