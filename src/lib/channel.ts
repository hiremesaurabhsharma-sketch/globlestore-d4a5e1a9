/**
 * Deterministic gradient for a channel avatar based on its name.
 * Keeps avatars distinct without any network fetch or subscriber metadata.
 */
const GRADIENTS = [
  "from-rose-500 to-orange-500",
  "from-indigo-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-red-500",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-emerald-500",
  "from-pink-500 to-rose-600",
];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function channelGradient(name: string): string {
  return GRADIENTS[hash(name) % GRADIENTS.length];
}

export function channelInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
