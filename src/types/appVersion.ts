import { Timestamp } from "firebase/firestore";

export interface AppVersionConfig {
  deployedVersion: string;
  minimumVersion: string;
  forceRefresh: boolean;
  updateMessage: string;
  lastUpdated: string | Timestamp;
  updatedBy?: string;
}

export interface AppVersionResponse {
  version: string;
  minimumVersion: string;
  forceUpdate: boolean;
  message: string;
}
