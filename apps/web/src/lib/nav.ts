// Adapted from cosscom/coss apps/site/src/lib/nav.ts (AGPL-3.0); see NOTICE.md.
import {
  BanIcon,
  CalendarCheckIcon,
  CalendarIcon,
  GlobeIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  ShieldIcon,
  ShipIcon,
  VideoIcon,
  WebhookIcon,
} from 'lucide-react';

/*
 * The header's "Products" menu: coss.com's products, as coss.com's own header lists them. The
 * desktop mega menu and the mobile drawer both render these lists. qnot is not served from
 * coss.com yet, so every coss.com product is an absolute link to it (a plain `<a>`); qnot itself
 * is this site.
 */

/** coss.com, the site qnot is a section of. */
export const COSS_URL = 'https://coss.com';

/** The element the mega menu's panels hang from: the page's sheet, flush under the header. */
export const HEADER_BAR_ID = 'site-header-bar';
/**
 * The shell the panels render into (not `<body>`): inside its stacking context, so the shell's
 * rails and corner marks stay drawn over an open panel.
 */
export const SITE_SHELL_ID = 'site-shell';
/**
 * The docs sidebar's width (coss ui's default). On docs pages the header's wordmark cell takes it
 * too, so the hairline after the wordmark continues the sidebar's edge.
 */
export const DOCS_SIDEBAR_WIDTH = '16rem';

export interface MenuLink {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  badge?: 'New';
  /** On coss.com (another site from here): a plain link rather than `next/link`. */
  external?: boolean;
}

export interface MenuColumn {
  title: string;
  links: readonly MenuLink[];
}

const coss = (path: string) => `${COSS_URL}${path}`;

export const PRODUCT_COLUMNS: readonly MenuColumn[] = [
  {
    title: 'Communication',
    links: [
      { label: 'Email', description: 'Transactional email from your own domains.', icon: MailIcon, href: coss('/#email'), external: true },
      { label: 'SMS', description: 'Text messages worldwide.', icon: MessageSquareIcon, href: coss('/#sms'), external: true },
      { label: 'Video', description: 'Rooms and recordings.', icon: VideoIcon, href: coss('/#video'), external: true },
    ],
  },
  {
    title: 'Scheduling',
    links: [
      { label: 'Scheduling', description: 'Availability and bookings.', icon: CalendarCheckIcon, href: coss('/#scheduling'), external: true },
      { label: 'kloq', description: 'A React calendar component.', icon: CalendarIcon, href: coss('/kloq'), badge: 'New', external: true },
    ],
  },
  {
    title: 'Developer tools',
    links: [
      { label: 'coss.com ui', description: 'React components built on Base UI.', icon: LayoutDashboardIcon, href: coss('/ui'), external: true },
      { label: 'Shipyard', description: 'Coding agents on your own dev boxes.', icon: ShipIcon, href: coss('/shipyard'), badge: 'New', external: true },
      { label: 'qnot', description: 'A typed query builder for every framework.', icon: ListFilterIcon, href: '/', badge: 'New' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Webhooks', description: 'Signed events, retried.', icon: WebhookIcon, href: coss('/docs/webhooks'), external: true },
      { label: 'Logs and drains', description: 'Every request and event.', icon: HistoryIcon, href: coss('/docs/logs'), external: true },
      { label: 'Domains', description: 'Verified sending domains.', icon: GlobeIcon, href: coss('/docs/email/domains'), external: true },
      { label: 'Suppressions', description: 'Bounces and opt-outs.', icon: BanIcon, href: coss('/docs/email/suppressions'), external: true },
      { label: 'Audit log', description: 'Who changed what.', icon: ShieldIcon, href: coss('/docs/audit-log'), external: true },
    ],
  },
];
