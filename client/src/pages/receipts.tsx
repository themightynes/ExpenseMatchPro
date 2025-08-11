import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Folder, FolderOpen, File, Search, Eye, ChevronRight, ChevronDown, ArrowLeft, Upload, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import MobileHeader from "@/components/MobileHeader";
import FileUploadZone from "@/components/FileUploadZone";
import ReceiptViewer from "@/components/ReceiptViewer";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Receipt, AmexStatement } from "@shared/schema";

interface FolderStructure {
  [key: string]: {
    receipts: Receipt[];
    folders?: FolderStructure;
  };
}

export default function ReceiptsPage() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [assigningReceipts, setAssigningReceipts] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: statements = [] } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  // Mutation for assigning receipts to statement periods
  const assignReceiptToStatement = useMutation({
    mutationFn: async ({ receiptId, statementId }: { receiptId: string; statementId: string }) => {
      const response = await fetch(`/api/receipts/${receiptId}/assign-to-statement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign receipt to statement");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      toast({
        title: "Success",
        description: "Receipt assigned to statement period successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle URL parameter for selected receipt
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const selectedReceiptId = urlParams.get('selected');
    
    if (selectedReceiptId && receipts.length > 0) {
      const receipt = receipts.find(r => r.id === selectedReceiptId);
      if (receipt) {
        setSelectedReceipt(receipt);
      }
    }
  }, [location, receipts]);

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
              <div key={receipt.id} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <File className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {receipt.organizedPath ? receipt.organizedPath.split('/').pop() : receipt.originalFileName}
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReceipt(receipt)}
                      className="p-1 h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Show assignment controls only for INBOX NEW receipts */}
                {folderName === "Inbox_New" && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={async (statementId) => {
                          setAssigningReceipts(prev => ({ ...prev, [receipt.id]: true }));
                          try {
                            await assignReceiptToStatement.mutateAsync({ receiptId: receipt.id, statementId });
                          } finally {
                            setAssigningReceipts(prev => ({ ...prev, [receipt.id]: false }));
                          }
                        }}
                        disabled={assigningReceipts[receipt.id]}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder={assigningReceipts[receipt.id] ? "Assigning..." : "Assign to Period"} />
                        </SelectTrigger>
                        <SelectContent>
                          {statements
                            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
                            .map((statement) => (
                              <SelectItem key={statement.id} value={statement.id}>
                                {statement.periodName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
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
            className="p-1 h-8 w-8 min-h-[44px] min-w-[44px]"
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
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Search */}
        {/* MOBILE: Improved search with larger touch target */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search receipts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-base min-h-[44px]"
              style={{ fontSize: '16px' }}
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