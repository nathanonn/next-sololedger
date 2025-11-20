#!/usr/bin/env node

/**
 * SoloLedger MCP Server
 *
 * Enables AI assistants to interact with SoloLedger financial management API.
 *
 * Features:
 * - 47 comprehensive tools covering transactions, documents, and setup
 * - Intelligent bearer token caching with auto-refresh
 * - Full support for dual-currency transactions
 * - Document management with AI extraction
 * - Category, account, vendor, and client management
 * - P&L and financial reports
 *
 * Environment Variables:
 * - SOLOLEDGER_API_KEY: Your API key (slk_...)
 * - SOLOLEDGER_API_URL: Base URL (default: http://localhost:3000)
 * - SOLOLEDGER_ORG_SLUG: Organization slug
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "./config.js";
import { APIClient } from "./api-client.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerSetupTools } from "./tools/setup.js";

// ============================================================================
// Server Initialization
// ============================================================================

const config = loadConfig();
const client = new APIClient(config.apiUrl, config.orgSlug, config.apiKey);

const server = new Server(
  {
    name: "sololedger-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool Registration
// ============================================================================

// Store registered tools
const tools: Map<
  string,
  {
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
  }
> = new Map();

// Helper to register a tool
function registerTool(
  name: string,
  description: string,
  inputSchema: any,
  handler: (args: any) => Promise<any>
) {
  tools.set(name, { description, inputSchema, handler });
}

// Provide tool registration function to tool modules
const toolRegistrar = {
  tool: registerTool,
};

// Register all tool categories
registerTransactionTools(toolRegistrar, client);
registerDocumentTools(toolRegistrar, client);
registerSetupTools(toolRegistrar, client);

// ============================================================================
// MCP Protocol Handlers
// ============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsList = Array.from(tools.entries()).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: tool.inputSchema,
      required: Object.keys(tool.inputSchema).filter((key) => {
        const schema = tool.inputSchema[key];
        return !schema.isOptional && !schema._def?.defaultValue;
      }),
    },
  }));

  return { tools: toolsList };
});

// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = tools.get(toolName);

  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${toolName}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(request.params.arguments || {});
    return result;
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${toolName}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Server Startup
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup to stderr (stdout is used for MCP protocol)
  console.error("SoloLedger MCP Server started");
  console.error(`Organization: ${config.orgSlug}`);
  console.error(`API URL: ${config.apiUrl}`);
  console.error(`Tools registered: ${tools.size}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
