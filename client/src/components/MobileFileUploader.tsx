import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload } from "lucide-react";

interface MobileFileUploaderProps {
  onUploadComplete?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function MobileFileUploader({ onUploadComplete, className, children }: MobileFileUploaderProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processReceiptMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; originalFileName: string }) => {
      const response = await apiRequest("POST", "/api/receipts/process", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      console.error("Error processing receipt:", error);
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setUploadProgress({ current: 0, total: files.length });
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });
      
      try {
        // Get upload URL
        const uploadResponse = await apiRequest("POST", "/api/objects/upload");
        const uploadData = await uploadResponse.json();
        
        // Upload file directly
        const uploadResult = await fetch(uploadData.uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (uploadResult.ok) {
          // Process the receipt
          await processReceiptMutation.mutateAsync({
            fileUrl: uploadData.uploadURL,
            fileName: file.name,
            originalFileName: file.name,
          });
          successCount++;
        } else {
          throw new Error(`Upload failed: ${uploadResult.status}`);
        }
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        failCount++;
      }
    }

    // Reset progress and form
    setUploadProgress({ current: 0, total: 0 });
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Show summary toast
    toast({
      title: `Upload Complete`,
      description: `${successCount} receipt${successCount !== 1 ? 's' : ''} uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}. Click on them to add details.`,
    });

    // Call the completion callback if provided
    onUploadComplete?.();
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />
      
      <Button
        onClick={handleButtonClick}
        disabled={isProcessing}
        className="w-full touch-manipulation"
      >
        {children || (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {isProcessing ? "Processing..." : "Upload Receipts"}
          </>
        )}
      </Button>

      {isProcessing && uploadProgress.total > 0 && (
        <div className="mt-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-blue-600">
              Processing {uploadProgress.current} of {uploadProgress.total} receipts...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}