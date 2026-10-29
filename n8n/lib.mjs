// Tiny helpers to author n8n workflow JSON programmatically (import-ready) + a validator.
import { randomUUID } from "node:crypto";

export const uid = () => randomUUID();

/** Fixed credential id so the workflow and `n8n/credentials/*.json` (CLI/API import) always line up. */
export const PG_CRED_ID = "fenebrisPostgres01";
export const PG_CRED_NAME = "Fenebris Postgres";

export class Workflow {
  constructor(name, { timezone = "Asia/Kolkata", tags = ["Fenebris"] } = {}) {
    this.name = name;
    this.nodes = [];
    this.connections = {};
    this.settings = { executionOrder: "v1", timezone, saveManualExecutions: true };
    this.tags = tags;
  }

  /** Add a node. `pos` is [col,row] on a 260x170 grid. */
  add(name, type, typeVersion, pos, parameters = {}, extra = {}) {
    if (this.nodes.some((n) => n.name === name)) throw new Error(`Duplicate node name: ${name}`);
    const node = {
      parameters,
      id: uid(),
      name,
      type,
      typeVersion,
      position: [pos[0] * 260, pos[1] * 170],
      ...extra,
    };
    this.nodes.push(node);
    return name;
  }

  /** connect(from, to, outputIndex=0, inputIndex=0). */
  connect(from, to, output = 0, input = 0) {
    this.connections[from] ??= { main: [] };
    const main = this.connections[from].main;
    while (main.length <= output) main.push([]);
    main[output].push({ node: to, type: "main", index: input });
  }

  chain(...names) {
    for (let i = 0; i < names.length - 1; i++) this.connect(names[i], names[i + 1]);
  }

  toJSON() {
    return {
      name: this.name,
      nodes: this.nodes,
      connections: this.connections,
      active: false,
      settings: this.settings,
      pinData: {},
      meta: { templateCredsSetupCompleted: false },
      tags: this.tags.map((t) => ({ name: t })),
    };
  }

  validate() {
    const names = new Set(this.nodes.map((n) => n.name));
    const errors = [];
    for (const [from, v] of Object.entries(this.connections)) {
      if (!names.has(from)) errors.push(`connection from unknown node "${from}"`);
      for (const outs of v.main) for (const c of outs) if (!names.has(c.node)) errors.push(`"${from}" -> unknown node "${c.node}"`);
    }
    // every non-trigger node must have an inbound connection
    const inbound = new Set(Object.values(this.connections).flatMap((v) => v.main.flat().map((c) => c.node)));
    for (const n of this.nodes) {
      if (n.type.endsWith("stickyNote")) continue;
      const isTrigger = /webhook$|scheduleTrigger$/i.test(n.type) && !/respondToWebhook/i.test(n.type);
      if (!isTrigger && !inbound.has(n.name)) errors.push(`orphan node "${n.name}"`);
    }
    // JS syntax check for Code nodes
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    for (const n of this.nodes.filter((x) => x.type === "n8n-nodes-base.code")) {
      try {
        new AsyncFunction("$input", "$", "$env", "$json", "$items", "$node", "$now", "$itemIndex", "require", "items", n.parameters.jsCode);
      } catch (e) {
        errors.push(`Code node "${n.name}" syntax error: ${e.message}`);
      }
    }
    return errors;
  }
}

/**
 * Merge several Workflow objects into ONE workflow (stacked vertically, one lane per part).
 * Colliding node names are suffixed with the part label (never referenced from expressions - checked by build).
 */
export function mergeWorkflows(name, parts, { gapRows = 3 } = {}) {
  const merged = new Workflow(name);
  const used = new Set();
  let yCursor = 0;
  for (const { wf, label, banner } of parts) {
    const ys = wf.nodes.map((n) => n.position[1]);
    const shift = yCursor - Math.min(...ys);
    const rename = new Map();
    for (const n of wf.nodes) {
      let nn = n.name;
      if (used.has(nn)) nn = `${n.name} [${label}]`;
      if (used.has(nn)) throw new Error(`Cannot de-duplicate node name: ${nn}`);
      used.add(nn);
      rename.set(n.name, nn);
      merged.nodes.push({ ...n, name: nn, position: [n.position[0], n.position[1] + shift] });
    }
    for (const [from, v] of Object.entries(wf.connections)) {
      merged.connections[rename.get(from)] = {
        main: v.main.map((outs) => outs.map((c) => ({ ...c, node: rename.get(c.node) }))),
      };
    }
    if (banner) {
      const bn = `Lane: ${label}`;
      used.add(bn);
      merged.nodes.push({
        parameters: { content: banner, width: 1400, height: 110, color: 4 },
        id: uid(),
        name: bn,
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-260, yCursor - 200],
      });
    }
    yCursor = Math.max(...wf.nodes.map((n) => n.position[1])) + shift + gapRows * 170 + 340;
  }
  return merged;
}

/* ───────────── node factories ───────────── */

export const headerParams = (obj) => ({
  sendHeaders: true,
  headerParameters: { parameters: Object.entries(obj).map(([name, value]) => ({ name, value })) },
});

export const queryParams = (obj) => ({
  sendQuery: true,
  queryParameters: { parameters: Object.entries(obj).map(([name, value]) => ({ name, value })) },
});

export function http(w, name, pos, { method = "POST", url, headers, query, json, timeout = 30000, batching, text, onError = "continueRegularOutput", fullResponse } = {}) {
  const params = { method, url, ...(headers ? headerParams(headers) : {}), ...(query ? queryParams(query) : {}) };
  if (json !== undefined) Object.assign(params, { sendBody: true, specifyBody: "json", jsonBody: json });
  params.options = { timeout };
  if (batching) params.options.batching = { batch: { batchSize: batching[0], batchInterval: batching[1] } };
  if (text || fullResponse) params.options.response = { response: { fullResponse: true, neverError: true, ...(text ? { responseFormat: "text" } : {}) } };
  params.options.redirect = { redirect: { followRedirects: true, maxRedirects: 5 } };
  return w.add(name, "n8n-nodes-base.httpRequest", 4.2, pos, params, onError ? { onError } : {});
}

export function code(w, name, pos, jsCode, { each = false } = {}) {
  return w.add(name, "n8n-nodes-base.code", 2, pos, { ...(each ? { mode: "runOnceForEachItem" } : {}), jsCode: jsCode.trim() + "\n" });
}

const cond = (leftValue, operator, rightValue = "") => ({
  id: uid(),
  leftValue,
  rightValue,
  operator,
});
export const OP = {
  isTrue: { type: "boolean", operation: "true", singleValue: true },
  strEquals: { type: "string", operation: "equals" },
  notEmpty: { type: "string", operation: "notEmpty", singleValue: true },
};

export function ifNode(w, name, pos, leftValue, op = OP.isTrue, rightValue = "") {
  return w.add(name, "n8n-nodes-base.if", 2.2, pos, {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
      conditions: [cond(leftValue, op, rightValue)],
      combinator: "and",
    },
    options: {},
  });
}

export function switchNode(w, name, pos, leftValue, outputs) {
  return w.add(name, "n8n-nodes-base.switch", 3.2, pos, {
    rules: {
      values: outputs.map(([key, value]) => ({
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
          conditions: [cond(leftValue, OP.strEquals, value)],
          combinator: "and",
        },
        renameOutput: true,
        outputKey: key,
      })),
    },
    options: {},
  });
}

export function webhook(w, name, pos, path, { respond = "responseNode", method = "POST" } = {}) {
  return w.add(
    name,
    "n8n-nodes-base.webhook",
    2,
    pos,
    { httpMethod: method, path, responseMode: respond, options: {} },
    { webhookId: uid() },
  );
}

/**
 * The Google Calendar node only accepts a calendar id that looks like an email, never "primary".
 * This asks Google for the primary calendar's real id with the attached OAuth credential, so no config value can be wrong.
 */
export function googleCalendarIdNode(w, name, pos) {
  return w.add(
    name,
    "n8n-nodes-base.httpRequest",
    4.2,
    pos,
    {
      method: "GET",
      url: "https://www.googleapis.com/calendar/v3/calendars/primary",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "googleCalendarOAuth2Api",
      options: { timeout: 20000 },
    },
    { credentials: { googleCalendarOAuth2Api: { id: "y5FL0LJTf7OK7BZo", name: "Google Calendar account" } }, onError: "continueRegularOutput", executeOnce: true },
  );
}

/** Calendar field value: an explicit email from config when set, else the id fetched by `googleCalendarIdNode(nodeName)`. */
export const calExpr = (nodeName) => ({
  __rl: true,
  mode: "id",
  value: `={{ ($env.GOOGLE_CALENDAR_ID && String($env.GOOGLE_CALENDAR_ID).includes('@')) ? $env.GOOGLE_CALENDAR_ID : $('${nodeName}').first().json.id }}`,
});

/** Responds with an HTML page taken from `$json.page`. */
export function respondHtml(w, name, pos) {
  return w.add(name, "n8n-nodes-base.respondToWebhook", 1.1, pos, {
    respondWith: "text",
    responseBody: "={{ $json.page }}",
    options: { responseCode: 200, responseHeaders: { entries: [{ name: "Content-Type", value: "text/html; charset=utf-8" }] } },
  });
}

export function respond(w, name, pos, code = 200, body = '{"ok": true}') {
  return w.add(name, "n8n-nodes-base.respondToWebhook", 1.1, pos, {
    respondWith: "json",
    responseBody: body,
    options: { responseCode: code },
  });
}

export function postgres(w, name, pos, query, replacement, { alwaysOutput = false, once = false } = {}) {
  return w.add(
    name,
    "n8n-nodes-base.postgres",
    2.5,
    pos,
    { operation: "executeQuery", query, options: replacement ? { queryReplacement: replacement } : {} },
    {
      credentials: { postgres: { id: PG_CRED_ID, name: PG_CRED_NAME } },
      ...(alwaysOutput ? { alwaysOutputData: true } : {}),
      ...(once ? { executeOnce: true } : {}),
    },
  );
}

export function noop(w, name, pos) {
  return w.add(name, "n8n-nodes-base.noOp", 1, pos, {});
}

export function sticky(w, content, pos, size = [520, 260], color = 5) {
  return w.add(`Note ${w.nodes.length + 1}`, "n8n-nodes-base.stickyNote", 1, pos, { content, width: size[0], height: size[1], color });
}

export const DASH = {
  url: "={{ $env.DASHBOARD_URL }}/api/webhooks/n8n",
  headers: { "x-fenebris-secret": "={{ $env.DASHBOARD_WEBHOOK_SECRET }}", "content-type": "application/json" },
};

export const dashboardNotify = (w, name, pos, jsonExpr) =>
  http(w, name, pos, { url: DASH.url, headers: DASH.headers, json: jsonExpr, timeout: 10000 });

/** Smartlead authenticates with ?api_key=, not a bearer header. */
export const smartleadUrl = (path) =>
  `=https://server.smartlead.ai/api/v1${path}${path.includes("?") ? "&" : "?"}api_key={{ $env.SMARTLEAD_API_KEY }}`;
