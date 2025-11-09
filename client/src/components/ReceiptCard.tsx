import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReceiptViewer from "@/components/ReceiptViewer";
import type { Receipt } from "@shared/schema";
import { Eye } from "lucide-react";

interface ReceiptCardProps {
  receipt: Receipt;
  receipts?: Receipt[];
}

export default function ReceiptCard({ receipt, receipts = [] }: ReceiptCardProps) {
  const [showViewer, setShowViewer] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(receipt);
  
  // Sync currentReceipt with receipt prop and latest data from receipts array
  // This ensures the card always shows the most up-to-date receipt data
  useEffect(() => {
    // First, try to find the receipt in the receipts array (most up-to-date)
    const updatedReceipt = receipts.find(r => r.id === receipt.id);
    if (updatedReceipt) {
      setCurrentReceipt(updatedReceipt);
    } else {
      // If not in array, use prop (but this might mean it was deleted)
      setCurrentReceipt(receipt);
    }
  }, [receipt, receipts]);
  
  // Get the latest receipt data for display (from array if available, otherwise prop)
  const displayReceipt = receipts.find(r => r.id === receipt.id) || receipt;
  const getStatusBadge = (status: string, isMatched: boolean) => {
    if (status === "completed" && isMatched) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <i className="fas fa-check-circle mr-1"></i>
          Matched
        </Badge>
      );
    }
    
    // Check if manual entry is needed (no merchant, amount, or date)
    // Use displayReceipt to show latest data
    const needsManualEntry = !displayReceipt.merchant && !displayReceipt.amount && !displayReceipt.date;
    
    if (status === "completed" && !isMatched) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <i className="fas fa-exclamation-triangle mr-1"></i>
          {needsManualEntry ? "Manual Entry Needed" : "Needs Review"}
        </Badge>
      );
    }

    if (status === "processing") {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <i className="fas fa-edit mr-1"></i>
          Manual Entry Needed
        </Badge>
      );
    }

    if (status === "failed") {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <i className="fas fa-times-circle mr-1"></i>
          Failed
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        <i className="fas fa-clock mr-1"></i>
        Pending
      </Badge>
    );
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'fas fa-file-pdf text-red-500';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'fas fa-file-image text-blue-500';
    return 'fas fa-file text-gray-500';
  };

  const formatTimestamp = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        <i className={getFileIcon(displayReceipt.fileName)}></i>
      </div>
      <div className="ml-4 flex-1">
        <p className="font-medium text-gray-900 leading-tight break-words">
          {displayReceipt.organizedPath ? displayReceipt.organizedPath.split('/').pop() : (displayReceipt.originalFileName || displayReceipt.fileName)}
        </p>
        <div className="flex items-center mt-1">
          {getStatusBadge(displayReceipt.processingStatus, displayReceipt.isMatched || false)}
          <span className="text-sm text-gray-500 ml-2">
            {formatTimestamp(displayReceipt.createdAt)}
          </span>
          {displayReceipt.amount && (
            <span className="text-sm font-medium text-gray-700 ml-2">
              ${displayReceipt.amount}
            </span>
          )}
        </div>
        {displayReceipt.merchant && (
          <p className="text-sm text-gray-600 mt-1">{displayReceipt.merchant}</p>
        )}
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="p-2 text-gray-400 hover:text-gray-600"
        onClick={() => setShowViewer(true)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      <ReceiptViewer 
        receipt={currentReceipt} 
        receipts={receipts}
        isOpen={showViewer} 
        onClose={() => {
          setShowViewer(false);
          setCurrentReceipt(receipt); // Reset to original receipt when closing
        }}
        onNavigate={(newReceipt) => {
          setCurrentReceipt(newReceipt);
        }}
      />
    </div>
  );
}
