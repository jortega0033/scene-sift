# M6 — UX Specification

Date: 2026-07-20  
Status: Planning

---

## Location

AI Provider configuration lives in **Settings page** (`src/renderer/features/settings/SettingsPage.tsx`), as a new section below "Output" and above "Diagnostics". Section heading: "AI Provider".

No new top-level navigation item. No new page. Settings page is the appropriate location for infrastructure configuration.

---

## Component: AiProviderSection

```
<section data-testid="ai-provider-section">
  <h3>AI Provider</h3>
  <p class="description">Configure an AI provider to enable clip candidate generation.</p>

  [State-conditional content — see states below]
</section>
```

---

## State: unconfigured

```
┌─ AI Provider ───────────────────────────────────────────────────────┐
│  Configure an AI provider to enable clip candidate generation.      │
│                                                                      │
│  [Privacy notice — collapsed / inline — see privacy notice section] │
│                                                                      │
│  Provider                                                            │
│  [ OpenAI (compatible) ▼ ]    (select, single option in M6)         │
│                                                                      │
│  Endpoint                                                            │
│  [ https://api.openai.com __________________ ]                       │
│                                                                      │
│  Model                                                               │
│  [ gpt-4o-mini _________________________ ]                           │
│                                                                      │
│  API key                                                             │
│  [ ••••••••••••••••••••• ]  (password input)                         │
│                                                                      │
│  [ Save configuration ]                                              │
└──────────────────────────────────────────────────────────────────────┘
```

data-testid values: `ai-provider-form`, `ai-provider-input`, `ai-endpoint-input`, `ai-model-input`, `ai-apikey-input`, `ai-save-button`

---

## State: configured (unconfigured → configured_untested after save)

```
┌─ AI Provider ───────────────────────────────────────────────────────┐
│  ● API key saved                                                    │
│  Provider: OpenAI (compatible)                                      │
│  Endpoint: https://api.openai.com                                   │
│  Model: gpt-4o-mini                                                  │
│                                                                      │
│  Status: Not tested                                                  │
│                                                                      │
│  [ Test connection ]   [ Clear configuration ]                       │
└──────────────────────────────────────────────────────────────────────┘
```

data-testid: `ai-status-indicator`, `ai-status-text`, `ai-test-button`, `ai-clear-button`

Masked endpoint: displays `https://ap…` (first 10 chars + ellipsis). Model name shown in full.

API key NOT displayed in any form. No "View key" button. The `<input type="password">` is cleared after save completes.

---

## State: testing

```
│  Status: Testing…  [spinner]                                         │
│  [ Cancel ]                                                          │
```

data-testid: `ai-status-testing`, `ai-cancel-button`

---

## State: available

```
│  Status: ✓ Connected  (green indicator)                              │
│  Last tested: 2 minutes ago                                          │
│                                                                      │
│  [ Test again ]   [ Clear configuration ]                            │
```

data-testid: `ai-status-available`

---

## State: unavailable / rate_limited / offline / invalid_configuration

```
│  Status: ✗ Connection failed  (red indicator)                        │
│  [Human-readable error message — see M6_ERROR_TAXONOMY.md]          │
│                                                                      │
│  [ Retry ]   [ Clear configuration ]                                 │
```

data-testid: `ai-status-error`, `ai-error-message`, `ai-retry-button`

Error messages: from `AI_ERROR_MESSAGES` map (never raw provider error, never raw code exposed in UI text — error code stored in state for mapping only).

---

## Privacy notice

Shown **once** before the user can save a configuration, as an inline collapsible or modal. After consent recorded, the notice is replaced with a one-line summary:

"AI features send text from your subtitles to the configured provider. [View notice]"

The "View notice" link re-displays the full notice text (read-only, no action required after consent).

data-testid: `ai-privacy-notice`, `ai-consent-button`, `ai-notice-summary`

---

## Form validation

Client-side (before submit):
- API key: non-empty, max 512 chars, no whitespace-only
- Endpoint: valid URL, HTTPS only (client-side check mirrors server-side)
- Model: non-empty, max 128 chars

Server-side: Zod validation in IPC handler + `AiConfigurationService` validates endpoint policy. Errors returned as safe codes and mapped to user-facing messages.

---

## Error messages (UX copy)

| Error code | User-facing message |
|---|---|
| `AI_NOT_CONFIGURED` | "API key required. Enter an API key to use AI features." |
| `AI_INVALID_CONFIGURATION` | "Configuration is incomplete. Check your endpoint and API key." |
| `AI_AUTHENTICATION_FAILED` | "Authentication failed. Check your API key." |
| `AI_FORBIDDEN` | "Access denied. Your API key may not have access to this model." |
| `AI_RATE_LIMITED` | "Rate limited. Wait a moment and try again." |
| `AI_PROVIDER_UNAVAILABLE` | "AI provider is unavailable. Try again later." |
| `AI_NETWORK_ERROR` | "Could not reach the AI provider. Check your network." |
| `AI_TIMEOUT` | "Request timed out. The provider may be slow. Try again." |
| `AI_OFFLINE` | "No network connection." |
| `AI_ENDPOINT_NOT_ALLOWED` | "Endpoint not allowed. Use an HTTPS provider URL." |
| `AI_ENCRYPTION_UNAVAILABLE` | "Secure storage unavailable. Set SCENESIFT_AI_API_KEY environment variable." |

---

## Keyboard and focus

- "Save configuration" button: `type="submit"`, responds to Enter when form focused.
- "Test connection" button: `type="button"`, keyboard accessible.
- "Clear configuration" button: `type="button"`, requires confirmation (native `confirm()` dialog or inline confirm step).
- "Cancel" (during test): `type="button"`, accessible.
- API key input: `type="password"`, `autocomplete="new-password"` (prevent browser autofill).
- All interactive elements have visible focus rings using design system focus tokens.

---

## Compact viewport (800px width)

Form stacks vertically. Buttons wrap. Input fields full width. Tested in visual regression at 800×700.

---

## Dark / light appearance

Uses existing design-system tokens. No hardcoded colors. Status indicators use `text-green-*` and `text-red-*` tokens (mapped via design system). Visual regression tests in both appearances.

---

## Accessibility

- Section has `role="region"` and `aria-label="AI Provider configuration"`.
- Status indicator has `aria-live="polite"` to announce state changes to screen readers.
- Error messages have `role="alert"`.
- Spinner has `aria-label="Testing connection"`.
- All form inputs have associated `<label>`.
