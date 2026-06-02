import { Bricolage_Grotesque, Fraunces } from "next/font/google";

export const publicBodyFont = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-body",
  display: "swap",
});

export const publicSerifFont = Fraunces({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800", "900"],
  style: ["italic"],
  variable: "--font-public-serif",
  display: "swap",
});
