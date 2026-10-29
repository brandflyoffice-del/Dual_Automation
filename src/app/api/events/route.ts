import { bus, type LiveEvent } from "@/lib/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: LiveEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      bus.on("event", send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 25000);
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      cleanup = () => {
        bus.off("event", send);
        clearInterval(ping);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
