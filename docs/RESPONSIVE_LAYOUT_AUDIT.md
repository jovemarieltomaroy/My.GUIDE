# Landing-page laptop correction

## Cause and scope

The supplied Windows screenshot is approximately 1280px wide with 599px of page height after browser chrome. The previous implementation kept a 120px heading, 550px photograph, 96px header, 120px side gutters, and large vertical padding at that width. The available text column was too narrow for the subtitle and action row, while the hero extended well below the visible page. Preserving fixed desktop sizes was insufficient for matching the MacBook composition in a smaller CSS viewport.

This revision changes only frontend/src/pages/LandingPage.css and this report. The larger approved desktop design remains the baseline. No OS detection, zoom, transform scaling, backend or functionality changes.

## Implementation

Between 861px and 1600px, one width-based media query uses bounded fluid typography, header size, gutters, hero image height, column gaps, padding and button dimensions. The larger desktop sizes are approached smoothly; navigation login padding stays slightly tighter through 1600px. The hero stays in two columns. Buttons stay in one flex row; labels can wrap within buttons only when space is very narrow. Existing tablet portrait stacking remains unchanged. No height query or viewport-height typography is used; very short views still scroll naturally. Locally hosted Poppins from the preceding revision is retained.

At 1280px: heading 88px, description/button text 14px, subtitle 16px, header 72px, photo 400px high. At 1710px the original heading 120px, photo 550px, header 96px and all original spacing remain unchanged.

## Validation

Headless Chrome screenshots and measurements:
1280×599 (approximately the supplied Windows page area), 1710×950 (MacBook comparison), 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1280×720, 1024×768; tablet 834×1194, 1194×834, 820×1180, 1180×820, 768×1024; reduced views 1366×600, 1093×614, 911×512.

No horizontal page overflow at any measured size. Desktop/laptop action buttons share the same top edge in every two-column viewport. At 1280×599 the three buttons occupy y=504.39–548.78px, fully visible without scrolling; the hero ends at y=588.78px. At 911px width button labels wrap internally while the three buttons remain in one row. Some shorter views still require vertical scrolling.

The 1710×950 and 1920×1080 PNGs are byte-identical to their pre-change captures, verifying preservation of those larger desktop renderings. Visually inspected the revised 1280×599 screenshot. Production build passes with the existing large-bundle advisory; diff whitespace check passes.

Artifacts: /private/tmp/myguide-layout-revision/laptop-final-WIDTHxHEIGHT.png. The Windows-sized preview is laptop-final-1280x599.png. Actual Windows hardware and iPad Safari have not been tested; matching viewport emulation in macOS Chrome does not establish cross-OS pixel equivalence. The Windows screenshot page height is inferred from the supplied image; browser zoom/scaling were not measured directly.


## Follow-up: lower landing-page sections

The initial laptop correction covered the hero only. About, Overview, Help and footer still inherited 18px body text, 34px headings, a 440px illustration, and larger desktop card/section spacing. These remaining fixed values caused the oversized appearance shown in the next Windows screenshots.

Extended the same existing 861–1600px media query to those sections: fluid inherited body text, heading sizes, illustration maximum width, section padding, paragraph gaps, card padding/title/icon sizing, FAQ spacing and footer typography. At 1280px body text is 14px, h2 is 26px, module/FAQ titles are 17px and the illustration is 330px wide. Original colors, content, grid composition and larger MacBook styles remain intact. Below-860px tablet stacking is unchanged. No unrelated page edits.

Measured all four lower sections in Chrome at 1710×950, 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1280×720, 1280×599, 1024×768, 834×1194, 1194×834, 820×1180, 1180×820 and 768×1024. No horizontal document overflow or overflowing heading/paragraph widths. At 1280px, About height drops from 784.95px to 542.28px; its full text fits at 1280×599. Overview retains two-column module cards, with both module rows visible in the 599px-tall capture. Other content remains accessible by normal scrolling.

MacBook-size (1710×950) before/after About, Help and footer PNGs are byte-identical. Overview content below the header is pixel-identical; the header difference is confined to the animated active-navigation underline during capture. Before/after section heights are identical at this width. Inspected the 1280×599 About and Overview screenshots visually. Build and diff whitespace checks pass. Real Windows/iPad Safari validation remains outstanding.

Files changed in this follow-up: frontend/src/pages/LandingPage.css and this report. Screenshots: /private/tmp/myguide-layout-revision/sections-after-about-1280x599.png, sections-after-overview-1280x599.png, sections-after-help-1280x599.png and sections-after-landing-footer-1280x599.png.


## Follow-up: login layout

The login screenshot at approximately 1280×599 showed 62px fields, large labels, large gaps and panel padding. The form plus padding made the page 723px tall; the signup-help link extended below the viewport. Added a login-only media query for widths 801–1600px or desktop heights below 761px. Bounded font sizes, logo dimensions, input/button sizes, gaps and panel padding respond to available width/height. Background, colors, 46/54 column ratio, content, authentication logic and larger MacBook styling are preserved. Decorative bottom-line spacing is reduced to stay below the form on short views. Existing stacked narrow-screen behavior is retained. No fixed page height or hidden content was introduced.

Files changed in this follow-up: frontend/src/pages/LoginPage.css and this report.

Chrome viewport checks: 1710×950, 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1280×720, 1280×599, 1366×600, 1920×650, 1024×768, 834×1194, 1194×834, 820×1180, 1180×820, 768×1024. Default login has no horizontal or vertical page overflow and no heading/paragraph/label width overflow at these sizes. The signup and Sign In controls are visible. At 1280×599 signup ends near y=524px instead of y=652px; default document height is exactly 599px. Fields remain 46px high, with 16px input text.

The MacBook-size 1710×950 before/after PNGs are byte-identical. Empty-form validation shows both messages and keeps submit/signup visible (document grows slightly to 606px). Password visibility toggle works. Password assistance expands, remains accessible through natural scrolling, and adds no horizontal overflow. These checks did not submit credentials or call authentication APIs. Expanded help/error states may require scrolling; content is never clipped to enforce the default no-scroll presentation.

Production build and whitespace checks pass; large-bundle advisory remains. Screenshots: /private/tmp/myguide-layout-revision/login-final-1280x599.png and login-final-1710x950.png. Actual Windows hardware and iPad Safari remain unverified.
