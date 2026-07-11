export interface Project {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  url: string | null;
  repo: string | null;
  tags: string[];
  status: "live" | "in-progress" | "parked";
  tier: "energy" | "intelligence" | "games";
}

export const TIERS: {
  id: Project["tier"];
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: "energy",
    label: "Energy",
    emoji: "☀️",
    description:
      "Capture near-infinite energy from the sun — the foundation everything else runs on.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    emoji: "🧠",
    description:
      "Personal intelligence for all — AI that knows you, runs on your hardware, answers to you.",
  },
  {
    id: "games",
    label: "Fun & Games",
    emoji: "🎮",
    description:
      "Free us from life's insecurities in favor of fun and games — the point of it all.",
  },
];

export const PROJECTS: Project[] = [
  // ── Energy ──────────────────────────────────────────────────────────────────
  {
    slug: "infinite-vibes",
    name: "Infinite Vibes",
    emoji: "☀️",
    tagline:
      "Engineering roadmap for orbital ring and Dyson sphere construction. Real math, real materials.",
    description:
      "A 10-step interactive engineering roadmap from first orbital ring to full Dyson sphere. Each step includes technical specifications, material requirements, and physics simulations. Built with real aerospace engineering constraints — Zylon tethers, electromagnetic launchers, and bootstrap growth curves.",
    url: "https://infinitevibes.solar",
    repo: "https://github.com/vargasjr-dev/infinitevibes.solar",
    tags: ["Next.js", "Engineering", "Physics Simulation", "Space Tech"],
    status: "live",
    tier: "energy",
  },

  {
    slug: "durium",
    name: "durium",
    emoji: "⬡",
    tagline:
      "Space-native AI inference chip. Designed from first principles for orbital compute — trade FLOPS for lifetime.",
    description:
      "The first AI inference chip designed for orbit, not Earth. Every accelerator in space today was built for a data center — when it dies, it stays dead. durium makes the tradeoffs that are wrong for Earth but right for space: triple mode redundancy, no HBM, deliberate 5–7nm node selection, and chiplet graceful degradation with hot spares. The result: 10× better annual chip mortality, satellite life extended from 5 to 10–12 years, and the 18× orbital compute cost gap collapsed. Combined with eat-the-sun's launch economics, orbital compute crosses below terrestrial a decade ahead of any existing model.",
    url: "https://durium.vercel.app",
    repo: "https://github.com/vargasjr-dev/durium",
    tags: [
      "Silicon",
      "Space Tech",
      "AI Inference",
      "RHBD",
      "Chiplet",
      "Next.js",
    ],
    status: "in-progress",
    tier: "energy",
  },

  // ── Intelligence ─────────────────────────────────────────────────────────────
  {
    slug: "piro",
    name: "Piro",
    emoji: "🔥",
    tagline:
      "Personal Intelligence — a tiny RL-first LLM trained on your own knowledge base.",
    description:
      "A ~10M parameter language model trained from scratch using reinforcement learning (GRPO). Piro learns from your personal knowledge base — corrections, discoveries, preferences — and distills them into a model that actually knows you. The intelligence layer of the thesis: personalized, cheap, yours.",
    url: null,
    repo: "https://github.com/vargasjr-dev/piro",
    tags: ["Python", "Reinforcement Learning", "LLM", "GRPO", "PKM"],
    status: "in-progress",
    tier: "intelligence",
  },
  {
    slug: "personal-os",
    name: "PersonalOS",
    emoji: "🏠",
    tagline:
      "An assistant-native operating system written in Rust. VargasJR's future home.",
    description:
      "A bare-metal x86_64 operating system built from scratch in Rust. Features VGA text output, keyboard input, and an LLM abstraction layer. The long-term vision: an OS where the AI assistant is a first-class citizen at the kernel level, not an app running on top.",
    url: null,
    repo: "https://github.com/vargasjr-dev/personal-os",
    tags: ["Rust", "OS Dev", "x86_64", "QEMU", "bare-metal"],
    status: "in-progress",
    tier: "intelligence",
  },

  {
    slug: "mac-falcon",
    name: "Mac Falcon",
    emoji: "🦅",
    tagline:
      "Give your AI a body. Robotics kits that put your Mac Mini on wheels.",
    description:
      "Lego Technic superstructure + robot base kits that mount a Mac Mini and let it roam untethered. Each kit ships with all the parts, hardware, and build instructions. Add cameras and arms when you're ready. Built for makers who want their AI to move.",
    url: "https://mac-falcon.vercel.app",
    repo: "https://github.com/vargasjr-dev/mac-falcon",
    tags: ["Robotics", "Hardware", "Mac Mini", "Lego Technic", "Mobile AI"],
    status: "live",
    tier: "intelligence",
  },

  // ── Fun & Games ──────────────────────────────────────────────────────────────
  {
    slug: "vellymon",
    name: "Vellymon",
    emoji: "🐉",
    tagline:
      "Monster collection game with simultaneous-turn combat, team building, and three win conditions.",
    description:
      "A 1v1 tactical RPG where both players act simultaneously. Build a roster of 8 vellymons, field 4 on an 8×5 grid, and win by elimination, occupation, or energy accumulation. Features a market with 64 unique vellymons, real-time WebSocket matches, and a full game engine with server-authoritative turn resolution.",
    url: "https://vellymon.game",
    repo: "https://github.com/vargasjr-dev/vellymon.game",
    tags: ["Next.js", "WebSocket", "Drizzle", "better-auth", "Vercel"],
    status: "live",
    tier: "games",
  },
  {
    slug: "squad-party",
    name: "Squad Party",
    emoji: "🎉",
    tagline:
      "Party game platform with AI-generated mini-games. Create, play, and share with friends.",
    description:
      "A party game platform where AI generates unique mini-games on the fly using Lua scripting. Host sessions, invite friends, and play through rounds of AI-crafted challenges. Currently rebuilding from Expo to native Swift (iOS) and Next.js (web).",
    url: "https://squad-party.vercel.app",
    repo: "https://github.com/vargasjr-dev/Squad-Party",
    tags: ["Next.js", "Swift", "AI", "Lua", "WebSocket"],
    status: "in-progress",
    tier: "games",
  },
  {
    slug: "codenaimes",
    name: "Codenaimes",
    emoji: "🕵️",
    tagline:
      "Online multiplayer word game inspired by Codenames. Real-time play with friends.",
    description:
      "A real-time multiplayer implementation of the classic word-guessing party game. Create rooms, invite friends, and play with live updates. Supports spymasters, operatives, and spectators with full game state sync.",
    url: "https://codenaimes.vercel.app",
    repo: "https://github.com/vargasjr-dev/codenaimes",
    tags: ["Next.js", "Multiplayer", "Real-time", "Vercel"],
    status: "live",
    tier: "games",
  },
  {
    slug: "aivalon",
    name: "Aivalon",
    emoji: "🏰",
    tagline:
      "AI-powered Avalon — the social deduction game with intelligent AI opponents.",
    description:
      "A digital implementation of Avalon (The Resistance) with AI players that use game theory and deduction. Play with friends or fill seats with AI opponents that bluff, deduce, and vote strategically.",
    url: null,
    repo: "https://github.com/vargasjr-dev/aivalon",
    tags: ["Next.js", "AI", "Game Theory", "Social Deduction"],
    status: "in-progress",
    tier: "games",
  },
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getProjectsByTier(tier: Project["tier"]): Project[] {
  return PROJECTS.filter((p) => p.tier === tier);
}
