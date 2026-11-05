export type AuditFindings = {
  domain?: string;
  pageSpeedMobile?: number;
  lcpSeconds?: number;
  hasMetaPixel?: boolean;
  hasGa4?: boolean;
  hasGtm?: boolean;
  https?: boolean;
  securityHeaders?: { hsts?: boolean; csp?: boolean; xFrameOptions?: boolean };
  techStack?: string[];
  metaDescriptionPresent?: boolean;
  mobileViewport?: boolean;
};

export type Dossier = {
  summary?: string;
  discoveryQuestions?: string[];
  talkingPoints?: string[];
};

export type ThreadMessage = {
  id: string;
  direction: "out" | "in";
  kind: "SEQUENCE" | "REPLY" | "AI_REPLY";
  step: number | null;
  subject: string;
  body: string;
  at: string;
  sentiment?: string | null;
  needsHuman?: boolean;
};

export type MeetingRow = {
  id: string;
  leadId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  meetLink: string | null;
  calendarEventUrl: string | null;
  status: string;
  estimatedTicket: number;
  notes: string;
  prospectName: string;
  email: string;
  role: string;
  phone: string | null;
  linkedinUrl: string | null;
  company: string;
  website: string | null;
  revenue: number;
  country: string;
  region: string;
  industry: string;
  painPoint: string | null;
  painPointDetail: string | null;
  service: string | null;
  score: number;
  audit: AuditFindings | null;
  dossier: Dossier | null;
  thread: ThreadMessage[];
};

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  emailStatus: string;
  phone: string | null;
  role: string;
  company: string;
  website: string | null;
  country: string;
  region: string;
  industry: string;
  revenue: number;
  painPoint: string | null;
  painPointDetail: string | null;
  service: string | null;
  score: number;
  ticket: number;
  stage: string;
  currentStep: number;
  paused: boolean;
  sentiment: string | null;
  needsHuman: boolean;
  hasMeeting: boolean;
  createdAt: string;
};

export type SequenceLead = {
  id: string;
  name: string;
  company: string;
  role: string;
  region: string;
  stage: string;
  paused: boolean;
  sentiment: string | null;
  steps: { step: number; subject: string; body: string; status: string; sentAt: string | null; scheduledAt: string | null; opens: number; clicks: number; replied: boolean }[];
};

/** One prospect in one Smartlead campaign, as the Inbox lists it. */
export type InboxConversation = {
  key: string;
  campaignId: string;
  campaignName: string;
  email: string;
  name: string;
  company: string | null;
  dbLeadId: string | null;
  subject: string;
  stepsSent: number;
  lastSentAt: string | null;
  repliedAt: string | null;
  lastActivity: string | null;
  bounced: boolean;
  unsubscribed: boolean;
  category: string | null;
  sentiment: string | null;
  needsHuman: boolean;
  stage: string | null;
};

export type InboxMessage = {
  type: "SENT" | "REPLY";
  /** SEQUENCE = Smartlead sequence email, PROSPECT = their reply, AI = our AI answer, TEAM = written in the Inbox. */
  kind: "SEQUENCE" | "PROSPECT" | "AI" | "TEAM";
  from: string;
  to: string;
  time: string;
  subject: string | null;
  /** Clean text for the chat view. */
  text: string;
  /** Original email HTML (empty for messages we only have as text). */
  html: string;
  quoteHtml: string;
  step: number | null;
  messageId?: string | null;
};
