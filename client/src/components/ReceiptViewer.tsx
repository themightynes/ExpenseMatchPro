import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Save, 
  X, 
  FileText, 
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Trash2,
  Eye,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import type { Receipt } from '@shared/schema';

// Import react-image-crop for cropping functionality
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { Crop, PixelCrop } from 'react-image-crop';

interface ReceiptViewerProps {
  receipt: Receipt;
  receipts: Receipt[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (receipt: Receipt) => void;
}

function ReceiptViewer({ receipt, receipts, isOpen, onClose, onNavigate }: ReceiptViewerProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    merchant: '',
    amount: '',
    date: '',
    category: '',
  });

  // OCR trigger mutation
  const triggerOcrMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await fetch(`/api/receipts/${receiptId}/ocr`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `OCR failed with status ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      toast({
        title: "OCR started",
        description: "Processing receipt text - results will appear shortly",
      });
    },
    onError: (error: any) => {
      toast({
        title: "OCR failed to start",
        description: error.message || "Could not start OCR processing",
        variant: "destructive",
      });
    },
  });

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Delete failed with status ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/financial-stats'] });
      toast({
        title: "Receipt deleted",
        description: "Receipt has been permanently deleted",
      });
      onClose(); // Close the viewer
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete receipt. Please try again.",
        variant: "destructive",
      });
    },
  });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Touch handling for pinch-to-zoom
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // Find current receipt index
  const currentIndex = receipts.findIndex(r => r.id === receipt.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < receipts.length - 1;

  // Image handling
  const imageUrl = receipt.fileUrl?.startsWith('http') ? receipt.fileUrl : 
                   receipt.fileUrl?.startsWith('/') ? `${window.location.origin}${receipt.fileUrl}` : 
                   receipt.fileUrl;
  const isPDF = receipt.originalFileName?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (hasPrevious) navigatePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (hasNext) navigateNext();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, hasPrevious, hasNext]);

  // Touch event handlers for pinch-to-zoom
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return null;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      if (currentDistance) {
        const scale = currentDistance / lastTouchDistance;
        const newZoom = Math.max(0.5, Math.min(3, zoom * scale));
        setZoom(newZoom);
        setLastTouchDistance(currentDistance);
      }
    }
  }, [lastTouchDistance, zoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setLastTouchDistance(null);
    }
  }, []);

  // Zoom control functions
  const zoomIn = () => setZoom(prev => Math.min(3, prev + 0.25));
  const zoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.25));
  const resetZoom = () => setZoom(1);
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  const navigatePrevious = useCallback(() => {
    if (hasPrevious) {
      onNavigate(receipts[currentIndex - 1]);
    }
  }, [hasPrevious, currentIndex, receipts, onNavigate]);

  const navigateNext = useCallback(() => {
    if (hasNext) {
      onNavigate(receipts[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, receipts, onNavigate]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  }, []);

  const handleSave = async () => {
    try {
      // Validate at least one field is provided
      if (!editedData.merchant?.trim() && !editedData.amount?.trim() && !editedData.date?.trim() && !editedData.category?.trim()) {
        toast({
          title: "Validation Error",
          description: "Please provide at least one piece of information (merchant, amount, date, or category).",
          variant: "destructive",
        });
        return;
      }

      console.log('Saving receipt data:', editedData);
      
      const response = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(editedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Update failed with status ${response.status}`);
      }

      const updatedReceipt = await response.json();
      console.log('Receipt updated successfully:', updatedReceipt);

      toast({
        title: "Receipt updated",
        description: "Receipt information has been saved successfully.",
      });

      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/financial-stats'] });
    } catch (error) {
      console.error('Failed to save receipt:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save receipt information.",
        variant: "destructive",
      });
    }
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

  const needsManualEntry = !receipt.merchant && !receipt.amount && !receipt.date;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Mobile Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate text-base">
              {receipt.organizedPath ? receipt.organizedPath.split('/').pop() : receipt.originalFileName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {currentIndex >= 0 && receipts.length > 1 && (
                <span className="text-sm text-gray-500">
                  {currentIndex + 1} of {receipts.length}
                </span>
              )}
              {receipt.isMatched && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                  Matched
                </Badge>
              )}
              {needsManualEntry && (
                <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                  Needs Entry
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {receipts.length > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={navigatePrevious} 
              disabled={!hasPrevious}
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={navigateNext} 
              disabled={!hasNext}
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Receipt Image/PDF Viewer */}
        <div className="flex-1 bg-gray-100 overflow-auto relative">
          <div 
            ref={imageContainerRef}
            className="flex justify-center items-center min-h-full p-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {imageUrl ? (
              isPDF ? (
                <div className="w-full max-w-sm">
                  <Card className="text-center">
                    <CardContent className="p-6">
                      <FileText className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                      <h3 className="text-lg font-medium mb-2">PDF Receipt</h3>
                      <p className="text-sm text-gray-600 mb-4 truncate" title={receipt.originalFileName}>
                        {receipt.originalFileName}
                      </p>
                      <div className="space-y-3">
                        <Button 
                          onClick={() => window.open(imageUrl, '_blank')}
                          className="w-full"
                          size="lg"
                        >
                          <FileText className="h-5 w-5 mr-2" />
                          Open PDF in New Tab
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = receipt.originalFileName || 'receipt.pdf';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="w-full max-w-4xl">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={receipt.originalFileName}
                    onLoad={onImageLoad}
                    className="w-full h-auto rounded-lg shadow-lg touch-none"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: 'center',
                      transition: zoom === 1 && rotation === 0 ? 'transform 0.2s ease-in-out' : 'none'
                    }}
                    onError={(e) => {
                      console.error("Failed to load image:", imageUrl);
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                    }}
                  />
                </div>
              )
            ) : (
              <div className="text-center text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4" />
                <p>Unable to load receipt image</p>
              </div>
            )}
          </div>
          
          {/* Zoom Controls - Only show for images, not PDFs */}
          {imageUrl && !isPDF && (
            <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                className="p-2 h-8 w-8"
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                className="p-2 h-8 w-8"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetZoom}
                className="p-2 h-8 w-8"
                disabled={zoom === 1 && rotation === 0}
              >
                <span className="text-xs font-mono">1:1</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={rotate}
                className="p-2 h-8 w-8"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Zoom indicator */}
          {imageUrl && !isPDF && zoom !== 1 && (
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-sm">
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>

        {/* Mobile Bottom Panel - Receipt Details */}
        <div className="bg-white border-t border-gray-200 max-h-[50vh] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Edit Form */}
            {isEditing ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Edit Receipt Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="merchant">Merchant</Label>
                    <Input
                      id="merchant"
                      value={editedData.merchant}
                      onChange={(e) => setEditedData(prev => ({ ...prev, merchant: e.target.value }))}
                      placeholder="Enter merchant name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      value={editedData.amount}
                      onChange={(e) => setEditedData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Enter amount"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={editedData.date}
                      onChange={(e) => setEditedData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={editedData.category} onValueChange={(value) => setEditedData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meals">Meals</SelectItem>
                        <SelectItem value="Travel">Travel</SelectItem>
                        <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                        <SelectItem value="Entertainment">Entertainment</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Receipt Details Display */
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Receipt Details</CardTitle>
                    {!receipt.isMatched && (
                      <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Merchant</label>
                      <p className="text-base font-medium">{receipt.merchant || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Amount</label>
                      <p className="text-base font-medium text-green-600">
                        {receipt.amount ? `$${receipt.amount}` : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date</label>
                      <p className="text-base">
                        {receipt.date ? new Date(receipt.date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Category</label>
                      <p className="text-base">{receipt.category || 'Not set'}</p>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={receipt.processingStatus === 'completed' ? 'default' : 'secondary'}>
                        {needsManualEntry ? 'Manual Entry Needed' : receipt.processingStatus}
                      </Badge>
                      {receipt.isMatched && <Badge variant="default">Matched to AMEX</Badge>}
                      
                      {/* OCR Status and Control */}
                      {receipt.processingStatus === 'processing' ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing OCR
                        </Badge>
                      ) : receipt.ocrText === 'Manual entry required' || receipt.ocrText === 'OCR failed - manual entry required' || (receipt.ocrText && receipt.ocrText.includes('PDF receipt detected')) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerOcrMutation.mutate(receipt.id)}
                          disabled={triggerOcrMutation.isPending}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                        >
                          {triggerOcrMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              Extract Text
                            </>
                          )}
                        </Button>
                      ) : receipt.ocrText && receipt.ocrText !== 'Processing...' && receipt.ocrText.length > 50 ? (
                        <Badge variant="default" className="text-green-700 bg-green-100">
                          OCR Complete
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* File Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">File Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-500">Original Name</label>
                  <p className="text-sm break-all">{receipt.originalFileName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Upload Date</label>
                  <p className="text-sm">{receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : 'Unknown'}</p>
                </div>
                <div className="pt-3">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
                        deleteReceiptMutation.mutate(receipt.id);
                      }
                    }}
                    disabled={deleteReceiptMutation.isPending}
                    className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteReceiptMutation.isPending ? 'Deleting...' : 'Delete Receipt'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden canvas for crop processing */}
      <canvas
        ref={previewCanvasRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
        }}
      />
    </div>
  );
}

export default ReceiptViewer;