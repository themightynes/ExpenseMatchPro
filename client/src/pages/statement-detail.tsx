import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft,
  CheckCircle, 
  XCircle, 
  User, 
  DollarSign, 
  Calendar,
  StickyNote,
  Eye,
  EyeOff,
  MessageSquare,
  Edit3,
  Filter,
  Search,
  Download,
  TrendingUp,
  Receipt,
  Building,
  MapPin,
  FileText,
  Plus,
  AlertCircle,
  Trash2,
  CreditCard
} from "lucide-react";
import { AmexStatement, AmexCharge, Receipt as ReceiptType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import ManualChargeModal from "@/components/ManualChargeModal";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StatementDetailPage() {
  const [, params] = useRoute("/statements/:id");
  const statementId = params?.id;
  const { toast } = useToast();

  // All useState hooks at the top
  const [notes, setNotes] = useState("");
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedChargeNotes, setSelectedChargeNotes] = useState<{ [key: string]: boolean }>({});
  const [chargeNotes, setChargeNotes] = useState<{ [key: string]: string }>({});
  const [uploadingCharges, setUploadingCharges] = useState<{ [key: string]: boolean }>({});
  const [showManualChargeModal, setShowManualChargeModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [convertingReceipts, setConvertingReceipts] = useState<{ [key: string]: boolean }>({});

  // All useQuery hooks together
  const { data: statement } = useQuery<AmexStatement>({
    queryKey: ["/api/statements", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}`).then(res => res.json()),
    enabled: !!statementId,
  });

  const { data: charges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}/charges`).then(res => res.json()),
    enabled: !!statementId,
  });

  const { data: receipts = [] } = useQuery<ReceiptType[]>({
    queryKey: ["/api/receipts", statementId],
    queryFn: () => fetch(`/api/statements/${statementId}/receipts`).then(res => res.json()),
    enabled: !!statementId,
  });

  // Get unmatched receipts for this statement period
  const { data: unmatchedReceipts = [] } = useQuery<ReceiptType[]>({
    queryKey: ["/api/statements", statementId, "unmatched-receipts"],
    queryFn: () => fetch(`/api/statements/${statementId}/unmatched-receipts`).then(res => res.json()),
    enabled: !!statementId,
  });

  // Mutation for creating non-AMEX charges from receipts
  const createNonAmexCharge = useMutation({
    mutationFn: async ({ receiptId, statementId }: { receiptId: string; statementId: string }) => {
      const response = await fetch("/api/charges/create-from-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, statementId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create non-AMEX charge");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/charges", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements", statementId, "unmatched-receipts"] });
      toast({
        title: "Success",
        description: "Receipt converted to non-AMEX charge successfully.",
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

  // Get all statements for the manual charge modal
  const { data: allStatements = [] } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
    queryFn: () => fetch("/api/statements").then(res => res.json()),
  });

  // All useMutation hooks together
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/statements/${statementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      toast({
        title: "Notes Updated",
        description: "Statement notes have been saved successfully.",
      });
    },
  });

  const updateChargeNotesMutation = useMutation({
    mutationFn: async ({ chargeId, notes }: { chargeId: string; notes: string }) => {
      const response = await fetch(`/api/charges/${chargeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: notes }),
      });
      if (!response.ok) throw new Error('Failed to update charge notes');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      toast({
        title: "Notes Updated",
        description: "Charge notes have been saved successfully.",
      });
    },
  });

  const togglePersonalExpenseMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const response = await fetch(`/api/charges/${chargeId}/toggle-personal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to toggle personal expense');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      toast({
        title: "Personal Expense Updated",
        description: data.message,
      });
    },
  });

  const toggleNoReceiptRequiredMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const response = await fetch(`/api/charges/${chargeId}/toggle-no-receipt-required`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to toggle no receipt required');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Receipt Requirement Updated",
        description: data.message,
      });
    },
  });

  // Quick match mutation for linking receipts to charges
  const quickMatchMutation = useMutation({
    mutationFn: async ({ receiptId, chargeId }: { receiptId: string; chargeId: string }) => {
      const response = await fetch('/api/matching/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, chargeId }),
      });
      if (!response.ok) throw new Error('Failed to match receipt');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/charges", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements", statementId, "unmatched-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Receipt Matched",
        description: "Receipt has been successfully linked to the charge.",
      });
    },
    onError: (error) => {
      console.error("Error matching:", error);
      toast({
        title: "Match Failed",
        description: "There was an error linking the receipt. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete charge mutation
  const deleteChargeMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const response = await fetch(`/api/charges/${chargeId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete charge');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/statements", statementId, "charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Charge Deleted",
        description: "The charge has been successfully deleted.",
      });
    },
    onError: (error) => {
      console.error("Error deleting charge:", error);
      toast({
        title: "Delete Failed",
        description: "There was an error deleting the charge. Please try again.",
        variant: "destructive",
      });
    },
  });

  // All useEffect hooks together - MUST be after all other hooks  
  useEffect(() => {
    if (statement?.userNotes && notes === "") {
      setNotes(statement.userNotes);
    }
  }, [statement?.userNotes]);

  useEffect(() => {
    if (charges.length > 0) {
      const newChargeNotes: { [key: string]: string } = {};
      let hasChanges = false;
      
      charges.forEach(charge => {
        if (charge.userNotes && chargeNotes[charge.id] !== charge.userNotes) {
          newChargeNotes[charge.id] = charge.userNotes;
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setChargeNotes(prev => ({ ...prev, ...newChargeNotes }));
      }
    }
  }, [charges.length]);

  // Helper functions
  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handler functions
  const handleTogglePersonalExpense = (chargeId: string) => {
    togglePersonalExpenseMutation.mutate(chargeId);
  };

  const handleToggleNoReceiptRequired = (chargeId: string) => {
    toggleNoReceiptRequiredMutation.mutate(chargeId);
  };

  const handleQuickMatch = (receiptId: string, chargeId: string) => {
    quickMatchMutation.mutate({ receiptId, chargeId });
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleSaveChargeNotes = (chargeId: string) => {
    const notes = chargeNotes[chargeId] || "";
    updateChargeNotesMutation.mutate({ chargeId, notes });
    setSelectedChargeNotes(prev => ({ ...prev, [chargeId]: false }));
  };

  const handleDeleteCharge = (chargeId: string) => {
    if (confirm("Are you sure you want to delete this charge? This action cannot be undone.")) {
      deleteChargeMutation.mutate(chargeId);
    }
  };

  const handleReceiptUpload = async (chargeId: string, file: File) => {
    setUploadingCharges(prev => ({ ...prev, [chargeId]: true }));
    
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      formData.append('chargeId', chargeId);
      
      const response = await fetch('/api/receipts/upload-to-charge', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload receipt');
      }
      
      const result = await response.json();
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/charges", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", statementId] });
      
      toast({
        title: "Receipt Uploaded",
        description: `Receipt uploaded and matched to charge successfully.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed", 
        description: "Failed to upload receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingCharges(prev => ({ ...prev, [chargeId]: false }));
    }
  };

  // Early return after all hooks are called
  if (!statement || !statementId) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600">Loading statement...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Filter and sort charges
  const filteredCharges = charges
    .filter(charge => {
      const matchesSearch = searchTerm === "" || 
        charge.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        charge.amount.includes(searchTerm) ||
        (charge.category && charge.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPersonalFilter = showPersonalExpenses ? charge.isPersonalExpense : !charge.isPersonalExpense;
      
      return matchesSearch && matchesPersonalFilter;
    })
    .sort((a, b) => {
      // Sorting priority:
      // 1st: Unmatched (regular unmatched charges that need receipts)
      // 2nd: Unmatched No Receipt Required 
      // 3rd: Matched charges
      
      const aIsUnmatched = !a.isMatched && !a.noReceiptRequired;
      const bIsUnmatched = !b.isMatched && !b.noReceiptRequired;
      const aIsUnmatchedNoReceipt = !a.isMatched && a.noReceiptRequired;
      const bIsUnmatchedNoReceipt = !b.isMatched && b.noReceiptRequired;
      const aIsMatched = a.isMatched;
      const bIsMatched = b.isMatched;
      
      // Priority 1: Regular unmatched charges (need receipts)
      if (aIsUnmatched && !bIsUnmatched) return -1;
      if (!aIsUnmatched && bIsUnmatched) return 1;
      
      // Priority 2: Unmatched no receipt required (among non-priority-1)
      if (!aIsUnmatched && !bIsUnmatched) {
        if (aIsUnmatchedNoReceipt && !bIsUnmatchedNoReceipt) return -1;
        if (!aIsUnmatchedNoReceipt && bIsUnmatchedNoReceipt) return 1;
      }
      
      // Within same priority group, sort by the selected column
      let aValue: any = a[sortColumn as keyof AmexCharge];
      let bValue: any = b[sortColumn as keyof AmexCharge];
      
      if (sortColumn === "amount") {
        aValue = parseFloat(a.amount);
        bValue = parseFloat(b.amount);
      } else if (sortColumn === "date") {
        aValue = new Date(a.date);
        bValue = new Date(b.date);
      }
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const personalExpenseAmount = charges.filter(c => c.isPersonalExpense).reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);
  const totalAmount = charges.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);
  
  const stats = {
    totalCharges: charges.length,
    matchedCharges: charges.filter(c => c.isMatched && !c.isPersonalExpense).length,
    unmatchedCharges: charges.filter(c => !c.isMatched && !c.noReceiptRequired && !c.isPersonalExpense).length,
    noReceiptRequired: charges.filter(c => c.noReceiptRequired && !c.isPersonalExpense).length,
    personalExpenses: charges.filter(c => c.isPersonalExpense).length,
    totalAmount,
    businessExpenseAmount: totalAmount - personalExpenseAmount,
    matchedAmount: charges.filter(c => c.isMatched).reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0),
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleOracleExport = async () => {
    if (!statementId) return;
    
    setIsExporting(true);
    try {
      const response = await fetch(`/api/statements/${statementId}/export/oracle`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `Oracle_Export_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Oracle CSV exported successfully with ${stats.totalCharges} charges.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Oracle export. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      {/* MOBILE: Improved responsive header layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link href="/statements">
            <Button variant="outline" size="sm" className="w-fit">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Statements</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{statement.periodName}</h1>
            <p className="text-sm sm:text-base text-gray-600">
              {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowManualChargeModal(true)}
            className="gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Missing Charge</span>
            <span className="sm:hidden">Add Charge</span>
          </Button>
          <Button 
            onClick={handleOracleExport}
            disabled={isExporting}
            className="gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isExporting ? "Exporting..." : "Export to Oracle"}
            </span>
            <span className="sm:hidden">
              {isExporting ? "..." : "Export"}
            </span>
          </Button>
        </div>
      </div>

      {/* Reconciliation Alert - Show when there might be missing charges */}
      {stats.totalCharges > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                <strong>Data Reconciliation:</strong> Always verify charge counts match your AMEX statement. 
                If you notice missing charges, use "Add Missing Charge" to manually add them.
              </span>
              <span className="text-sm text-yellow-600">
                Current: {stats.totalCharges} charges
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800">
              <span className="text-blue-600">{stats.totalCharges} Total Charges</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-green-600">{stats.matchedCharges} Matched</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-red-600">{stats.unmatchedCharges} Unmatched</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-orange-600">{stats.noReceiptRequired} No Receipt Needed</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-purple-600">{stats.personalExpenses} Personal</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Total Amount: {formatCurrency(stats.totalAmount.toString())} | Business Expenses: {formatCurrency(stats.businessExpenseAmount.toString())}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          {/* MOBILE: Improved responsive filters layout */}
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by description, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-base"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="flex gap-2 justify-center sm:justify-start">
              <Button
                variant={showPersonalExpenses ? "default" : "outline"}
                onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
                className="gap-2 min-h-[44px]"
              >
                {showPersonalExpenses ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="hidden sm:inline">{showPersonalExpenses ? "Show Business" : "Show Personal"}</span>
                <span className="sm:hidden">{showPersonalExpenses ? "Business" : "Personal"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charges List - Vertical Card Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{showPersonalExpenses ? "Personal" : "Business"} Expenses ({filteredCharges.length})</span>
            <Badge variant="secondary">{formatCurrency(filteredCharges.reduce((sum, c) => sum + parseFloat(c.amount), 0).toString())}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredCharges.map((charge) => (
            <Card key={charge.id} className="border border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Row 1: Date and Description */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm text-gray-900 mb-1">{charge.description}</h3>
                    {charge.extendedDetails && (
                      <p className="text-xs text-gray-500">{charge.extendedDetails}</p>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600 ml-4">
                    {formatDate(charge.date)}
                  </div>
                </div>
                
                {/* Row 2: Amount, Category, Card Member */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(charge.amount)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {charge.category || "Uncategorized"}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      {charge.isNonAmex && (
                        <CreditCard className="h-3 w-3 text-blue-600" />
                      )}
                      {charge.cardMember}
                    </div>
                  </div>
                  {charge.cityState && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {charge.cityState}
                    </div>
                  )}
                </div>
                
                {/* Row 3: Notes, Personal Toggle, Match Status - Mobile Responsive */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Match Status with Receipt Link */}
                    <div className="flex items-center gap-1">
                      <Badge variant={charge.receiptId ? "default" : "secondary"} className="text-xs">
                        {charge.receiptId ? "Matched" : "Unmatched"}
                      </Badge>
                      {charge.noReceiptRequired && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          No Receipt Required
                        </Badge>
                      )}
                      {charge.receiptId ? (
                        <Link href={`/receipts?selected=${charge.receiptId}`}>
                          <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                            <FileText className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </Link>
                      ) : (
                        <div className="flex items-center">
                          <input
                            type="file"
                            id={`upload-${charge.id}`}
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleReceiptUpload(charge.id, file);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-1 sm:px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[24px] sm:min-w-[auto]"
                            onClick={() => document.getElementById(`upload-${charge.id}`)?.click()}
                            disabled={uploadingCharges[charge.id]}
                          >
                            {uploadingCharges[charge.id] ? (
                              "..."
                            ) : (
                              <>
                                <Receipt className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Upload</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Personal Expense Toggle */}
                    <Button
                      variant={charge.isPersonalExpense ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTogglePersonalExpense(charge.id)}
                      className="h-6 px-1 sm:px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[24px] sm:min-w-[auto]"
                    >
                      {charge.isPersonalExpense ? "Personal" : "Business"}
                    </Button>
                    
                    {/* No Receipt Required Toggle */}
                    <Button
                      variant={charge.noReceiptRequired ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleNoReceiptRequired(charge.id)}
                      className="h-6 px-1 sm:px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[24px] sm:min-w-[auto]"
                    >
                      {charge.noReceiptRequired ? "No Receipt" : "Receipt Needed"}
                    </Button>
                    
                    {/* Notes Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedChargeNotes(prev => ({ 
                          ...prev, 
                          [charge.id]: !prev[charge.id] 
                        }));
                      }}
                      className="h-6 px-1 sm:px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[24px] sm:min-w-[auto]"
                    >
                      <Edit3 className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">{selectedChargeNotes[charge.id] ? "Hide" : "Notes"}</span>
                    </Button>
                    
                    {/* Delete Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCharge(charge.id)}
                      disabled={deleteChargeMutation.isPending}
                      className="h-6 px-1 sm:px-2 text-xs min-h-[36px] min-w-[36px] sm:min-h-[24px] sm:min-w-[auto] text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      <Trash2 className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                  
                  {/* Notes Badge (mobile friendly) */}
                  {charge.userNotes && (
                    <Badge variant="outline" className="text-xs self-start sm:self-center">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Has Notes</span>
                    </Badge>
                  )}
                </div>
                
                {/* Expandable Notes Section */}
                {selectedChargeNotes[charge.id] && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Label className="text-xs font-medium text-gray-700 mb-2 block">Charge Notes:</Label>
                    <Textarea
                      placeholder="Add notes about this specific charge..."
                      value={chargeNotes[charge.id] || ""}
                      onChange={(e) => setChargeNotes(prev => ({ 
                        ...prev, 
                        [charge.id]: e.target.value 
                      }))}
                      className="min-h-[60px] text-sm resize-none mb-2"
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleSaveChargeNotes(charge.id)}
                        disabled={updateChargeNotesMutation.isPending}
                        size="sm"
                        className="h-7 px-3 text-xs"
                      >
                        {updateChargeNotesMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedChargeNotes(prev => ({ ...prev, [charge.id]: false }))}
                        size="sm"
                        className="h-7 px-3 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {filteredCharges.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No {showPersonalExpenses ? "personal" : "business"} expenses found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unmatched Receipts Section */}
      {unmatchedReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-600" />
              Unmatched Receipts in Statement Period
              <Badge variant="secondary" className="ml-2">
                {unmatchedReceipts.length} receipts
              </Badge>
            </CardTitle>
            <p className="text-sm text-gray-600">
              These receipts fall within this statement period but haven't been matched to charges yet. Click on a receipt to match it to an unmatched charge.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {unmatchedReceipts.map((receipt) => (
              <Card key={receipt.id} className="border border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-sm font-medium text-gray-900">
                          {receipt.merchant || "Unknown Merchant"}
                        </div>
                        <div className="text-lg font-bold text-orange-700">
                          {receipt.amount ? formatCurrency(receipt.amount) : "No Amount"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {receipt.date ? formatDate(receipt.date) : "No Date"}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {receipt.fileName} • {receipt.category || "Uncategorized"}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link href={`/receipts?selected=${receipt.id}`}>
                        <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </Link>
                      <Link href={`/matching?statement=${statementId}&receipt=${receipt.id}`}>
                        <Button size="sm" className="h-7 px-3 text-xs bg-orange-600 hover:bg-orange-700">
                          Match
                        </Button>
                      </Link>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 px-3 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={convertingReceipts[receipt.id] || !receipt.date || !receipt.amount || !receipt.merchant}
                        onClick={async () => {
                          if (!statementId) return;
                          setConvertingReceipts(prev => ({ ...prev, [receipt.id]: true }));
                          try {
                            await createNonAmexCharge.mutateAsync({ receiptId: receipt.id, statementId });
                          } finally {
                            setConvertingReceipts(prev => ({ ...prev, [receipt.id]: false }));
                          }
                        }}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {convertingReceipts[receipt.id] ? "Converting..." : "Add as Non-AMEX"}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Match Section - Show unmatched charges for this receipt */}
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">Quick Match to Unmatched Charges:</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {charges
                        .filter(charge => !charge.isMatched)
                        .slice(0, 3) // Show top 3 best matches
                        .map((charge) => {
                          // Simple matching score calculation
                          const amountDiff = receipt.amount && charge.amount ? 
                            Math.abs(parseFloat(receipt.amount) - Math.abs(parseFloat(charge.amount))) : 999;
                          const dateDiff = receipt.date && charge.date ?
                            Math.abs(new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24) : 999;
                          const merchantMatch = receipt.merchant && charge.description ?
                            charge.description.toLowerCase().includes(receipt.merchant.toLowerCase()) : false;
                          
                          return (
                            <div key={charge.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:bg-gray-50">
                              <div className="flex-1 text-xs">
                                <div className="font-medium truncate">{charge.description}</div>
                                <div className="text-gray-500 flex gap-2">
                                  <span>{formatCurrency(charge.amount)}</span>
                                  <span>•</span>
                                  <span>{formatDate(charge.date)}</span>
                                  {merchantMatch && <span className="text-green-600">• Merchant Match</span>}
                                  {amountDiff < 1 && <span className="text-green-600">• Amount Match</span>}
                                </div>
                              </div>
                              <Button
                                onClick={() => handleQuickMatch(receipt.id, charge.id)}
                                disabled={quickMatchMutation.isPending}
                                size="sm"
                                className="h-6 px-2 text-xs ml-2"
                              >
                                {quickMatchMutation.isPending ? "..." : "Link"}
                              </Button>
                            </div>
                          );
                        })}
                      {charges.filter(charge => !charge.isMatched).length === 0 && (
                        <div className="text-xs text-gray-500 p-2">No unmatched charges available</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Statement Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Statement Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Add your annotations:</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this statement period, important reminders, or observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
          
          <Button 
            onClick={handleSaveNotes}
            disabled={updateNotesMutation.isPending}
            className="w-full md:w-auto"
          >
            {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
          </Button>

          {statement.userNotes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Current Notes:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{statement.userNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Charge Modal */}
      <ManualChargeModal
        isOpen={showManualChargeModal}
        onClose={() => setShowManualChargeModal(false)}
        statements={allStatements}
        defaultStatementId={statementId}
      />
    </div>
  );
}