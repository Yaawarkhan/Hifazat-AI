import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Shield, 
  Camera, 
  Map, 
  Bell, 
  Volume2, 
  Settings, 
  ChevronRight,
  Radio,
  AlertTriangle,
  Phone,
  Zap,
  Search,
  Sparkles,
  UserPlus
} from "lucide-react";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: "active" | "standby" | "alert";
  onClick?: () => void;
  className?: string;
}

function ModuleCard({ icon, title, description, status = "standby", onClick, className }: ModuleCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-2",
        status === "active" && "border-primary/50 bg-primary/5",
        status === "alert" && "border-destructive/50 bg-destructive/5",
        status === "standby" && "border-border hover:border-primary/30",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            status === "active" && "bg-primary/20 text-primary",
            status === "alert" && "bg-destructive/20 text-destructive",
            status === "standby" && "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            "h-2 w-2 rounded-full",
            status === "active" && "bg-primary animate-pulse",
            status === "alert" && "bg-destructive animate-pulse",
            status === "standby" && "bg-muted-foreground"
          )} />
          <span className="text-muted-foreground capitalize">{status}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LaunchScreen() {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);

  const handleLaunchDashboard = () => {
    setIsInitializing(true);
    // Small delay for visual feedback
    setTimeout(() => {
      navigate("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Hifazat.ai</h1>
              <p className="text-muted-foreground">AI-Powered Campus Security System</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Quick Launch */}
        <div className="mb-8">
          <Button 
            size="lg" 
            className="w-full h-16 text-lg gap-3"
            onClick={handleLaunchDashboard}
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <Zap className="h-5 w-5 animate-pulse" />
                Initializing Command Center...
              </>
            ) : (
              <>
                <Radio className="h-5 w-5" />
                Launch Security Command Center
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>

        {/* Module Grid */}
        <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Security Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <ModuleCard
            icon={<Camera className="h-6 w-6" />}
            title="Live Surveillance"
            description="Real-time camera feeds with AI-powered detection"
            status="active"
            onClick={handleLaunchDashboard}
          />
          <ModuleCard
            icon={<Map className="h-6 w-6" />}
            title="Campus Map"
            description="Interactive map with camera locations and alerts"
            status="active"
            onClick={handleLaunchDashboard}
          />
          <ModuleCard
            icon={<Volume2 className="h-6 w-6" />}
            title="Acoustic Sentinel"
            description="Audio threat detection for screams and impacts"
            status="standby"
            onClick={handleLaunchDashboard}
          />
          <ModuleCard
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Threat Detection"
            description="AI weapon and danger recognition system"
            status="active"
            onClick={handleLaunchDashboard}
          />
          <ModuleCard
            icon={<Phone className="h-6 w-6" />}
            title="Emergency Dispatch"
            description="Telegram & WhatsApp alerts with navigation"
            status="standby"
            onClick={handleLaunchDashboard}
          />
          <ModuleCard
            icon={<Bell className="h-6 w-6" />}
            title="Alert Management"
            description="Review and manage all security incidents"
            status="standby"
            onClick={handleLaunchDashboard}
          />
        </div>

        {/* Smart Search Feature Card */}
        <Card className="mb-8 border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Smart Search
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      <Sparkles className="h-3 w-3" />
                      AI Powered
                    </span>
                  </CardTitle>
                  <CardDescription>Search footage using natural language</CardDescription>
                </div>
              </div>
              <Button onClick={() => navigate("/smart-search")} className="gap-2">
                Try Now
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground">
              Find specific moments in CCTV footage by describing what you're looking for. 
              Example: "Find a person wearing a red shirt who entered after 10 PM"
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => setAddStudentOpen(true)}
          >
            <UserPlus className="h-5 w-5" />
            <span className="text-xs">Add Student</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/smart-search")}
          >
            <Search className="h-5 w-5" />
            <span className="text-xs">Smart Search</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/mobile-camera")}
          >
            <Camera className="h-5 w-5" />
            <span className="text-xs">Mobile Camera</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/dashboard?view=map")}
          >
            <Map className="h-5 w-5" />
            <span className="text-xs">View Map</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/dashboard?view=alerts")}
          >
            <Bell className="h-5 w-5" />
            <span className="text-xs">Alerts</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate("/dashboard?view=settings")}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>

        {/* System Status */}
        <div className="mt-8 rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">System Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">AI Models: Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">Cloud: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">Cameras: 0 Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Dispatch: Ready</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Hifazat.ai • Aligarh Muslim University Campus Security</p>
          <p className="mt-1">Powered by AI Vision, Audio Analysis & Real-time Alerting</p>
        </div>
      </div>

      <AddStudentDialog open={addStudentOpen} onOpenChange={setAddStudentOpen} />
    </div>
  );
}
