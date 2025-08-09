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
  const [selectedStatementId, setSelectedStatementId] = useState<string>("");
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, statementId }: { file: File; statementId: string }) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('statementId', statementId);

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
      toast({
        title: "CSV Import Successful",
        description: `Imported ${data.imported} charges with ${data.errors} errors.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onClose();
      setSelectedFile(null);
      setSelectedStatementId("");
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedStatementId) {
      toast({
        title: "Missing Information",
        description: "Please select both a CSV file and a statement period.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, statementId: selectedStatementId });
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
              Select Statement Period
            </label>
            <select
              value={selectedStatementId}
              onChange={(e) => setSelectedStatementId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Choose statement period...</option>
              {statements.map((statement) => (
                <option key={statement.id} value={statement.id}>
                  {statement.periodName}
                </option>
              ))}
            </select>
          </div>

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
          </div>

          <div className="text-xs text-gray-500">
            <p>• Export your AMEX statement as CSV from online banking</p>
            <p>• Include all columns from the statement</p>
            <p>• Only expense charges will be imported (payments skipped)</p>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedStatementId || uploadMutation.isPending}
              className="flex-1"
            >
              {uploadMutation.isPending ? "Importing..." : "Import CSV"}
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