import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Playlist = {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
};

export type PlaylistMap = Record<string, Omit<Playlist, "id">>;

type LibraryState = {
  liked: string[];
  playlists: PlaylistMap;
  subscriptions: string[];
};

type LibraryContextValue = {
  liked: string[];
  subscriptions: string[];
  playlists: Playlist[]; // ordered array for UI
  playlistsMap: PlaylistMap;
  hydrated: boolean;
  isLiked: (videoId: string) => boolean;
  toggleLike: (videoId: string) => void;
  getPlaylist: (playlistId: string) => Playlist | undefined;
  createPlaylist: (name: string, initialVideoId?: string) => Playlist;
  addVideoToPlaylist: (playlistId: string, videoId: string) => void;
  removeVideoFromPlaylist: (playlistId: string, videoId: string) => void;
  togglePlaylistVideo: (playlistId: string, videoId: string) => void;
  playlistHasVideo: (playlistId: string, videoId: string) => boolean;
  deletePlaylist: (playlistId: string) => void;
  isSubscribed: (channelName: string) => boolean;
  toggleSubscription: (channelName: string) => void;
};

const STORAGE_KEY = "elitefree:library:v2";
const LEGACY_KEY = "elitefree:library:v1";
const LibraryContext = createContext<LibraryContextValue | null>(null);

function makeId() {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readInitial(): LibraryState {
  const empty: LibraryState = { liked: [], playlists: {}, subscriptions: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LibraryState>;
      const playlists =
        parsed.playlists && typeof parsed.playlists === "object" && !Array.isArray(parsed.playlists)
          ? (parsed.playlists as PlaylistMap)
          : {};
      return {
        liked: Array.isArray(parsed.liked) ? parsed.liked : [],
        playlists,
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      };
    }
    // Migrate v1 (array of playlists) → v2 (record)
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as {
        liked?: string[];
        subscriptions?: string[];
        playlists?: Array<{ id: string; name: string; videoIds: string[]; createdAt: number }>;
      };
      const playlists: PlaylistMap = {};
      (parsed.playlists ?? []).forEach((p) => {
        if (p && p.id) {
          playlists[p.id] = {
            name: p.name ?? "Untitled playlist",
            videoIds: Array.isArray(p.videoIds) ? p.videoIds : [],
            createdAt: p.createdAt ?? Date.now(),
          };
        }
      });
      return {
        liked: Array.isArray(parsed.liked) ? parsed.liked : [],
        playlists,
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      };
    }
    return empty;
  } catch {
    return empty;
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>({ liked: [], playlists: {}, subscriptions: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readInitial());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota / privacy errors
    }
  }, [state, hydrated]);

  const isLiked = useCallback((videoId: string) => state.liked.includes(videoId), [state.liked]);

  const toggleLike = useCallback((videoId: string) => {
    setState((prev) => ({
      ...prev,
      liked: prev.liked.includes(videoId)
        ? prev.liked.filter((id) => id !== videoId)
        : [videoId, ...prev.liked],
    }));
  }, []);

  const createPlaylist = useCallback((name: string, initialVideoId?: string): Playlist => {
    const id = makeId();
    const entry = {
      name: name.trim() || "Untitled playlist",
      videoIds: initialVideoId ? [initialVideoId] : [],
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      playlists: { ...prev.playlists, [id]: entry },
    }));
    return { id, ...entry };
  }, []);

  const addVideoToPlaylist = useCallback((playlistId: string, videoId: string) => {
    setState((prev) => {
      const pl = prev.playlists[playlistId];
      if (!pl || pl.videoIds.includes(videoId)) return prev;
      return {
        ...prev,
        playlists: {
          ...prev.playlists,
          [playlistId]: { ...pl, videoIds: [...pl.videoIds, videoId] },
        },
      };
    });
  }, []);

  const removeVideoFromPlaylist = useCallback((playlistId: string, videoId: string) => {
    setState((prev) => {
      const pl = prev.playlists[playlistId];
      if (!pl) return prev;
      return {
        ...prev,
        playlists: {
          ...prev.playlists,
          [playlistId]: { ...pl, videoIds: pl.videoIds.filter((id) => id !== videoId) },
        },
      };
    });
  }, []);

  const togglePlaylistVideo = useCallback((playlistId: string, videoId: string) => {
    setState((prev) => {
      const pl = prev.playlists[playlistId];
      if (!pl) return prev;
      const has = pl.videoIds.includes(videoId);
      return {
        ...prev,
        playlists: {
          ...prev.playlists,
          [playlistId]: {
            ...pl,
            videoIds: has ? pl.videoIds.filter((id) => id !== videoId) : [...pl.videoIds, videoId],
          },
        },
      };
    });
  }, []);

  const playlistHasVideo = useCallback(
    (playlistId: string, videoId: string) => !!state.playlists[playlistId]?.videoIds.includes(videoId),
    [state.playlists],
  );

  const deletePlaylist = useCallback((playlistId: string) => {
    setState((prev) => {
      if (!(playlistId in prev.playlists)) return prev;
      const next = { ...prev.playlists };
      delete next[playlistId];
      return { ...prev, playlists: next };
    });
  }, []);

  const isSubscribed = useCallback(
    (channelName: string) => state.subscriptions.includes(channelName),
    [state.subscriptions],
  );

  const toggleSubscription = useCallback((channelName: string) => {
    setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.includes(channelName)
        ? prev.subscriptions.filter((c) => c !== channelName)
        : [channelName, ...prev.subscriptions],
    }));
  }, []);

  const orderedPlaylists = useMemo<Playlist[]>(
    () =>
      Object.entries(state.playlists)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.playlists],
  );

  const getPlaylist = useCallback(
    (playlistId: string): Playlist | undefined => {
      const p = state.playlists[playlistId];
      return p ? { id: playlistId, ...p } : undefined;
    },
    [state.playlists],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      liked: state.liked,
      subscriptions: state.subscriptions,
      playlists: orderedPlaylists,
      playlistsMap: state.playlists,
      hydrated,
      isLiked,
      toggleLike,
      getPlaylist,
      createPlaylist,
      addVideoToPlaylist,
      removeVideoFromPlaylist,
      togglePlaylistVideo,
      playlistHasVideo,
      deletePlaylist,
      isSubscribed,
      toggleSubscription,
    }),
    [
      state.liked,
      state.subscriptions,
      state.playlists,
      orderedPlaylists,
      hydrated,
      isLiked,
      toggleLike,
      getPlaylist,
      createPlaylist,
      addVideoToPlaylist,
      removeVideoFromPlaylist,
      togglePlaylistVideo,
      playlistHasVideo,
      deletePlaylist,
      isSubscribed,
      toggleSubscription,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
