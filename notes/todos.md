Help me test out the mcp server implementation.

The MCP server codebase is at @worktrees/feat_mcp_server/mcp-server.

The MCP server is already connected, but you still need to run the "npm run dev" to start the app so that the MCP server can communicate with it.

You can refer to the README.md in the mcp-server folder for more details on how to run and test the MCP server.

You can also find a few PDF files in @worktrees/feat_mcp_server/uploads folder that you can use to test the MCP server's document handling capabilities.

====

Can you test out this workflow?

1. upload the PDF (/home/pi/Dev/next-sololedger/worktrees/feat_mcp_server/uploads/Invoice-D4E6C4EB-0036.pdf) as a document using the MCP server.
2. Create a transaction using the MCP server with the uploaded document transaction details. Don't use the AI extraction feature for now. Manually fill in the transaction details.
3. Link the uploaded document to the created transaction using the MCP server.

You may need to run the "npm run dev" to start the app so that the MCP server can communicate with it.

The mcp configuration is at /home/pi/Dev/next-sololedger/worktrees/feat_mcp_server/.mcp.json

Please use the "build-insights-logger" skill to automatically log meaningful insights, discoveries, and decisions during coding session.

====

I want to upgrade the transaction import to the advanced mode, where we allow to import via zipped file. In the advanced mode, we allow to import via zipped file.

Here's an example of how the zipped file will structured:

```
/zip-file/
    /OpenAI
        /DHUENf-0011.pdf
        /DHUENf-0012.pdf
    /Google
        /239413.pdf
        /239414.pdf
    /transactions.csv
```

The transactions.csv file will have the following structure:

```
"date","amount","currency","description","category","account","type","vendor","client","notes","tags","secondaryAmount","secondaryCurrency","document"
"2025-10-30","150.00","MYR","OpenAI API usage for project X","Software & Subscriptions","MBB","EXPENSE","OpenAI",,"Monthly API usage for project X","api;software",,,"OpenAI/DHUENf-0011.pdf"
"2025-10-25","96.00","MYR","ChatGPT Plus subscription renewal","Software & Subscriptions","MBB","EXPENSE","OpenAI",,"Annual renewal for ChatGPT Plus","subscription;software",20,USD,"OpenAI/DHUENf-0012.pdf"
"2025-10-22","75.00","MYR","Google Ads campaign for product launch","Marketing","MBB","EXPENSE","Google",,"Initial ad spend for new product launch","ads;marketing",,,"Google/239413.pdf"
"2025-10-02","200.00","MYR","Google Workspace subscription renewal","Software & Subscriptions","MBB","EXPENSE","Google",,"Annual renewal for Google Workspace","subscription;software",,,"Google/239414.pdf"
```

When importing the system should auto upload the documents from the zipped file based on the paths specified in the "document" column of the CSV file. Each transaction added will be linked to its corresponding document.
