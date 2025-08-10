import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ObjectUploader } from "@/components/ObjectUploader";
import { MobileFileUploader } from "@/components/MobileFileUploader";
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
  const [currentStatus, setCurrentStatus] = useState("");
  const [isMobile, setIsMobile] = useState(true); // Start with mobile as default for better compatibility

  useEffect(() => {
    const checkMobile = () => {
      // Prioritize user agent detection for mobile devices
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // For desktop, make sure it's actually a desktop with mouse capability
      const isDesktop = /windows|macintosh|linux/i.test(userAgent) && !isMobileUserAgent;
      const hasMouseInput = window.matchMedia('(pointer: fine)').matches;
      
      // Use mobile uploader if it's a mobile device OR if it's a small screen without fine pointer
      setIsMobile(isMobileUserAgent || (!isDesktop || !hasMouseInput));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const uploadFileDirectly = async (file: File): Promise<string> => {
    console.log("Starting direct upload for:", file.name);
    setCurrentStatus(`Getting upload URL for ${file.name}...`);
    
    let retries = 3;
    while (retries > 0) {
      try {
        // Get fresh presigned URL
        const response = await apiRequest("POST", "/api/objects/upload");
        const data = await response.json();
        console.log("Received upload URL:", data.uploadURL);
        
        setCurrentStatus(`Uploading ${file.name} to cloud storage...`);
        
        // Upload file directly to GCS
        const uploadResponse = await fetch(data.uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Upload failed. Status:", uploadResponse.status, "Response:", errorText);
          
          // If expired token, retry with fresh URL
          if (uploadResponse.status === 400 && errorText.includes('ExpiredToken')) {
            retries--;
            if (retries > 0) {
              console.log(`Token expired, retrying... (${retries} attempts left)`);
              setCurrentStatus(`Upload URL expired, getting new one for ${file.name}...`);
              continue;
            }
          }
          
          throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
        }
        
        console.log("Upload successful for:", file.name);
        setCurrentStatus(`${file.name} uploaded successfully, starting processing...`);
        return data.uploadURL.split('?')[0]; // Return clean URL without query params
        
      } catch (error) {
        if (retries <= 1) throw error;
        retries--;
        console.log(`Upload failed, retrying... (${retries} attempts left)`, error);
        setCurrentStatus(`Upload failed, retrying ${file.name}...`);
      }
    }
    
    throw new Error(`Failed to upload ${file.name} after 3 attempts`);
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsProcessing(true);
    
    // Check authentication status before processing
    try {
      const authResponse = await fetch('/api/auth/status', { credentials: 'include' });
      const authData = await authResponse.json();
      if (!authData.authenticated) {
        toast({
          title: "Session Expired",
          description: "Please refresh the page and log in again to continue uploading.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }
    } catch (error) {
      console.error("Failed to check authentication status:", error);
      toast({
        title: "Authentication Check Failed",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }
    
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    setUploadProgress({ current: 0, total: totalFiles });
    
    let successCount = 0;
    let failCount = 0;
    
    // Upload and process all files
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      console.log("Processing file:", file.name);
      setUploadProgress({ current: i + 1, total: totalFiles });
      
      try {
        // Upload file directly
        const fileUrl = await uploadFileDirectly(file);
        
        setCurrentStatus(`Processing ${file.name} - extracting text and data...`);
        
        // Process the uploaded file
        const processData = {
          fileUrl: fileUrl,
          fileName: file.name,
          originalFileName: file.name,
        };
        console.log("Sending to process endpoint:", processData);
        await processReceiptMutation.mutateAsync(processData);
        setCurrentStatus(`${file.name} processed successfully!`);
        successCount++;
      } catch (error) {
        console.error(`Failed to upload/process ${file.name}:`, error);
        
        // Check if it's an authentication error
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('Authentication required'))) {
          toast({
            title: "Session Expired",
            description: "Please refresh the page and log in again to continue uploading.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return; // Stop processing more files
        }
        
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Receipts</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Modern File Upload Zone */}
        <div className="space-y-4">
          <div className="w-full">
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-all cursor-pointer min-h-[120px] flex flex-col justify-center"
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-base">
                Drop receipts here or click to upload
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                PDF, JPG, PNG files • Up to 10 files, 10MB each
              </p>
              
              {isProcessing && (
                <div className="flex flex-col items-center justify-center gap-2 mt-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm text-blue-600 text-center">
                    {uploadProgress.total > 1 
                      ? `Processing ${uploadProgress.current} of ${uploadProgress.total} receipts...`
                      : "Processing..."}
                  </span>
                  {currentStatus && (
                    <span className="text-xs text-gray-500 text-center max-w-sm">
                      {currentStatus}
                    </span>
                  )}
                </div>
              )}
            </label>
          </div>
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
