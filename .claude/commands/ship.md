Stage all modified tracked files, write a concise commit message describing what changed, commit, and push to origin main so Vercel picks it up.

Steps:
1. Run `git status` and `git diff --stat` to understand what changed.
2. Run `git log --oneline -5` to match the existing commit message style.
3. Stage with `git add` (specific files — never `git add -A` if there are untracked secrets like .env).
4. Commit with a clear message ending with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
5. Push to `origin main`.
6. Print the Vercel production URL so the user can watch the deploy: https://community-demographic-tool.vercel.app
