import type { Metadata } from "next";

import { HackathonPublicDemo } from "@/components/hackathon-public-demo";

export const metadata: Metadata = {
  title: "Lead Emergence - Scripture in New Frontiers Demo",
  description:
    "Public hackathon demo for a Scripture-native student discipleship workflow using YouVersion, Journey Journal, leader review, and Slack delivery."
};

export default function HackathonPage() {
  return <HackathonPublicDemo />;
}
