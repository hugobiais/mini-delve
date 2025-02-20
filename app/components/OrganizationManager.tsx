import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Building2,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  Calendar,
  Hash,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Organization {
  id: string;
  name: string;
  supabase_org_id: string;
  token_expires_at: string;
}

interface OrganizationManagerProps {
  selectedOrg: Organization | null;
  onSelectOrg: (org: Organization | null) => void;
}

export default function OrganizationManager({
  selectedOrg,
  onSelectOrg,
}: OrganizationManagerProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    try {
      // First get the current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("No authenticated user");

      // Then fetch organizations for this user
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, supabase_org_id, token_expires_at")
        .eq("user_id", user.id);

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch organizations"
      );
    } finally {
      setLoading(false);
    }
  }

  const handleConnect = () => {
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem("supabase_oauth_state", state);

    const clientId = process.env.NEXT_PUBLIC_SUPABASE_CLIENT_ID;
    const redirectUri =
      process.env.NODE_ENV === "development"
        ? process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI_DEV
        : process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI_PROD;

    if (!redirectUri) {
      throw new Error("Redirect URI is not configured");
    }

    const authUrl =
      `https://api.supabase.com/v1/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `state=${state}`;

    window.location.href = authUrl;
  };

  const handleRemoveOrg = async (orgId: string) => {
    try {
      setDeletingOrg(orgId);
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);

      if (error) throw error;

      // If the deleted org was selected, deselect it
      if (selectedOrg?.id === orgId) {
        onSelectOrg(null);
      }

      // Refresh the organizations list
      await fetchOrganizations();
      toast({
        title: "Success",
        description: "Organization removed successfully",
      });
    } catch (err) {
      console.error("Error removing organization:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove organization",
      });
    } finally {
      setDeletingOrg(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Error</CardTitle>
          </div>
          <CardDescription className="text-destructive">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Organizations</CardTitle>
          <CardDescription>
            Connect your Supabase organizations. You must be an Owner or
            Administrator of the organization to connect it.
          </CardDescription>
        </div>
        <Button onClick={handleConnect} className="gap-2 !mt-0">
          <LinkIcon className="h-4 w-4" />
          Connect Organization
        </Button>
      </CardHeader>
      <CardContent>
        {organizations.length === 0 ? (
          <div className="rounded-lg border p-4 text-center text-muted-foreground bg-black/[.05] dark:bg-white/[.06]">
            <p className="font-medium">No Organizations Connected</p>
            <p className="text-sm">
              Click &quot;Connect Organization&quot; to add a Supabase
              organization. Note: You must have Owner or Administrator access to
              connect an organization.
            </p>
          </div>
        ) : (
          <div className="flex gap-4">
            {organizations.map((org) => (
              <Card
                key={org.id}
                className={cn(
                  "cursor-pointer transition-all hover:bg-accent",
                  selectedOrg?.id === org.id && "ring-2 ring-primary",
                  "flex-1"
                )}
                onClick={() =>
                  onSelectOrg(selectedOrg?.id === org.id ? null : org)
                }
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{org.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          {deletingOrg === org.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove Organization
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove &quot;{org.name}
                            &quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveOrg(org.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span>Supabase Org ID: {org.supabase_org_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Token expires:{" "}
                        {new Date(org.token_expires_at)
                          .toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          .replace(/(\d+)/, (match) => {
                            const day = parseInt(match);
                            const suffix = ["th", "st", "nd", "rd"][
                              day % 10 > 3 || day > 13 ? 0 : day % 10
                            ];
                            return `${day}${suffix}`;
                          })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
