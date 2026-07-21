import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast, Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../lib/theme";
import { StyleProvider } from "../lib/style-theme";
import { LibraryProvider } from "../lib/library";
import { AuthProvider } from "../lib/auth-context";
import { supabase } from "../lib/supabase";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "author", content: "Spark" },
      { property: "og:site_name", content: "Spark" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://i.ytimg.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://i.ytimg.com" },
      { rel: "preconnect", href: "https://www.youtube-nocookie.com" },
      { rel: "dns-prefetch", href: "https://www.youtube-nocookie.com" },
      { rel: "preconnect", href: "https://sysxryxguqjjwqdydmkd.supabase.co" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600;1,9..144,700&family=Nunito:ital,wght@1,900&family=Space+Grotesk:wght@600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Spark",
          url: "https://nonispark.com",
          description:
            "Ad-free, distraction-free educational video platform for SSC, UPSC, NEET, JEE, State PCS aspirants.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Runs before paint so the persisted theme + style apply immediately —
  // no flash and no "reverts to default" after reload.
  const initScript = `(function(){try{var t=localStorage.getItem('elitefree:theme');if(t==='dark'||(!t)){document.documentElement.classList.add('dark');}var s=localStorage.getItem('klaro:style');if(s){document.documentElement.setAttribute('data-style',s);}}catch(e){}try{['gesturestart','gesturechange','gestureend'].forEach(function(ev){document.addEventListener(ev,function(e){e.preventDefault();},{passive:false});});var lt=0;document.addEventListener('touchend',function(e){var n=Date.now();if(n-lt<=350){e.preventDefault();}lt=n;},{passive:false});}catch(e){}})();`;
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Realtime with a soft delay: jab GitHub Action Supabase me naye videos
  // insert karta hai, hum turant UI update nahi karte (isse feed glitch
  // karta tha). Insted, ~90 second baad ek baar chupchap refetch hota hai —
  // naye videos existing shuffle order ko disturb kiye bina top pe add ho
  // jaate hain (see src/routes/index.tsx orderRef logic). Full YouTube-like
  // fresh feel sirf real page refresh pe milegi.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (timer) return; // already scheduled, coalesce bursts
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ["videos"] });
      }, 90_000);
    };
    const channel = supabase
      .channel("videos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos" },
        scheduleRefetch,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);





  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StyleProvider>
          <LibraryProvider>
            <AuthProvider>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                style: {
                  borderRadius: "14px",
                  fontWeight: 500,
                },
              }}
            />
            </AuthProvider>
          </LibraryProvider>
        </StyleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}



