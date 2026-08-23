import { Container, ContainerProxy } from "@cloudflare/containers";

export { ContainerProxy };

type D1Method = "run" | "all" | "values" | "get";

type D1Request = {
  sql: string;
  params: unknown[];
  method: D1Method;
};

type OutboundEmail = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
};

function json(value: unknown, init?: ResponseInit): Response {
  return Response.json(value, init);
}

function parseMailbox(value: string): string | { email: string; name: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return value;
  return { name: match[1], email: match[2] };
}

async function handleD1(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.json<D1Request>();
  if (!body.sql || !Array.isArray(body.params)) {
    return new Response("Invalid D1 request", { status: 400 });
  }

  try {
    const statement = env.DB.prepare(body.sql).bind(...body.params);
    if (body.method === "run") {
      await statement.run();
      return json({ rows: [] });
    }

    const rows = await statement.raw();
    return json({ rows: body.method === "get" ? rows[0] : rows });
  } catch (error) {
    console.error(JSON.stringify({ event: "d1_query_error", error, sql: body.sql }));
    return new Response(error instanceof Error ? error.message : "D1 query failed", { status: 500 });
  }
}

async function handleEmail(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await request.json<OutboundEmail>();
    const result = await env.EMAIL.send({
      from: parseMailbox(body.from),
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      headers: body.headers,
    });
    return json({ messageId: result.messageId });
  } catch (error) {
    console.error(JSON.stringify({ event: "email_send_error", error }));
    return new Response(error instanceof Error ? error.message : "Email send failed", { status: 502 });
  }
}

export class AIHackrContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "30m";
  envVars = {
    NODE_ENV: "production",
    PORT: "8080",
    APP_URL: "https://aihackr.com",
  };

  override onStart(): void {
    console.log(JSON.stringify({ event: "container_started" }));
  }

  override onStop(): void {
    console.log(JSON.stringify({ event: "container_stopped" }));
  }

  override onError(error: unknown): void {
    console.error(JSON.stringify({ event: "container_error", error }));
  }
}

AIHackrContainer.outboundByHost = {
  "d1.internal": handleD1,
  "email.internal": handleEmail,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/__internal/")) {
      return new Response("Not Found", { status: 404 });
    }

    const app = env.AIHACKR.getByName("primary");
    return await app.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const app = env.AIHACKR.getByName("primary");
    ctx.waitUntil(
      app.fetch(new Request("http://container/__internal/cron", { method: "POST" })).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Background jobs failed: ${response.status} ${await response.text()}`);
        }
      }),
    );
  },
} satisfies ExportedHandler<Env>;
