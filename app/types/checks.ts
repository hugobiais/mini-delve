export interface Check {
  id: number;
  user_id: string;
  organization_id: number;
  check_type: string;
  status: string;
  logs: {
    execution_logs: {
      message: string;
      timestamp: string;
      level: string;
      data: Record<string, unknown>;
    }[];
    summary: {
      total_items: number;
      items_with_issues: number;
      status: string;
      details?: Record<string, unknown>;
    };
  };
  recommendations?: {
    suggestion: string;
    affected_elements: Array<
      | { type: "user"; email: string }
      | {
          type: "table";
          project_name: string;
          table_name: string;
          project_id: string;
        }
      | { type: "project"; project_name: string; project_id: string }
    >;
    action_links: Array<{
      url: string;
      label: string;
      project_name?: string;
    }>;
  };
  created_at: string;
  full_scan_id?: string;
}

export interface CheckHistoryProps {
  organizationId: number | null;
} 