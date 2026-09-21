# Build the Cofounder MVP

## Problem Statement

Prospective and early-stage AI startup cofounders often discuss product and equity without exposing the assumptions most likely to damage their working relationship under pressure. Existing personality and compatibility tests reduce this problem to individual traits or a single score, while conventional governance exercises feel too formal to invite participation or sharing.

The repository currently presents Henry Heffernan's retro 3D portfolio experience. It does not yet provide recoverable Accounts, a two-Participant Pair lifecycle, versioned questions and Rules, privacy-preserving result generation, or a shareable team identity. The product needs to turn that visual foundation into Cofounder: an entertaining two-person stress test that surfaces useful Structural Differences without claiming scientific authority, exposing Sensitive Topic answers, or issuing a yes/no compatibility verdict.

## Solution

Build Cofounder as a free, Simplified Chinese, two-Participant entertainment product for AI startup founders aged 14 and over.

A creator registers through a retro computer sign-in flow, creates a Pair, completes 24 core questions, six Mirror predictions, four Red Line questions, and unscored relationship setup, then receives a single-use Invitation Link for the second Participant. The second Participant authenticates and completes the same independent process without seeing the creator's answers. When both submissions are sealed, deterministic Rules calculate dimensions, Mirror Accuracy, Conflict Flags, Unresolved Topics, and a de-identified Pair Feature Vector. A pinned Jev classifier may choose among bounded content identifiers; deterministic Rules provide a complete Conservative Result whenever Jev is unavailable or insufficiently confident. Every visible result sentence comes from a versioned, human-approved Content Library.

Both Participants receive the same underlying Private Report: a team portrait, strongest alignment, most useful complement, most important Structural Difference or Unresolved Topic, eight named dimensions, Mirror Accuracy, Conflict Flags, and five conversation prompts. There is no total compatibility score.

Either Participant can explicitly generate a privacy-safe Public Result Page and animated Identity Receipt. The public identity contains only approved display names, a Public Archetype, a Team Quote, three safe traits, version metadata, a test CTA, and a QR code. It never exposes dimensions, Mirror results, private risks, or Sensitive Topic answers.

Preserve the garage-style 3D homepage for desktop discovery, provide direct access to one IE-style Diagnostics Application, and default mobile users to an accessible 2D experience. Deploy the product as one same-origin Cloudflare application with passwordless email authentication and backend-owned domain operations.

## User Stories

1. As a visitor, I want to understand within seconds that Cofounder is a two-person startup stress test, so that I know what I am being invited to do.
2. As a visitor, I want to see that the test takes about ten minutes and requires both Participants, so that I can decide whether to start.
3. As a visitor, I want to enter through the 3D garage or skip directly to Diagnostics, so that the visual experience is optional rather than a barrier.
4. As a desktop visitor, I want the 3D garage to lead into one coherent Diagnostics Application, so that the retro environment feels like part of the product.
5. As a mobile visitor, I want to enter the touch-friendly 2D Diagnostics Application by default, so that I do not have to navigate a desktop 3D scene.
6. As a mobile visitor, I want the 2D Diagnostics Application free of a floating 3D-garage link, so that the registration and test flow stay focused.
7. As a visitor following an Invitation Link, authentication return, or result link, I want to enter the relevant Diagnostics state directly, so that I do not have to traverse the garage first.
8. As a prospective Participant, I want to see the entertainment-product disclaimer before beginning, so that I do not mistake the result for scientific or professional advice.
9. As a prospective Participant, I want to confirm that I am at least 14 without providing a birth date, so that eligibility requires minimal personal data.
10. As a prospective Participant, I want the privacy agreement presented alongside email entry, so that I understand the processing before requesting a verification code.
11. As a prospective Participant, I want one concise terms agreement with the material privacy choices available inside it, so that registration is approachable without hiding how data is processed.
12. As a prospective Participant, I want to authenticate with an email OTP rather than a password, so that Account recovery is simple.
13. As a Participant, I want an OTP error to explain whether I can resend or change my email, so that authentication failure is recoverable.
14. As a Participant, I want a 30-day rotating session, so that routine return visits do not require repeated OTP entry.
15. As an Account holder, I want to choose a display name that is not derived from my email, so that my email identity is not exposed.
16. As an Account holder, I want my display name to support ordinary Unicode names and company names, so that I can represent myself naturally.
17. As an Account holder, I want a changed display name to update my Pair views and permitted public appearances, so that stale identity does not persist.
18. As an authenticated Account holder, I want to create a Pair without a separate beta code, so that the product has one clear invitation concept.
19. As an Account holder, I want at most three active incomplete Pairs, so that accidental or abusive Pair creation is bounded.
20. As a creator, I want to provide relationship stage, known duration, worked duration, responsibilities, and current company authority, so that the report has relevant working context.
21. As a Participant, I want Profile and authority questions described as setup rather than part of the advertised 34 test questions, so that the product promise remains accurate.
22. As a Participant, I want one question per screen with section-level progress, so that the questionnaire remains focused on desktop and mobile.
23. As a keyboard user, I want to complete every questionnaire action without a pointer, so that the core flow is accessible.
24. As a Participant, I want each answer saved before advancing, so that apparent progress cannot silently lose data.
25. As a Participant with a temporary network failure, I want to see an unsaved state and retry, so that the application never pretends an answer was stored.
26. As a Participant using multiple devices, I want stale writes rejected instead of silently overwriting newer answers, so that cross-device recovery is trustworthy.
27. As a Participant, I want to navigate backward and revise answers before submission, so that I can correct mistakes.
28. As a Participant, I want a private complete review before final submission, so that I know exactly what I am sealing.
29. As a Participant, I want a clear warning that submission is immutable, so that sealing is deliberate.
30. As a creator, I want the Invitation Link generated only after my submission is sealed, so that I cannot invite a partner into an unfinished Pair.
31. As a creator, I want to copy or reset an unclaimed Invitation Link, so that I can recover from sending it to the wrong place.
32. As an invited Participant, I want opening a link not to claim the Pair automatically, so that accidental opens do not consume the invitation.
33. As an invited Participant, I want to authenticate, hold current consent, and explicitly accept before claiming the Pair, so that membership is intentional.
34. As a Participant, I want the product to prevent one Account from occupying both places in production, so that a Pair represents two people.
35. As a Participant, I want the Invitation Link to reveal no answers or report data, so that token possession does not expose private content.
36. As a waiting creator, I want to know only whether the other Participant has started, not their exact progress, so that the product does not create pressure.
37. As a Participant, I want neither person to see the other's raw answers, so that independent response integrity is preserved.
38. As a Participant, I want meaningful differences in independently entered relationship facts to inform the report, so that mismatched assumptions become visible.
39. As a Participant, I want an incomplete Pair to remain available while either person is actively contributing, so that ordinary pauses do not destroy work.
40. As a Participant, I want an inactive incomplete Pair to expire after 30 days with a seven-day reminder, so that abandoned sensitive drafts do not persist indefinitely.
41. As a Participant, I want mere viewing or login not to extend Pair retention, so that passive traffic cannot preserve abandoned data forever.
42. As a Participant, I want a retest to create a new independent Pair rather than rewrite history, so that submitted results remain versioned and immutable.
43. As a Participant, I want Pair Completion to enter a visible Report Generating state, so that asynchronous classification does not look like data loss.
44. As a Participant, I want Report Ready to refresh an open page and trigger a content-free email notification, so that I know when to return.
45. As a Participant, I want a complete Conservative Result after bounded classifier failure, so that Jev availability cannot block the product.
46. As a Participant, I want the same report facts as my partner, so that the product does not tell contradictory stories.
47. As a Participant, I want ordinary differences phrased from my perspective while Sensitive Signals remain unattributed, so that the report is useful without revealing protected choices.
48. As a Participant, I want eight named dimensions rather than a total score, so that local collaboration patterns are not reduced to a verdict.
49. As a Participant, I want my position rendered as a five-band bipolar marker rather than an exact personal number, so that the report emphasizes interpretation over false precision.
50. As a Participant, I want an integer Dimension Match for each named dimension, so that I can understand expected friction in that area.
51. As a Participant, I want Dimension Match explicitly described as local friction rather than personal quality or overall compatibility, so that scores are not misused.
52. As a Participant, I want Mirror Accuracy shown as exact, near, and opposite counts, so that I can understand how accurately we model each other.
53. As a Participant, I want deterministic Conflict Flags to identify consequential contradictions, so that important risks cannot be averaged away.
54. As a Participant, I want the highest-priority Conflict Flag summarized and all remaining flags retained in context, so that the report is focused without hiding issues.
55. As a Participant, I want “not discussed” classified as an Unresolved Topic rather than disagreement, so that missing conversation is not mistaken for conflict.
56. As a Participant, I want a Public Archetype separated from a Private Risk Pattern, so that shareable identity does not leak private diagnosis.
57. As a Participant, I want five selected conversation prompts, so that the report produces an actionable next discussion.
58. As a Participant, I want conversation prompts in Simplified Chinese, so that they feel direct and natural.
59. As a Participant, I want Public Archetype titles shown in Chinese with an English secondary title, so that the identity fits Chinese AI startup culture.
60. As a Participant, I want a concise disclaimer in the Private Report footer, so that results remain in their intended entertainment context.
61. As a Participant, I want Q1 acquisition intent and all Red Line raw options deleted after Pair Completion, so that the system cannot later reveal who chose what.
62. As a Participant, I want the Private Report to mention the Sensitive Topic and Pair-level state without attribution, so that a critical conversation remains possible.
63. As a Participant, I want no Sensitive Topic evidence used for public classification, so that a Public Archetype cannot reveal a protected answer indirectly.
64. As a Participant, I want Jev to receive only de-identified, rule-derived English features, so that the external classifier never receives my identity or raw answers.
65. As a Participant, I want Jev to choose only approved content identifiers, so that it cannot invent report prose about me.
66. As a Participant, I want low-confidence Jev output rejected in favor of Rules, so that uncertainty produces a stable fallback rather than a guess.
67. As a Participant, I want either person to explicitly create a Public Result Page, so that public sharing never occurs automatically.
68. As a Participant, I want my public display name disabled by default for each Pair, so that publication defaults to an anonymous role label.
69. As a Participant, I want to permit my name during the first PRINT or SHARE flow, so that permission is contextual and visible.
70. As a Participant, I want my counterpart to remain anonymous until they independently permit their name, so that one person cannot publish the other's identity.
71. As a Participant, I want either person to unpublish the Public Result Page without deleting the Private Report, so that public consent remains revocable.
72. As a visitor, I want an unpublished or withdrawn URL to show no identifying remnants, so that stale links do not reveal former Pair data.
73. As a visitor, I want a Public Result Page limited to the Identity Receipt, an expanded archetype explanation, and a new-test CTA, so that private diagnostics remain private.
74. As a Participant, I want PRINT to open a centered receipt-printer overlay rather than a new 3D scene, so that the payoff is immediate.
75. As a reduced-motion user, I want the complete receipt shown without printer animation, so that motion is optional.
76. As a Participant, I want to share through Web Share, copy a link, save a PNG, or show and download a QR code, so that common sharing paths work without platform-specific integrations.
77. As a public viewer, I want the receipt to communicate that two cofounders completed a startup test within three seconds, so that the shared artifact is self-explanatory.
78. As a Participant, I want public pages excluded from search indexing while retaining social preview metadata, so that sharing does not imply discoverability.
79. As a Participant, I want previously downloaded images acknowledged as irrevocable, so that withdrawal promises remain honest.
80. As an Account holder, I want Privacy & Data to explain processing and retained data, so that product behavior is inspectable.
81. As an Account holder, I want a machine-readable export of my retained Account, consent, answer, Pair, and shared-report data, so that I can exercise data access rights.
82. As an Account holder, I want deleted Sensitive Topic options omitted rather than reconstructed in export, so that deletion remains real.
83. As a Participant, I want to withdraw my answers after fresh OTP verification, so that I can invalidate derived Pair results securely.
84. As the other Participant, I want my independently supplied data preserved after a counterpart withdraws, so that one person cannot delete my data.
85. As an Account holder, I want Account deletion to withdraw me from every Pair after fresh OTP verification, so that deletion has complete and predictable scope.
86. As an Account holder, I want sign-in, export, withdrawal, and deletion to remain available after a privacy-policy update, so that renewed consent is not required to exercise rights.
87. As an Account holder, I want new Pair activity blocked until I accept a materially changed consent version, so that consent records remain current.
88. As a privacy-conscious Participant, I want production logs to exclude email, OTPs, tokens, answers, and Pair Feature Vectors, so that operational telemetry cannot become a shadow dataset.
89. As a Participant, I want online deletion to take effect immediately while backup expiry is described honestly, so that retention claims are accurate.
90. As a user, I want only OTP, expiry-reminder, and Report Ready emails, so that the product does not generate noisy progress notifications.
91. As a user, I want ambient sound to start only after I enter the garage and remain mutable, so that the homepage does not autoplay audio unexpectedly.
92. As a mobile user, I want sound muted by default, so that opening an invitation is socially safe.
93. As a user, I want all camera, CRT, terminal, and printer motion to honor reduced-motion settings, so that the complete product respects accessibility preferences.
94. As a user, I want Credits to name Henry Heffernan, the original projects, and third-party licenses, so that reused creative work remains visible.
95. As a product owner, I want Pair Share Rate calculated once per Pair from qualified share actions, so that repeated clicks cannot inflate the north-star metric.
96. As a product owner, I want completion, invitation, report, withdrawal, and sharing events recorded by the backend, so that the funnel is based on authoritative events.
97. As a product owner, I want every historical result tied to question, Rules, model, schema, and Content Library versions, so that results can be reproduced and audited.
98. As a content editor, I want offline LLM drafting allowed but every visible item human-edited and approved, so that production is efficient without runtime generation.
99. As a product owner, I want every reachable Content ID previewed before launch, so that no user receives TODO, missing, or generated placeholder copy.
100. As a product owner, I want at least 40 approved conversation prompts covering all initial topics, so that result selection has meaningful breadth.
101. As a product owner, I want the default `0.3` confidence threshold backed by fixture evaluation and recalibrated whenever the model or decision schema changes, so that fallback behavior reflects observed classification quality.
102. As a support operator, I want ordinary answers accessible only through audited least-privilege procedures, so that calibration and support do not create unrestricted access.
103. As a support operator, I want only anonymized aggregates for Sensitive Topics, so that individual protected answers remain unavailable even internally.
104. As a product owner, I want current Chrome and Safari desktop flows fully verified, so that the visual experience works in primary desktop browsers.
105. As a product owner, I want iOS Safari and Android Chrome 2D flows fully verified, so that invitation and sharing flows work on likely mobile entry points.
106. As a product owner, I want Firefox core-flow smoke coverage, so that basic interoperability is checked without promising full visual parity.

## Implementation Decisions

- Keep the product name `Cofounder`; use “AI 创业合伙人压力测试” as a descriptive subtitle.
- Treat the product as entertainment, not a scientific, psychological, legal, investment, or professional assessment. Show a concise disclaimer before testing and in the Private Report footer.
- Retain React 17 and Webpack for the MVP. Do not combine product implementation with a frontend-framework migration.
- Deploy one same-origin Cloudflare Worker using Hono. Use D1 for Account and Pair data, R2 for oversized media and generated assets, Queue for report generation and transactional work, and Cron for retention cleanup.
- Replace the production Express runtime. Move static assets that exceed Cloudflare's static-asset limit into R2.
- Use Better Auth with email OTP delivered by Resend. OTPs last ten minutes, permit at most five attempts, have a 60-second resend delay, and are rate-limited by email and IP. Sessions rotate over 30 days.
- Present email entry and one versioned terms agreement together, and require acceptance before sending an OTP. Include age eligibility and de-identified overseas classification in the expandable terms; attach consent timestamps only after email verification creates the Account.
- Keep internal Account identity separate from email. Store one Account-level display name, constrained to 1–32 trimmed Unicode characters with control-character rejection and contextual output escaping.
- Record the bundled agreement's underlying privacy and overseas-classification versions separately. A material version change blocks new Pair activity but never blocks sign-in, export, withdrawal, or deletion.
- Permit any authenticated, currently consenting Account to create a Pair. Do not implement a Beta Invitation Code.
- Limit each Account to three active incomplete Pairs.
- Model Pair ownership as two equal Participant positions after claim. The creator has special invitation controls only before the second place is claimed.
- Create an Invitation Link only after the creator seals their submission. Hash Invitation tokens at rest, invalidate them on claim or reset, and keep them valid only during the Pair's 30-day active lifetime.
- Do not claim a Pair on link open. Claim only after authentication, current consent, and explicit acceptance. Prevent one production Account from occupying both positions.
- Use these Pair states: Pending, Waiting Partner, Partner In Progress, Pair Complete, Report Generating, Report Ready, and Expired. Withdrawal invalidates derived results rather than becoming another active lifecycle state.
- Count Profile saves, answer saves, invitation acceptance, and submission as retention activity. Viewing and sign-in do not extend retention. Delete inactive incomplete Pairs after 30 days and send one reminder seven days before expiry.
- Ask both Participants independently for relationship stages, known duration, worked duration, responsibilities, and company authority. Treat differences as report inputs.
- Present one question per screen, save through a revision-checked backend operation, and require save acknowledgement before advancing. Reject stale cross-device writes. Do not implement full offline completion.
- Allow free revision before submission. Show a private answer review and explicit immutable-submission warning. Seal all answers atomically for that Participant.
- Version every question set and Rules release. A retest creates a new Pair and never mutates a historical result.
- Calculate Participant dimension values as explicit weighted averages. Exclude tag-only questions from arithmetic.
- Calculate Ambition and Money Dimension Match as `100 - absolute difference`.
- Calculate Operating and External through the approved difference table: 0–10 gives 55, 11–25 gives 75, 26–55 gives 100, 56–70 gives 80, and 71 or more gives 55. Cap External at 65 when both values are below 30.
- Calculate Risk and Conflict as 100 for differences through 15, then linearly decline to 0 at a difference of 85.
- Classify Product gaps through the approved Aligned, Productive Tension, and Structural Difference rules. Productive Tension requires healthy Governance and Conflict plus no related Conflict Flag.
- Calculate Governance from 40% preference alignment and 60% normalized authority agreement. Cap undefined authority at 65 and dual sole-authority claims at 25.
- Render Participant positions in five fixed bands: 0–20, 21–40, 41–60, 61–80, and 81–100. Do not expose exact Participant values.
- Never calculate, retain, or display an overall compatibility score or five-tier verdict.
- Use complete versioned Mirror matrices for Q1, Q4, Q7, Q13, Q16, and Q22. Persist exact, near, and opposite counts rather than a percentage.
- Derive Conflict Flags only through deterministic Rules. Initial ordinary rules cover dual sole-authority claims, large safe-Ambition, Risk, Money, Product, Conflict Latency, and Operating gaps. Do not create an External flag from distance alone.
- Use question-specific Sensitive Topic matrices for Q1 acquisition intent and all four Red Line questions. Derive only Pair-level topic, aligned/conflict/unresolved state, severity, and rule version.
- Encrypt raw Sensitive Topic options while the Pair is incomplete. At Pair Completion, calculate required aggregates, Mirror relationships, and Sensitive Signals, then delete the original options.
- Exclude Q1 and every other Sensitive Topic from public classification features. Public Ambition is derived only from Q2 and Q3.
- Build a compact de-identified Pair Feature Vector with English keys. It contains no names, email, Account or Pair identifiers, raw answers, Sensitive Topic options, or free text.
- Keep all exact calculations, ranking, thresholds, Mirror relationships, Conflict Flags, and Unresolved Topics in deterministic Rules.
- Restrict Jev to bounded fuzzy selection among typed candidate identifiers for Public Archetype, Private Risk Pattern, narrative salience, non-Flag private-risk severity, and conversation content. Jev never changes a Rules-derived Conflict Flag severity.
- Pin the evaluated Jev model and persist model ID, schema version, probabilities, confidence, and selected identifiers. Never recalculate a historical result on view.
- Generate results asynchronously and idempotently. Retry transient Jev failure within a bounded five-minute window, then produce a complete Conservative Result. Apply the fixture-calibrated `0.3` threshold independently to each typed decision.
- Assemble all visible prose from a versioned Content Library. Offline LLM drafting is permitted, but every item must be edited, approved, previewed, and versioned by a human. Jev never generates runtime prose.
- Provide at least 40 Simplified Chinese conversation prompts across all initial topics, with extra variants for governance and conflict. Use bilingual display only for Public Archetype titles.
- Preserve one immutable Classification Result and semantic Content Library version per Pair. Permit versioned spelling, accessibility, and security corrections that do not change meaning.
- Structure the Private Report as team portrait, strongest alignment, most valuable complement, top Structural Difference or Unresolved Topic, eight dimensions, Mirror Accuracy, all Conflict Flags in context, and five conversation prompts.
- Keep the Public Archetype separate from the Private Risk Pattern. Public candidates may use only share-safe features and must honor forbidden classifications from privacy Rules.
- Create no Public Result Page automatically. Either Participant can create it explicitly; each Participant separately permits their own display name per Pair.
- Use a high-entropy public slug whose hash is stored. Mark public pages `noindex, nofollow` while serving share metadata. Either Participant may unpublish; withdrawal replaces the former page with a non-identifying tombstone.
- Fix Identity Receipt fields to permitted Pair names, Public Archetype, Team Quote, three safe traits, date and version, CTA, and QR code. Include no dimensions, Mirror data, Private Risk Pattern, Conflict Flag, or Sensitive Signal.
- Count a Pair as shared once after successful Web Share completion, successful public-link copy, receipt PNG download, or QR image download. Opening PRINT or displaying a QR code does not qualify.
- Preserve the 3D garage as the optional desktop homepage. Serve one IE-style Diagnostics Application for the complete product workflow and open it directly for mobile and deep links.
- Keep only Cofounder Diagnostics and Credits as desktop applications. Provide functional Start entries for New Pair Test, My Pairs, Privacy & Data, Credits, and Shut Down.
- Use one shared centered receipt-printer overlay for the desktop and direct 2D experiences. Honor reduced motion by rendering the final receipt immediately.
- Make the complete questionnaire keyboard-operable. Honor reduced-motion preferences across camera, CRT, terminal, and printer effects. Start desktop audio only after explicit garage entry and mute mobile by default.
- Use Cloudflare Turnstile only for risk-triggered OTP, Pair-creation, and public-result-generation abuse controls. Do not interrupt ordinary answers with CAPTCHA.
- Do not implement a public abuse-reporting workflow in the MVP.
- Restrict production logs to allowlisted internal identifiers, event names, versions, timings, and error codes. Never log email, OTP, tokens, raw answers, or Pair Feature Vectors.
- Provide machine-readable JSON export. Require fresh OTP for Participant Withdrawal and Account deletion. Account deletion withdraws that Account from every Pair while preserving each counterpart's independently supplied data.
- Send only OTP, seven-day expiry reminder, and Report Ready emails. Include no result content in email.
- Use Cloudflare Web Analytics for page traffic and backend D1 events for authoritative funnel state.
- Keep the MVP hosted outside mainland China without a mainland availability or latency guarantee.

## Testing Decisions

- Test externally observable behavior rather than internal implementation details. A refactor that preserves HTTP contracts, rendered user behavior, persisted domain outcomes, and Rules output should not require broad test rewrites.
- Use two principal seams only: the same-origin HTTP/browser application boundary for complete product behavior and one pure Rules boundary for deterministic scoring and classification inputs.
- At the HTTP boundary, test Account registration, consent versioning, OTP recovery, session recovery, Pair creation limits, Invitation claim and reset, Participant equality after claim, cross-device revision rejection, immutable submission, retention activity, report state transitions, public publication, unpublication, export, withdrawal, and Account deletion.
- At the browser boundary, test desktop entry from the garage, direct mobile and deep-link entry, one-question navigation, private review, waiting states, report rendering, PRINT, reduced motion, keyboard operation, name permission, sharing actions, and non-identifying tombstones.
- At the pure Rules boundary, verify weighted Participant dimensions, every Dimension Match rule, Governance normalization, Product preconditions, all Mirror option pairs, Sensitive Topic matrices, ordinary Conflict Flag thresholds, public-feature exclusion, candidate filtering, and Conservative Result selection.
- Use at least 60 deliberately asymmetric boundary fixtures. Choose values on both sides of every threshold and use different inputs that yield similar dimension distances but require different outcomes.
- Use the 20 product-owner-approved narrative mock Pairs as classifier and composition expectations. An acceptable candidate may vary only within each fixture's approved set; forbidden public candidates must always fail.
- Validate every question, option, weight, tag, matrix pair, Content ID, and fixture reference against its pinned version. Missing, duplicate, or unreachable identifiers fail the build.
- Test that Pair Completion deletes raw Q1 and Red Line options only after all required derived values are committed. Verify that retries are idempotent and cannot recreate deleted raw values.
- Test that Jev requests contain only allowed Pair Feature Vector fields. Assert absence of raw answers, names, email, internal identifiers, free text, and Sensitive Topic options.
- Test classifier timeout, rate limit, malformed output, below-threshold confidence, Queue retry, and duplicate delivery. Every case must produce one immutable result or a complete Conservative Result.
- Test that public output contains only permitted Identity Receipt fields and that forbidden Sensitive evidence cannot alter Public Archetype selection.
- Test access-control asymmetry deliberately: Invitation possession without authentication, one Participant requesting the other's answers, stale public links, withdrawn results, unclaimed versus claimed creator controls, and attempts to self-pair.
- Test retention boundaries with activity immediately before and after expiry, including the seven-day reminder, passive page views, and deletion cleanup.
- Test analytics semantics so repeated share actions count once per Pair and non-qualifying printer or QR views do not count.
- Test display-name trimming, Unicode support, control-character rejection, contextual escaping, anonymous fallback, later permission, rename propagation, and unpublication.
- Run full desktop flows in current Chrome and Safari, full 2D flows in iOS Safari and Android Chrome, and core-flow smoke tests in Firefox.
- Run accessibility checks for keyboard completion, focus order, visible focus, semantic controls, error announcements, and reduced-motion behavior.
- For appearance changes, render and inspect representative desktop garage, desktop Diagnostics, mobile questionnaire, waiting, Private Report, printer, receipt, and withdrawn-page states. Structural checks alone are insufficient.
- The repository has no existing test framework or test prior art. Introduce the smallest toolchain that supports the two agreed seams rather than creating separate unit, component, database, and Queue test architectures.

## Out of Scope

- Scientific validation, psychological diagnosis, legal advice, investment assessment, or a yes/no cofounder compatibility verdict.
- An overall Pair score, hidden Final Score, five-tier public verdict, or score-based Red Flag penalty.
- Runtime LLM-generated prose, chat, free-text analysis, or an AI coach.
- More than two Participants, founder-team topology, portfolio mode, or accelerator administration.
- Operating Agreement collaboration, acceptance workflow, or Agreement Coverage.
- Investor View, PDF export, Data Room integration, or investor-specific disclosures.
- Historical report comparison, version-delta visualization, or automatic 90-day retesting.
- Direct WeChat or Xiaohongshu publishing integrations.
- Password authentication, Magic Link fallback, or manual authentication bypass.
- Full offline questionnaire completion or offline conflict resolution.
- Public abuse reporting or automatic moderation.
- A frontend-framework migration or an unrelated 3D-engine rewrite.
- A mainland-China hosting, availability, or latency guarantee.
- Automatic public-page creation or publication of private diagnostics.
- Search indexing of Public Result Pages.
- Restoring or exporting deleted raw Sensitive Topic options.

## Further Notes

- Pair Share Rate is the north-star metric: the proportion of created Pairs that reach at least one qualifying share action. Diagnose it through creator completion, invitation sharing, partner start, Pair Completion, result view, and share events.
- The canonical calibration question bank is still marked as a calibration draft. Preserve scenario meaning and score maps while editorially normalizing wording before freezing the first production version.
- Jev's default `0.3` confidence threshold is based on the complete boundary and narrative fixture set and must be recalibrated when its model, decision schema, or candidate criteria change.
- The existing outer 3D repository is MIT-licensed. The adapted inner-site repository and copied Receipt Printer source do not currently provide explicit licenses. The product owner has chosen to proceed with commit and deployment while Henry Heffernan's permission is pending. Credits and attribution do not themselves resolve that copyright risk.
- Preserve complete Credits for Henry Heffernan, the original 3D repository and license, the adapted inner site, the Receipt Printer source, and all other third-party assets.
- Previously downloaded receipt images cannot be revoked. Public-page withdrawal and name removal affect only product-controlled online representations.
- Backup copies expire under infrastructure retention windows rather than immediate physical deletion. State this honestly in privacy material.
- No implementation should begin by splitting the product into numerous services or replacing the frontend stack. The intended MVP boundary is one same-origin product with backend-owned domain operations.
