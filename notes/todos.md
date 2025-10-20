# AI API keys and providers for organizations

Here outlined the documentations on how to implement AI features to app:

- @notes/skills/ai_features.md
- @notes/skills/ai_features_wireframes.md

I want to implement this into the app. However, instead of per-user API keys, I want to implement organization-wide API keys that can be managed by organization admins. The usage logs should also reflect organization-wide usage, only accessible to organization admins.

Super admin users should be able to manage API keys and view usage logs for all organizations. We want to add two new tabs in the organization settings page for managing AI API keys and viewing usage logs.

I want to redesign the @components/features/ai/ai-keys-management.tsx component. Table may not be suitable for this. Let's use a more user-friendly layout with tabs for each provider, and within each tab, provide sections for managing the API key and add models.

I also want to add a simple playground feature where organization admins can test the AI integration directly from the settings page. This playground should allow them to select a model (from the added models), input system prompt, user prompt, max outputs, and see the response directly on the page. This will help admins verify that their API keys and models are working correctly without needing to leave the app. Let's add a button at the bottom of each provider management section to open the playground modal. The playground modal should have fields for system prompt, user prompt, max outputs, and a submit button to get the AI response. Lay it out in 2 columns: input fields on the left and response display on the right. The response can be show the JSON response from the AI API. Make sure to handle the JSON formatting properly for better readability. Wrap long text and provide a copy button for convenience. Everything triggered from the playground should log the usage under the organization, so admins can see how their testing affects their usage stats.
