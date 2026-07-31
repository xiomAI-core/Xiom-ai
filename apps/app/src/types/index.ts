// Re-export shared types + app-specific types
export * from '@xiom/types';

export interface DashboardStats {
  policiesEnforced: number;
  receiptsIssued: number;
  agentsGoverned: number;
  totalSpendUsdc: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}
