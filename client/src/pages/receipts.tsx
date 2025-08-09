import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Folder, FolderOpen, File, Search, Eye, ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
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
      <div key={folderPath} className={`${level > 0 ? 'ml-4' : ''}`}>
        {/* Folder Header */}
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
          onClick={() => toggleFolder(folderPath)}
        >
          {hasSubfolders && (
            isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          {isExpanded && hasSubfolders ? (
            <FolderOpen className="h-5 w-5 text-amber-500" />
          ) : (
            <Folder className="h-5 w-5 text-amber-600" />
          )}
          <span className="font-medium text-gray-900">{folderName}</span>
          <Badge variant="secondary" className="ml-auto">
            {totalReceipts}
          </Badge>
        </div>

        {/* Folder Contents */}
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {/* Direct receipts in this folder */}
            {displayReceipts.map(receipt => (
              <div
                key={receipt.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <File className="h-4 w-4 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {receipt.originalFileName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {getReceiptStatusBadge(receipt)}
                    {receipt.merchant && (
                      <span className="text-xs text-gray-500">{receipt.merchant}</span>
                    )}
                    {receipt.amount && (
                      <span className="text-xs font-medium text-gray-900">${receipt.amount}</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Subfolders */}
            {folderData.folders && Object.entries(folderData.folders).map(([subFolderName, subFolderData]) =>
              renderFolder(subFolderName, subFolderData, level + 1, folderPath)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-3">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Folder className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">All Receipts</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Receipt Folders</span>
              <Badge variant="outline">
                {receipts.length} Total Receipts
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receiptsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading receipts...</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No receipts found. Start by uploading your first receipt.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(folderStructure).map(([folderName, folderData]) =>
                  renderFolder(folderName, folderData)
                )}
              </div>
            )}
          </CardContent>
        </Card>
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