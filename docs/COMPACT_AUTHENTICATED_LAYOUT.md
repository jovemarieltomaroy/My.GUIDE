# Compact authenticated layout

The compact mode applies to authenticated application roots only, at CSS viewport widths 1024–1440px. It uses actual dimensions rather than CSS zoom, transforms, browser zoom, or OS detection. Larger reference viewports retain their current appearance. A Mac window resized into this range also uses compact mode; this is viewport-based, not Windows-specific.

## Styling

A single AuthenticatedCompact.css stylesheet is imported by AppSidebar. All 19 sidebar page roots receive the authenticated-app class. Embedded recommendations inherit their host styling rather than nesting another compact root. No authentication, API, routing, clinical-data, or public-page behavior changes.

Within compact mode: sidebar width 200px with matching content offset; main/header heights 50px; content gutters 96px per side (the prior 120px gutters at an approximately 80% proportion); Tailwind spacing token 0.2rem instead of 0.25rem; theme and explicit pixel font sizes adjusted, with an 11px floor for small labels. Inline 15px labels use 12px. Controls keep a 28px minimum height. Summary and filter grids retain desktop columns. Sidebar rows, selected chart dimensions and Analytics timestamp wrapping receive targeted adjustments. The stylesheet declares the existing Tailwind layer order and places its scoped overrides in the utilities layer to respect existing important classes. Print is excluded.

This intentionally approximates the screenshot density rather than replicating browser zoom. Natural scrolling remains available; browser zoom is unchanged. The 1024–1440px range is the compact range, not a hardware or operating-system classification.

## Verification

Rendered Analytics, Dashboard, My Cases and New Case with synthetic session/API fixtures in an isolated Chrome context. Every API request was replaced with synthetic responses; actual counseling records were not accessed. Tested each page at 1710×950, 1920×1080, 1440×900, 1366×768, 1280×599, 1024×768, and 834×1194 (28 checks). All pages rendered with no document horizontal overflow and computed body zoom 1. Four large-reference layout measurements match baseline exactly. Dashboard, My Cases and New Case 1710×950 PNGs are byte-identical; Analytics has identical layout metrics and a time-dependent refresh label. Inspected the compact Analytics capture visually against the supplied screenshot.

At 1280×599 Analytics has a 200px sidebar, 50px header, content beginning at x=296px and 879px content width. Screenshot artifacts and JSON measurements are in /private/tmp/myguide-layout-revision/compact-complete-*.png and compact-complete.json.

Production build passes with the existing large-bundle advisory. Targeted lint for AppSidebar and Analytics passes. Global CSS, Landing, Login, API configuration and backend files were not modified. Real Windows hardware, iPad Safari, all other authenticated routes with populated data, and dialog interactions still require manual verification.

## Files modified

- frontend/src/components/AppSidebar.jsx
- frontend/src/components/PendingCaseBookings.jsx
- frontend/src/pages/LLMRecommendationsPage.jsx
- frontend/src/pages/CaseDetailsPage.jsx
- frontend/src/pages/MyCasesPage.jsx
- frontend/src/pages/UserManagementPage.jsx
- frontend/src/pages/DashboardPage.jsx
- frontend/src/pages/ActivityLogPage.jsx
- frontend/src/pages/SettingsPage.jsx
- frontend/src/pages/MyProfilePage.jsx
- frontend/src/pages/StudentRecordsPage.jsx
- frontend/src/pages/SystemAdminPage.jsx
- frontend/src/pages/AnalyticsPage.jsx
- frontend/src/pages/BookingsPage.jsx
- frontend/src/pages/ProgressNotesPage.jsx
- frontend/src/pages/KnowledgeBasePage.jsx
- frontend/src/pages/FollowUpsPage.jsx
- frontend/src/pages/ReportsPage.jsx
- frontend/src/pages/InterventionPlansPage.jsx
- frontend/src/pages/NewCasePage.jsx
- frontend/src/components/AuthenticatedCompact.css
