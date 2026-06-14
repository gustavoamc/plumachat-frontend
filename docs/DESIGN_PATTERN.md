# Plumachat Frontend — Design Pattern Reference

> Single source of truth for colors, typography, spacing, and component patterns.  
> Derived from scanning all CSS Modules in the project (April 2026).

---

## Color Palette

### Brand / Primary

| Token (proposed) | Value | Usage |
|---|---|---|
| `--color-primary` | `#aa920b` | Primary buttons, active tabs, CTA links |
| `--color-primary-hover` | `#856201` | Hover on navbar links |
| `--color-primary-dark` | `#4b3f02` | Hover on primary buttons |

### Semantic / Status

| Token | Value | Usage |
|---|---|---|
| `--color-success` | `#32a852` / `#27ae60` | Confirm modals, unban, join room |
| `--color-success-hover` | `#1e8449` / `#072910` | Hover states for success buttons |
| `--color-danger` | `#db211a` | Delete, logout, ban, cancel actions |
| `--color-danger-hover` | `#70110e` | Hover states for danger buttons |
| `--color-danger-alt` | `#c0392b` | Ban button (AdminArea), error headings |
| `--color-warning` | `#ff9900` | Orange secondary action (RoomInfo) |
| `--color-info` | `#0077cc` / `#0077dd` | Promote user, dropdown triggers |
| `--color-info-hover` | `#005fa3` | Hover on info/blue buttons |

### Neutrals & Backgrounds

| Token | Value | Usage |
|---|---|---|
| `--color-bg-page` | `#f9f9f9` | Page background, info-box, right columns |
| `--color-bg-panel` | `#f4f4f4` | Profile left column, secondary panels |
| `--color-bg-subtle` | `#f2f2f2` | Tab content background |
| `--color-bg-input` | `#ddd` | Input fill, inactive button hover |
| `--color-bg-card` | `#e0e0e0` | Info box fill, icon button background |
| `--color-bg-white` | `#ffffff` | Modals, dropdown menus, right panels |
| `--color-bg-dark` | `#323` | Navbar background |
| `--color-border` | `#ccc` | Standard borders (inputs, cards, lists) |
| `--color-border-dark` | `#999` | Stronger section borders |
| `--color-border-subtle` | `#eee` | Row dividers |
| `--color-overlay` | `rgba(0,0,0,0.5)` | Modal backdrop |

### Text

| Token | Value | Usage |
|---|---|---|
| `--color-text-primary` | `#333` | Default body text |
| `--color-text-dark` | `#000` | Strong emphasis |
| `--color-text-on-dark` | `#ffffff` | Text on colored/dark backgrounds |
| `--color-text-muted` | `#999` / `gray` | Empty states, secondary labels |
| `--color-text-nav` | `#ddd` | Inactive navbar links |

---

## Typography

Font family (global): `Helvetica, Arial, sans-serif` (system stack, no custom imports)

| Role | Size | Weight |
|---|---|---|
| Page title / hero | `3rem` | bold |
| Section heading (h2) | `2rem` | bold |
| Form label | `1.5rem` | bold |
| Large button text | `1.5rem` | bold |
| Input text | `1.2rem` | normal |
| Body / standard | `1rem` | normal |
| Bold inline span | `16px` | bold |
| Navbar logo | `1.75rem` | bold |
| Navbar links | `1rem` | normal |

---

## Spacing Scale

| Name | Value | Typical context |
|---|---|---|
| xs | `0.25rem` | Tight internal gaps |
| sm | `0.5rem` | Compact inputs, button padding |
| md | `1rem` | Standard form / section gap |
| lg | `1.5rem` | Card / info-box padding |
| xl | `2rem` | Modal padding, large sections |
| 2xl | `3rem+` | Hero / landing areas |

---

## Border Radius

| Usage | Value |
|---|---|
| Buttons | `4px` – `6px` |
| Cards / info boxes | `6px` – `8px` |
| Modals | `8px` |
| Inputs | `4px` |
| Navbar links | `0` |

---

## Z-Index Hierarchy

| Layer | Value |
|---|---|
| Navbar | `1000` |
| Modals | `1000` |
| Dropdown menus | `1000` |

---

## Component Patterns

### Button Variants

```
Primary:   bg #aa920b → hover #4b3f02  | white text | radius 4-6px | bold
Success:   bg #32a852 → hover #072910  | white text
Danger:    bg #db211a → hover #70110e  | white text
Info/Blue: bg #0077dd → hover #005fa3  | white text
Warning:   bg #ff9900                  | white text
Secondary: bg #eee    → hover #ddd     | #333 text  (inactive tabs)
Cancel:    bg #999    → hover #666     | white text
```

All buttons share: `cursor: pointer; border: none; font-weight: bold; padding: 0.5rem 1rem`

---

### Form Pattern

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1.2rem;
}

.form label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}
```

- Submit: Primary button variant, full-width or right-aligned
- Validation: Currently via browser `alert()` — move to inline errors in future

---

### Modal Pattern

```css
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modalContent {
  background: #fff;
  width: 400px;
  padding: 2rem;
  border-radius: 8px;
}

.modalActions {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}
```

- Cancel button: Danger (`#db211a`) or gray (`#999`)
- Confirm button: Success (`#32a852`) or Primary (`#aa920b`)

---

### Navbar

```css
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
  height: 60px;
  background: #323;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}
```

- Logo: `1.75rem`, bold, white
- Links: `1rem`, `#ddd` default → white text + `#856201` bg on hover

---

### Info Card / Box

```css
.infoBox {
  background: #f9f9f9; /* or #e0e0e0 for filled variant */
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 1.5rem;
}
```

Optional `box-shadow` for elevated/floating appearance.

---

### Two-Column Layout

**Admin grid (60 / 40 split):**

```css
.grid {
  display: grid;
  grid-template-columns: 60% 40%;
}
```

**Profile / info pages:**

```css
.layout {
  display: flex;
}
.leftColumn {
  background: #f4f4f4;
  border-right: 2px solid #ddd;
}
.rightColumn {
  background: #fff;
}
```

---

### List / Row

```css
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #eee;
}
.row:hover {
  background: #d0d0d0;
}
```

---

### Tab Bar

```css
.tabBar {
  display: flex;
  gap: 0.5rem;
}
.tab {
  background: #eee;
  color: #333;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.tab:hover { background: #ddd; }
.tab.active {
  background: #aa920b;
  color: white;
}
```

---

### Dropdown Menu

- Trigger: Info/blue button (`#0077dd`)
- Menu: `position: absolute; background: white; border: 1px solid #ccc; z-index: 1000`
- Items: `padding: 0.5rem 1rem; color: black; hover bg: #f1f1f1`

---

## Component Tree

```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx          — fixed header, auth-aware nav links
│   │   ├── Container.tsx       — full-height flex wrapper (60px top padding for navbar)
│   │   └── Loading.tsx         — centered "Carregando..." placeholder
│   └── routes/
│       ├── ErrorBoundary.tsx   — class-based error catcher
│       ├── RequireAuth.tsx     — role-based route guard (user / admin / root)
│       └── NotFound.tsx        — 404 page
├── pages/
│   ├── Home.tsx                — landing page, 3-col fixed layout, auth-aware CTA
│   ├── Auth/
│   │   ├── Login.tsx           — email + password form → AuthContext.login()
│   │   └── Register.tsx        — username + email + password → AuthContext.login()
│   ├── User/
│   │   ├── Dashboard.tsx       — room list + find/create modals + per-room dropdown
│   │   └── Profile.tsx         — user info + edit / change password / logout modals
│   ├── Admin/
│   │   ├── AdminArea.tsx       — tab hub: "Usuários" + "Gerenciar Admins" (root only)
│   │   └── AdminAreaTabs/
│   │       ├── UsersList.tsx   — searchable list → selected user details + ban modal
│   │       └── AdminPromote.tsx— searchable list + promote / demote buttons
│   └── Room/
│       ├── Room.tsx            — chat room (placeholder)
│       └── RoomInfo.tsx        — room details + participants list + edit modal
├── context/
│   └── AuthContext.tsx         — user state, login(), logout(), isAuthenticated
├── hooks/
│   └── useAuth.ts              — consumes AuthContext; throws outside provider
└── utils/
    └── api.ts                  — configured Axios instance (base URL + credentials)
```

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| React | 19.1.0 | UI framework |
| React Router | 7.6.2 | Client-side routing |
| Axios | 1.9.0 | HTTP client |
| React Icons | 5.5.0 | Icon library (Fa*, Io* families) |
| CSS Modules | (Vite built-in) | Scoped component styles |
