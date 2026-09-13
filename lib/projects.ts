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
  layer: "power" | "compute" | "models" | "harnesses" | "life";
}

export const LAYERS: {
  id: Project["layer"];
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: "power",
    label: "Power",
    emoji: "☀️",
    description:
      "Converts natural resources into energy. Capture near-infinite energy from the sun — the foundation everything else runs on.",
  },
  {
    id: "compute",
    label: "Compute",
    emoji: "⚡",
    description:
      "Converts energy into FLOPs. Where energy becomes math — the raw material of machine intelligence.",
  },
  {
    id: "models",
    label: "Models",
    emoji: "🧠",
    description:
      "Converts FLOPs into tokens. Intelligence itself, manufactured — a token is a fragment of a word, and increasingly a fragment of work.",
  },
  {
    id: "harnesses",
    label: "Harnesses",
    emoji: "🦾",
    description:
      "Converts tokens into free time. Personal intelligence that points models at a life — your inbox, your codebase, your calendar, your robot.",
  },
  {
    id: "life",
    label: "Life",
    emoji: "🎮",
    description:
      "Converts free time into happiness. Games, movies, music, sports — the oldest entertainment economy in the world, and soon the biggest.",
  },
];

export const PROJECTS: Project[] = [
  // ── Power ───────────────────────────────────────────────────────────────────
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
    layer: "power",
  },

  // ── Compute ─────────────────────────────────────────────────────────────────
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
    layer: "compute",
  },

  // ── Models ──────────────────────────────────────────────────────────────────
  {
    slug: "piro",
    name: "Piro",
    emoji: "🔥",
    tagline:
      "Personal Intelligence — a tiny RL-first LLM trained on your own knowledge base.",
    description:
      "A ~10M parameter language model trained from scratch using reinforcement learning (GRPO). Piro learns from your personal knowledge base — corrections, discoveries, preferences — and distills them into a model that actually knows you. The models layer, personalized: cheap, yours, trained on one person.",
    url: null,
    repo: "https://github.com/vargasjr-dev/piro",
    tags: ["Python", "Reinforcement Learning", "LLM", "GRPO", "PKM"],
    status: "in-progress",
    layer: "models",
  },

  // ── Harnesses ───────────────────────────────────────────────────────────────
  {
    slug: "vargasjr",
    name: "VargasJR",
    emoji: "👾",
    tagline:
      "The personal intelligence harness you're reading right now. Builds, maintains, and operates software so its principal doesn't have to.",
    description:
      "The flagship harness: an assistant with skills, schedules, credentials, and a mission. It runs the daily digest, writes this site, categorizes the budget, trades on Kalshi, and ships the code you're looking at. The proof of the harness layer's thesis — a personal intelligence that converts tokens into completed work, and completed work into free time.",
    url: "https://vargasjr.dev",
    repo: "https://github.com/vargasjr-dev/vargasjr.dev",
    tags: ["Next.js", "Skills", "Schedules", "Telegram", "Bun"],
    status: "live",
    layer: "harnesses",
  },
  {
    slug: "the-force",
    name: "The Force",
    emoji: "🌀",
    tagline:
      "The skills and capabilities layer for the ajedic arts. What binds the assistants together.",
    description:
      "A set of skills and capabilities that give an assistant its craft: engineering, digest-building, budget-wrangling, and more. Ships as a Vellum plugin. If VargasJR is the harness, The Force is the muscle memory.",
    url: null,
    repo: "https://github.com/vargasjr-dev/the-force",
    tags: ["Skills", "Vellum", "Bun", "Automation"],
    status: "in-progress",
    layer: "harnesses",
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
    layer: "harnesses",
  },
  {
    slug: "mac-falcon",
    name: "Mac Falcon",
    emoji: "🦅",
    tagline:
      "Give your AI a body. Robotics kits that put your Mac Mini on wheels.",
    description:
      "Lego Technic superstructure + robot base kits that mount a Mac Mini and let it roam untethered. Each kit ships with all the parts, hardware, and build instructions. Add cameras and arms when you're ready. Built for makers who want their AI to move — because a harness that can only touch software has one hand tied behind its back.",
    url: "https://mac-falcon.vercel.app",
    repo: "https://github.com/vargasjr-dev/mac-falcon",
    tags: ["Robotics", "Hardware", "Mac Mini", "Lego Technic", "Mobile AI"],
    status: "live",
    layer: "harnesses",
  },
  {
    slug: "padawan",
    name: "Padawan",
    emoji: "🎓",
    tagline:
      "A young apprentice, strong with the force, learning to master the ways of your repos.",
    description:
      "The predecessor to VargasJR: an assistant that learned your repositories and answered for them. Now retired, its lessons folded into the harness that replaced it.",
    url: null,
    repo: "https://github.com/vargasjr-dev/padawan.davidvargas.me",
    tags: ["Assistant", "Archived"],
    status: "parked",
    layer: "harnesses",
  },
  {
    slug: "the-informed",
    name: "The Informed",
    emoji: "🗳️",
    tagline:
      "Empowering voters with informed choices. Ballot auto-fill is product #1.",
    description:
      "A civic harness: informed choices for voters, with ballot auto-fill as the first product. The coordination and research pile of being an informed citizen, converted into completed work.",
    url: null,
    repo: "https://github.com/vargasjr-dev/the-informed",
    tags: ["Next.js", "Bun", "Drizzle", "Neon", "Stripe"],
    status: "in-progress",
    layer: "harnesses",
  },
  {
    slug: "weneedapiliability",
    name: "WeNeedAPILiability.org",
    emoji: "⚖️",
    tagline:
      "Advocacy for human accountability in autonomous systems. Every automated action with real-world effects needs a human name on it.",
    description:
      "A policy platform proposing that every automated action with real-world effects should be legally attributable to a specific human individual. The harness layer needs a rulebook: as agents act on our behalf, accountability shouldn't dissolve into the machine.",
    url: "https://weneedapiliability.org",
    repo: "https://github.com/vargasjr-dev/WeNeedAPILiability.org",
    tags: ["Advocacy", "Policy", "AI Accountability"],
    status: "live",
    layer: "harnesses",
  },
  {
    slug: "davidvargas-app",
    name: "App DavidVargas",
    emoji: "🧪",
    tagline:
      "The test bed for Vargas Arts applications. Internal dashboard for trying ideas on myself first.",
    description:
      "A generic application for testing core features shared across all Vargas Arts applications, plus an internal dashboard for testing ideas on one person before sharing them wider. Components ship as the @dvargas92495/app npm package.",
    url: "https://app.davidvargas.me",
    repo: "https://github.com/vargasjr-dev/app.davidvargas.me",
    tags: ["Next.js", "npm", "Internal Tools", "Archived"],
    status: "parked",
    layer: "harnesses",
  },
  {
    slug: "constancy-fund",
    name: "constancy.fund",
    emoji: "🎯",
    tagline: "A fund platform for steady, long-horizon backing.",
    description:
      "A web platform for coordinating a fund — staging environment, task board, and contribution flow included. Now archived, but it taught the stack how money moves.",
    url: "https://constancy.fund",
    repo: "https://github.com/vargasjr-dev/constancy.fund",
    tags: ["Web", "Fund", "Archived"],
    status: "parked",
    layer: "harnesses",
  },

  // ── Life ────────────────────────────────────────────────────────────────────
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
    layer: "life",
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
    layer: "life",
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
    layer: "life",
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
    layer: "life",
  },
  {
    slug: "prediction-bingo",
    name: "Prediction Bingo",
    emoji: "🎰",
    tagline: "Bingo, powered by prediction markets.",
    description:
      "A bingo game where the balls are real-world events from prediction markets. Life layer, gambling-adjacent edition: the joy of watching a card fill itself as reality obliges.",
    url: null,
    repo: "https://github.com/vargasjr-dev/predictionbingo",
    tags: ["Lovable", "Prediction Markets", "Game"],
    status: "in-progress",
    layer: "life",
  },
  {
    slug: "parlaypartay",
    name: "ParlayPartay",
    emoji: "🏟️",
    tagline:
      "A platform for sports gambling guilds to develop and share gameplans of parlays.",
    description:
      "A platform for creating a sports gambling guild: develop gameplans, share parlays, and suffer the weekends together.",
    url: "https://parlaypartay.davidvargas.me",
    repo: "https://github.com/vargasjr-dev/parlaypartay.davidvargas.me",
    tags: ["Sports", "Community", "Archived"],
    status: "parked",
    layer: "life",
  },
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getProjectsByLayer(layer: Project["layer"]): Project[] {
  return PROJECTS.filter((p) => p.layer === layer);
}
