"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import OrganizationManager, {
  Organization,
} from "./components/OrganizationManager";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { CheckHistory } from "./components/CheckHistory";
import { RunningChecks } from "./components/RunningChecks";

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
      }
      setIsLoading(false);
    };

    checkUser();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">mini-delve</h1>
              <p className="text-md text-muted-foreground">
                Your Supabase security checker
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="gap-2"
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {isSigningOut ? "Signing out..." : "Logout"}
            </Button>
          </div>

          <OrganizationManager
            selectedOrg={selectedOrg}
            onSelectOrg={setSelectedOrg}
          />

          {selectedOrg && (
            <>
              <RunningChecks selectedOrg={selectedOrg} />
              <CheckHistory organizationId={Number(selectedOrg.id)} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
