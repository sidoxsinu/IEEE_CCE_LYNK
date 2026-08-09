// ── Participants (imported by admin from CSV) ──
export interface Participant {
  id?: string;
  name: string;
  email: string;
  department: string;
  paperTitle: string;
  interest?: string;
  clueText: string;
  uniqueCode: string; // 6-char alphanumeric, printed on badges
  claimedByUid: string | null;
  connectionsMadeCount: number;
  createdAt: string;
}

// Public-safe subset visible to non-admin users
export interface ParticipantPublic {
  id: string;
  clueText: string;
  department: string;
  connectionsMadeCount: number;
  claimedByUid: string | null;
  name?: string; // Only visible after connection is verified
}

// ── Users (created on first login) ──
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string;
  participantId: string; // linked to their participants doc
  role: "user" | "admin";
  createdAt: string;
}

// ── Connections ──
export interface Connection {
  id?: string;
  fromUid: string;
  toParticipantId: string;
  factLearned: string;
  selfieBase64: string; 
  status: "pending" | "verified";
  submittedCode: string;
  createdAt: string;
  verifiedAt: string | null;
}

// ── Event Config (singleton) ──
export interface EventConfig {
  id: string;
  admins: string[];
  eventActive: boolean;
  leaderboardVisible: boolean;
  totalParticipants: number;
}
