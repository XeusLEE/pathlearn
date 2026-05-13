import type { Course } from "./types";

/**
 * Rich fallback course used when ANTHROPIC_API_KEY is not set, so the demo
 * always works end-to-end. Modeled on a "How Photosynthesis Works" doc and
 * exercises every question type the player supports.
 */
export const MOCK_COURSE: Course = {
  id: "mock-photosynthesis",
  documentTitle: "How Photosynthesis Works",
  summary:
    "A primer on how plants convert sunlight into chemical energy, the chloroplast machinery, and why it matters for the planet.",
  isDemoMode: true,
  createdAt: Date.now(),
  paths: [
    {
      id: "p1",
      title: "The Big Picture",
      description: "What photosynthesis is and why life depends on it.",
      themeColor: "#58cc02",
      iconEmoji: "🌱",
      episodes: [
        {
          id: "p1-e1",
          title: "What is photosynthesis?",
          description: "The headline definition.",
          iconEmoji: "☀️",
          difficulty: 1,
          questions: [
            {
              id: "p1-e1-q1",
              type: "multiple_choice",
              prompt: "Photosynthesis primarily converts sunlight into…",
              options: [
                "Mechanical energy",
                "Chemical energy stored in glucose",
                "Heat that warms the soil",
                "Electrical signals",
              ],
              correctIndex: 1,
              explanation:
                "Plants store solar energy as chemical bonds in glucose — the universal fuel for life.",
            },
            {
              id: "p1-e1-q2",
              type: "true_false",
              prompt: "Only plants can do photosynthesis.",
              correct: false,
              explanation:
                "Algae and many bacteria also photosynthesize — cyanobacteria invented it billions of years ago.",
            },
            {
              id: "p1-e1-q3",
              type: "fill_in_blank",
              prompt: "Photosynthesis takes in CO₂ and releases ___.",
              answer: "oxygen",
              alternates: ["O2", "o2", "Oxygen"],
              explanation:
                "Oxygen is a by-product of splitting water molecules in the light reactions.",
            },
          ],
        },
        {
          id: "p1-e2",
          title: "Why Earth needs it",
          description: "The atmospheric & food-chain payoff.",
          iconEmoji: "🌍",
          difficulty: 1,
          questions: [
            {
              id: "p1-e2-q1",
              type: "multiple_choice",
              prompt:
                "Roughly what fraction of Earth's atmospheric oxygen comes from photosynthetic organisms?",
              options: ["~10%", "~30%", "~70%", "Essentially all of it"],
              correctIndex: 3,
              explanation:
                "Free O₂ in our atmosphere is almost entirely a biological product.",
            },
            {
              id: "p1-e2-q2",
              type: "matching",
              prompt: "Match each role to what it does in the food chain.",
              pairs: [
                { left: "Producer", right: "Makes its own food via sunlight" },
                { left: "Consumer", right: "Eats producers or other consumers" },
                {
                  left: "Decomposer",
                  right: "Breaks down dead matter back to nutrients",
                },
              ],
              explanation:
                "Producers (plants/algae) anchor the chain by capturing energy from sunlight.",
            },
          ],
        },
        {
          id: "p1-e3",
          title: "The overall equation",
          description: "Inputs in, outputs out.",
          iconEmoji: "🧪",
          difficulty: 2,
          questions: [
            {
              id: "p1-e3-q1",
              type: "ordering",
              prompt:
                "Order the photosynthesis equation from inputs to outputs.",
              items: [
                "6 CO₂ + 6 H₂O",
                "+ light energy",
                "→ C₆H₁₂O₆",
                "+ 6 O₂",
              ],
              explanation:
                "Six carbon dioxide + six water + sunlight produces glucose plus six oxygen.",
            },
            {
              id: "p1-e3-q2",
              type: "fill_in_blank",
              prompt: "The sugar produced by photosynthesis is called ___.",
              answer: "glucose",
              alternates: ["Glucose", "C6H12O6"],
              explanation:
                "Glucose (C₆H₁₂O₆) is a 6-carbon sugar that fuels cellular respiration.",
            },
          ],
        },
      ],
    },
    {
      id: "p2",
      title: "Inside the Chloroplast",
      description: "Where the light reactions actually happen.",
      themeColor: "#1cb0f6",
      iconEmoji: "🔬",
      episodes: [
        {
          id: "p2-e1",
          title: "Anatomy of a chloroplast",
          description: "Key structures, plain language.",
          iconEmoji: "🧬",
          difficulty: 1,
          questions: [
            {
              id: "p2-e1-q1",
              type: "multiple_choice",
              prompt: "Where in the chloroplast does the Calvin cycle occur?",
              options: [
                "Thylakoid membrane",
                "Stroma",
                "Outer envelope",
                "Granum",
              ],
              correctIndex: 1,
              explanation:
                "The stroma — the fluid surrounding the thylakoids — hosts the carbon-fixing Calvin cycle.",
            },
            {
              id: "p2-e1-q2",
              type: "matching",
              prompt: "Match each part to its job.",
              pairs: [
                { left: "Thylakoid", right: "Captures light, makes ATP" },
                { left: "Stroma", right: "Site of the Calvin cycle" },
                { left: "Granum", right: "Stack of thylakoids" },
              ],
              explanation:
                "Light reactions live in the thylakoid; sugar-building lives in the stroma.",
            },
          ],
        },
        {
          id: "p2-e2",
          title: "Chlorophyll — the green pigment",
          description: "Why leaves are green.",
          iconEmoji: "🟢",
          difficulty: 2,
          questions: [
            {
              id: "p2-e2-q1",
              type: "true_false",
              prompt: "Chlorophyll absorbs green light most strongly.",
              correct: false,
              explanation:
                "It mostly absorbs red and blue and REFLECTS green — that's why leaves look green.",
            },
            {
              id: "p2-e2-q2",
              type: "fill_in_blank",
              prompt:
                "Chlorophyll molecules sit in the ___ membrane of the chloroplast.",
              answer: "thylakoid",
              alternates: ["Thylakoid"],
              explanation:
                "The thylakoid membrane is studded with light-harvesting complexes.",
            },
          ],
        },
      ],
    },
    {
      id: "p3",
      title: "Light & Dark Reactions",
      description: "How the two halves of photosynthesis hand off energy.",
      themeColor: "#ce82ff",
      iconEmoji: "⚡",
      episodes: [
        {
          id: "p3-e1",
          title: "Light reactions",
          description: "Splitting water, making ATP.",
          iconEmoji: "⚡",
          difficulty: 2,
          questions: [
            {
              id: "p3-e1-q1",
              type: "multiple_choice",
              prompt: "The light reactions produce which two energy carriers?",
              options: [
                "ATP and NADPH",
                "Glucose and water",
                "ADP and NADP⁺",
                "ATP and CO₂",
              ],
              correctIndex: 0,
              explanation:
                "ATP and NADPH are the chemical-energy currency that powers the Calvin cycle.",
            },
            {
              id: "p3-e1-q2",
              type: "ordering",
              prompt: "Put the light-reaction steps in order.",
              items: [
                "Photon hits PSII",
                "Water is split, releasing O₂",
                "Electrons travel down the chain",
                "ATP and NADPH are produced",
              ],
              explanation:
                "Photons excite electrons, water replenishes them, and the chain pumps protons to make ATP & NADPH.",
            },
          ],
        },
        {
          id: "p3-e2",
          title: "The Calvin Cycle",
          description: "Building sugar from CO₂.",
          iconEmoji: "🔄",
          difficulty: 3,
          questions: [
            {
              id: "p3-e2-q1",
              type: "fill_in_blank",
              prompt: "The enzyme that fixes CO₂ in the Calvin cycle is ___.",
              answer: "RuBisCO",
              alternates: ["rubisco", "Rubisco", "RUBISCO"],
              explanation:
                "RuBisCO is the most abundant enzyme on Earth and catalyzes carbon fixation.",
            },
            {
              id: "p3-e2-q2",
              type: "multiple_choice",
              prompt: "What does the Calvin cycle ultimately produce?",
              options: ["O₂", "G3P (sugar precursor)", "Water", "Chlorophyll"],
              correctIndex: 1,
              explanation:
                "G3P (glyceraldehyde-3-phosphate) is the 3-carbon sugar precursor that becomes glucose.",
            },
            {
              id: "p3-e2-q3",
              type: "true_false",
              prompt: "The Calvin cycle requires direct sunlight to run.",
              correct: false,
              explanation:
                "It needs ATP/NADPH from the light reactions — but the cycle itself is light-INDEPENDENT.",
            },
          ],
        },
      ],
    },
  ],
};
