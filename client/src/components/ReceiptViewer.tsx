import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ZoomIn, ZoomOut, RotateCw, Download, FileText } from "lucide-react";
import type { Receipt } from "@shared/schema";

interface ReceiptViewerProps {
  receipt: Receipt;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptViewer({ receipt, isOpen, onClose }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const imageUrl = receipt.fileUrl ? `/objects/${receipt.fileUrl.split('/objects/')[1]}` : null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

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
                  <CardTitle className="text-sm">Receipt Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receipt.merchant && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Merchant</label>
                      <p className="text-sm">{receipt.merchant}</p>
                    </div>
                  )}
                  {receipt.amount && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Amount</label>
                      <p className="text-sm font-semibold">${receipt.amount}</p>
                    </div>
                  )}
                  {receipt.date && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Date</label>
                      <p className="text-sm">{new Date(receipt.date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {receipt.category && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Category</label>
                      <p className="text-sm">{receipt.category}</p>
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