import type { Metadata } from "next";

import { HackathonPublicDemo } from "@/components/hackathon-public-demo";

export const metadata: Metadata = {
  title: "Lead Emergence - Scripture in New Frontiers Demo",
  description:
    "Public hackathon demo for a Scripture-native ministry operating system using YouVersion, Gloo AI Studio, Meridian, Journey Journal, and leader review."
};

export default function HackathonPage() {
  return <HackathonPublicDemo />;
}
