import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CsvUploadModal from "@/components/CsvUploadModal";
import StatementChargesDialog from "@/components/StatementChargesDialog";
import type { AmexStatement, AmexCharge, Receipt } from "@shared/schema";
import { Calendar, CreditCard, FileText, Upload, Eye, TrendingUp, DollarSign, List } from "lucide-react";

export default function StatementsPage() {
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<AmexStatement | null>(null);

  const { data: statements = [], isLoading: statementsLoading } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  const { data: allCharges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges"],
  });

  const { data: receipts = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const getStatementStats = (statementId: string) => {
    const charges = allCharges.filter(charge => charge.statementId === statementId);
    const matchedCharges = charges.filter(charge => charge.isMatched);
    const totalAmount = charges.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0);
    const matchedAmount = matchedCharges.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0);
    
    return {
      totalCharges: charges.length,
      matchedCharges: matchedCharges.length,
      unmatchedCharges: charges.length - matchedCharges.length,
      totalAmount,
      matchedAmount,
      matchPercentage: charges.length > 0 ? (matchedCharges.length / charges.length) * 100 : 0
    };
  };

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
                  <p className="text-2xl font-bold text-gray-900">{allCharges.length}</p>
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
                    {allCharges.filter(c => c.isMatched).length}
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
                    ${allCharges.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0).toFixed(2)}
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
                        <div>
                          <CardTitle className="text-lg">{statement.periodName}</CardTitle>
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

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">${stats.matchedAmount.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Matched Amount</p>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">{stats.unmatchedCharges}</p>
                            <p className="text-sm text-gray-600">Unmatched</p>
                          </div>
                        </div>

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
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // TODO: Export functionality
                              alert("Export functionality coming soon!");
                            }}
                          >
                            Export
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