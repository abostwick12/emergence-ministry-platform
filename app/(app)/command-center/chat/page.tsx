import { SageChatPanel } from "@/components/command-center/sage-chat-panel";
import { getSageAvailability } from "@/lib/command-center/sage";

export default function CommandCenterChatPage() {
  const availability = getSageAvailability();

  return (
    <div className="grid workspace-page">
      <SageChatPanel available={availability.available} model={availability.model} />
    </div>
  );
}
