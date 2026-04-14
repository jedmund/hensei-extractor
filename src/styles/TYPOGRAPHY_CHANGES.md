# Typography scale changes

Simplified the font-size scale by collapsing 1.5rem down to 1.4rem (`$font-small`).
If the UI feels too tight, revert these by changing `$font-small` references back to 1.5rem.

## 1.5rem -> 1.4rem changes

| File             | Selector                | Was                                                   |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| `_base.scss`     | `body`                  | `font-size: 1.5rem`                                   |
| `_tokens.scss`   | `$input-font-size`      | `1.5rem` (affects all inputs via `--input-font-size`) |
| `_detail.scss`   | `.char-stats-name`      | `font-size: 1.5rem`                                   |
| `_detail.scss`   | `.char-stats-awakening` | `font-size: 1.5rem`                                   |
| `_detail.scss`   | `.char-stats-line`      | `font-size: 1.5rem`                                   |
| `_detail.scss`   | `.char-stats-empty`     | `font-size: 1.5rem`                                   |
| `_playlist.scss` | `textarea.contained`    | `font-size: 1.5rem`                                   |
| `_cache.scss`    | `.cache-name`           | `font-size: 1.5rem`                                   |
| `_profile.scss`  | `.profile-username`     | `font-size: 1.5rem`                                   |
| `_database.scss` | `.stat-row`             | `font-size: 1.5rem`                                   |

## 1.3rem -> 1.4rem changes

| File             | Selector                 | Was                 |
| ---------------- | ------------------------ | ------------------- |
| `_detail.scss`   | `.filter-section-title`  | `font-size: 1.3rem` |
| `_detail.scss`   | `.filter-option-desc`    | `font-size: 1.3rem` |
| `_detail.scss`   | `.filter-show-all`       | `font-size: 1.3rem` |
| `_detail.scss`   | `.job-skill-item span`   | `font-size: 1.3rem` |
| `_playlist.scss` | `.playlist-create-error` | `font-size: 1.3rem` |
| `_playlist.scss` | `.playlist-item-count`   | `font-size: 1.3rem` |
| `_cache.scss`    | `.stash-tag`             | `font-size: 1.3rem` |
| `_login.scss`    | `.login-language-switch` | `font-size: 1.3rem` |
