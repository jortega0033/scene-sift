# Visual QA Skill

Invoke: `/visual-qa`

Requires dev/preview server running at `http://localhost:4173`.

## Steps

1. Confirm server running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173` — expect 200.
2. Run `pnpm test:visual` — capture pass/fail count.
3. Run `pnpm test:e2e` — capture pass/fail count.
4. For failures: note screenshot diff paths (`.qa/visual-regression/`).
5. Check browser console for errors during E2E run (chrome-devtools-mcp if available).

## Output

PASS / FAIL with counts. Screenshot diff paths for failures. Console errors if any. If server not running, state clearly — do not skip tests.
