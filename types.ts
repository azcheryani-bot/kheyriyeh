
export interface Donation {
  id: string;
  event_id: string;
  donorName: string;
  fatherName?: string;
  mobile?: string;
  amount: number;
  description?: string;
  paymentType: 'pos' | 'cash' | 'card' | 'online' | 'card_cash' | 'mock' | 'transfer';
  hideName: boolean;
  status: 'pending' | 'approved';
  smsStatus?: 'pending' | 'sent' | 'failed' | 'rejected' | 'not_sent';
  smsError?: string;
  batchSmsId?: string;
  hasReceipt?: boolean;
  registeredBy?: string;
  createdAt?: string;
}

export interface Event {
  id: string;
  title: string;
  isactive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  created_at: string;
  hostUsername?: string;
  hostPassword?: string;
}

export interface HostSession {
  eventId: string;
  eventTitle: string;
  hostUsername: string;
}

export interface HostDonation {
  id: string;
  event_id: string;
  donorName: string;
  fatherName?: string;
  mobile?: string;
  description?: string;
  createdAt?: string;
}

export interface Admin {
  id: string;
  username: string;
  displayName?: string;
  password?: string;
  role: 'admin' | 'superadmin';
}

export interface DisplaySettings {
  fontSize: number;
  scrollSpeed: number;
  fontSizeHigh?: number;
  fontSizeMid?: number;
  fontSizeLow?: number;
  speedHigh?: number;
  speedMid?: number;
  speedLow?: number;
  highThreshold: number;
  midThreshold: number;
  fontHigh: string;
  fontMid: string;
  fontLow: string;
  customFontData?: string;
  deceasedImage?: string;
  bgImage?: string;
  announcementImage?: string;
  showAnnouncement: boolean;
  eventTitle: string;
  titleColor: string;
  titleSize: number;
  deceasedLabel: string;
  deceasedLabelColor: string;
  deceasedLabelSize: number;
  footerText: string;
  footerColor: string;
  footerSize: number;
  // Niazpardaz SMS config
  smsUser?: string;
  smsPass?: string;
  smsFrom?: string;
  smsDefaultText?: string;
  // File Output Config
  obsDirHandle?: any; // Storing the handle might not work well in DB, but we'll try to just handle it locally
  obsFileLow?: string;
  obsFileMid?: string;
  obsFileHigh?: string;
  obsSeparator?: string;
  obsCapLow?: number;
  obsCapMid?: number;
  obsCapHigh?: number;
  obsThresholdMid?: number;
  obsThresholdHigh?: number;
  obsFormat?: string;
  // Live Stream & GitHub Actions config
  githubToken?: string;
  githubRepo?: string;
  githubWorkflow?: string;
  streamTargetUrl?: string;
  streamWorkerUrl?: string;
  streamNeonUrl?: string;
  streamQuality?: string;
  streamFps?: number;
  streamDuration?: number;
}

export type ViewType = 'landing' | 'login' | 'admin' | 'display' | 'donor' | 'host_login' | 'host_panel';
