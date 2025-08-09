import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ZoomIn, ZoomOut, RotateCw, Save, Edit, Lock, Download, FileText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Receipt } from "@shared/schema";

interface ReceiptViewerProps {
  receipt: Receipt;
  isOpen: boolean;
  onClose: () => void;
}

const EXPENSE_CATEGORIES = [
  "Restaurant-Bar & Café",
  "Restaurant-Restaurant", 
  "Travel-Airfare",
  "Travel-Hotel",
  "Transportation-Ground",
  "Office Supplies",
  "Software & Technology",
  "Entertainment",
  "Fuel-Gas",
  "Parking & Tolls",
  "Other"
];

export default function ReceiptViewer({ receipt, isOpen, onClose }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    merchant: receipt.merchant || "",
    amount: receipt.amount || "",
    date: receipt.date ? new Date(receipt.date).toISOString().split('T')[0] : "",
    category: receipt.category || "",
  });
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update receipt');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Receipt Updated",
        description: "Receipt data has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to save receipt data. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isOpen) return null;

  const imageUrl = receipt.fileUrl ? `/objects/${receipt.fileUrl.split('/objects/')[1]}` : null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleSave = () => {
    const updates = {
      merchant: editedData.merchant,
      amount: editedData.amount,
      date: editedData.date ? new Date(editedData.date) : null,
      category: editedData.category,
    };
    updateMutation.mutate(updates);
  };

  const handleEdit = () => {
    setEditedData({
      merchant: receipt.merchant || "",
      amount: receipt.amount || "",
      date: receipt.date ? new Date(receipt.date).toISOString().split('T')[0] : "",
      category: receipt.category || "",
    });
    setIsEditing(true);
  };

  const isProcessing = receipt.processingStatus === 'processing';
  const canEdit = !receipt.isMatched; // Allow editing unless already matched

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{receipt.originalFileName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={receipt.processingStatus === 'completed' ? 'default' : 'secondary'}>
                {receipt.processingStatus}
              </Badge>
              {receipt.isMatched && <Badge variant="default">Matched</Badge>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex">
          {/* Image Panel */}
          <div className="flex-1 bg-gray-100 relative overflow-auto" style={{ maxHeight: '70vh' }}>
            {imageUrl ? (
              <div className="p-4 flex justify-center items-center min-h-full">
                <img
                  src={imageUrl}
                  alt={receipt.originalFileName}
                  className="max-w-full h-auto shadow-lg"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                  onError={(e) => {
                    console.error("Failed to load image:", imageUrl);
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2" />
                  <p>No image available</p>
                </div>
              </div>
            )}

            {/* Image Controls */}
            {imageUrl && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="px-3 py-1 text-sm font-medium">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleRotate}>
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(imageUrl, '_blank')}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Details Panel */}
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto" style={{ maxHeight: '70vh' }}>
            <div className="p-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Receipt Details</CardTitle>
                    {canEdit && (
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={handleSave}
                              disabled={updateMutation.isPending}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditing(false)}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEdit}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                    {!canEdit && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  {isProcessing && (
                    <p className="text-xs text-blue-600 mt-1">
                      OCR processing... You can manually enter data below to speed up the workflow.
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="merchant" className="text-xs text-gray-500">
                          Merchant
                        </Label>
                        <Input
                          id="merchant"
                          value={editedData.merchant}
                          onChange={(e) => setEditedData(prev => ({ ...prev, merchant: e.target.value }))}
                          placeholder="Enter merchant name"
                          className="mt-1 text-sm h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="amount" className="text-xs text-gray-500">
                          Amount
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={editedData.amount}
                          onChange={(e) => setEditedData(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="Enter amount"
                          className="mt-1 text-sm h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="date" className="text-xs text-gray-500">
                          Date
                        </Label>
                        <Input
                          id="date"
                          type="date"
                          value={editedData.date}
                          onChange={(e) => setEditedData(prev => ({ ...prev, date: e.target.value }))}
                          className="mt-1 text-sm h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="category" className="text-xs text-gray-500">
                          Category
                        </Label>
                        <Select
                          value={editedData.category}
                          onValueChange={(value) => setEditedData(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger className="mt-1 text-sm h-8">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Merchant</label>
                        <p className="text-sm">{receipt.merchant || 'Not detected'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Amount</label>
                        <p className="text-sm font-semibold">{receipt.amount ? `$${receipt.amount}` : 'Not detected'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Date</label>
                        <p className="text-sm">{receipt.date ? new Date(receipt.date).toLocaleDateString() : 'Not detected'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Category</label>
                        <p className="text-sm">{receipt.category || 'Not assigned'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {receipt.ocrText && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">OCR Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono">{receipt.ocrText}</pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">File Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500">File Name</label>
                    <p className="text-sm">{receipt.fileName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Original Name</label>
                    <p className="text-sm">{receipt.originalFileName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Upload Date</label>
                    <p className="text-sm">{receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : 'Unknown'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}