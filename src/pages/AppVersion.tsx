import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { AppVersionConfig } from "@/types/appVersion";
import {
  getAppVersionConfig,
  updateAppVersionConfig,
  initializeAppVersionConfig,
} from "@/services/appVersion";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { IconRefresh, IconAlertCircle, IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PageLoading from "@/components/PageLoading";

const AppVersion = () => {
  const [config, setConfig] = useState<AppVersionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    deployedVersion: "",
    minimumVersion: "",
    forceRefresh: false,
    updateMessage: "",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      let data = await getAppVersionConfig();

      // Initialize if doesn't exist
      if (!data) {
        await initializeAppVersionConfig(auth.currentUser?.email || undefined);
        data = await getAppVersionConfig();
      }

      if (data) {
        setConfig(data);
        setFormData({
          deployedVersion: data.deployedVersion,
          minimumVersion: data.minimumVersion,
          forceRefresh: data.forceRefresh,
          updateMessage: data.updateMessage,
        });
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast({
        title: "Error",
        description: "Failed to load app version configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate semver format
      const semverRegex = /^\d+\.\d+\.\d+$/;
      if (!semverRegex.test(formData.deployedVersion)) {
        toast({
          title: "Invalid Version",
          description: "Deployed version must be in format X.Y.Z (e.g., 1.0.0)",
          variant: "destructive",
        });
        return;
      }
      if (!semverRegex.test(formData.minimumVersion)) {
        toast({
          title: "Invalid Version",
          description: "Minimum version must be in format X.Y.Z (e.g., 1.0.0)",
          variant: "destructive",
        });
        return;
      }

      // Validate minimum <= deployed
      const [depMajor, depMinor, depPatch] = formData.deployedVersion.split(".").map(Number);
      const [minMajor, minMinor, minPatch] = formData.minimumVersion.split(".").map(Number);

      const deployedNum = depMajor * 10000 + depMinor * 100 + depPatch;
      const minimumNum = minMajor * 10000 + minMinor * 100 + minPatch;

      if (minimumNum > deployedNum) {
        toast({
          title: "Invalid Configuration",
          description: "Minimum version cannot be higher than deployed version",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);
      await updateAppVersionConfig(formData, auth.currentUser?.email || undefined);

      toast({
        title: "✅ Saved Successfully",
        description: "App version configuration updated",
      });

      // Refresh to get updated lastUpdated timestamp
      await fetchConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">App Version Manager</h1>
            <p className="text-muted-foreground mt-1">
              Control PWA updates and force refresh for users
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
          >
            <IconDeviceFloppy className="h-5 w-5" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Info Alert */}
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            Changes take effect immediately. Users will see the update prompt on their next page load
            or refresh.
          </AlertDescription>
        </Alert>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Version Configuration</CardTitle>
            <CardDescription>
              Manage the current deployed version and minimum required version for your PWA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Deployed Version */}
            <div className="space-y-2">
              <Label htmlFor="deployedVersion">
                Deployed Version
                <span className="text-muted-foreground text-xs ml-2">
                  (What's currently live on your server)
                </span>
              </Label>
              <Input
                id="deployedVersion"
                placeholder="1.0.0"
                value={formData.deployedVersion}
                onChange={(e) =>
                  setFormData({ ...formData, deployedVersion: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Format: MAJOR.MINOR.PATCH (e.g., 1.0.0, 2.3.1)
              </p>
            </div>

            {/* Minimum Version */}
            <div className="space-y-2">
              <Label htmlFor="minimumVersion">
                Minimum Required Version
                <span className="text-muted-foreground text-xs ml-2">
                  (Users below this see force-refresh banner)
                </span>
              </Label>
              <Input
                id="minimumVersion"
                placeholder="1.0.0"
                value={formData.minimumVersion}
                onChange={(e) =>
                  setFormData({ ...formData, minimumVersion: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Must be less than or equal to deployed version
              </p>
            </div>

            {/* Force Refresh Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="forceRefresh" className="text-base">
                  Force Refresh
                </Label>
                <p className="text-sm text-muted-foreground">
                  Triggers skipWaiting() on service worker for immediate update
                </p>
              </div>
              <Switch
                id="forceRefresh"
                checked={formData.forceRefresh}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, forceRefresh: checked })
                }
              />
            </div>

            {/* Update Message */}
            <div className="space-y-2">
              <Label htmlFor="updateMessage">Update Message</Label>
              <Textarea
                id="updateMessage"
                placeholder="A new version of KOLI is available. Click to refresh."
                value={formData.updateMessage}
                onChange={(e) =>
                  setFormData({ ...formData, updateMessage: e.target.value })
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be shown to users when an update is available
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoint Info */}
        <Card>
          <CardHeader>
            <CardTitle>Public API Endpoint</CardTitle>
            <CardDescription>Your PWA should call this endpoint on startup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              GET /api/app-version
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Response:</p>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "version": "${formData.deployedVersion}",
  "minimumVersion": "${formData.minimumVersion}",
  "forceUpdate": ${formData.forceRefresh},
  "message": "${formData.updateMessage}"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated Info */}
        {config && (
          <div className="text-sm text-muted-foreground text-center space-y-1">
            <p>
              Last updated:{" "}
              {(() => {
                const date = config.lastUpdated instanceof Timestamp 
                  ? config.lastUpdated.toDate() 
                  : new Date(config.lastUpdated);
                return date.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });
              })()}
            </p>
            {config.updatedBy && <p>by {config.updatedBy}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppVersion;
