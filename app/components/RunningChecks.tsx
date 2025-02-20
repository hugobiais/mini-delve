"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Database, Loader2, ScanLine } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { CheckCard } from "./checks/CheckCard";

interface Check {
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
      details: Record<string, unknown>;
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

interface RunningChecksProps {
  selectedOrg: { id: string; supabase_org_id: string } | null;
}

export function RunningChecks({ selectedOrg }: RunningChecksProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [checkData, setCheckData] = useState<Check | null>(null);
  const [fullScanResults, setFullScanResults] = useState<{
    scan_id: string;
    checks: { mfa?: Check; rls?: Check; pitr?: Check };
    overall_status: string;
  } | null>(null);

  const runCheck = async ({
    check,
    route,
  }: {
    check: string;
    route: string;
  }) => {
    if (!selectedOrg) {
      alert("Please select an organization first");
      return;
    }

    setCheckData(null);
    setFullScanResults(null);
    setLoading(check);
    try {
      const res = await fetch(`/api/${route}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organization_id: selectedOrg.supabase_org_id }),
      });
      const data = await res.json();

      if (check === "full") {
        setFullScanResults(data.scan_results);
      } else {
        setCheckData(data);
      }
    } catch (error) {
      console.error(`Error running ${check} check:`, error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Checks</CardTitle>
        <CardDescription>
          Run security checks on your organization&apos;s MFA, RLS, and PITR
          settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => runCheck({ check: "full", route: "full-scan" })}
            disabled={!!loading || !selectedOrg}
            variant="default"
            className="gap-2"
          >
            {loading === "full" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanLine className="w-4 h-4" />
            )}
            {loading === "full" ? "Running Full Scan..." : "Run Full Scan"}
          </Button>
          <Separator orientation="vertical" className="h-10" />
          <Button
            onClick={() => runCheck({ check: "mfa", route: "mfa-check" })}
            disabled={!!loading || !selectedOrg}
            variant="outline"
            className="gap-2"
          >
            {loading === "mfa" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Key className="w-4 h-4" />
            )}
            {loading === "mfa" ? "Checking MFA..." : "Check MFA"}
          </Button>
          <Button
            onClick={() => runCheck({ check: "rls", route: "rls-check" })}
            disabled={!!loading || !selectedOrg}
            variant="outline"
            className="gap-2"
          >
            {loading === "rls" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {loading === "rls" ? "Checking RLS..." : "Check RLS"}
          </Button>
          <Button
            onClick={() => runCheck({ check: "pitr", route: "pitr-check" })}
            disabled={!!loading || !selectedOrg}
            variant="outline"
            className="gap-2"
          >
            {loading === "pitr" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {loading === "pitr" ? "Checking PITR..." : "Check PITR"}
          </Button>
        </div>

        {(loading || checkData || fullScanResults) && (
          <Accordion type="multiple" className="space-y-4">
            {fullScanResults && (
              <div className="flex items-center gap-2 mb-4">
                <ScanLine className="w-4 h-4" />
                <span className="text-sm font-medium">Full Scan Results →</span>
                <span
                  className={`text-sm font-medium ${
                    fullScanResults.overall_status === "success"
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {fullScanResults.overall_status === "success"
                    ? "Passed"
                    : "Issues Found"}
                </span>
              </div>
            )}

            {loading === "full" &&
              ["mfa", "rls", "pitr"].map((checkType) => (
                <CheckCard
                  key={checkType}
                  type={checkType}
                  status="running"
                  timestamp="Now"
                  logs={{
                    execution_logs: [],
                    summary: {
                      total_items: 0,
                      items_with_issues: 0,
                      status: "running",
                    },
                  }}
                  isLoading={true}
                />
              ))}

            {loading && loading !== "full" && (
              <CheckCard
                type={loading}
                status="running"
                timestamp="Now"
                logs={{
                  execution_logs: [],
                  summary: {
                    total_items: 0,
                    items_with_issues: 0,
                    status: "running",
                  },
                }}
                isLoading={true}
              />
            )}

            {fullScanResults &&
              Object.entries(fullScanResults.checks).map(
                ([type, check]) =>
                  check && (
                    <CheckCard
                      key={type}
                      type={type}
                      status={check.status}
                      timestamp="Now"
                      logs={check.logs}
                      recommendations={check.recommendations}
                      fullScanId={fullScanResults?.scan_id}
                    />
                  )
              )}

            {checkData && (
              <CheckCard
                type={checkData.check_type}
                status={checkData.status}
                timestamp="Now"
                logs={checkData.logs}
                recommendations={checkData.recommendations}
              />
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
