Help me test out the mcp server implementation.

The MCP server codebase is at @worktrees/feat_mcp_server/mcp-server.

The MCP server is already connected, but you still need to run the "npm run dev" to start the app so that the MCP server can communicate with it.

You can refer to the README.md in the mcp-server folder for more details on how to run and test the MCP server.

You can also find a few PDF files in @worktrees/feat_mcp_server/uploads folder that you can use to test the MCP server's document handling capabilities.

====

Can you test out this workflow?

1. upload the PDF (/home/pi/Dev/next-sololedger/worktrees/feat_mcp_server/uploads/Invoice-1B4CA695-0012.pdf) as a document using the MCP server.
2. Create a transaction using the MCP server with the uploaded document transaction details. Don't use the AI extraction feature for now. Manually fill in the transaction details.
3. Link the uploaded document to the created transaction using the MCP server.

You may need to run the "npm run dev" to start the app so that the MCP server can communicate with it.

The mcp configuration is at /home/pi/Dev/next-sololedger/worktrees/feat_mcp_server/.mcp.json

Please use the "build-insights-logger" skill to automatically log meaningful insights, discoveries, and decisions during coding session.
