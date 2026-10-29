# Enarea – notes for Claude

- **Version number:** the footer under Målinger shows `APP_VERSION` from `src/version.ts` (currently 1.00).
  With every update that is shipped (every PR to main), raise it by 0.01 – 1.00 → 1.01 → 1.02 … (after 1.99 comes 2.00).
  Always bump it in the same commit/PR as the change.
- Pages is deployed from `main`; work on the designated branch and merge through a PR.
