import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  ArrowLeft, 
  Play, 
  Pause, 
  Clock, 
  User, 
  Shirt,
  Send,
  Loader2,
  Video,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  id: string;
  timestamp: string;
  timeInVideo: number;
  description: string;
  confidence: number;
  matchedCriteria: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: SearchResult[];
  isLoading?: boolean;
}

export default function SmartSearch() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to Smart Search! I can help you search through CCTV footage using natural language. Try queries like:\n\n• \"Find a person wearing a red shirt\"\n• \"Show me anyone who entered after 10 PM\"\n• \"Find people walking in groups\"\n• \"Detect suspicious behavior near the entrance\"\n\nThe sample footage is loaded and ready for analysis."
    }
  ]);
  const [isSearching, setIsSearching] = useState(false);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim() || isSearching) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "Analyzing footage with AI...",
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setQuery("");
    setIsSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke("smart-search", {
        body: { 
          query: query.trim(),
          videoDuration: duration
        }
      });

      if (error) throw error;

      const results: SearchResult[] = data?.results || [];
      const aiResponse = data?.summary || "No matches found for your query.";

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: aiResponse, 
                results: results,
                isLoading: false 
              }
            : msg
        )
      );
    } catch (err) {
      console.error("[SmartSearch] Error:", err);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: "Sorry, I encountered an error analyzing the footage. Please try again.", 
                isLoading: false 
              }
            : msg
        )
      );
      toast({
        title: "Search Error",
        description: "Failed to analyze footage. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  }, [query, isSearching, duration, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Smart Search</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Footage Analysis</p>
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by AI
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Video Player Section */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              Sample CCTV Footage
            </CardTitle>
            <CardDescription>Click on search results to jump to specific moments</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
              <video
                ref={videoRef}
                src="/footage/sample-cctv.mp4"
                className="w-full h-full object-contain"
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={handleVideoLoaded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-white font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Video Info */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Duration: {formatTime(duration)}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Video className="h-3 w-3" />
                720p Resolution
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                Demo Footage
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat/Search Section */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Natural Language Search
            </CardTitle>
            <CardDescription>Describe what you're looking for in plain English</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4 mb-3">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">{message.content}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Search Results */}
                          {message.results && message.results.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium opacity-70">Found {message.results.length} matches:</p>
                              {message.results.map((result) => (
                                <button
                                  key={result.id}
                                  onClick={() => seekToTime(result.timeInVideo)}
                                  className="w-full text-left p-2 rounded bg-background/50 hover:bg-background/80 transition-colors"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono text-primary">
                                      {formatTime(result.timeInVideo)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] h-5">
                                      {Math.round(result.confidence * 100)}% match
                                    </Badge>
                                  </div>
                                  <p className="text-xs">{result.description}</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {result.matchedCriteria.map((criteria, i) => (
                                      <Badge key={i} variant="secondary" className="text-[10px] h-4">
                                        {criteria}
                                      </Badge>
                                    ))}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Describe what you're looking for..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSearching}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={!query.trim() || isSearching}
                size="icon"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Example Queries */}
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Try:</span>
              {[
                "Find people wearing red",
                "Show groups of 3+",
                "Detect running"
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
