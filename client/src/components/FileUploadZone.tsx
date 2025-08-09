import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
        fileUrl: file.uploadURL!,
        fileName: file.name,
        originalFileName: file.name,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        {/* File Upload Drag Zone */}
        <ObjectUploader
          maxNumberOfFiles={10}
          maxFileSize={10485760} // 10MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="w-full"
        >
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors duration-200">
            <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
            <p className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to browse</p>
            <p className="text-sm text-gray-500 mb-4">Supports PDF, JPG, PNG files and Outlook emails</p>
            
            {isProcessing && (
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Processing your receipt...</p>
              </div>
            )}
          </div>
        </ObjectUploader>

        {/* Email Ingestion Options */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Email Integration Options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center p-3 bg-white rounded-lg border">
              <i className="fas fa-paper-plane text-primary mr-3"></i>
              <div>
                <p className="font-medium text-gray-900">Forward Emails</p>
                <p className="text-sm text-gray-500">receipts@yourcompany.com</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-white rounded-lg border">
              <i className="fab fa-microsoft text-primary mr-3"></i>
              <div>
                <p className="font-medium text-gray-900">Outlook Plugin</p>
                <p className="text-sm text-gray-500">Drag & drop from Outlook</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
