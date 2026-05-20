---
name: Adrail
description: Warm, privacy-safe AI advertising UI with transparent sponsored boundaries and auditable settlement.
colors:
  background: "#f6f7f9"
  surface: "#ffffff"
  surface-soft: "#f8fafc"
  surface-strong: "#f1f5f9"
  line: "#d7dde5"
  text: "#111827"
  muted: "#5b6675"
  teal-signal: "#0f766e"
  blue-action: "#2563eb"
  green-success: "#15803d"
  red-danger: "#b91c1c"
  amber-warning: "#b45309"
  violet-accent: "#6d28d9"
  blue-selected-bg: "#eff6ff"
  green-success-bg: "#ecfdf5"
  red-danger-bg: "#fef2f2"
  amber-muted-bg: "#fff7ed"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.5rem, 2vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.12rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.98rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.74rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  xxl: "16px"
  shell: "22px"
components:
  button-primary:
    backgroundColor: "{colors.blue-action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "38px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px"
  status-pill:
    backgroundColor: "{colors.green-success-bg}"
    textColor: "{colors.green-success}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  panel-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "18px"
---

# Design System: Adrail

## 1. Overview

**Creative North Star: "The Warm Control Room"**

Adrail should feel like a calm assistant wrapped around a precise operations layer. User Chat is the warm room: humane, conversational, clear about sponsorship, and careful not to make the user feel processed by ad machinery. Advertiser Dashboard is the control room: denser, more technical, and visibly accountable, but still plain-spoken and approachable.

The system is a restrained light product UI with tinted grays, strong readable borders, compact 8px surfaces, and blue used for action or current state. Visual trust comes from clarity, not spectacle: labels, proof, review status, and settlement state should be easy to scan before they are decorative.

It explicitly rejects generic SaaS dashboards, crypto casino or neon Web3 styling, adtech clutter, dark-pattern advertising, cold enterprise security dashboards, direct Claude or ChatGPT imitation, and User Chat layouts where proof panels fight the conversation.

**Key Characteristics:**

- Warm chat surface, precise dashboard surface.
- Restrained light palette with blue reserved for action and selection.
- Compact 8px component vocabulary across buttons, fields, panels, and disclosure drawers.
- Proof is near the workflow but visually secondary until requested.
- Plain English state copy over abstract system labels.

## 2. Colors

The palette is a warm-neutral product palette with a blue action spine and semantic colors used only when they carry state or proof meaning.

### Primary

- **Clear Action Blue** (`blue-action`): Used for primary CTAs, active tabs, selected presets, focus rings, proof links, and current-state emphasis.

### Secondary

- **Privacy Teal** (`teal-signal`): Used for personalized or privacy-safe interaction signals, especially when an ad state updates without crossing into the answer agent.
- **Proof Green** (`green-success`): Used for approved, settled, verified, and success states.
- **Warning Amber** (`amber-warning`): Used for stale, pending, muted, or needs-attention states.
- **Danger Red** (`red-danger`): Used only for rejected, blocked, failed, or policy-danger states.
- **Deep Violet** (`violet-accent`): Reserved for ad-theme differentiation. Do not use it as the default product accent.

### Neutral

- **Soft App Canvas** (`background`): The page background that keeps the app light without a blank white glare.
- **Pure Surface** (`surface`): Current base panel and field surface in the implementation.
- **Soft Surface** (`surface-soft`): Secondary panel, graphic, and metric cell fill.
- **Strong Surface** (`surface-strong`): User message fill and heavier neutral surface.
- **Warm Divider** (`line`): Borders, panel separators, cards, fields, and grid cells.
- **Ink Text** (`text`): Primary text.
- **Muted Slate** (`muted`): Secondary copy, labels, metadata, and explanatory help text.

### Named Rules

**The Blue Means Action Rule.** Blue is for primary action, selection, active tabs, proof links, and focus. Do not spend it as decoration.

**The Semantic Color Rule.** Green, amber, red, teal, and violet must explain state, policy, proof, privacy, or ad-theme meaning. If the color does not carry meaning, remove it.

**The No New Pure Neutral Rule.** The current code includes pure white surfaces. New work should prefer tinted neutrals from the existing family and should never introduce pure black or new pure white as a design choice.

## 3. Typography

**Display Font:** Inter with system fallbacks.
**Body Font:** Inter with system fallbacks.
**User Chat Font:** Avenir Next with Inter/system fallbacks for a warmer, more humanist chat surface. This is an approximation of the desired Claude-like warmth, not a direct Anthropic brand copy.
**Label/Mono Font:** Inter with system fallbacks. Code may use the browser monospace default.

**Character:** The typography is product-native and familiar. It should feel like a trusted assistant plus an operational dashboard, not like a marketing page or a branded poster.

### Hierarchy

- **Display** (700, `clamp(1.5rem, 2vw, 2rem)`, 1.08): Route titles and top-level screen names only.
- **Headline** (700, `1.12rem`, 1.08): Panel headers such as User Chat, Advertiser Console, Platform Review, and Settlement Dashboard.
- **Title** (700, `0.98rem`, 1.25): Compact component titles, graphic card headings, claim block headings, and contribution list headings.
- **Body** (400, `1rem`, 1.55): Conversational copy, ad body, answer text, notices, disclosure details, and explanatory prose. Keep normal prose near 65 to 75 characters per line when possible.
- **Label** (700, `0.74rem`, 1.2, uppercase where already used): Eyebrows, metadata labels, metric terms, message roles, and small status labels.

### Named Rules

**The One Family Rule.** Use one well-tuned sans family per surface. User Chat may use the warmer humanist chat stack; Advertiser Console should keep the sharper operational Inter/system stack. Do not add display fonts to labels, buttons, dashboard data, or system states.

**The Human Copy Rule.** User Chat copy should sound like a helpful assistant. Advertiser Dashboard copy can be technical, but it must stay plain English.

## 4. Elevation

This system uses a hybrid of borders, tonal layering, and one ambient shadow. Borders do most structural work. Shadows are reserved for large app panels and the privacy drawer, where depth clarifies hierarchy and focus.

### Shadow Vocabulary

- **Ambient Panel Shadow** (`0 12px 36px rgba(15, 23, 42, 0.12)`): Use on primary app panels, console panels, and the disclosure drawer. Do not apply it to every metric cell or repeated card.

### Named Rules

**The Border First Rule.** Use borders and tonal surfaces before adding another shadow. If every object is floating, no object feels important.

**The Proof Stays Quiet Rule.** Settlement and privacy proof should feel available and trustworthy, not louder than the chat or the advertiser workflow.

## 5. Components

Components should feel consistent and familiar. Shape, focus, and state language should repeat across both User Chat and Advertiser Dashboard, while density differs by surface.

### Buttons

- **Shape:** Gently squared product controls (8px radius) with a minimum 38px height.
- **Primary:** Clear Action Blue background with white text, 1px blue border, and compact horizontal padding (`0 14px`).
- **Hover / Focus:** Hover changes border color. Focus uses a 3px blue translucent outline with 2px offset.
- **Secondary:** White surface, Warm Divider border, Ink Text copy, same 8px radius and height.
- **Small:** 32px minimum height with tighter horizontal padding (`0 10px`) for inline proof, disclosure, and reset actions.

### Chips

- **Style:** Pill chips use 999px radius, 28px minimum height, bold uppercase label text, and semantic background pairs.
- **State:** Neutral chips use blue-tinted background. Success, danger, warning, and muted states must use matching semantic text and background.

### Cards / Containers

- **Corner Style:** 8px radius.
- **Background:** Primary panels use Pure Surface. Secondary cells use Soft Surface or Strong Surface.
- **Shadow Strategy:** Large panels may use Ambient Panel Shadow. Repeated metric cells and graphic cards stay flat with borders.
- **Border:** Warm Divider is the default border color. Sponsored frames may use a stronger 2px Ink Text border to make sponsorship unmistakable.
- **Internal Padding:** Dense cells use 10 to 14px. Panel headers use 18px. Sponsored frames use 22px on desktop and 16px on mobile.

### Inputs / Fields

- **Style:** White surface, Warm Divider border, 8px radius, 12px padding, full width.
- **Focus:** 3px translucent blue focus outline, 2px offset.
- **Error / Disabled:** Error copy uses Danger Red and bold weight. Disabled controls keep shape but drop opacity to 0.56 and use the not-allowed cursor.

### Navigation

- **Style:** Top navigation and tab groups use button-like 8px controls with 8px gaps and wrapping on desktop.
- **Active:** Active route, tab, preset, and choice states use Clear Action Blue border, selected blue background, and stronger blue text.
- **Mobile:** Screen tabs and theme tabs scroll horizontally. Do not compress labels until they are unreadable.

### Sponsored Message

- **Style:** Sponsored messages require an explicit Sponsored label, advertiser name, action controls, and one micro-interaction. The sponsored area may be visually stronger than normal chat bubbles, but it must remain inside the conversation context.
- **Boundary:** Do not mix service answer content into the sponsored frame. The ad can pause the answer, but it cannot masquerade as the answer.

### Privacy Drawer

- **Style:** Right-side drawer, full height, white surface, Warm Divider border, Ambient Panel Shadow, and 18px padding.
- **Interaction:** Opening and closing may fade the layer over 160ms. Respect reduced motion and keep focus management explicit.

## 6. Do's and Don'ts

### Do:

- **Do** make User Chat warm, humane, and conversational before it becomes technical.
- **Do** make Advertiser Dashboard credible, secure, and technically sharp while preserving a warm product tone.
- **Do** keep sponsored content, service answers, advertiser data, and user-private intelligence visually distinct.
- **Do** use Clear Action Blue only for action, selection, focus, active state, and proof links.
- **Do** keep proof available through compact chips, drawers, or clear dashboard sections instead of making it dominate the first viewport.
- **Do** use the shared 8px radius, 1px Warm Divider border, and Inter/system typography vocabulary across both surfaces.
- **Do** expose errors, stale states, rejected policies, and settlement status in plain English.

### Don't:

- **Don't** create generic SaaS dashboards with identical card grids and decorative metrics.
- **Don't** use crypto casino, neon Web3, speculative trading, or hype-driven visual language.
- **Don't** introduce adtech clutter: dense campaign machinery that overwhelms the user-facing product idea.
- **Don't** create dark-pattern advertising: hidden sponsorship, forced engagement, confusing opt-out, or ambiguous dismissal.
- **Don't** make cold enterprise security dashboards that look credible but feel hostile or opaque.
- **Don't** directly imitate Claude, ChatGPT, or Anthropic brand visuals. Humane warmth is the aspiration, not visual copying.
- **Don't** return to workbench-style User Chat layouts where advertiser, review, proof, and settlement panels compete with the conversation.
- **Don't** use gradient text, decorative glassmorphism, side-stripe accent borders, or repeated icon-heading-text card grids.
- **Don't** add decorative motion. Motion must explain state, reveal, or feedback.
