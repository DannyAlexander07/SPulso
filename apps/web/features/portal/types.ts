export type PortalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  employeeCode: string | null;
  personalEmail: string | null;
  phoneMobile: string | null;
  address: string | null;
  jobTitle: string | null;
  area: string | null;
  hireDate: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  };
  areaRef: {
    id: string;
    name: string;
    slug: string;
  } | null;
  position: {
    id: string;
    name: string;
    slug: string;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    area: {
      id: string;
      name: string;
      slug: string;
    } | null;
    client: {
      id: string;
      name: string;
      slug: string;
    } | null;
    leader: {
      id: string;
      firstName: string;
      lastName: string;
      personalEmail: string | null;
      phoneMobile: string | null;
      jobTitle: string | null;
      position: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    personalEmail: string | null;
    phoneMobile: string | null;
    jobTitle: string | null;
    position: {
      id: string;
      name: string;
    } | null;
  } | null;
  clientAssignments: Array<{
    id: string;
    role: string | null;
    isPrimary: boolean;
    startsAt: string | null;
    endsAt: string | null;
    client: {
      id: string;
      name: string;
      slug: string;
    };
    area: {
      id: string;
      name: string;
      slug: string;
    } | null;
    team: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }>;
  user: {
    id: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type PortalProfile = {
  themePreference?: "light" | "dark" | "star";
  employee: PortalEmployee;
  attendance: Array<{
    id: string;
    workDate: string;
    checkIn: string | null;
    checkOut: string | null;
    status: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";
    source: string;
  }>;
  documents: Array<{
    id: string;
    type: "CONTRACT" | "PAYSLIP" | "POLICY" | "CERTIFICATE" | "OTHER";
      status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "EXPIRED";
      title: string;
      folder: string;
      visibleToEmployee: boolean;
      requiresSignature: boolean;
      fileUrl: string | null;
      fileName: string | null;
      mimeType: string | null;
      fileSize: number | null;
      issuedAt: string | null;
      expiresAt: string | null;
      signedAt: string | null;
      signedByName: string | null;
      signedByEmail: string | null;
      signatureText: string | null;
      signatureHash: string | null;
      createdAt: string;
      folderRef: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        requiresSignature: boolean;
      } | null;
  }>;
  requests: Array<{
    id: string;
    type: "VACATION" | "PERMISSION" | "REMOTE_WORK" | "MEDICAL_LEAVE" | "OTHER";
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    title: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    createdAt: string;
  }>;
  benefits: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    audienceScope: "ALL" | "COMPANIES" | "TEAMS";
    startsAt: string | null;
    endsAt: string | null;
    actionLabel: string | null;
    actionUrl: string | null;
    imageUrl: string | null;
    isHighlighted: boolean;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    message: string;
    imageUrl: string | null;
    priority: "NORMAL" | "IMPORTANT" | "URGENT";
    audienceScope: "ALL" | "COMPANIES" | "TEAMS";
    publishAt: string | null;
    expiresAt: string | null;
    isPinned: boolean;
    readAt: string | null;
  }>;
  teamMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    personalEmail: string | null;
    phoneMobile: string | null;
    jobTitle: string | null;
    position: {
      id: string;
      name: string;
    } | null;
    areaRef: {
      id: string;
      name: string;
    } | null;
    company: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  birthdays: Array<{
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    company: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  summary: {
    pendingRequests: number;
    documentsToSign: number;
    benefits: number;
    announcements: number;
    teamMembers: number;
  };
};
