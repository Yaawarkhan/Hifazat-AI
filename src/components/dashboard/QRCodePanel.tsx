import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface QRCodePanelProps {
  previewUrl: string;
}

export function QRCodePanel({ previewUrl }: QRCodePanelProps) {
  const [copied, setCopied] = useState(false);
  
  const mobileUrl = `${previewUrl}/mobile-camera`;
  
  const copyUrl = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Smartphone className="h-4 w-4" />
          Add Mobile Camera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Connect Mobile Camera
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {/* QR Code */}
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG
              value={mobileUrl}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            Scan this QR code with your phone to use it as a security camera
          </p>
          
          {/* URL Display */}
          <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 p-2">
            <code className="flex-1 truncate text-xs">{mobileUrl}</code>
            <Button size="icon" variant="ghost" onClick={copyUrl}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Instructions */}
          <div className="w-full space-y-2 rounded-lg bg-muted/30 p-3 text-xs">
            <p className="font-medium">📱 How it works:</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Scan QR code on your phone</li>
              <li>Allow camera permissions</li>
              <li>Enter your PC's local IP (e.g., <code>ws://192.168.1.100:8000/ws/mobile</code>)</li>
              <li>Tap "Start Camera" → "Connect to Backend"</li>
              <li>Point phone at a face — boxes + names appear here!</li>
            </ol>
            <p className="mt-2 font-medium text-primary">✨ Facial recognition active for:</p>
            <ul className="list-inside list-disc text-muted-foreground">
              <li>Mohammad Yaawar Khan</li>
              <li>Bakhtiyar Khan</li>
              <li>Faiz Ahmad Khan</li>
            </ul>
          </div>
          
          <Button variant="outline" className="w-full" asChild>
            <a href={mobileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
