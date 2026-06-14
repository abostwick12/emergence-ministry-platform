import type { CategoryTheme } from "@/lib/games/types";

export const defaultCategoryTheme: CategoryTheme = {
  icon: "Sparkles",
  accentStyle: "mixed",
  accentColor: "#2563eb",
  transitionAnimation: "fade",
  introEnabled: true,
  introTitle: "",
  introSubtitle: "Get ready for the next round"
};

const themePresets: Record<string, CategoryTheme> = {
  summer: {
    icon: "Sun",
    accentStyle: "sunny",
    accentColor: "#f59e0b",
    backgroundGraphic: "sun-beach",
    transitionAnimation: "slide",
    introEnabled: true,
    introSubtitle: "Bright, fast, and made for camp energy"
  },
  "ice cream": {
    icon: "IceCreamBowl",
    accentStyle: "dessert",
    accentColor: "#ec4899",
    backgroundGraphic: "dessert-scoop",
    transitionAnimation: "zoom",
    introEnabled: true,
    introSubtitle: "Sweet answers, cold pressure"
  },
  "frozen treats": {
    icon: "IceCreamBowl",
    accentStyle: "dessert",
    accentColor: "#06b6d4",
    backgroundGraphic: "dessert-scoop",
    transitionAnimation: "zoom",
    introEnabled: true,
    introSubtitle: "Keep cool and choose carefully"
  },
  "ice cream and desserts": {
    icon: "IceCreamBowl",
    accentStyle: "dessert",
    accentColor: "#ec4899",
    backgroundGraphic: "dessert-scoop",
    transitionAnimation: "zoom",
    introEnabled: true,
    introSubtitle: "Sweet answers, cold pressure"
  },
  animals: {
    icon: "PawPrint",
    accentStyle: "wildlife",
    accentColor: "#15803d",
    backgroundGraphic: "wildlife",
    transitionAnimation: "fade",
    introEnabled: true,
    introSubtitle: "Tracks, wings, teeth, and surprise facts"
  },
  bible: {
    icon: "BookOpen",
    accentStyle: "manuscript",
    accentColor: "#8b5e34",
    backgroundGraphic: "manuscript",
    transitionAnimation: "fade",
    introEnabled: true,
    introSubtitle: "Scripture, stories, and people of faith"
  },
  "random knowledge": {
    icon: "Shuffle",
    accentStyle: "mixed",
    accentColor: "#7c3aed",
    backgroundGraphic: "mixed-shapes",
    transitionAnimation: "slide",
    introEnabled: true,
    introSubtitle: "Anything can happen in this round"
  }
};

export function themeForCategory(name: string): CategoryTheme {
  const preset = themePresets[name.trim().toLowerCase()];
  return {
    ...defaultCategoryTheme,
    ...preset,
    introTitle: name
  };
}
