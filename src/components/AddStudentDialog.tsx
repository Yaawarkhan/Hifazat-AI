import { useState, useRef } from "react";
import { UserPlus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const KNOWN_FACES_BUCKET = "known-faces";

export interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddStudentDialog({ open, onOpenChange, onSuccess }: AddStudentDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  const resetForm = () => {
    setName("");
    setEnrollmentNumber("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !enrollmentNumber.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter name and enrollment number.",
        variant: "destructive",
      });
      return;
    }
    if (!file) {
      toast({
        title: "No photo",
        description: "Please select a photo of the student's face.",
        variant: "destructive",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image (JPEG, PNG).",
        variant: "destructive",
      });
      return;
    }

    if (!hasSupabase) {
      toast({
        title: "Storage not configured",
        description: "Configure Supabase (VITE_SUPABASE_URL and key) and create a public bucket named 'known-faces'.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Filename: enrollment_NameWithUnderscores.ext (e.g. 2024ABC_John_Doe.jpg)
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = name.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const enrollmentSafe = enrollmentNumber.trim().replace(/\s+/g, "_");
      const filePath = `${enrollmentSafe}_${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(KNOWN_FACES_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        if (uploadError.message?.includes("Bucket not found")) {
          toast({
            title: "Bucket not found",
            description: "Create a Supabase Storage bucket named 'known-faces' and set it to public.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Upload failed",
            description: uploadError.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Student added",
        description: `${name} (${enrollmentNumber}) has been added to known faces for facial recognition.`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("[AddStudent] Error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add student.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Student
          </DialogTitle>
          <DialogDescription>
            Upload a clear photo of the student's face with name and enrollment number. The image will be saved to known-faces for facial recognition.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enrollment">Enrollment Number</Label>
            <Input
              id="enrollment"
              placeholder="e.g. 2024ABC123"
              value={enrollmentNumber}
              onChange={(e) => setEnrollmentNumber(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Photo (face clearly visible)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="text-sm text-foreground">{file.name}</p>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to select image (JPEG or PNG)</p>
                </>
              )}
            </div>
          </div>
          {!hasSupabase && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and create a public bucket &quot;known-faces&quot;.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                "Add Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
