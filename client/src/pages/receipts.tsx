import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Folder, FolderOpen, File, Search, Eye, ChevronRight, ChevronDown, ArrowLeft, Upload, Plus } from "lucide-react";
import { Link } from "wouter";
import MobileHeader from "@/components/MobileHeader";
import FileUploadZone from "@/components/FileUploadZone";
import ReceiptViewer from "@/components/ReceiptViewer";
import type { Receipt, AmexStatement } from "@shared/schema";

interface FolderStructure {
  [key: string]: {
    receipts: Receipt[];
    folders?: FolderStructure;
  };
}

export default function ReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: statements = [] } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  // Build folder structure based on receipt organization
  const buildFolderStructure = (receipts: Receipt[], statements: AmexStatement[]): FolderStructure => {
    const structure: FolderStructure = {};
    
    // Create statement folders
    statements.forEach(statement => {
      const folderName = statement.periodName;
      structure[folderName] = {
        receipts: [],
        folders: {
          "Matched": { receipts: [] },
          "Unmatched": { receipts: [] }
        }
      };
    });

    // Add special folders
    structure["Inbox_New"] = { receipts: [] };
    structure["Unmatched"] = { receipts: [] };
    structure["Non-Reimbursable"] = { receipts: [] };

    // Organize receipts into folders
    receipts.forEach(receipt => {
      if (receipt.statementId && receipt.isMatched) {
        const statement = statements.find(s => s.id === receipt.statementId);
        if (statement && structure[statement.periodName]?.folders) {
          structure[statement.periodName].folders!["Matched"].receipts.push(receipt);
        }
      } else if (receipt.statementId && !receipt.isMatched) {
        const statement = statements.find(s => s.id === receipt.statementId);
        if (statement && structure[statement.periodName]?.folders) {
          structure[statement.periodName].folders!["Unmatched"].receipts.push(receipt);
        }
      } else {
        // Unassigned receipts go to Inbox_New
        structure["Inbox_New"].receipts.push(receipt);
      }
    });

    return structure;
  };

  const folderStructure = buildFolderStructure(receipts, statements);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getReceiptStatusBadge = (receipt: Receipt) => {
    if (receipt.isMatched) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Matched</Badge>;
    }
    
    const needsManualEntry = !receipt.merchant && !receipt.amount && !receipt.date;
    if (needsManualEntry) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Manual Entry Needed</Badge>;
    }
    
    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Ready</Badge>;
  };

  const filteredReceipts = receipts.filter(receipt => 
    searchTerm === "" || 
    receipt.originalFileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.merchant?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderFolder = (
    folderName: string, 
    folderData: { receipts: Receipt[]; folders?: FolderStructure }, 
    level: number = 0,
    parentPath: string = ""
  ) => {
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    const isExpanded = expandedFolders.has(folderPath);
    const hasSubfolders = folderData.folders && Object.keys(folderData.folders).length > 0;
    const totalReceipts = folderData.receipts.length + 
      (folderData.folders ? Object.values(folderData.folders).reduce((sum, folder) => sum + folder.receipts.length, 0) : 0);

    // Filter receipts for search
    const displayReceipts = searchTerm 
      ? folderData.receipts.filter(r => filteredReceipts.includes(r))
      : folderData.receipts;

    return (
      <Card key={folderPath} className={`${level > 0 ? 'ml-3' : ''} mb-3`}>
        {/* Folder Header */}
        <div
          className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50"
          onClick={() => toggleFolder(folderPath)}
        >
          {hasSubfolders && (
            isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
          {isExpanded && hasSubfolders ? (
            <FolderOpen className="h-6 w-6 text-amber-500" />
          ) : (
            <Folder className="h-6 w-6 text-amber-600" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">{folderName.replace(/_/g, ' ')}</h3>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {totalReceipts}
          </Badge>
        </div>

        {/* Folder Contents */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {/* Direct receipts in this folder */}
            {displayReceipts.map(receipt => (
              <div
                key={receipt.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 active:bg-gray-50 cursor-pointer shadow-sm"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <File className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {receipt.originalFileName}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {getReceiptStatusBadge(receipt)}
                    {receipt.merchant && (
                      <span className="text-sm text-gray-600 truncate">{receipt.merchant}</span>
                    )}
                  </div>
                  {receipt.amount && (
                    <div className="mt-1">
                      <span className="text-lg font-bold text-green-600">${receipt.amount}</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}

            {/* Subfolders */}
            {folderData.folders && Object.entries(folderData.folders).map(([subFolderName, subFolderData]) =>
              renderFolder(subFolderName, subFolderData, level + 1, folderPath)
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader 
        title="Receipts"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
            className="p-1 h-8 w-8"
          >
            <Plus className="w-4 h-4" />
          </Button>
        }
      />

      <div className="px-4 py-6">
        {/* Upload Section */}
        {showUpload && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Upload Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadZone 
                onUploadComplete={() => {
                  setShowUpload(false);
                  // Refresh receipts data
                  window.location.reload();
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search receipts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4">
          <Badge variant="outline" className="text-sm">
            {receipts.length} Total Receipts
          </Badge>
        </div>

        {/* Mobile-Optimized Receipt List */}
        {receiptsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts yet</h3>
              <p className="text-gray-600 mb-4">Start by uploading your first receipt</p>
              <Button onClick={() => setShowUpload(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Receipt
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(folderStructure).map(([folderName, folderData]) =>
              renderFolder(folderName, folderData)
            )}
          </div>
        )}
      </div>

      {/* Receipt Viewer Modal */}
      {selectedReceipt && (
        <ReceiptViewer
          receipt={selectedReceipt}
          receipts={receipts}
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onNavigate={(receipt) => setSelectedReceipt(receipt)}
        />
      )}
    </div>
  );
}