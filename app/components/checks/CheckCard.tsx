import { Shield, Key, Database } from "lucide-react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CheckCardProps {
  type: string;
  status: string;
  timestamp: string | "Now";
  isLoading?: boolean;
  fullScanId?: string;
  logs: {
    execution_logs: {
      message: string;
      timestamp: string;
      level?: string;
      data?: Record<string, unknown>;
    }[];
    summary: {
      total_items: number;
      items_with_issues: number;
      status: string;
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
}

export function getCheckIcon(checkType: string) {
  switch (checkType.toLowerCase()) {
    case "mfa":
      return <Key className="w-4 h-4 text-primary" />;
    case "rls":
      return <Shield className="w-4 h-4 text-primary" />;
    case "pitr":
      return <Database className="w-4 h-4 text-primary" />;
    default:
      return null;
  }
}

export function CheckCard({
  type,
  status,
  timestamp,
  logs,
  recommendations,
  isLoading,
  fullScanId,
}: CheckCardProps) {
  return (
    <AccordionItem
      value={`check-${type}`}
      className="border rounded-lg px-6 py-4 bg-card"
    >
      <AccordionTrigger className="flex items-center gap-4 !no-underline hover:no-underline">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            {getCheckIcon(type)}
            <span className="font-semibold text-base">
              {type.toUpperCase()} Check
            </span>
          </div>
          <span className="text-sm text-muted-foreground">{timestamp}</span>
          {fullScanId && (
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              Part of full scan n°{fullScanId}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isLoading
                  ? "bg-blue-500 animate-pulse"
                  : status === "success"
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-sm font-medium">
              {isLoading
                ? "Running"
                : status === "success"
                ? "Passed"
                : "Issues Found"}
            </span>
          </div>
        </div>
      </AccordionTrigger>

      {!isLoading && (
        <AccordionContent>
          <div className="mt-6 space-y-6">
            {recommendations ? (
              <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold mb-3">Recommendations</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {recommendations.suggestion}
                </p>
                {recommendations.affected_elements && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {type === "mfa"
                        ? "Users without MFA:"
                        : type === "rls"
                        ? "Tables without RLS:"
                        : "Projects without PITR:"}
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {recommendations.affected_elements.map((element, i) => (
                        <li key={i}>
                          {element.type === "user" && element.email}
                          {element.type === "table" && (
                            <span>
                              {element.table_name}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({element.project_name})
                              </span>
                            </span>
                          )}
                          {element.type === "project" && element.project_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendations.action_links && (
                  <div className="space-y-2">
                    {recommendations.action_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline block"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold mb-3">All Good!</h4>
                <p className="text-sm text-muted-foreground">
                  {type === "mfa"
                    ? "All users have MFA enabled."
                    : type === "rls"
                    ? "Row Level Security is properly configured on all tables."
                    : "Point-in-time recovery is enabled for all projects."}
                </p>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg">
              <h4 className="text-lg font-semibold mb-3">Execution Logs</h4>
              <div>
                <div className="space-y-2">
                  {logs.execution_logs.map((log, i) => (
                    <div
                      key={i}
                      className={`text-sm ${
                        log.level === "error"
                          ? "text-red-600"
                          : log.level === "warning"
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      } border-b border-gray-200 dark:border-gray-800 pb-2 mb-2`}
                    >
                      <span className="font-medium">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="ml-2">{log.message}</span>
                      {log.data && (
                        <pre className="mt-1 text-xs bg-black/[.05] dark:bg-white/[.06] p-2 rounded">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-black/[.05] dark:bg-white/[.06] rounded">
                  <h5 className="font-semibold mb-2">Summary</h5>
                  <div className="space-y-1 text-sm">
                    <p>Total Items: {logs.summary.total_items}</p>
                    <p>Items with Issues: {logs.summary.items_with_issues}</p>
                    <p>
                      Status:{" "}
                      <span
                        className={
                          logs.summary.status === "success"
                            ? "text-green-600"
                            : "text-yellow-600"
                        }
                      >
                        {logs.summary.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      )}
    </AccordionItem>
  );
}
