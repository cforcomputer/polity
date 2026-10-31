export const CATEGORIES = [
  "Roads & Potholes",
  "Traffic Safety",
  "Public Transit",
  "Streetlights & Signals",
  "Water & Sewer",
  "Flooding & Drainage",
  "Sanitation & Dumping",
  "Parks & Trees",
  "Sidewalks & Accessibility",
  "Bike & Pedestrian",
  "Public Safety",
  "Housing & Homelessness",
  "Environment & Noise",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const REPORT_TYPES = ["complaint", "recommendation", "idea"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const STATUSES = ["new", "acknowledged", "in_progress", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export type Channel = "web" | "voice" | "chat" | "whatsapp" | "phone" | "imessage";

export interface IdDocument {
  type: string;
  nameOnId: string;
  expiry: string | null;
  method: "ai" | "sample";
  verifiedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  dob: string;
  city: string;
  role: "citizen" | "staff";
  verified: boolean;
  idDoc?: IdDocument;
  createdAt: string;
  demo?: boolean;
  /** Photon shared-line enrollment: the resident's handle, their agent number, and the thread once they text. */
  imessage?: { handle: string; agentNumber: string; spaceId?: string; agentUserId?: string };
}

export interface Report {
  id: string;
  userId: string | null;
  authorName: string;
  channel: Channel;
  text: string;
  type: ReportType;
  category: Category;
  title: string;
  severity: number; // 1-5
  priority: number; // 0-100
  priorityReason: string;
  department: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  clusterId: string;
  createdAt: string;
  aiMode: "claude" | "offline" | "seed";
  demo: boolean;
}

export interface ClusterUpdate {
  at: string;
  status: Status;
  note: string;
  by: string;
}

export interface StaffBrief {
  rootCause: string;
  impact: string;
  actions: string[];
  department: string;
  generatedAt: string;
  aiMode: "claude" | "offline";
}

export interface Cluster {
  id: string;
  title: string;
  summary: string;
  category: Category;
  type: ReportType;
  status: Status;
  priority: number;
  department: string;
  lat: number;
  lng: number;
  city: string;
  reportIds: string[];
  supporters: string[]; // user ids who pressed "me too"
  createdAt: string;
  updatedAt: string;
  updates: ClusterUpdate[];
  brief?: StaffBrief;
  demo: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  clusterId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface Settings {
  demoMode: boolean;
  simulation: boolean;
  simulationCursor: number;
}

export interface DB {
  users: User[];
  reports: Report[];
  clusters: Cluster[];
  notifications: Notification[];
  settings: Settings;
  photon?: { since: string; seen: string[] };
}

/** Claude's (or the offline classifier's) reading of a new report. */
export interface Analysis {
  type: ReportType;
  category: Category;
  title: string;
  summary: string;
  severity: number;
  priority: number;
  priorityReason: string;
  department: string;
  matchClusterId: string | null;
  matchReason: string;
  aiMode: "claude" | "offline";
}

export interface PublicReport extends Report {
  mine: boolean;
  cluster: {
    id: string;
    title: string;
    status: Status;
    count: number;
    priority: number;
  };
}

export interface PublicCluster extends Cluster {
  count: number;
  mine: boolean;
  supported: boolean;
}
