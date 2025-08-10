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

interface PDFPageRendererProps {
  pdfDoc: any;
  pageNumber: number;
  zoom: number;
  panPosition: { x: number; y: number };
  isDragging: boolean;
}

function PDFPageRenderer({ pdfDoc, pageNumber, zoom, panPosition, isDragging }: PDFPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setPageLoading(true);
        
        const page = await pdfDoc.getPage(pageNumber);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Calculate scale for high-DPI displays
        const devicePixelRatio = window.devicePixelRatio || 1;
        const scale = zoom * devicePixelRatio;

        // Get viewport
        const viewport = page.getViewport({ scale });
        
        // Set canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setPageLoading(false);
        
      } catch (error) {
        console.error('Error rendering PDF page:', error);
        setPageLoading(false);
      }
    };

    renderPage();
  }, [pdfDoc, pageNumber, zoom]);

  return (
    <div className="relative">
      {pageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Rendering page {pageNumber}...</p>
          </div>
        </div>
      )}
      <canvas 
        ref={canvasRef}
        className="max-w-full h-auto rounded-lg shadow-lg bg-white"
        style={{
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
          transition: !isDragging ? 'transform 0.1s ease-out' : 'none',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      />
    </div>
  );
}

export default function InlinePdfViewer({ src, fileName }: InlinePdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [renderError, setRenderError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedRef = useRef<HTMLEmbedElement>(null);
  const [useIframe, setUseIframe] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Load PDF.js and initialize PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setRenderError(false);
        
        // Dynamic import of PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument(src);
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setZoom(1);
        setPanPosition({ x: 0, y: 0 });
        setLoading(false);
        
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        
      } catch (error) {
        console.error('Failed to load PDF with PDF.js:', error);
        // Fallback to iframe/embed approach
        setUseIframe(true);
        setLoading(false);
      }
    };

    if (src) {
      loadPdf();
    }
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

  // Pan functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPanPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPanPoint.x;
      const deltaY = touch.clientY - lastPanPoint.y;
      
      setPanPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Reset pan when zoom changes
  useEffect(() => {
    if (zoom === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

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
    <div className="w-full h-full flex flex-col max-w-full overflow-hidden">
      {/* PDF Controls - Sticky toolbar */}
      {/* MOBILE: Improved touch targets and responsive controls */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-2">
        <div className="flex items-center justify-between gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[60px] sm:min-w-[80px] text-center">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              aria-label="Zoom out"
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-mono min-w-[40px] sm:min-w-[50px] text-center hidden sm:inline">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              aria-label="Zoom in"
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              aria-label="Open in new tab"
              className="min-h-[44px] min-w-[44px] p-2"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              aria-label="Download PDF"
              className="min-h-[44px] min-w-[44px] p-2"
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
              <p className="text-xs text-gray-500 mt-2">Initializing advanced viewer...</p>
            </div>
          </div>
        )}

        {pdfDoc && !loading ? (
          <div 
            className="flex justify-center items-center min-h-full p-4"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              touchAction: zoom > 1 ? 'none' : 'auto'
            }}
          >
            <div className="relative">
              <PDFPageRenderer 
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                zoom={zoom}
                panPosition={panPosition}
                isDragging={isDragging}
              />
              
              {/* Zoom indicator */}
              {zoom !== 1 && (
                <div className="absolute bottom-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-sm">
                  {Math.round(zoom * 100)}%
                </div>
              )}
              
              {/* Page indicator for multi-page PDFs */}
              {totalPages > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-sm">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>
          </div>
        ) : useIframe && !pdfDoc ? (
          // Fallback to iframe if PDF.js fails
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
        ) : null}
      </div>
    </div>
  );
}