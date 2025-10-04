import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/MobileHeader";
import FinancialCard from "@/components/FinancialCard";
import QuickAction from "@/components/QuickAction";
import StatsCard from "@/components/StatsCard";
import FileUploadZone from "@/components/FileUploadZone";
import ReceiptCard from "@/components/ReceiptCard";
import ReceiptViewer from "@/components/ReceiptViewer";
import CsvUploadModal from "@/components/CsvUploadModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { DollarSign, Receipt as ReceiptIcon, CreditCard, TrendingUp, Upload, PlusCircle, Brain } from "lucide-react";
import type { Receipt, AmexStatement } from "@shared/schema";

export default function Dashboard() {
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showProcessingDetails, setShowProcessingDetails] = useState(false);
  const [processingViewerOpen, setProcessingViewerOpen] = useState(false);
  const [currentProcessingReceipt, setCurrentProcessingReceipt] = useState<Receipt | null>(null);
  
  const { data: stats, isLoading: statsLoading } = useQuery<{
    processedCount: number;
    pendingCount: number;
    processingCount: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: statements = [], isLoading: statementsLoading } = useQuery<AmexStatement[]>({
    queryKey: ["/api/statements"],
  });

  const { data: financialStats, isLoading: financialStatsLoading } = useQuery<{
    totalStatementAmount: number;
    totalMatchedAmount: number;
    totalUnmatchedReceiptAmount: number;
    totalMissingReceiptAmount: number;
    noReceiptRequiredAmount: number;
    personalExpensesAmount: number;
    matchedCount: number;
    unmatchedReceiptCount: number;
    missingReceiptCount: number;
    noReceiptRequiredCount: number;
    totalCharges: number;
    personalExpensesCount: number;
    matchingPercentage: number;
  }>({
    queryKey: ["/api/dashboard/financial-stats"],
  });

  const processingReceipts = receipts
    .filter((receipt) => receipt.processingStatus === "processing")
    .sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bDate - aDate;
    });
  const recentReceipts = receipts.slice(0, 3);

  useEffect(() => {
    if (processingReceipts.length === 0 && showProcessingDetails) {
      setShowProcessingDetails(false);
    }
  }, [processingReceipts.length, showProcessingDetails]);

  useEffect(() => {
    if (processingReceipts.length === 0 && processingViewerOpen) {
      setProcessingViewerOpen(false);
      setCurrentProcessingReceipt(null);
    }
  }, [processingReceipts.length, processingViewerOpen]);

  const hasProcessing = processingReceipts.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader 
        title="Receipt Manager"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCsvModal(true)}
            className="p-1 h-8 w-8 min-h-[44px] min-w-[44px]"
          >
            <Upload className="w-4 h-4" />
          </Button>
        }
      />

      {/* MOBILE: Improved container with overflow protection */}
      <div className="px-4 py-6 space-y-6 max-w-full overflow-x-hidden">
        {/* Quick Actions - Moved to top */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/ml-insights">
            <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-1">
              <Brain className="h-5 w-5" />
              <span className="text-sm">ML Insights</span>
            </Button>
          </Link>
          <Link href="/statements">
            <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-1">
              <CreditCard className="h-5 w-5" />
              <span className="text-sm">Statements</span>
            </Button>
          </Link>
          <Link href="/receipts">
            <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-1">
              <ReceiptIcon className="h-5 w-5" />
              <span className="text-sm">All Receipts</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full h-16 flex flex-col items-center justify-center gap-1"
            onClick={() => setShowCsvModal(true)}
          >
            <Upload className="h-5 w-5" />
            <span className="text-sm">Import CSV</span>
          </Button>
        </div>

        {/* Quick Balance Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Financial Overview</h2>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">
                  <span className="text-blue-600">{financialStats?.totalCharges || 0} Total Charges</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-green-600">{financialStats?.matchedCount || 0} Matched</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-red-600">{financialStats?.missingReceiptCount || 0} Unmatched</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-orange-600">{financialStats?.noReceiptRequiredCount || 0} No Receipt Needed</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-purple-600">{financialStats?.personalExpensesCount || 0} Personal</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Total Amount: ${(financialStats?.totalStatementAmount || 0).toLocaleString()} | Business Expenses: ${((financialStats?.totalStatementAmount || 0) - (financialStats?.personalExpensesAmount || 0)).toLocaleString()} | {Math.round(financialStats?.matchingPercentage || 0)}% Complete
                </p>
              </div>
            </CardContent>
          </Card>
        </div>







        {/* Processing Stats - Mobile Card Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Receipts</p>
                <p className="text-2xl font-bold text-blue-600">{statsLoading ? "..." : stats?.processedCount || "0"}</p>
                <p className="text-xs text-gray-500">uploaded this period</p>
              </div>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div
            role={hasProcessing ? "button" : undefined}
            tabIndex={hasProcessing ? 0 : -1}
            onClick={hasProcessing ? () => setShowProcessingDetails((prev) => !prev) : undefined}
            onKeyDown={hasProcessing ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setShowProcessingDetails((prev) => !prev);
              }
            } : undefined}
            aria-expanded={hasProcessing ? showProcessingDetails : undefined}
            aria-controls={hasProcessing ? "processing-details-panel" : undefined}
            className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 ${hasProcessing ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300" : "cursor-default"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-yellow-600">{statsLoading ? "..." : stats?.processingCount || "0"}</p>
                <p className="text-xs text-gray-500">
                  {processingReceipts.length > 0
                    ? `${processingReceipts[0].originalFileName}`
                    : "being processed"}
                </p>
              </div>
              <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Need Attention</p>
                <p className="text-2xl font-bold text-orange-600">{statsLoading ? "..." : stats?.pendingCount || "0"}</p>
                <p className="text-xs text-gray-500">require manual entry</p>
              </div>
              <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {hasProcessing && showProcessingDetails && (
          <Card id="processing-details-panel" className="border-yellow-200 bg-yellow-50/70">
            <CardHeader>
              <CardTitle className="text-base">Items Being Processed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {processingReceipts.slice(0, 5).map((receipt) => (
                <button
                  type="button"
                  key={receipt.id}
                  onClick={() => {
                    setCurrentProcessingReceipt(receipt);
                    setProcessingViewerOpen(true);
                  }}
                  className="flex w-full items-start justify-between rounded-md border border-yellow-100 bg-white/70 p-3 text-left transition hover:border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                >
                  <div className="max-w-[70%]">
                    <p className="text-sm font-medium text-gray-900 truncate" title={receipt.originalFileName}>
                      {receipt.originalFileName}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {receipt.merchant || "Unknown merchant"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700 text-xs">
                      {receipt.processingStatus}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {receipt.updatedAt ? new Date(receipt.updatedAt).toLocaleString() : "Awaiting update"}
                    </p>
                  </div>
                </button>
              ))}
              {processingReceipts.length > 5 && (
                <p className="text-xs text-gray-600 text-center">
                  Showing 5 of {processingReceipts.length} items in progress
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {currentProcessingReceipt && (
          <ReceiptViewer
            receipt={currentProcessingReceipt}
            receipts={receipts}
            isOpen={processingViewerOpen}
            onClose={() => {
              setProcessingViewerOpen(false);
              setCurrentProcessingReceipt(null);
            }}
            onNavigate={(newReceipt) => {
              setCurrentProcessingReceipt(newReceipt);
            }}
          />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <FileUploadZone />

            {/* Recent Uploads */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Uploads</CardTitle>
                  <Link to="/receipts">
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 px-2">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {receiptsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading receipts...</div>
                  ) : recentReceipts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No receipts uploaded yet. Start by uploading your first receipt above.
                    </div>
                  ) : (
                    recentReceipts.map((receipt) => (
                      <ReceiptCard key={receipt.id} receipt={receipt} receipts={recentReceipts} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AMEX Statement Periods */}
            <Card>
              <CardHeader>
                <CardTitle>AMEX Statement Periods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statementsLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading statements...</div>
                  ) : statements.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No statements found</div>
                  ) : (
                    statements.map((statement: any) => (
                      <Link key={statement.id} href={`/statements/${statement.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors bg-gray-50 hover:bg-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">
                            {statement.periodName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(statement.startDate).toLocaleDateString()} -{" "}
                            {new Date(statement.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ${((statement.totalAmount || 0) - (statement.personalExpensesAmount || 0)).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            business expenses
                          </p>
                          <p className="text-xs text-gray-500">
                            {statement.matchedCount || 0}/{statement.chargeCount || 0} matched
                          </p>
                        </div>
                      </div>
                      </Link>
                    ))
                  )}
                </div>
                <Link to="/statements">
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    View All Periods
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        statements={statements}
      />
    </div>
  );
}
