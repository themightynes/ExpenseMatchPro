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
  const [step, setStep] = useState<"upload" | "confirm-dates">("upload");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dateValidation, setDateValidation] = useState<any>(null);
  const [isValidatingDates, setIsValidatingDates] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, periodName, startDate, endDate }: { 
      file: File; 
      periodName: string; 
      startDate?: string; 
      endDate?: string; 
    }) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('periodName', periodName);
      if (startDate) formData.append('startDate', startDate);
      if (endDate) formData.append('endDate', endDate);

      const response = await fetch('/api/charges/import-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle validation errors specially
        if (response.status === 400 && errorData.validation) {
          return {
            validationError: true,
            ...errorData
          };
        }
        
        throw new Error(errorData.message || 'Failed to upload CSV');
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
        // Analyze CSV content for date range
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        
        // Parse dates from CSV
        for (let i = 1; i < Math.min(lines.length, 100); i++) { // Sample first 100 rows
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());
          
          const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date'));
          if (dateIndex >= 0 && cleanValues[dateIndex]) {
            const dateParts = cleanValues[dateIndex].split('/');
            if (dateParts.length === 3) {
              const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));
              if (!isNaN(date.getTime())) {
                if (!minDate || date < minDate) minDate = date;
                if (!maxDate || date > maxDate) maxDate = date;
              }
            }
          }
        }
        
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
        
        if (!detectedName && minDate) {
          const year = minDate.getFullYear();
          const month = minDate.toLocaleDateString('en-US', { month: 'long' });
          detectedName = `${year} - ${month} Statement`;
        }
        
        if (!detectedName) {
          const now = new Date();
          detectedName = `${now.getFullYear()} - ${now.toLocaleDateString('en-US', { month: 'long' })} Statement`;
        }
        
        setDetectedPeriod(detectedName);
        setPeriodName(detectedName);
        
        // Set detected dates
        if (minDate && maxDate) {
          setStartDate(minDate.toISOString().split('T')[0]);
          setEndDate(maxDate.toISOString().split('T')[0]);
        }
        
      } catch (error) {
        console.error("Error analyzing file:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const validateDates = async () => {
    if (!startDate || !endDate) return;
    
    setIsValidatingDates(true);
    try {
      const response = await fetch('/api/statements/validate-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });
      
      const validation = await response.json();
      setDateValidation(validation);
    } catch (error) {
      console.error("Error validating dates:", error);
      setDateValidation({ isValid: false, message: "Failed to validate dates" });
    } finally {
      setIsValidatingDates(false);
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

    if (startDate && endDate) {
      setStep("confirm-dates");
    } else {
      uploadMutation.mutate({ file: selectedFile, periodName: periodName.trim() });
    }
  };

  const handleConfirmUpload = () => {
    if (!selectedFile || !periodName.trim() || !startDate || !endDate) {
      toast({
        title: "Missing Information",
        description: "Please provide all required information.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ 
      file: selectedFile, 
      periodName: periodName.trim(),
      startDate,
      endDate
    });
  };

  const handleBack = () => {
    setStep("upload");
    setDateValidation(null);
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
          {step === "upload" && (
            <>
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
                <p>• Dates will be detected and validated for gaps/overlaps</p>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !periodName.trim() || uploadMutation.isPending}
                  className="flex-1"
                >
                  {uploadMutation.isPending ? "Creating Statement..." : "Next: Confirm Dates"}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === "confirm-dates" && (
            <>
              <div className="space-y-4">
                <h3 className="font-medium">Confirm Statement Period Dates</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <Button
                  onClick={validateDates}
                  disabled={!startDate || !endDate || isValidatingDates}
                  variant="outline"
                  size="sm"
                >
                  {isValidatingDates ? "Validating..." : "Validate Dates"}
                </Button>

                {dateValidation && (
                  <div className={`p-3 rounded-md ${dateValidation.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                    <p className={`text-sm font-medium ${dateValidation.isValid ? 'text-green-800' : 'text-red-800'}`}>
                      {dateValidation.isValid ? "✓ Dates Valid" : "⚠ Validation Issue"}
                    </p>
                    {dateValidation.message && (
                      <p className={`text-sm mt-1 ${dateValidation.isValid ? 'text-green-700' : 'text-red-700'}`}>
                        {dateValidation.message}
                      </p>
                    )}
                    {dateValidation.overlaps && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Overlapping with:</p>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                          {dateValidation.overlaps.map((overlap: any) => (
                            <li key={overlap.id}>{overlap.periodName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dateValidation.gaps && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-yellow-700">Detected gaps:</p>
                        <ul className="text-sm text-yellow-600 list-disc list-inside">
                          {dateValidation.gaps.map((gap: any, index: number) => (
                            <li key={index}>{gap.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={!dateValidation?.isValid || uploadMutation.isPending}
                  className="flex-1"
                >
                  {uploadMutation.isPending ? "Creating Statement..." : "Import CSV"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}