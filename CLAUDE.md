# Notes for AI assistants working in this repo

- **The live website does not update from git.** After changing code, run `npm test`, then tell the owner to run `npm run web:deploy`. Only run it yourself if the owner asks you to deploy. See "What to run, and when" at the top of README.md.
- `npm run sync` merges Mac-mode data (`data/my-data.json`) with the website's database. Don't run it against the real database without the owner's go-ahead. `--dry-run` is read-only.
- `node server.js` (Mac mode) also merges with the real website automatically. For tests and experiments, always set `DATA_FILE=<temp file>`, which turns that off. To test the merge itself, add `WEBSITE_SYNC_TEST_FILE=<temp file>`, which stands in for the website.
- The website's address is https://interpreter-helper.pages.dev. The `<hash>.interpreter-helper.pages.dev` addresses are frozen copies of single deployments.
- The GitHub repo is public. Never commit keys, personal data or the gitignored files, such as `.env.local`, `.dev.vars`, `.phone-code` and `data/my-data.json`.
