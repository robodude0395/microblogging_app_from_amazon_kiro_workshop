---
inclusion: fileMatch
fileMatchPattern: '**/*.{tsx,jsx,css}'
---

# Design System Guidelines

When creating or modifying UI components, you MUST follow these design system rules.

## Reference Documentation

The complete design system is documented in #[[file:DESIGN_LANGUAGE.md]]. This file provides a quick reference for common patterns.

## Color System (REQUIRED)

You MUST ONLY USE these exact color values:

```css
/* Primary Colors */
--primary-color: #8b5cf6        /* Purple - buttons, links, accents */
--button-hover: #7c3aed          /* Darker purple - hover states */
--button-disabled: #c4b5fd       /* Light purple - disabled states */

/* Backgrounds */
--app-background: #f5f8fa        /* Light gray - app background */
--background-color: #ffffff      /* White - cards and content */
--border-color: #e1e8ed          /* Light gray - borders */

/* Text Colors */
--text-primary: #14171a          /* Dark gray - main content */
--text-secondary: #657786        /* Medium gray - timestamps, metadata */
--text-muted: #8899a6           /* Light gray - less important */
--text-disabled: #aab8c2        /* Very light gray - inactive */

/* Semantic Colors */
--error-color: #e0245e          /* Red - errors */
--success-color: #17bf63        /* Green - success */
--like-color: #e0245e           /* Red - like button active */
--warning-color: #ffad1f        /* Orange - warnings */
--info-color: #1da1f2          /* Blue - information */
```

## Button Styling (REQUIRED)

All buttons MUST use these exact styles:

```css
/* Primary Buttons */
background-color: #8b5cf6;
color: white;
border: none;
border-radius: 9999px;          /* REQUIRED: Fully rounded */
padding: 0.5rem 1rem;
font-size: 1rem;
font-weight: 600;               /* REQUIRED: Semibold */
cursor: pointer;
transition: background-color 0.2s;

/* Hover State */
:hover {
  background-color: #7c3aed;
}

/* Disabled State */
:disabled {
  background-color: #c4b5fd;
  cursor: not-allowed;
}
```

## Card Styling (REQUIRED)

All cards MUST use these exact styles:

```css
background-color: #ffffff;
border: 1px solid #e1e8ed;
border-radius: 8px;             /* REQUIRED: 8px rounded corners */
padding: 1rem;                  /* REQUIRED: 1rem padding */
```

## Spacing Scale (REQUIRED)

You MUST ONLY USE these spacing values:

- 4px (0.25rem) - Tight spacing, small borders
- 8px (0.5rem) - Small gaps, compact padding
- 16px (1rem) - Standard spacing, card padding
- 24px (1.5rem) - Section spacing, large padding
- 32px (2rem) - Major sections, large gaps

## Typography (REQUIRED)

### Font Weights
You MUST ONLY USE these font weights:

- 400 (normal) - Body text, post content
- 500 (medium) - Labels, form labels
- 600 (semibold) - Buttons, emphasized text
- 700 (bold) - User names, headings

### Font Sizes
You MUST ONLY USE these font sizes:

- 12px (0.75rem) - Small labels, API display
- 14px (0.875rem) - Secondary text, timestamps
- 16px (1rem) - Body text, default size
- 18px (1.125rem) - Emphasized content
- 20px (1.25rem) - Small headings
- 24px (1.5rem) - Section headings
- 30px (1.875rem) - Page titles

## Form Elements (REQUIRED)

All form inputs MUST use these exact styles:

```css
/* Input Fields */
width: 100%;
padding: 0.75rem;               /* REQUIRED: 0.75rem padding */
border: 1px solid #e1e8ed;
border-radius: 4px;             /* REQUIRED: 4px rounded corners */
font-size: 1rem;

/* Labels */
display: block;
margin-bottom: 0.5rem;
font-weight: 500;               /* REQUIRED: Medium weight */
color: #14171a;
```

## Layout Patterns (REQUIRED)

### App Background
- App background MUST be #f5f8fa (light gray)
- Content cards MUST be #ffffff (white) on the gray background

### Responsive Breakpoints
- Mobile: Default styles (up to 768px)
- Desktop: 769px and above

### Header
- MUST be sticky with `position: sticky; top: 0; z-index: 100;`
- MUST have white background with bottom border
- MUST use `padding: 0.5rem 1rem;`

## Component Patterns (REQUIRED)

### User Names
- MUST use `font-weight: 700` (bold)
- MUST be clickable links in purple (#8b5cf6)

### Timestamps
- MUST use `color: #657786` (secondary text)
- MUST use `font-size: 0.875rem` (14px)

### Like Buttons
- MUST use transparent background when not liked
- MUST use #e0245e (red) when liked
- MUST show count next to icon

### Follow Buttons
- MUST use purple background (#8b5cf6) when not following
- MUST use white background with purple border when following
- MUST be fully rounded (border-radius: 9999px)

## Critical Rules

1. NEVER use arbitrary colors - ONLY use the defined color tokens
2. NEVER use arbitrary spacing - ONLY use the spacing scale (4px, 8px, 16px, 24px, 32px)
3. NEVER use arbitrary border-radius values - buttons MUST be 9999px, cards MUST be 8px, inputs MUST be 4px
4. NEVER use font weights outside 400, 500, 600, 700
5. ALL buttons MUST be fully rounded (9999px)
6. ALL cards MUST have 8px border-radius and 1rem padding
7. ALL interactive elements MUST have hover states with darker shades

## Accessibility Requirements

- Maintain color contrast ratios for text readability
- Ensure touch targets are at least 44px for mobile
- Use semantic HTML elements
- Maintain visible focus states for keyboard navigation
