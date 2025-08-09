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
            <div className="relative border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-all duration-300 group-hover:shadow-lg cursor-pointer">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10 pointer-events-none">
                <div className="mb-4">
                  <Upload className="h-12 w-12 text-gray-400 group-hover:text-blue-500 mx-auto transition-colors duration-300" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Drop receipts here or click to upload
                </h3>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Supports PDF, JPG, PNG files and Outlook emails
                </p>
                
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    PDF
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Image className="h-3 w-3 mr-1" />
                    JPG/PNG
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Badge>
                </div>
                
                {isProcessing && (
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-sm text-blue-600 font-medium">Processing receipt...</span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-full animate-pulse"></div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-400 mt-2">
                  📱 On mobile: Tap to open camera or file browser
                </p>
              </div>
            </div>
          </ObjectUploader>

          {/* Mobile Fallback - Direct File Input */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <strong>Mobile Alternative:</strong> If the upload area above doesn't work on your device, use this direct file picker:
            </p>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  console.log("Direct file input selected:", files);
                  // For now, just show a message - this would need additional implementation
                  toast({
                    title: "Files Selected",
                    description: `${files.length} file(s) selected. Please use the main upload area above for processing.`,
                  });
                }
              }}
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            />
          </div>
        </div>

        {/* Email Integration Options */}
        <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Automated Email Integration</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Forward Emails</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">receipts@yourcompany.com</p>
              </div>
            </div>
            
            <div className="group flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg mr-3 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-colors">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Outlook Plugin</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Drag & drop from Outlook</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
