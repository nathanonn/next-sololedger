# AI Features Setup & Testing Guide

## 🚀 Quick Setup

### 1. Generate Encryption Key

The AI features require an encryption key for securely storing provider API keys:

```bash
# Generate a 32-byte base64-encoded key
openssl rand -base64 32
```

### 2. Update Environment Variables

Edit your `.env` file and add:

```bash
# Enable AI Features
AI_FEATURES_ENABLED=true

# Encryption Key (REQUIRED - use the key generated above)
APP_ENCRYPTION_KEY=<your-generated-key-here>

# Rate Limits (optional - these are the defaults)
AI_RATE_LIMIT_PER_MIN_ORG=60
AI_RATE_LIMIT_PER_MIN_IP=120

# Allowed Providers (optional - defaults to all three)
AI_ALLOWED_PROVIDERS="openai,gemini,anthropic"
```

### 3. Database Migration

The migration has already been applied, but you can verify:

```bash
# Check current migration status
npx prisma migrate status

# If needed, regenerate Prisma client
npx prisma generate
```

### 4. Restart Development Server

```bash
npm run dev
```

## 📖 User Guide

### For Organization Admins

#### Setting Up AI Providers

1. **Navigate to AI API Keys**
   - Go to `Organization Settings` → `AI API Keys` tab
   - You'll see a table with three providers: OpenAI, Google Gemini, and Anthropic

2. **Add an API Key**
   - Click `Manage` on any provider
   - Enter your API key in the password field
   - Click `Verify & Save`
   - The system will verify the key before saving (makes a small test call)
   - Once verified, you'll see the status change to "Verified" with the last 4 characters displayed

3. **Configure Models**
   - After adding an API key, you'll see a list of curated models
   - Click `Add` next to any model to enable it for your organization
   - The first model added automatically becomes the default
   - Use `Set Default` to change which model is used by default
   - You can remove models with the trash icon (except if it's the only model)

4. **Remove a Provider**
   - Click `Manage` on a verified provider
   - Scroll to the bottom and click `Remove API Key`
   - This will delete the key and all configured models

#### Viewing AI Usage

1. **Navigate to AI Usage**
   - Go to `Organization Settings` → `AI Usage` tab

2. **View Analytics**
   - See aggregate metrics at the top:
     - Total Requests
     - Tokens In (prompt tokens)
     - Tokens Out (completion tokens)
     - Average Latency

3. **Filter Logs**
   - Filter by Provider (OpenAI, Gemini, Anthropic)
   - Filter by Feature (currently just "generic-text")
   - Filter by Status (OK, Error, Canceled)
   - Search by Correlation ID or text content

4. **View Log Details**
   - Click on any log row to open the detail panel
   - See full metadata, token usage, latency
   - View sanitized input and output (truncated to protect secrets)
   - For errors, see the error code and message

### For Developers (Using the API)

#### Generate Text (Non-Streaming)

```bash
curl -X POST http://localhost:3000/api/orgs/your-org-slug/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "feature": "generic-text",
    "maxOutputTokens": 500
  }'
```

Response:
```json
{
  "text": "Quantum computing is...",
  "correlationId": "a1b2c3d4e5f6g7h8",
  "tokensIn": 8,
  "tokensOut": 95,
  "latencyMs": 842
}
```

#### Generate Text (Streaming)

```bash
curl -X POST http://localhost:3000/api/orgs/your-org-slug/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Write a short story about a robot",
    "feature": "generic-text",
    "stream": true
  }'
```

Response (Server-Sent Events):
```
data: {"text":"Once"}
data: {"text":" upon"}
data: {"text":" a"}
data: {"text":" time"}
...
data: {"done":true,"metadata":{"tokensIn":10,"tokensOut":250,"latencyMs":1250}}
```

#### Specify Provider and Model

```bash
curl -X POST http://localhost:3000/api/orgs/your-org-slug/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Hello world",
    "provider": "anthropic",
    "modelName": "claude-sonnet-4-20250514",
    "temperature": 0.7
  }'
```

## 🧪 Testing Checklist

### API Key Management

- [ ] Add an OpenAI API key
- [ ] Verify the key is stored encrypted in the database
- [ ] Add a Google Gemini API key
- [ ] Add an Anthropic API key
- [ ] Try adding an invalid key (should show error)
- [ ] Remove a provider's API key
- [ ] Verify all models for that provider are also removed

### Model Configuration

- [ ] Add a model for a provider
- [ ] Verify the first model becomes default automatically
- [ ] Add a second model
- [ ] Change the default model
- [ ] Try to remove the default model when it's the only one (should fail with message)
- [ ] Remove a non-default model

### Text Generation

- [ ] Generate text without specifying provider/model (uses org default)
- [ ] Generate text with specific provider
- [ ] Generate text with specific model
- [ ] Generate text with specific provider AND model
- [ ] Test streaming generation
- [ ] Test non-streaming generation
- [ ] Verify correlation ID is returned
- [ ] Test with different temperature values
- [ ] Test with different maxOutputTokens values

### Rate Limiting

- [ ] Make 60+ requests in 1 minute from same org (should hit rate limit)
- [ ] Verify 429 response with Retry-After header
- [ ] Wait for rate limit reset and try again
- [ ] Test IP-based rate limiting (120/min)

### Usage Logs

- [ ] View logs in the AI Usage dashboard
- [ ] Verify totals are calculated correctly
- [ ] Filter logs by provider
- [ ] Filter logs by status
- [ ] Search logs by correlation ID
- [ ] Search logs by text content
- [ ] Click on a log to view details
- [ ] Verify sensitive data is redacted in logs
- [ ] Verify pagination works correctly

### Error Handling

- [ ] Generate with no API key configured (should show config error)
- [ ] Generate with invalid model name (should show model not allowed error)
- [ ] Test generation when provider API returns error
- [ ] Verify errors are logged with error code and message
- [ ] Test with revoked/invalid API key (should show auth error)

### Multi-Tenant Security

- [ ] Verify org admin can only manage their org's keys
- [ ] Verify org member can generate but not manage keys
- [ ] Verify superadmin can manage any org's keys
- [ ] Try to access another org's AI endpoints (should fail)
- [ ] Verify logs are isolated per organization

### UI Components

- [ ] Test AI Keys management dialog opens and closes
- [ ] Test all buttons and actions in the UI
- [ ] Verify loading states show correctly
- [ ] Verify error toasts appear for failures
- [ ] Verify success toasts appear for successful operations
- [ ] Test responsive design on mobile
- [ ] Test keyboard navigation
- [ ] Test with screen reader (accessibility)

## 🔍 Troubleshooting

### "AI features are disabled"

- Check that `AI_FEATURES_ENABLED=true` in your `.env`
- Restart the dev server after changing `.env`

### "APP_ENCRYPTION_KEY is not set" or "must be 32 bytes"

- Generate a new key: `openssl rand -base64 32`
- Copy the entire output to `APP_ENCRYPTION_KEY` in `.env`
- Make sure there are no extra spaces or line breaks

### "Invalid origin" (CSRF error)

- Make sure you're making requests from `http://localhost:3000`
- Check that `APP_URL=http://localhost:3000` in `.env`
- Include proper Origin header in API requests

### API Key Verification Fails

**OpenAI:**
- Verify the key starts with `sk-`
- Check the key has proper permissions
- Ensure you have credits/quota available

**Google Gemini:**
- Get key from https://aistudio.google.com/app/apikey
- Verify the key is enabled for Generative AI API

**Anthropic:**
- Get key from https://console.anthropic.com/
- Verify the key starts with `sk-ant-`
- Check you have credits available

### Rate Limit Issues

- Check `AI_RATE_LIMIT_PER_MIN_ORG` and `AI_RATE_LIMIT_PER_MIN_IP` in `.env`
- Wait for the rate limit window to reset (1 minute)
- Increase limits if needed for testing (not recommended for production)

### Database Issues

- Run `npx prisma migrate status` to check migrations
- Run `npx prisma generate` to regenerate client
- Check database connection with `npx prisma studio`
- Verify pgvector extension is enabled: `psql -d your_db -c "CREATE EXTENSION IF NOT EXISTS vector;"`

## 📊 Monitoring in Production

### Important Metrics to Track

1. **Generation Latency**
   - Monitor average latency per provider
   - Set alerts for latency > 5 seconds

2. **Error Rates**
   - Track error logs by error code
   - Alert on error rate > 5%

3. **Token Usage**
   - Monitor daily/monthly token consumption
   - Set budget alerts to avoid overages

4. **Rate Limiting**
   - Track 429 responses
   - Adjust limits if legitimate usage is blocked

5. **API Key Health**
   - Monitor last verification time
   - Alert if keys haven't been verified in 7+ days
   - Re-verify keys periodically

### Recommended Alerts

```
Alert: High AI Error Rate
Condition: error_count / total_requests > 0.05 (5%)
Action: Check provider API status, verify keys

Alert: High Latency
Condition: avg_latency > 5000ms for 5 minutes
Action: Check provider status, consider switching default model

Alert: Rate Limit Hit
Condition: 429 responses > 10 in 1 minute
Action: Review if limits should be increased for org

Alert: Token Budget
Condition: monthly_tokens > 80% of budget
Action: Notify admins, review usage patterns
```

## 🎯 Next Steps

1. **Add More Features**
   - Implement data purge/retention controls
   - Add support for image generation
   - Add support for embeddings
   - Implement usage-based billing

2. **Enhance UI**
   - Add charts for usage trends over time
   - Add cost estimates based on token usage
   - Add model comparison features
   - Add bulk operations for models

3. **Improve Developer Experience**
   - Create TypeScript SDK for the generate endpoint
   - Add webhooks for generation completion
   - Create example applications

4. **Production Hardening**
   - Implement Redis for distributed rate limiting
   - Add provider failover/fallback logic
   - Implement circuit breaker for failing providers
   - Add request queuing for high load

## 📚 Additional Resources

- **AI SDK v5 Documentation**: `.claude/skills/ai-sdk-v5/`
- **Plan & Specifications**: `notes/plan.md`
- **Wireframes**: `notes/wireframes.md`
- **Implementation Status**: `notes/implementation-status.md`
- **Project Guidelines**: `CLAUDE.md`
