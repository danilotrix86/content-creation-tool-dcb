import type { ArticleType } from "@/lib/pipeline/types";

export const DEFAULT_CONTENT_BRIEF_PLACEHOLDER =
  "e.g. Write for players comparing licensed online casinos; cover bonuses, payout speed, and game variety; include a pros/cons table; end with responsible gambling note.";

export const POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER = `Write an online casino review for [Site Name].

## Goal
Help the reader make a concrete decision: is this casino worth considering, who is it good for, and who should avoid it. The review should feel like advice from an experienced player — not an operator's landing page, not a general gambling encyclopedia.

## Tone
Natural, expert, specific. You are writing for someone comparing several casinos with 5 minutes to spare. Do not market, do not scaremonger, do not moralize. Judge honestly.

## Fact rule (highest priority)
You have access to data from the content brief (operator, bonus terms, limits, licence). Use it.
If a specific value is NOT in the brief — state that once in the relevant section and move on.
Do not repeat "please verify in the terms" warnings across multiple sections.
Do not turn missing data into filler content.

## Structure (follow order, do not expand sections unnecessarily)

### 1. Quick verdict (max 4 sentences)
Clear judgement: good / average / avoid. Who it is for. One concrete pro, one concrete con.
No disclaimers like "check the terms" here — those go at the end.

### 2. Ratings summary
Table: Bonus | Withdrawals | Games | Mobile | Trust | Support
Use a 1–5 scale or labels (Strong / Average / Weak).
If data is missing for a category — write "No data" without further explanation.

### 3. Who this casino suits
Two lists: who will benefit, who should pick something else.
Give specific reasons, not generic statements.

### 4. Welcome bonus
State: amount, free spins, minimum deposit, wagering requirement, max bet during playthrough,
excluded games, bonus withdrawal cap, expiry, bonus code if applicable.
Explain wagering with a simple numerical example.
Give a clear verdict: is the bonus actually worthwhile after accounting for the conditions?
If data is missing — say so once, then assess what is known.

### 5. Registration and KYC
What the casino requires at sign-up. When and what KYC documents may be needed.
How this could affect the first withdrawal. Maximum 2 paragraphs.

### 6. Payments and withdrawals
Available methods (highlight locally relevant ones). Withdrawal timeframes. Transaction limits.
Fees if any. Whether KYC holds up withdrawals.
One concrete comparative comment: faster / slower / similar to typical competition.

### 7. Games and providers
Is the library large or average. Quality of providers (name 3–5 key ones).
Whether live casino is strong. How search and filters work. One sentence on mobile.
Do not list every provider.

### 8. Trust and licence
Operator, jurisdiction, licence number if available. Responsible gambling tools.
One specific red flag if it exists — or a clear confirmation that nothing concerning was found.

### 9. UX and customer support
How navigation feels. Whether bonus terms are easy to find before activating.
Whether the cashier is transparent. Whether support responds quickly and in the user's language.

### 10. Pros and cons
Maximum 5 pros and 5 cons. Each point must be specific and not repeat content from earlier sections.

### 11. Comparison with competitors
One table: this casino vs. 2 typical competitors.
Columns: wagering, withdrawal speed, game providers, mobile, licence.
Use realistic market benchmarks if specific competitor data is unavailable.

### 12. Final verdict
3–4 sentences. Clear assessment.
Responsible CTA only: "Check bonus terms before registering" — never "Sign up now".

### 13. FAQ
Maximum 6 questions. Questions must be specific to this casino — no generic wagering or KYC
questions that would apply equally to any casino.

## What to avoid
- Repeating "check the terms" more than once per section
- Paragraphs describing what a good casino should look like instead of evaluating this specific one
- FAQ questions that are identical to body content
- Restating the same warning in different words across sections
- Filler sentences that explain why something is important rather than assessing whether
  this casino does it well or poorly
- Any claim about legality for specific countries unless explicitly confirmed in the brief
- Phrases implying guaranteed wins, easy money, or financial motivation to gamble`;

export function getContentBriefPlaceholder(
  articleLanguage: string,
  articleType: ArticleType
): string {
  if (articleLanguage === "pl" && articleType === "casino_review") {
    return POLISH_CASINO_REVIEW_CONTENT_BRIEF_PLACEHOLDER;
  }
  return DEFAULT_CONTENT_BRIEF_PLACEHOLDER;
}

export function usesPolishCasinoReviewBrief(
  articleLanguage: string,
  articleType: ArticleType
): boolean {
  return articleLanguage === "pl" && articleType === "casino_review";
}
