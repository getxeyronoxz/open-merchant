#!/usr/bin/env node
/**
 * A sample Open Merchant connector — a real MCP server, no dependencies.
 *
 * A connector is not a plugin API and not a JavaScript module this app loads.
 * It is a local process that speaks MCP over stdio and answers one tool call.
 * That is the whole contract, and this file is deliberately the smallest
 * honest example of it: no SDK, no dependencies, nothing to install. Copy this
 * folder into the app's `plugins` directory and it runs.
 *
 * What it does NOT do matters as much as what it does. It returns *drafts*.
 * It never writes to a project, has no filesystem access, and the app records
 * the raw response hash so a draft can be traced back to exactly this output.
 * Accepting a draft is a separate, human act on the Draft Desk.
 *
 * Protocol: newline-delimited JSON-RPC 2.0, which is what MCP stdio is.
 */

// The versions this server answers. Echoing back the client's own request is
// what the specification asks for; refusing an unknown one loudly is better
// than silently agreeing to speak something else.
const SUPPORTED = ["2025-11-25", "2025-03-26"];
const LATEST = SUPPORTED[0];

const SERVER_INFO = { name: "sample-market", version: "1.0.0" };

/**
 * The one tool. `input` carries the seller's one-line query from the Plugins
 * screen, so a real connector could search with it; this one is a fixed,
 * obviously-fake listing set, because a sample that invents live market prices
 * would be worse than one that invents nothing.
 */
const TOOL = {
  name: "fetch_prices",
  description: "Return example competitor listings as drafts for a seller to review.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "What to look for." } },
    required: ["query"],
  },
};

function listings(query) {
  const label = String(query ?? "").trim() || "example listing";
  return [
    {
      id: "C-901",
      product: `${label} — Model A`,
      brand: "Sample Brand",
      price: "749.00",
      currency: "INR",
      marketplace: "Example Marketplace",
      url: "https://example.com/listings/model-a",
      notes: "Sample data from the sample connector. Not a real listing.",
    },
    {
      id: "C-902",
      product: `${label} — Model B`,
      brand: "Sample Brand",
      price: "899.00",
      currency: "INR",
      marketplace: "Example Marketplace",
      url: "https://example.com/listings/model-b",
      notes: "Sample data from the sample connector. Not a real listing.",
    },
  ];
}

function result(query) {
  const now = new Date().toISOString();
  const url = String(query ?? "").trim() || "example";
  return {
    // Evidence: what the seller observed, with the query recorded so the draft
    // says where it came from without pretending an AI read a page.
    evidence: [
      {
        id: "S-901",
        url: `https://example.com/search?q=${encodeURIComponent(url)}`,
        title: `Sample results for "${url}"`,
        notes: "Collected by the sample connector. Sample data, not a real page.",
        observations: [],
        observedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    competitors: listings(query),
  };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  const { id, method, params } = message;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      const protocolVersion = SUPPORTED.includes(asked) ? asked : LATEST;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    }
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: [TOOL] } };
    case "tools/call": {
      if (params?.name !== TOOL.name) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool: ${String(params?.name)}` },
        };
      }
      const structuredContent = result(params?.arguments?.query);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(structuredContent) }],
          structuredContent,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    default:
      // A notification carries no id and must never be answered.
      if (id === undefined || id === null) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${String(method)}` },
      };
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    newline = buffer.indexOf("\n");
    if (line === "") continue;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      send({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      continue;
    }
    let response;
    try {
      response = handle(request);
    } catch (error) {
      response = {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
      };
    }
    if (response !== null) send(response);
  }
});

// A connector holds stdio open for the app to talk to; exiting on stdin end is
// the only normal way this process ends.
process.stdin.on("end", () => process.exit(0));
