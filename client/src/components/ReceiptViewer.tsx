import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ZoomIn, ZoomOut, RotateCw, Save, Edit, Lock, Download, FileText, Crop, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactCrop, { Crop as CropType, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
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
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [editedData, setEditedData] = useState({
    merchant: receipt.merchant || "",
    amount: receipt.amount || "",
    date: receipt.date ? new Date(receipt.date).toISOString().split('T')[0] : "",
    category: receipt.category || "",
  });
  const { toast } = useToast();

  // Crop utility functions
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        16 / 9,
        width,
        height,
      ),
      width,
      height,
    ));
  }, []);

  const canvasPreview = useCallback((
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    crop: PixelCrop,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    canvas.width = crop.width * pixelRatio * scaleX;
    canvas.height = crop.height * pixelRatio * scaleY;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY,
    );
  }, []);

  const applyCrop = useCallback(async () => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) return;

    const canvas = previewCanvasRef.current;
    canvasPreview(imgRef.current, canvas, completedCrop);

    // Convert canvas to blob and update the image
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      
      // Create a new image element to replace the current one
      const newImg = new Image();
      newImg.onload = () => {
        if (imgRef.current) {
          imgRef.current.src = url;
        }
        URL.revokeObjectURL(url);
        setIsCropping(false);
        setCrop(undefined);
        setCompletedCrop(undefined);
        
        toast({
          title: "Image cropped successfully",
          description: "The receipt image has been cropped.",
        });
      };
      newImg.src = url;
    }, 'image/jpeg', 0.95);
  }, [completedCrop, canvasPreview, toast]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      console.log("Updating receipt with data:", updates);
      const response = await apiRequest("PATCH", `/api/receipts/${receipt.id}`, updates);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update failed:", response.status, errorText);
        throw new Error(`Update failed: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Receipt updated successfully:", data);
      
      // Check if auto-matching occurred
      if (data.autoMatched) {
        toast({
          title: "Receipt auto-matched!",
          description: `Automatically matched to AMEX charge with ${data.matchConfidence}% confidence. ${data.matchReason}`,
          duration: 6000,
        });
      } else {
        toast({
          title: "Receipt Updated",
          description: "Receipt data has been saved successfully.",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Update mutation error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to save receipt data. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isOpen) return null;

  const imageUrl = receipt.fileUrl ? `/objects/${receipt.fileUrl.split('/objects/')[1]}` : null;
  const isPDF = receipt.originalFileName?.toLowerCase().endsWith('.pdf') || false;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleSave = () => {
    const updates = {
      merchant: editedData.merchant || null,
      amount: editedData.amount || null,
      date: editedData.date || null,
      category: editedData.category || null,
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
  const needsManualEntry = !receipt.merchant && !receipt.amount && !receipt.date;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{receipt.originalFileName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={receipt.processingStatus === 'completed' ? 'default' : 'secondary'}>
                {needsManualEntry ? 'Manual Entry Needed' : receipt.processingStatus}
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
                {isPDF ? (
                  <div className="w-full h-full">
                    <iframe
                      src={imageUrl}
                      title={receipt.originalFileName}
                      className="w-full h-full min-h-[500px] border-0 shadow-lg rounded"
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'center top',
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    />
                  </div>
                ) : isCropping ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={undefined}
                    minWidth={50}
                    minHeight={50}
                  >
                    <img
                      ref={imgRef}
                      src={imageUrl}
                      alt={receipt.originalFileName}
                      onLoad={onImageLoad}
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
                  </ReactCrop>
                ) : (
                  <img
                    ref={imgRef}
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
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2" />
                  <p>No image available</p>
                </div>
              </div>
            )}

            {/* File Controls */}
            {imageUrl && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="px-3 py-1 text-sm font-medium">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                {!isPDF && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleRotate}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setIsCropping(!isCropping);
                        if (isCropping) {
                          setCrop(undefined);
                          setCompletedCrop(undefined);
                        }
                      }}
                    >
                      <Crop className="h-4 w-4" />
                    </Button>
                    {isCropping && completedCrop && (
                      <Button variant="outline" size="sm" onClick={applyCrop}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
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