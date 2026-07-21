import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addTrackedChannel,
  backfillDurations,
  cleanupBlockedVideos,
  importChannelHistory,
  listTrackedChannels,
  pruneUntrackedVideos,
  setChannelActive,
  syncAllChannelsFn,
} from "@/lib/youtube-sync.functions";
import { syncFeedToR2Fn } from "@/lib/r2-sync.functions";


export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — Spark" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const TOKEN_KEY = "pt_admin_token";

const SEED_CHANNELS = [
  "@parmarssc",
  "@ABHINAYMATHS",
  "@sscabhinaymaths",
  "@sscwallahpw",
  "@rankersgurukullive",
  "@gaganpratapmaths",
  "@RBERevolutionByEducation",
  "@KD_LIVE",
  "@e1coachingcenter",
  "@SSCAdda247",
  "@Testbook",
];

function AdminPage() {
  const [token, setToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [newHandle, setNewHandle] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listTrackedChannels);
  const addFn = useServerFn(addTrackedChannel);
  const importFn = useServerFn(importChannelHistory);
  const syncFn = useServerFn(syncAllChannelsFn);
  const toggleFn = useServerFn(setChannelActive);
  const cleanupFn = useServerFn(cleanupBlockedVideos);
  const backfillFn = useServerFn(backfillDurations);
  const r2SyncFn = useServerFn(syncFeedToR2Fn);
  const pruneFn = useServerFn(pruneUntrackedVideos);



  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : "";
    if (stored) {
      setToken(stored);
      setTokenSaved(true);
    }
  }, []);

  function appendLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }

  async function refresh() {
    if (!token) return;
    try {
      const rows = await listFn({ data: { admin_token: token } });
      setChannels(rows as any[]);
    } catch (e: any) {
      appendLog(`Load failed: ${e.message}`);
    }
  }

  useEffect(() => {
    if (tokenSaved) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenSaved]);

  function saveToken() {
    localStorage.setItem(TOKEN_KEY, token);
    setTokenSaved(true);
    appendLog("Token saved locally");
  }

  async function handleAdd(handle: string) {
    if (!handle) return;
    setBusy(true);
    try {
      const res: any = await addFn({ data: { admin_token: token, handle } });
      appendLog(`Added: ${res.channel_name} (${res.channel_id})`);
      setNewHandle("");
      await refresh();
    } catch (e: any) {
      appendLog(`Add failed for ${handle}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(handle: string) {
    setBusy(true);
    appendLog(`Importing history for ${handle}...`);
    try {
      const res: any = await importFn({ data: { admin_token: token, handle } });
      appendLog(`${handle}: ${res.imported} new, ${res.skipped} already present`);
      await refresh();
    } catch (e: any) {
      appendLog(`Import failed for ${handle}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncAll() {
    setBusy(true);
    appendLog("Running sync for all channels...");
    try {
      const res: any = await syncFn({ data: { admin_token: token } });
      appendLog(
        `Synced ${res.channels} channels — ${res.new_videos} new videos${
          res.errors.length ? ` (errors: ${res.errors.length})` : ""
        }`
      );
      if (res.errors.length) res.errors.forEach((err: string) => appendLog(`  ! ${err}`));
      await refresh();
    } catch (e: any) {
      appendLog(`Sync failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCleanup() {
    if (!confirm("Scan all videos and delete non-embeddable / blocked ones? This uses YouTube API quota (~1 unit per 50 videos).")) return;
    setBusy(true);
    appendLog("Scanning for blocked / non-embeddable videos...");
    try {
      const res: any = await cleanupFn({ data: { admin_token: token } });
      appendLog(`Cleanup done — checked ${res.checked}, deleted ${res.deleted}`);
    } catch (e: any) {
      appendLog(`Cleanup failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleBackfillDurations() {
    setBusy(true);
    appendLog("Backfilling ALL missing durations (auto-loop)...");
    try {
      let totalUpdated = 0;
      let totalChecked = 0;
      // Loop until no more rows need updating (max 20 passes = 40k videos)
      for (let pass = 1; pass <= 20; pass++) {
        const res: any = await backfillFn({ data: { admin_token: token, limit: 2000 } });
        totalChecked += res.checked;
        totalUpdated += res.updated;
        appendLog(`  Pass ${pass}: checked ${res.checked}, updated ${res.updated}`);
        if (res.checked === 0) break;
      }
      appendLog(`✓ Done. Total checked: ${totalChecked}, updated: ${totalUpdated}`);
    } catch (e: any) {
      appendLog(`Backfill failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleR2Sync() {
    setBusy(true);
    appendLog("Uploading feed.json to Cloudflare R2...");
    try {
      const res: any = await r2SyncFn({ data: { admin_token: token } });
      appendLog(`✓ R2 sync done — ${res.videos} videos, ${(res.bytes / 1024).toFixed(1)} KB`);
      appendLog(`  Public: ${res.public_url}`);
    } catch (e: any) {
      appendLog(`R2 sync failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePruneUntracked() {
    if (!confirm(
      "Delete every video whose channel is NOT in your tracked list below?\n\nThis removes old JSON/GitHub imports and leftovers so only admin-managed channels remain.",
    )) return;
    setBusy(true);
    appendLog("Pruning untracked videos...");
    try {
      const res: any = await pruneFn({ data: { admin_token: token } });
      appendLog(`✓ Pruned — kept ${res.kept_channels} tracked channels, deleted ${res.deleted} videos`);
    } catch (e: any) {
      appendLog(`Prune failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }





  async function handleSeedAll() {
    setBusy(true);
    appendLog(`Seeding ${SEED_CHANNELS.length} channels...`);
    for (const h of SEED_CHANNELS) {
      try {
        const res: any = await addFn({ data: { admin_token: token, handle: h } });
        appendLog(`  ✓ ${res.channel_name}`);
      } catch (e: any) {
        appendLog(`  ✗ ${h}: ${e.message}`);
      }
    }
    await refresh();
    setBusy(false);
  }

  async function handleToggle(handle: string, next: boolean) {
    try {
      await toggleFn({ data: { admin_token: token, handle, is_active: next } });
      await refresh();
    } catch (e: any) {
      appendLog(`Toggle failed: ${e.message}`);
    }
  }

  if (!tokenSaved) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold mb-4">Admin Access</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your admin sync token to manage channels.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_SYNC_TOKEN"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={saveToken}
          disabled={!token}
          className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">YouTube Sync Admin</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAll}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Sync all now
          </button>
          <button
            onClick={handleCleanup}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            title="Remove videos that can't be embedded (creator disabled embed, region-blocked, deleted)"
          >
            Clean blocked videos
          </button>
          <button
            onClick={handlePruneUntracked}
            disabled={busy}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            title="Delete every video whose channel is NOT in the tracked list (removes old JSON/GitHub imports)"
          >
            Prune untracked
          </button>
          <button
            onClick={handleR2Sync}
            disabled={busy}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            title="Push latest feed to Cloudflare R2 (unlimited free egress)"
          >
            Sync to R2
          </button>
          <button
            onClick={handleBackfillDurations}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            title="Fetch missing video durations from YouTube (adds MM:SS overlay on thumbnails)"
          >
            Backfill durations
          </button>

          <button
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setTokenSaved(false);
              setToken("");
            }}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 mb-6">
        <h2 className="font-semibold mb-3">Add channel</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            placeholder="@channelhandle or YouTube URL"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => handleAdd(newHandle)}
            disabled={busy || !newHandle}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={handleSeedAll}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            Seed 11 default channels
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">Handle</th>
              <th className="text-left p-3 hidden md:table-cell">Last synced</th>
              <th className="text-left p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No channels yet. Click "Seed 11 default channels" to bootstrap.
                </td>
              </tr>
            )}
            {channels.map((c) => (
              <tr key={c.handle} className="border-t border-border">
                <td className="p-3 font-medium">{c.channel_name || "—"}</td>
                <td className="p-3 text-muted-foreground">{c.handle}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">
                  {c.last_synced_at
                    ? new Date(c.last_synced_at).toLocaleString()
                    : "never"}
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => handleToggle(c.handle, e.target.checked)}
                  />
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleImport(c.handle)}
                    disabled={busy}
                    className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
                  >
                    Import history
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-2">Activity log</h2>
        <div className="max-h-72 overflow-auto font-mono text-xs space-y-1">
          {log.length === 0 && <div className="text-muted-foreground">No activity yet.</div>}
          {log.map((line, i) => (
            <div key={i} className="text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
