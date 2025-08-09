import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Mail, FileText, Image, Check, Zap } from "lucide-react";
import type { UploadResult } from "@uppy/core";

interface FileUploadZoneProps {
  onUploadComplete?: () => void;
}

export default function FileUploadZone({ onUploadComplete }: FileUploadZoneProps = {}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const processReceiptMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; originalFileName: string }) => {
      const response = await apiRequest("POST", "/api/receipts/process", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      // Don't show individual toasts when uploading multiple files
      // The summary toast will be shown in handleUploadComplete
    },
    onError: (error) => {
      console.error("Error processing receipt:", error);
      // Individual errors are handled in handleUploadComplete
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    setIsProcessing(true);
    
    if (result.successful && result.successful.length > 0) {
      const totalFiles = result.successful.length;
      setUploadProgress({ current: 0, total: totalFiles });
      
      let successCount = 0;
      let failCount = 0;
      
      // Process all uploaded files
      for (let i = 0; i < result.successful.length; i++) {
        const file = result.successful[i];
        setUploadProgress({ current: i + 1, total: totalFiles });
        
        try {
          await processReceiptMutation.mutateAsync({
            fileUrl: file.uploadURL || '',
            fileName: file.name || 'unknown',
            originalFileName: file.name || 'unknown',
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          failCount++;
        }
      }
      
      // Reset progress
      setUploadProgress({ current: 0, total: 0 });
      setIsProcessing(false);
      
      // Show summary toast
      toast({
        title: `Upload Complete`,
        description: `${successCount} receipt${successCount !== 1 ? 's' : ''} uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}. Click on them to add details.`,
      });
      
      // Call the completion callback if provided
      onUploadComplete?.();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Modern File Upload Zone */}
        <div className="space-y-4">
          <ObjectUploader
            maxNumberOfFiles={null}
            maxFileSize={10485760}
            onGetUploadParameters={handleGetUploadParameters}
            onComplete={handleUploadComplete}
            buttonClassName="w-full group"
          >
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-all cursor-pointer">
              
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Drop receipts here or click to upload
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                PDF, JPG, PNG files • Up to 10 files, 10MB each
              </p>
              
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm text-blue-600">
                    {uploadProgress.total > 1 
                      ? `Processing ${uploadProgress.current} of ${uploadProgress.total} receipts...`
                      : "Processing..."}
                  </span>
                </div>
              )}
            </div>
          </ObjectUploader>
        </div>

        {/* Compact Email Integration */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">Email Integration</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Forward to: receipts@yourcompany.com</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600 dark:text-gray-400">Outlook plugin available</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
