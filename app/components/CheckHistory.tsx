import { Accordion } from "@/components/ui/accordion";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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
      data: any;
    }[];
    projects_summary?: {
      total_projects: number;
      projects_with_disabled_rls: number;
      project_details: any[];
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
}

interface CheckHistoryProps {
  organizationId: number | null;
}

export function CheckHistory({ organizationId }: CheckHistoryProps) {
  const supabase = createClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checks, setChecks] = useState<Check[]>([]);
  const { toast } = useToast();

  const fetchChecks = async (orgId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("checks")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChecks(data || []);
    } catch (error) {
      console.error("Error fetching checks:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch checks. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!organizationId) return;
    setIsRefreshing(true);
    await fetchChecks(organizationId);
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (organizationId) {
      fetchChecks(organizationId);
    }
  }, [organizationId]);

  const clearHistory = async () => {
    setIsDeleting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { error } = await supabase
        .from("checks")
        .delete()
        .eq("user_id", user.id)
        .eq("organization_id", checks[0].organization_id); // Adjust if organization_id is different

      if (error) throw error;

      setChecks([]);
      toast({
        title: "Success",
        description: "Check history cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear history. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Previous Checks</CardTitle>
          <CardDescription>
            View the history of security checks performed on your organization,
            including MFA, RLS, and PITR status checks.
          </CardDescription>
        </div>
        <div className="flex items-stretch gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {checks.length > 0 && (
            <>
              <div className="inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium bg-secondary text-secondary-foreground">
                {checks.length} check{checks.length === 1 ? "" : "s"} performed
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Clearing..." : "Clear History"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Check History</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to clear all check history? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        clearHistory();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading checks...</span>
            </div>
          </div>
        ) : checks.length === 0 ? (
          <div className="rounded-lg border p-4 text-center text-muted-foreground bg-black/[.05] dark:bg-white/[.06]">
            <p className="font-medium">No Checks Performed Yet</p>
            <p className="text-sm">
              Security checks will appear here once they are performed on your
              organization.
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {checks.map((check) => (
              <CheckCard
                key={check.id}
                type={check.check_type}
                status={check.status}
                timestamp={format(new Date(check.created_at), "PPpp")}
                logs={check.logs}
                recommendations={check.recommendations}
                fullScanId={check.full_scan_id}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
