I want to setup a MCP (model context protocol) server for this app so that I can use AI models to add/update/delete transactions, upload documents, etc.

The MCP server will be using the existing API endpoints to perform these actions.

I don't to rewrite the entire API layer just for MCP. Therefore, I'm thinking of creating a "Personal API Key" feature that user can use to create their own API keys.

The API key created this way will have the same permissions as the user that created it.

Therefore, I'm thinking of maybe we have an new endpoint that allow user to create the access token using the API key. Then, when the MCP server needs to call the API, it will first get the access token using the API key, then use that access token to call the API.

Read the codebase, and help me brainstorm what are the best approach to implement this so that it's secure and easy to use. Perferably, we don't have to rewrite too much of the existing code.

NO NEED TO CREATE THE MCP SERVER YET. I want to focus on making the app ready for MCP integration first.
