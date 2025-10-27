
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
}

export interface NavigationSection {
  title?: string;
  items: NavigationItem[];
}

export const sidebarNavigation: NavigationSection[] = [
  {
    items: [
      {
        id: 'profile',
        label: 'Profile',
        href: '/institution/profile',
        icon: 'ProfileIcon.svg'
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/institution/dashboard',
        icon: 'DashboardIcon.svg',
      },
    ],
  },
  {
    title: 'I am a issuer',
    items: [
      {
        id: 'issue-request',
        label: 'Issue Request',
        href: '/institution/issue-request',
        icon: 'IssueIcon.svg',
      },
      {
        id: 'schema',
        label: 'Schema',
        href: '/institution/schema',
        icon: 'SchemaIcon.svg'
      },
      {
        id: 'issued-by-me',
        label: 'Issued By Me',
        href: '/institution/issued-by-me',
        icon: 'IDCardIcon.svg',
      },
      {
        id: 'history',
        label: 'History',
        href: '/institution/history',
        icon: 'FolderIcon.svg',
      },
    ],
  },
  {
    title: 'I am a holder',
    items: [
      {
        id: 'my-credential',
        label: 'My Credential',
        href: '/institution/my-credential',
        icon: 'IDCardIcon.svg',
      },
      {
        id: 'my-request',
        label: 'My Request',
        href: '/institution/my-request',
        icon: 'FolderIcon.svg',
      },
    ],
  },
  {
    title: 'I am a verifier',
    items: [
      {
        id: 'shared-with-me',
        label: 'Shared With Me',
        href: '/institution/shared-with-me',
        icon: 'IDCardIcon.svg',
      },
      {
        id: 'verify-request',
        label: 'Verify Request',
        href: '/institution/verify-request',
        icon: 'FolderIcon.svg',
      },
    ],
  },
];
