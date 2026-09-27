/** 16px line icons, inline so there is no icon dependency to keep current. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconDashboard = () => (
  <svg {...base}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.6" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.6" />
  </svg>
);

export const IconMonths = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
    <path d="M7.5 13h3M13.5 13h3M7.5 17h3M13.5 17h3" />
  </svg>
);

export const IconClose = () => (
  <svg {...base}>
    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="m9 13 2 2 4-4" />
  </svg>
);

export const IconReturns = () => (
  <svg {...base}>
    <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5M8 13h8M8 17h5" />
  </svg>
);

/** A calendar split into quarters - the returns that are not filed monthly. */
export const IconPeriodic = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4M12 10v11M3 15.5h18" />
  </svg>
);

export const IconProducts = () => (
  <svg {...base}>
    <path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" />
    <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
  </svg>
);

export const IconUpload = () => (
  <svg {...base}>
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    <path d="M12 3v13M7 8l5-5 5 5" />
  </svg>
);

export const IconConfig = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const IconAudit = () => (
  <svg {...base}>
    <path d="M12 21a9 9 0 1 0-9-9" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </svg>
);

export const IconGuide = () => (
  <svg {...base}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z" />
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z" />
  </svg>
);

export const IconMenu = () => (
  <svg {...base} width={20} height={20}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconX = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconPortals = () => (
  <svg {...base}>
    <path d="M15 3h4a2 2 0 0 1 2 2v4" />
    <path d="M21 3l-9 9" />
    <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
  </svg>
);

export const IconStores = () => (
  <svg {...base}>
    <path d="M4 9.5 5.5 4h13L20 9.5" />
    <path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5" />
    <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
  </svg>
);

export const IconMarketplace = () => (
  <svg {...base}>
    <path d="M9 3h6v4.2a2 2 0 1 0 0 3.6V15h-4.2a2 2 0 1 0-3.6 0H3V9h4.2a2 2 0 1 1 3.6 0H9Z" transform="translate(3 3)" />
  </svg>
);
