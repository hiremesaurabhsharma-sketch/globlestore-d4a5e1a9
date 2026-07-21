import { createFileRoute } from "@tanstack/react-router";

// Publishable Supabase creds are safe to ship to the browser, but we keep them
// in server env so the values live in one place. This tiny public endpoint
// hands them to the client at boot so the auth client can be constructed.
export const Route = createFileRoute("/api/public/auth-config")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.USERS_SUPABASE_URL;
        const publishableKey = process.env.USERS_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !publishableKey) {
          return new Response(
            JSON.stringify({ error: "Auth not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        return Response.json(
          { url, publishableKey },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
