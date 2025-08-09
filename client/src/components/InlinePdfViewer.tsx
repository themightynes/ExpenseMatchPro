import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  ExternalLink,
  Download,
  FileText
} from 'lucide-react';

interface InlinePdfViewerProps {
  src: string;
  fileName?: string;
}

export default function InlinePdfViewer({ src, fileName }: InlinePdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [renderError, setRenderError] = useState(false);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedRef = useRef<HTMLEmbedElement>(null);
  const [useIframe, setUseIframe] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setCurrentPage(1);
    setTotalPages(1);
    setZoom(1);
    setRenderError(false);
    setLoading(true);
    setUseIframe(false);
  }, [src]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleOpenInNewTab = () => {
    window.open(src, '_blank');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName || 'receipt.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEmbedError = () => {
    console.log('Embed failed, trying iframe fallback');
    setUseIframe(true);
    setLoading(true);
  };

  const handleIframeError = () => {
    console.log('Both embed and iframe failed, showing fallback');
    setRenderError(true);
    setLoading(false);
  };

  const handleEmbedLoad = () => {
    setLoading(false);
    setRenderError(false);
  };

  const handleIframeLoad = () => {
    setLoading(false);
    setRenderError(false);
  };

  // Fallback UI when inline rendering fails
  if (renderError) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-blue-500" />
          <h3 className="text-lg font-medium mb-2">PDF Receipt</h3>
          <p className="text-sm text-gray-600 mb-4 truncate" title={fileName}>
            {fileName}
          </p>
          <div className="space-y-3">
            <Button onClick={handleOpenInNewTab} className="w-full" size="lg">
              <FileText className="h-5 w-5 mr-2" />
              Open PDF in New Tab
            </Button>
            <Button variant="outline" onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* PDF Controls - Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-2">
        <div className="flex items-center justify-between">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              aria-label="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-100 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
              <p className="text-sm text-gray-600">Loading PDF...</p>
            </div>
          </div>
        )}

        {!useIframe ? (
          <embed
            ref={embedRef}
            src={`${src}#page=${currentPage}&zoom=${Math.round(zoom * 100)}`}
            type="application/pdf"
            className="w-full h-full"
            onLoad={handleEmbedLoad}
            onError={handleEmbedError}
            style={{ 
              minHeight: '500px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={`${src}#page=${currentPage}&zoom=${Math.round(zoom * 100)}`}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{ 
              minHeight: '500px'
            }}
            title={`PDF Viewer - ${fileName}`}
          />
        )}
      </div>
    </div>
  );
}