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

export default function FileUploadZone() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const processReceiptMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; originalFileName: string }) => {
      const response = await apiRequest("POST", "/api/receipts/process", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsProcessing(false);
      toast({
        title: "Receipt uploaded successfully",
        description: "Your receipt is being processed and will appear in the recent uploads.",
      });
    },
    onError: (error) => {
      setIsProcessing(false);
      console.error("Error processing receipt:", error);
      toast({
        title: "Upload failed",
        description: "There was an error processing your receipt. Please try again.",
        variant: "destructive",
      });
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
      const file = result.successful[0];
      
      await processReceiptMutation.mutateAsync({
        fileUrl: file.uploadURL || '',
        fileName: file.name || 'unknown',
        originalFileName: file.name || 'unknown',
      });
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
            maxNumberOfFiles={10}
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
                  <span className="text-sm text-blue-600">Processing...</span>
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
