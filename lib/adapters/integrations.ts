import type { IntegrationSyncLog, IntegrationType, MinistryEvent } from "../types";
import { uid } from "../utils";

export interface IntegrationAdapter {
  type: IntegrationType;
  runStubAction(event: MinistryEvent): IntegrationSyncLog;
}

function makeStub(type: IntegrationType, action: string, message: string): IntegrationAdapter {
  return {
    type,
    runStubAction(event) {
      return {
        id: uid("sync"),
        integrationType: type,
        eventId: event.id,
        status: "stub_mode",
        details: {
          action,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  };
}

export const integrationAdapters: Record<IntegrationType, IntegrationAdapter> = {
  planning_center: makeStub("planning_center", "sync_event", "Planning Center sync simulated. No credentials used."),
  google_calendar: makeStub("google_calendar", "publish_event", "Google Calendar publish simulated. No external calendar updated."),
  google_drive: makeStub("google_drive", "create_folder", "Google Drive folder creation simulated. No external folder created."),
  propresenter: makeStub("propresenter", "create_playlist", "ProPresenter playlist creation simulated. No external playlist created.")
};
