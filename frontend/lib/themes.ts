export interface Theme {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  colors: {
    primary: string;
    primaryHover: string;
    sidebarBg: string;
    accent: string;
    accentHover: string;
    badge: string;
    textOnDark: string;
  };
  emoji: string;
  flag: string; // Flag emoji or SVG
  greeting: string; // Special greeting text
  decorations: {
    type: "tricolor" | "diyas" | "snow" | "fireworks" | "colors" | "none";
    colors: string[];
  };
}

export const themes: Theme[] = [
  {
    id: "independence-day",
    name: "Independence Day",
    startMonth: 7,
    startDay: 14,
    endMonth: 7,
    endDay: 16,
    colors: {
      primary: "#FF9933",
      primaryHover: "#E88A2E",
      sidebarBg: "#1A1A2E",
      accent: "#138808",
      accentHover: "#0F6B06",
      badge: "#FF9933",
      textOnDark: "#FFFFFF",
    },
    emoji: "🇮🇳",
    flag: "🇮🇳",
    greeting: "Happy Independence Day! 🇮🇳",
    decorations: {
      type: "tricolor",
      colors: ["#FF9933", "#FFFFFF", "#138808"],
    },
  },
  {
    id: "republic-day",
    name: "Republic Day",
    startMonth: 0,
    startDay: 25,
    endMonth: 0,
    endDay: 27,
    colors: {
      primary: "#FF9933",
      primaryHover: "#E88A2E",
      sidebarBg: "#0D1B2A",
      accent: "#1B5E20",
      accentHover: "#144A18",
      badge: "#138808",
      textOnDark: "#FFFFFF",
    },
    emoji: "🇮🇳",
    flag: "🇮🇳",
    greeting: "Happy Republic Day! 🇮🇳",
    decorations: {
      type: "tricolor",
      colors: ["#FF9933", "#FFFFFF", "#138808"],
    },
  },
  {
    id: "diwali",
    name: "Diwali",
    startMonth: 9,
    startDay: 20,
    endMonth: 10,
    endDay: 15,
    colors: {
      primary: "#D97706",
      primaryHover: "#B85C05",
      sidebarBg: "#1A1200",
      accent: "#F59E0B",
      accentHover: "#D97706",
      badge: "#F59E0B",
      textOnDark: "#FFFFFF",
    },
    emoji: "🪔",
    flag: "🪔",
    greeting: "Happy Diwali! 🪔✨",
    decorations: {
      type: "diyas",
      colors: ["#F59E0B", "#FBBF24", "#D97706"],
    },
  },
  {
    id: "christmas",
    name: "Christmas",
    startMonth: 11,
    startDay: 23,
    endMonth: 11,
    endDay: 26,
    colors: {
      primary: "#DC2626",
      primaryHover: "#B91C1C",
      sidebarBg: "#0F1A0F",
      accent: "#16A34A",
      accentHover: "#15803D",
      badge: "#DC2626",
      textOnDark: "#FFFFFF",
    },
    emoji: "🎄",
    flag: "🎄",
    greeting: "Merry Christmas! 🎄",
    decorations: {
      type: "snow",
      colors: ["#FFFFFF", "#E5E7EB", "#F3F4F6"],
    },
  },
  {
    id: "new-year",
    name: "New Year",
    startMonth: 11,
    startDay: 30,
    endMonth: 0,
    endDay: 2,
    colors: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      sidebarBg: "#0F0F1A",
      accent: "#F59E0B",
      accentHover: "#D97706",
      badge: "#7C3AED",
      textOnDark: "#FFFFFF",
    },
    emoji: "🎉",
    flag: "🎉",
    greeting: "Happy New Year! 🎉",
    decorations: {
      type: "fireworks",
      colors: ["#7C3AED", "#F59E0B", "#EC4899", "#3B82F6"],
    },
  },
  {
    id: "holi",
    name: "Holi",
    startMonth: 2,
    startDay: 7,
    endMonth: 2,
    endDay: 10,
    colors: {
      primary: "#EC4899",
      primaryHover: "#DB2777",
      sidebarBg: "#1A0F1A",
      accent: "#8B5CF6",
      accentHover: "#7C3AED",
      badge: "#EC4899",
      textOnDark: "#FFFFFF",
    },
    emoji: "🎨",
    flag: "🎨",
    greeting: "Happy Holi! 🎨",
    decorations: {
      type: "colors",
      colors: ["#EC4899", "#F59E0B", "#8B5CF6", "#10B981", "#3B82F6"],
    },
  },
];

export const defaultTheme: Theme = {
  id: "default",
  name: "Default",
  startMonth: -1,
  startDay: -1,
  endMonth: -1,
  endDay: -1,
  colors: {
    primary: "#0A0A0A",
    primaryHover: "#262626",
    sidebarBg: "#FAFAFA",
    accent: "#0A0A0A",
    accentHover: "#262626",
    badge: "#0A0A0A",
    textOnDark: "#0A0A0A",
  },
  emoji: "⚡",
  flag: "⚡",
  greeting: "",
  decorations: {
    type: "none",
    colors: [],
  },
};

export function getCurrentTheme(): Theme {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  for (const theme of themes) {
    const { startMonth, startDay, endMonth, endDay } = theme;
    if (startMonth > endMonth) {
      if (
        (currentMonth === startMonth && currentDay >= startDay) ||
        (currentMonth === endMonth && currentDay <= endDay) ||
        currentMonth > startMonth ||
        currentMonth < endMonth
      ) {
        return theme;
      }
    } else {
      if (
        (currentMonth === startMonth && currentDay >= startDay) ||
        (currentMonth === endMonth && currentDay <= endDay) ||
        (currentMonth > startMonth && currentMonth < endMonth)
      ) {
        return theme;
      }
    }
  }
  return defaultTheme;
}
