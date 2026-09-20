# Product Decisions

Status: confirmed by the product owner on 2026-09-20 as the Cofounder MVP implementation baseline.

This document records the settled product decisions from the design interview. Any later semantic change requires an explicit decision and a versioned update to the affected rules, content, or question set.

## Positioning

- Name the product `Cofounder`; use “AI 创业合伙人压力测试” as a descriptive subtitle rather than the product name.
- Use “Are you really suited to build a company together?” as a provocative entry point, but never return a yes/no compatibility verdict.
- Present the product as an entertainment test, not a scientific, psychological, investment, or professional assessment.
- Launch first for mainland Chinese AI startup founders in Simplified Chinese.
- Offer the MVP free of charge.
- Set a minimum participation age of 14 without collecting a birth date. Require the Participant to confirm eligibility at Account registration.

## Initial validation

- The first MVP hypothesis is that a completed Pair finds its public identity compelling enough to share.
- Use Pair Share Rate—the proportion of created Pairs that ultimately produce a share—as the north-star metric.
- Diagnose that metric through Participant completion, partner participation, Pair Completion, result viewing, and completed-Pair sharing rates.

## Identity and privacy

- Use a lightweight, passwordless Account identified by a verified email address.
- Authenticate by email OTP and retain a secure session on the device. The same Account can recover access on another device by verifying the email again.
- Keep the internal Account identifier independent from the email address.
- Present registration as a retro computer sign-in flow rather than a conventional SaaS form.
- Collect all privacy-related acknowledgements at Account registration, not as Pair Test questions. Require one acknowledgement for the terms and privacy notice and a separate explicit consent for external automated classification and overseas processing; record each consent's version and timestamp.
- Present age eligibility and privacy choices before email and OTP entry, but attach the timestamped consent record only after the email is verified and the Account is created.
- Ask for an Account-level display name during registration after email verification. Never derive it from the email address.
- Accept display names from 1 through 32 Unicode characters after trimming, reject control characters, and escape them in every output context. Do not add a subjective profanity filter.
- Do not repeat unchanged privacy consent inside the Pair Test. Require consent again only when a material policy or processing change introduces a new version.
- After a required privacy version changes, continue to permit sign-in, data export, Participant Withdrawal, and Account deletion, but block Pair creation, invitation acceptance, and questionnaire progress until the Account records the current consent.
- Delete incomplete Pairs after 30 days; retain completed Pairs by default until deletion is requested.
- Let each Participant withdraw their own answers. A withdrawal invalidates the Pair result and its Public Identity Cards but does not delete the other Participant's answers.
- Treat Account deletion as Participant Withdrawal from every Pair associated with that Account. Invalidate all resulting Private Reports and Public Identity Cards while preserving each counterpart's independently provided data.
- Replace an invalidated Public Result Page with a non-identifying withdrawal notice and a path to start a new Pair Test. Previously downloaded or shared images cannot be revoked.
- Attribute ordinary differences in the Private Report, but only state that a difference exists for Sensitive Topics.
- Never expose Sensitive Topics on a Public Identity Card by default.
- In the registration privacy notice, explain that answers are combined into a shared interpretation while individual Sensitive Topic answers are not attributed.
- Each Participant controls their own public display name, which may be a real name, nickname, or role name.
- Keep public-name permission outside the Pair Test questions. Ask for Pair-specific permission in the first `PRINT / SHARE` flow and remember that choice for the Pair. Until a Participant explicitly enables their display name for a Public Result Page, use an anonymous role label for that Participant.
- Do not create a Public Result Page automatically at Report Ready. Either Participant may explicitly generate one from `PRINT / SHARE`; the counterpart remains anonymous unless they separately permitted their display name for that Pair.
- Opening an Invitation Link does not claim a place. The second Participant must authenticate, provide a display name, hold current required consent, and explicitly accept the challenge; the Invitation Link then becomes invalid.
- Participants may revise answers before submission. Submitted answers are sealed and immutable; a future retest creates a new Pair Test rather than rewriting the old one.
- Permit authorized operators to inspect ordinary-question answers for calibration and support under audited, least-privilege access.
- Do not expose individual Sensitive Topic answers to operators; provide only anonymized aggregates for those questions.
- Send only a de-identified Pair Feature Vector to TypeSafe AI. Disclose the external automated classifier and overseas processing in the privacy notice.
- Encrypt raw Sensitive Topic answers while the Pair is incomplete. At Pair Completion, derive only non-attributed Sensitive Signals and required immutable report inputs, then delete the original sensitive options.
- Mark Public Result Pages `noindex, nofollow` while allowing social preview crawlers to read public Open Graph metadata.
- Use ten-minute email OTPs with at most five verification attempts and a 60-second resend delay, rate-limited by email and IP. Use a rotating 30-day Account session.
- When OTP delivery fails, let the person retry after the resend countdown or change the email address, with a specific recoverable error. Do not introduce a password, Magic Link, or manual authentication bypass.
- Let `Privacy & Data` explain processing and provide export of the current Account's profile, answers still retained, and shared reports; Participant Withdrawal and Account deletion must also be available there.
- Export one machine-readable JSON package containing Account data, current consent records, the Participant's retained answers, Pair states, and shared reports. Never reconstruct raw Sensitive Topic answers that have already been deleted.
- Require a fresh email OTP before Participant Withdrawal or Account deletion.
- Use high-entropy Invitation tokens and store only their hashes. Invalidate an invitation immediately after claim or reset.
- Restrict production logs to an allowlist of internal IDs, event types, versions, timings, and error codes. Never log email addresses, OTPs, invitation or result tokens, raw answers, or Pair Feature Vectors.
- Publish results at `/r/{high-entropy-slug}` while storing only a slug hash. Keep the route as a Withdrawn Result tombstone after withdrawal.
- Let either Participant unpublish a Public Result Page without withdrawing from the Pair or deleting the Private Report. Show only a non-identifying unavailable-result page at the former URL.
- If a Participant later permits their display name, update the active Public Result Page and future receipt renders at the same URL. Previously downloaded images remain unchanged.
- When an Account changes its display name, update that name throughout its private Pair views and any Public Result Page on which that Account still permits public display.
- Make deleted online data immediately inaccessible. Disclose that backup copies age out under the infrastructure retention window rather than promising immediate physical erasure from every backup.

## MVP delivery constraints

- Host the MVP outside mainland China for seed validation and make no mainland availability or latency guarantee.
- Keep the existing React 17 and Webpack frontend toolchain during MVP development rather than combining product work with a framework migration.
- Serve the imported `portfolio-inner-site` application from the same origin at `/desktop`: embed it from the 3D desktop experience and open it directly for the mobile experience.
- Allow any authenticated Account with current consent to create a Pair; do not implement a separate Beta Invitation Code. Use the Pair Invitation Link only to admit the second Participant to that specific Pair.
- Do not add a separate legal or content sign-off workflow as an MVP product feature.
- Limit an Account to three active incomplete Pairs. Completing, cancelling, withdrawing from, or expiring one frees capacity for another.
- Protect OTP sending and anomalous Pair creation or public-result generation with server-side rate limits and risk-triggered Cloudflare Turnstile. Do not interrupt ordinary questionnaire answers with CAPTCHAs.
- Do not provide a Public Result Page abuse-reporting workflow in the MVP.

## Pair lifecycle

- The creator completes and seals their Pair Test before the product creates an Invitation Link.
- Prevent the same Account from occupying both places in a production Pair; allow explicit test fixtures outside production.
- Before an Invitation Link is claimed, the creator may cancel the Pair or replace the invitation. After claim, both Participants have equal rights and neither can remove or overwrite the other.
- Keep an unclaimed Invitation Link valid for the same 30-day active lifetime as its incomplete Pair rather than introducing a separate invitation expiry clock.
- If a claimed Participant abandons their draft, the other Participant may create a new Pair but may not delete that draft or replace its owner.
- Expire and delete an incomplete Pair after 30 consecutive days without valid Participant activity; send both Participants one reminder seven days before expiry.
- Count Profile saves, answer saves, invitation acceptance, and final submission as valid Participant activity. Merely opening, viewing, or signing in does not refresh the expiry clock.
- Ask both Participants independently for relationship stage, how long they have known each other, how long they have worked together, and their responsibilities. Treat meaningful discrepancies as input to the report.
- Present one question per screen with section-level progress. Allow free backward navigation and revision until final submission.
- Save each answer as a cross-device draft with an optimistic revision check. Reject a stale-device write and require that device to reload rather than silently overwriting a newer answer.
- Require an acknowledged server save before advancing. On network failure, show the unsaved state and retry without pretending to support a complete offline workflow.
- Before final submission, show the Participant a private review of all their answers and an explicit warning that submission seals them permanently.
- A retest always creates a new independent Pair. Keep the prior report, and do not build report-to-report comparison into the MVP.
- After Pair Completion, transition to `Report Generating`. Publish the immutable result only at `Report Ready`, then refresh open result pages and send the result-ready email.
- Advertise the Pair Test as taking approximately ten minutes until measured completion data supports a narrower claim.
- Describe the assessment as 34 test questions. Treat relationship Profile and company authority as unscored setup rather than adding them to the advertised count.

## Experience direction

- Preserve the existing 3D room as the starting point for exploration.
- On desktop, move from the 3D room into one IE-style Diagnostics Application based on the current “Henry Heffernan — Showcase 2022” interaction rather than splitting the test across multiple windows.
- On mobile, skip the 3D room and enter a touch-friendly 2D version of the Diagnostics Application while preserving the retro visual language.
- Do not use eyebrow or kicker labels anywhere in the product. Establish hierarchy with the page title, body copy, and functional system status only.
- Keep only `Cofounder Diagnostics` and `Credits` as desktop applications, and automatically open Diagnostics when the Participant enters the computer.
- Populate Start with `New Pair Test`, `My Pairs`, `Privacy & Data`, `Credits`, and `Shut Down`; every item must perform a real action.
- Send only the brand homepage `/` through the 3D room. Open Invitation, authentication-return, and report deep links directly in the Diagnostics Application.
- On the homepage, offer `Enter the Garage` and a secondary `Skip to Diagnostics` action without requiring the 3D experience.
- After the desktop user explicitly enters the garage, enable office ambience and interaction sounds with a persistent mute control. Keep mobile muted by default.
- Replace the outer Henry identity with the product name, `AI Cofounder Diagnostics`, clock, and mute control; remove free-camera controls from the product experience.
- Treat a small viewport or coarse pointer as a signal to default to the mobile 2D application, while still offering a path to the complete 3D experience.
- Preserve the shutdown terminal and restart mechanics with product-specific copy, but remove Henry's personal shutdown jokes and assets.
- Require keyboard operation throughout the Pair Test. Respect `prefers-reduced-motion` across camera movement, CRT effects, terminal typing, and receipt printing.
- Fully verify the desktop experience in current Chrome and Safari, and the direct 2D experience in iOS Safari and Android Chrome. Smoke-test the core flow in Firefox rather than promising complete visual parity across every browser.
- Generate one Archetype-led Identity Receipt in the MVP without a numerical compatibility score.
- After viewing the result, a Participant can click `PRINT`. A non-3D modal printer appears in the center of the page, feeds out the Identity Receipt, and then offers share, image download, and close actions.
- Implement the copied Receipt Printer as one shared Printer Overlay used by the outer desktop page and the direct mobile Diagnostics experience. The same-origin desktop application requests the parent overlay when the Participant clicks `PRINT`.
- Publish a Public Result Page for the Identity Receipt, generate its social preview image, and let a Participant save the receipt itself as an image.
- Support sharing through the platform Web Share API when available, saving the receipt as a PNG, copying the Public Result Page link, and displaying its QR code. Do not promise direct publishing integrations for WeChat or Xiaohongshu in the MVP.
- Respect reduced-motion preferences by making the complete receipt immediately available without the printer sequence.
- Show both Participants the same underlying Private Report facts. Present ordinary differences from the current Participant's perspective while describing Sensitive Topic differences without attribution.
- Show the eight dimensions in the Private Report without an overall compatibility score. Do not retain a hidden overall score or five-tier compatibility verdict.
- Render each Participant's position as a five-band bipolar axis marker, without their exact value. Display an integer Dimension Match for that dimension; never aggregate those numbers into an overall score.
- Present Mirror Accuracy as the number of correct predictions out of six plus an interpretation band, not as a percentage.
- Represent consequential disagreements as Conflict Flags. They affect the Private Report, conversation prompts, and archetype priority but do not subtract points from an overall score.
- When Pair Completion occurs, send both Participants a transactional “report ready” email without including result content.
- Use a Public Archetype for shareable identity and a separate Private Risk Pattern for structural diagnosis. Never publish a Private Risk Pattern by default.
- Let Rules filter three to five share-safe Public Archetype candidates without using Sensitive Topics; Jev selects one candidate for narrative representativeness.
- Start with these Public Archetype families: `Vision × Reality`, `双大结果`, `双产品经理`, `Cashflow Operators`, `Research Lab`, `Narrative-Market Fit`, and `Complementary Monsters`.
- Display each Public Archetype with a Chinese primary title and an English secondary title.
- Start with these Private Risk Pattern families: `双一号位`, a gender-neutral quiet-versus-reactive pairing, `高压搭档`, `世界和平型`, and `Solo Founder × Solo Founder`.
- Keep type names gender-neutral. Retain grey humor, but reserve language equivalent to “发疯” for identities Participants explicitly choose to publish in a future sharing mode.
- When Jev falls back, let Rules choose the clearest deterministic Public Archetype; if none is dominant, use the neutral `Complementary Builders` identity.
- Structure the Private Report as: one-line team portrait, strongest alignment, most valuable complement, largest Structural Difference or Unresolved Topic, eight-dimension detail, Mirror Accuracy, and five conversation prompts.
- Build the five conversation prompts from slots for lowest Dimension Match, highest Conflict Flag, largest Mirror misread, role or External gap, and highest-priority Unresolved Topic. Rules construct candidates and Jev selects a Content ID within each slot; missing slots fall back to the next-lowest Dimension Match.
- Fix the Identity Receipt fields to Pair display names, Public Archetype, Team Quote, three public traits, date/version microcopy, a test CTA, and a QR code to the Public Result Page.
- Limit the Public Result Page to Receipt content, an expanded Public Archetype explanation, and a CTA to create a new Pair; do not expose dimensions, Mirror Accuracy, or Private Report summaries.

## Result reasoning

- Version every Pair Test by both its question set and scoring rules. Submitted answers and their generated result remain attached to those versions rather than being recalculated under later rules.
- Preserve the original scenarios, option intent, and score maps while editorially normalizing question wording, length, and humour during pre-launch calibration. After launch, publish changes to wording, options, values, tags, or weights only as a new question-set or scoring version.
- Use explicit question weights to calculate each Participant's dimension value by weighted average. Tag-only questions do not enter numerical dimensions.
- Convert the former dimension weights into categorical Narrative Priorities before including them in the Pair Feature Vector. Jev may use that prior for storytelling but never for arithmetic.
- For consensus dimensions Ambition and Money, calculate `Dimension Match = 100 - |A - B|`.
- For complement dimensions Operating and External, retain the initial difference table: `0–10 → 55`, `11–25 → 75`, `26–55 → 100`, `56–70 → 80`, and `71+ → 55`.
- Cap External Dimension Match at 65 when both Participant values are below 30.
- For threshold dimensions Risk and Conflict, return 100 for a difference up to 15, then decrease linearly to 0 at a difference of 85; clamp to 0–100 and round the displayed score to the nearest integer.
- For Product, classify a difference up to 25 as `Aligned` with Match `100 - difference`. For a difference from 26 through 55, classify it as `Productive Tension` with Match 90 only when Governance Match and Conflict Match are both at least 70 and no related Conflict Flag exists; otherwise classify it as a `Structural Difference` with Match 45. Above 55, classify it as a `Structural Difference` with Match `max(0, 100 - difference)`.
- For Governance, calculate preference alignment as `100 - |A - B|`. Normalize each authority answer from self/partner into the actual Participant, then assign Authority Agreement: 100 when both identify the same sole decision-maker or both choose shared authority, 60 when one chooses shared and the other identifies one decision-maker, 50 when either answer is undefined, and 0 when each Participant claims sole authority. Calculate Match as 40% preference alignment plus 60% Authority Agreement, cap it at 65 when authority is undefined, and cap it at 25 for dual claims to sole authority.
- Use fixed Participant bands `0–20`, `21–40`, `41–60`, `61–80`, and `81–100`, with dimension-specific human labels from the Content Library.
- Map former weight-15 dimensions Ambition, Governance, Conflict, and External to `critical` Narrative Priority; map Risk, Money, Product, and Operating to `standard`.
- Show aggregated five-band positions for dimensions containing Sensitive Topics, but never use those positions to infer or imply a Participant's specific sensitive answer.
- Treat Q1 acquisition intent as a Sensitive Topic. Derive its non-attributed Pair state before deleting the raw options, and exclude Q1 from every public classification feature; public Ambition uses only Q2 and Q3 while the Private Report may display the full aggregated Ambition band.
- Describe Dimension Match only as the expected collaboration friction on that named dimension. Explicitly state that a high or low value does not judge either Participant and is not an overall compatibility result.
- Use deterministic Rules to calculate option values, participant and Pair dimensions, Conflict Latency, Mirror Accuracy, Conflict Flags, and Unresolved Topics, then produce a Pair Feature Vector.
- Treat a moderate Product-dimension gap as Productive Tension only when Governance and Conflict are healthy; treat a large gap, or the same moderate gap without those conditions, as a Structural Difference.
- Ask each Participant an unscored post-questionnaire fact question identifying current company-level decision authority as self, partner, shared, or undefined. Use the pair of answers in Governance rules.
- Define exact, near, and opposite prediction relationships explicitly for each Mirror Question. Present their counts separately rather than converting near predictions into fractional correct answers.
- Determine every Red Line pair through a versioned, question-specific relationship matrix. Treat compatible differences as aligned, defined opposing pairs as Conflict Flags, and any option explicitly meaning “not discussed” as an Unresolved Topic rather than a conflict.
- After Pair Completion, retain only the Sensitive Topic, Pair-level `aligned`, `conflict`, or `unresolved` state, severity, and rule version. Do not retain either Participant's original Sensitive Topic option.
- Generate ordinary Conflict Flags only through versioned deterministic thresholds such as dual claims to sole authority, extreme dimension gaps, or a material Conflict Latency gap. Jev may rank those flags but may not create a new one.
- Start with these ordinary Conflict Flags: dual claims to sole authority as critical; a Q2+Q3 safe Ambition gap of at least 60 as high; Risk or Money gaps of at least 60 as high; a Product Structural Difference above 55 as high; a Conflict Latency gap of at least 14 days as high; and an Operating gap of at least 70 as moderate. Never create an External Conflict Flag from distance alone because that distance may represent useful complement.
- In the Private Report summary, feature the highest-priority Conflict Flag while retaining every additional flag in its relevant dimension or Sensitive Topic section.
- Carry narrative tags into the Pair Feature Vector as descriptive evidence. A tag may influence candidate classifications and content but never determines an outcome by itself.
- Keep every exactly defined calculation and ranking in Rules. Use Jev only for bounded fuzzy judgments such as archetype, narrative salience, non-Flag Private Risk Pattern severity, and candidate content selection. Jev never changes a Rules-derived Conflict Flag severity.
- Send Jev a compact Pair Feature Vector with English field names and descriptions, excluding raw answers, names, email addresses, identifiers, and free text.
- Pin an evaluated version of Jev rather than using a moving alias. Persist the model ID, decision-schema version, probabilities, confidence, and chosen content identifiers; never recompute a historical result on view.
- Generate Classification Results asynchronously and idempotently through Cloudflare Queue. Retry transient Jev failures within a bounded five-minute window; after that window, or below the calibrated confidence threshold, Rules must produce a complete Conservative Result and retain a non-sensitive internal fallback reason.
- Before launch, evaluate against at least 60 deliberately asymmetric boundary fixtures and 20 coherent narrative mock Pairs. An LLM may draft the 20 narrative mocks, but a human must approve their expected labels; do not describe them as real-Participant validation.
- Set the production Jev confidence threshold only after evaluating the 60 boundary fixtures and 20 approved narrative mocks. Do not choose an arbitrary fixed probability in advance.
- Assemble all visible copy from a human-authored Content Library. Jev does not generate user-facing text and there is no chat experience in the MVP.
- Permit offline LLM drafting for the Content Library, but require a human to edit and approve every visible item before versioning it. Never use that drafting path at runtime.
- Require every reachable Content ID to contain final human-authored copy and pass an explicit preview before launch. Do not ship TODO copy, runtime-generated prose, or missing-module placeholders.
- Provide at least 40 human-authored conversation prompts: cover all 29 initial topics at least once and give the highest-risk governance and conflict topics multiple variants.
- Write conversation prompts in Simplified Chinese only. Keep Chinese-primary and English-secondary display exclusively for Public Archetype titles.
- Keep historical classification output, Content IDs, and semantic copy immutable. Permit versioned corrections for spelling, accessibility, or security that do not change meaning, and retain a correction record.

## Product disclaimer

- Before the Pair Test and in the Private Report footer, state concisely that Cofounder is an entertainment product, not a scientific, psychological, legal, or investment assessment, and does not replace direct communication between the Participants.

## Source authorization

- The existing outer 3D repository is MIT-licensed.
- Adapt the existing `portfolio-inner-site` source rather than independently recreating its IE-style application. The product owner has chosen to commit and deploy that adaptation while permission from Henry Heffernan remains pending. The repository's lack of an explicit license remains an unresolved copyright risk; attribution does not itself grant permission.
- Reuse the copyable Receipt Printer source published at `dqnamo.com/experiments/receipt-printer` without an additional authorization check.
- Preserve a complete `Credits` application naming Henry Heffernan, the original 3D-room repository and license, the adapted `portfolio-inner-site`, the Receipt Printer source, and other third-party assets and licenses.

## Analytics

- Use Cloudflare Web Analytics for page traffic.
- Record authoritative product events such as Pair Completion, Participant Withdrawal, result viewing, and sharing through the backend in D1.
- Mark a Pair as shared once when Web Share resolves successfully, a public link is copied successfully, or a receipt PNG or QR image download completes. Opening the printer or merely displaying a QR code does not qualify, and repeated actions do not increase the Pair-level north-star numerator.
- Send only OTP, seven-day expiry reminder, and Report Ready emails in the MVP. The creator shares the Pair Invitation Link themselves; do not send state-by-state progress emails.
