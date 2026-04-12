# Design Pattern Migration Guide

Steps to migrate from scattered hardcoded styles to the centralized design system documented in [`DESIGN_PATTERN.md`](../DESIGN_PATTERN.md).

No new packages required — CSS custom properties and CSS Modules are fully supported by the current Vite setup.

---

## Step 1 — Centralize tokens in `index.css`

Add a `:root` block to `src/index.css`. Every CSS module can then use `var(--color-primary)` instead of `#aa920b`.

```css
/* src/index.css */
:root {
  /* Brand */
  --color-primary:        #aa920b;
  --color-primary-hover:  #4b3f02;

  /* Status */
  --color-success:        #32a852;
  --color-success-hover:  #072910;
  --color-danger:         #db211a;
  --color-danger-hover:   #70110e;
  --color-info:           #0077dd;
  --color-info-hover:     #005fa3;
  --color-warning:        #ff9900;

  /* Neutrals */
  --color-bg-page:        #f9f9f9;
  --color-bg-white:       #ffffff;
  --color-bg-dark:        #323;
  --color-border:         #ccc;
  --color-overlay:        rgba(0, 0, 0, 0.5);

  /* Text */
  --color-text:           #333;
  --color-text-light:     #ffffff;
  --color-text-muted:     #999;
  --color-text-nav:       #ddd;

  /* Layout */
  --navbar-height:        60px;

  /* Border radius */
  --radius-sm:            4px;
  --radius-md:            6px;
  --radius-lg:            8px;
}
```

After adding the block, go through each `.module.css` file and replace hardcoded hex values with the corresponding variable.

**Files to update:**
- `src/components/layout/Navbar.module.css`
- `src/components/layout/Container.module.css`
- `src/components/routes/NotFound.module.css`
- `src/pages/Home.module.css`
- `src/pages/Auth/Login.module.css`
- `src/pages/User/Dashboard.module.css`
- `src/pages/User/Profile.module.css`
- `src/pages/Admin/AdminArea.module.css`
- `src/pages/Admin/AdminAreaTabs/Grid.module.css`
- `src/pages/Room/RoomInfo.module.css`

---

## Step 2 — Replace hardcoded colors in all `.module.css` files

With the `:root` tokens in place, do a find-and-replace pass across every module file.

**Common substitutions:**

| Hardcoded value | Replace with |
|---|---|
| `#aa920b` | `var(--color-primary)` |
| `#4b3f02` | `var(--color-primary-hover)` |
| `#856201` | `var(--color-primary-hover)` |
| `#db211a` | `var(--color-danger)` |
| `#70110e` | `var(--color-danger-hover)` |
| `#c0392b` | `var(--color-danger)` |
| `#32a852` / `#27ae60` | `var(--color-success)` |
| `#072910` / `#1e8449` | `var(--color-success-hover)` |
| `#0077dd` / `#0077cc` | `var(--color-info)` |
| `#005fa3` | `var(--color-info-hover)` |
| `#ff9900` | `var(--color-warning)` |
| `#f9f9f9` | `var(--color-bg-page)` |
| `#ffffff` / `white` | `var(--color-bg-white)` |
| `#ccc` | `var(--color-border)` |
| `rgba(0,0,0,0.5)` | `var(--color-overlay)` |
| `#333` | `var(--color-text)` |
| `#fff` / `white` (on dark bg) | `var(--color-text-light)` |
| `60px` (navbar height) | `var(--navbar-height)` |

---

## Step 3 — Extract a shared `<Modal />` component

The same modal CSS block is copy-pasted into **4 files**:
- `Dashboard.module.css`
- `RoomInfo.module.css`
- `Profile.module.css`
- `Grid.module.css`

### 3a. Create `src/components/ui/Modal.module.css`

```css
.overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  background: var(--color-bg-white);
  width: 400px;
  padding: 2rem;
  border-radius: var(--radius-lg);
}

.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}
```

### 3b. Create `src/components/ui/Modal.tsx`

```tsx
import styles from './Modal.module.css';

interface ModalProps {
  onClose?: () => void;
  children: React.ReactNode;
}

export function Modal({ onClose, children }: ModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

### 3c. Replace inline modal blocks in each page

In `Dashboard.tsx`, `RoomInfo.tsx`, and `Profile.tsx`, replace:

```tsx
{showModal && (
  <div className={styles.modalOverlay}>
    <div className={styles.modalContent}>
      {/* form */}
    </div>
  </div>
)}
```

With:

```tsx
import { Modal } from '../../components/ui/Modal';

{showModal && (
  <Modal onClose={() => setShowModal(false)}>
    {/* form */}
  </Modal>
)}
```

Then delete the duplicated `modalOverlay`, `modalContent`, and `modalActions` blocks from each `.module.css` file.

---

## Step 4 — Extract a shared `<Button />` component

Seven button variants are repeated across every page. A single component removes ~120 lines of duplicated CSS.

### 4a. Create `src/components/ui/Button.module.css`

```css
.btn {
  cursor: pointer;
  border: none;
  font-weight: bold;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-light);
  transition: background 0.15s;
}

.primary   { background: var(--color-primary);  }
.primary:hover { background: var(--color-primary-hover); }

.success   { background: var(--color-success);  }
.success:hover { background: var(--color-success-hover); }

.danger    { background: var(--color-danger);   }
.danger:hover { background: var(--color-danger-hover); }

.info      { background: var(--color-info);     }
.info:hover { background: var(--color-info-hover); }

.warning   { background: var(--color-warning);  }

.secondary { background: #eee; color: var(--color-text); }
.secondary:hover { background: #ddd; }
```

### 4b. Create `src/components/ui/Button.tsx`

```tsx
import styles from './Button.module.css';

type Variant = 'primary' | 'success' | 'danger' | 'info' | 'warning' | 'secondary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${className ?? ''}`}
      {...props}
    />
  );
}
```

### 4c. Replace inline button styles across pages

Replace hardcoded `className={styles.redButton}` etc. with:

```tsx
import { Button } from '../../components/ui/Button';

<Button variant="danger" onClick={handleDelete}>Delete</Button>
<Button variant="success" onClick={handleConfirm}>Confirm</Button>
```

---

## Step 5 — Centralize `--navbar-height`

The `60px` navbar height is a magic number duplicated in both `Navbar.module.css` and `Container.module.css`.

After Step 1 adds `--navbar-height: 60px` to `:root`, update both files:

```css
/* Container.module.css */
.container {
  padding-top: var(--navbar-height);
}

/* Navbar.module.css */
.navbar {
  height: var(--navbar-height);
}
```

---

## Priority Summary

| Step | What it solves | Estimated effort |
|---|---|---|
| 1 — `:root` tokens | Unlocks all following steps | ~30 min |
| 2 — Replace hex values | Consistency, easy theme changes | ~1–2 h |
| 3 — `<Modal />` component | Removes ~200 lines of duplication | ~1–2 h |
| 4 — `<Button />` component | Removes ~120 lines, enforces variants | ~1–2 h |
| 5 — `--navbar-height` | Removes magic number | ~10 min |
