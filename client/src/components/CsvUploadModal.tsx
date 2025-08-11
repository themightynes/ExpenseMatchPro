import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { AmexStatement } from "@shared/schema";

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  statements: AmexStatement[];
}

export default function CsvUploadModal({ isOpen, onClose, statements }: CsvUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [periodName, setPeriodName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedPeriod, setDetectedPeriod] = useState<string>("");
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, periodName }: { file: File; periodName: string }) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('periodName', periodName);

      const response = await fetch('/api/charges/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload CSV');
      }

      return response.json();
    },
    onSuccess: (data) => {
      let description = `Imported ${data.imported} charges.`;
      if (data.skipped > 0) {
        description += ` ${data.skipped} charges were skipped (payments/invalid data).`;
      }
      if (data.errors > 0) {
        description += ` ${data.errors} errors occurred.`;
      }
      description += ` Created statement: ${data.statementName}`;
      
      toast({
        title: data.skipped > 0 ? "CSV Import Completed with Skipped Items" : "CSV Import Successful",
        description,
        variant: data.skipped > 0 ? "default" : "default",
      });

      // Log detailed skip reasons for debugging
      if (data.skipped > 0 && data.skippedReasons) {
        console.log('CSV Import - Skipped charges details:');
        data.skippedReasons.forEach((reason: string) => console.log(`  - ${reason}`));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onClose();
      setSelectedFile(null);
      setPeriodName("");
      setDetectedPeriod("");
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading the CSV file.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsAnalyzing(true);
      
      try {
        // Auto-detect period from filename
        const filename = file.name;
        let detectedName = "";
        
        if (filename.includes("2024") || filename.includes("2025")) {
          const yearMatch = filename.match(/20\d{2}/);
          const monthMatch = filename.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})/i);
          
          if (yearMatch && monthMatch) {
            const year = yearMatch[0];
            const month = monthMatch[0];
            detectedName = `${year} - ${month.charAt(0).toUpperCase() + month.slice(1)} Statement`;
          } else if (yearMatch) {
            const year = yearMatch[0];
            detectedName = `${year} Statement`;
          }
        }
        
        if (!detectedName) {
          // Fallback to current date
          const now = new Date();
          detectedName = `${now.getFullYear()} - ${now.toLocaleDateString('en-US', { month: 'long' })} Statement`;
        }
        
        setDetectedPeriod(detectedName);
        setPeriodName(detectedName);
      } catch (error) {
        console.error("Error analyzing file:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !periodName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a CSV file and provide a statement period name.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, periodName: periodName.trim() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Import AMEX CSV
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              AMEX CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600 mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
            {isAnalyzing && (
              <p className="text-sm text-blue-600 mt-1">
                Analyzing file...
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Statement Period Name
            </label>
            <input
              type="text"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="e.g., 2025 - April Statement"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            {detectedPeriod && (
              <p className="text-sm text-green-600 mt-1">
                Auto-detected: {detectedPeriod}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500">
            <p>• Export your AMEX statement as CSV from online banking</p>
            <p>• A new statement period will be created automatically</p>
            <p>• Only expense charges will be imported (payments skipped)</p>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !periodName.trim() || uploadMutation.isPending}
              className="flex-1"
            >
              {uploadMutation.isPending ? "Creating Statement..." : "Import CSV"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}