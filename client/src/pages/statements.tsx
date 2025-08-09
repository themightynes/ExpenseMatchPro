import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import CsvUploadModal from "@/components/CsvUploadModal";
import StatementChargesDialog from "@/components/StatementChargesDialog";
import type { AmexStatement, AmexCharge, Receipt } from "@shared/schema";
import { Calendar, CreditCard, FileText, Upload, Eye, TrendingUp, DollarSign, List, Trash2, Edit2, Check, X } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function StatementsPage() {
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<AmexStatement | null>(null);
  const [editingStatement, setEditingStatement] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");

  const { data: statements = [], isLoading: statementsLoading } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  const { data: allCharges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges"],
  });

  const { data: receipts = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { toast } = useToast();

  const deleteStatementMutation = useMutation({
    mutationFn: async (statementId: string) => {
      const response = await apiRequest("DELETE", `/api/statements/${statementId}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/financial-stats"] });
      toast({
        title: "Statement Deleted",
        description: "Statement and all associated charges have been removed.",
      });
    },
    onError: (error) => {
      console.error("Error deleting statement:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error",
        description: `Failed to delete statement: ${message}`,
        variant: "destructive",
      });
    },
  });

  const updateStatementMutation = useMutation({
    mutationFn: async ({ id, periodName }: { id: string; periodName: string }) => {
      const response = await apiRequest("PUT", `/api/statements/${id}`, {
        periodName: periodName.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      setEditingStatement(null);
      toast({
        title: "Statement Updated",
        description: "Statement title has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating statement:", error);
      toast({
        title: "Error",
        description: "Failed to update statement title. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = (statement: AmexStatement) => {
    setEditingStatement(statement.id);
    setEditedName(statement.periodName);
  };

  const handleSaveEdit = (statementId: string) => {
    if (editedName.trim()) {
      updateStatementMutation.mutate({ id: statementId, periodName: editedName.trim() });
    } else {
      setEditingStatement(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingStatement(null);
    setEditedName("");
  };

  const getStatementStats = (statementId: string) => {
    // Get charges for this specific statement
    const charges = allCharges.filter(charge => charge.statementId === statementId);
    
    // Get ALL receipts that have this statement ID OR are matched to charges in this statement
    const directStatementReceipts = receipts.filter(receipt => receipt.statementId === statementId);
    const chargeIds = charges.map(charge => charge.id);
    const matchedToStatementReceipts = receipts.filter(receipt => 
      receipt.matchedChargeId && chargeIds.includes(receipt.matchedChargeId)
    );
    
    // Combine and deduplicate receipts
    const allStatementReceiptIds = new Set([
      ...directStatementReceipts.map(r => r.id),
      ...matchedToStatementReceipts.map(r => r.id)
    ]);
    const statementReceipts = receipts.filter(receipt => allStatementReceiptIds.has(receipt.id));
    
    // Find matched receipts - must have both isMatched=true AND matchedChargeId set
    const matchedReceipts = statementReceipts.filter(receipt => 
      receipt.isMatched && 
      receipt.matchedChargeId &&
      chargeIds.includes(receipt.matchedChargeId)
    );
    
    // Find matched charges - charges that have corresponding receipts
    const matchedChargeIds = matchedReceipts.map(receipt => receipt.matchedChargeId);
    const matchedCharges = charges.filter(charge => matchedChargeIds.includes(charge.id));
    
    // Unmatched receipts in this statement that have amount data
    const unmatchedReceipts = statementReceipts.filter(receipt => 
      !receipt.isMatched && 
      receipt.amount && 
      parseFloat(receipt.amount) > 0 &&
      receipt.processingStatus === 'completed'
    );

    // Calculate amounts - handle potential negative charges by taking absolute values
    const totalAmount = charges.reduce((sum, charge) => {
      const amount = parseFloat(charge.amount || '0');
      return sum + Math.abs(amount);
    }, 0);
    
    const matchedAmount = matchedCharges.reduce((sum, charge) => {
      const amount = parseFloat(charge.amount || '0');
      return sum + Math.abs(amount);
    }, 0);
    
    const unmatchedReceiptValue = unmatchedReceipts.reduce((sum, receipt) => {
      const amount = parseFloat(receipt.amount || '0');
      return sum + Math.abs(amount);
    }, 0);

    // Calculate percentage based on charges (since that's our source of truth)
    const matchPercentage = charges.length > 0 ? (matchedCharges.length / charges.length) * 100 : 0;

    return {
      totalCharges: charges.length,
      matchedCharges: matchedCharges.length, // Count of matched charges, not receipts
      unmatchedCharges: charges.length - matchedCharges.length,
      totalAmount,
      matchedAmount,
      unmatchedReceiptValue,
      unmatchedReceiptCount: unmatchedReceipts.length,
      missingReceiptCount: charges.length - matchedCharges.length,
      matchPercentage
    };
  };

  // Calculate aggregated statistics across all statements using individual statement data
  const getAggregatedStats = () => {
    return statements.reduce((acc, statement) => {
      const stats = getStatementStats(statement.id);
      return {
        totalCharges: acc.totalCharges + stats.totalCharges,
        matchedCharges: acc.matchedCharges + stats.matchedCharges,
        totalAmount: acc.totalAmount + stats.totalAmount,
        matchedAmount: acc.matchedAmount + stats.matchedAmount,
      };
    }, { totalCharges: 0, matchedCharges: 0, totalAmount: 0, matchedAmount: 0 });
  };

  const aggregatedStats = getAggregatedStats();

  if (statementsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 font-inter">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading statements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                ← Back to Dashboard
              </Link>
              <div className="flex items-center">
                <CreditCard className="text-primary text-2xl mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">AMEX Statements</h1>
              </div>
            </div>
            <Button 
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Statements</p>
                  <p className="text-2xl font-bold text-gray-900">{statements.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Charges</p>
                  <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalCharges}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Matched Charges</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {aggregatedStats.matchedCharges}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${aggregatedStats.totalAmount.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statements List */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Statement Periods</h2>

          {statements.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Statements Yet</h3>
                <p className="text-gray-600 mb-4">
                  Create your first statement period to start tracking AMEX charges.
                </p>
                <Button onClick={() => setShowCsvModal(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import First CSV
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {statements.map((statement) => {
                const stats = getStatementStats(statement.id);
                return (
                  <Card key={statement.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {editingStatement === statement.id ? (
                            <div className="flex items-center gap-2 mb-2">
                              <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="text-lg font-semibold"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(statement.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(statement.id)}
                                disabled={updateStatementMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={updateStatementMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-2 group">
                              <CardTitle className="text-lg cursor-pointer hover:text-blue-600 transition-colors">
                                {statement.periodName}
                              </CardTitle>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
                                onClick={() => handleStartEdit(statement)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <p className="text-sm text-gray-600">
                            {new Date(statement.startDate).toLocaleDateString()} - {new Date(statement.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={stats.matchPercentage === 100 ? "default" : "secondary"}>
                          {stats.matchPercentage.toFixed(0)}% Matched
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Matching Progress</span>
                            <span>{stats.matchedCharges}/{stats.totalCharges} charges</span>
                          </div>
                          <Progress value={stats.matchPercentage} className="h-2" />
                        </div>

                        {/* Financial Summary - Compact Version */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs font-medium text-blue-700">Total Amount</span>
                            </div>
                            <p className="text-lg font-bold text-blue-900">${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-xs text-blue-600">{stats.totalCharges} charges</p>
                          </div>

                          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium text-green-700">Matched</span>
                            </div>
                            <p className="text-lg font-bold text-green-900">${stats.matchedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-xs text-green-600">{stats.matchedCharges} receipts matched</p>
                          </div>
                        </div>

                        {/* Action Items - Only show if there are issues */}
                        {(stats.unmatchedReceiptCount > 0 || stats.missingReceiptCount > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            {stats.unmatchedReceiptCount > 0 && (
                              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                  <span className="text-xs font-medium text-orange-700">Unmatched Receipts</span>
                                </div>
                                <p className="text-lg font-bold text-orange-900">${stats.unmatchedReceiptValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-xs text-orange-600">{stats.unmatchedReceiptCount} need matching</p>
                              </div>
                            )}

                            {stats.missingReceiptCount > 0 && (
                              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span className="text-xs font-medium text-red-700">Missing Receipts</span>
                                </div>
                                <p className="text-lg font-bold text-red-900">${(stats.totalAmount - stats.matchedAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-xs text-red-600">{stats.missingReceiptCount} charges without receipts</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => setSelectedStatement(statement)}
                          >
                            <List className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Link href={`/matching?statementId=${statement.id}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              <Eye className="h-4 w-4 mr-2" />
                              Match Receipts
                            </Button>
                          </Link>
                          <Button 
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteStatementMutation.mutate(statement.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        statements={statements}
      />

      {/* Statement Details Dialog */}
      {selectedStatement && (
        <StatementChargesDialog
          statement={selectedStatement}
          open={!!selectedStatement}
          onOpenChange={(open) => !open && setSelectedStatement(null)}
        />
      )}
    </div>
  );
}