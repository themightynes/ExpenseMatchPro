import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/MobileHeader";
import FinancialCard from "@/components/FinancialCard";
import QuickAction from "@/components/QuickAction";
import StatsCard from "@/components/StatsCard";
import FileUploadZone from "@/components/FileUploadZone";
import ReceiptCard from "@/components/ReceiptCard";
import CsvUploadModal from "@/components/CsvUploadModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { DollarSign, Receipt as ReceiptIcon, CreditCard, TrendingUp, Upload, FileText, BarChart3, PlusCircle } from "lucide-react";
import type { Receipt, AmexStatement } from "@shared/schema";

export default function Dashboard() {
  const [showCsvModal, setShowCsvModal] = useState(false);
  
  const { data: stats, isLoading: statsLoading } = useQuery<{
    processedCount: number;
    pendingCount: number;
    readyCount: number;
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
    personalExpensesAmount: number;
    matchedCount: number;
    unmatchedReceiptCount: number;
    missingReceiptCount: number;
    totalCharges: number;
    personalExpensesCount: number;
    matchingPercentage: number;
  }>({
    queryKey: ["/api/dashboard/financial-stats"],
  });

  const recentReceipts = receipts.slice(0, 3);

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
        {/* Quick Balance Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Financial Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <FinancialCard
              title="Business Expenses"
              amount={(financialStats?.totalStatementAmount || 0) - (financialStats?.personalExpensesAmount || 0)}
              icon={<DollarSign className="w-4 h-4 text-blue-600" />}
              variant="default"
            />
            <FinancialCard
              title="Matched"
              amount={financialStats?.totalMatchedAmount || 0}
              subtitle={`${financialStats?.matchingPercentage || 0}% complete`}
              icon={<TrendingUp className="w-4 h-4 text-green-600" />}
              variant="success"
            />
            <FinancialCard
              title="Missing Receipts"
              amount={financialStats?.totalMissingReceiptAmount || 0}
              subtitle={`${financialStats?.missingReceiptCount || 0} charges`}
              icon={<ReceiptIcon className="w-4 h-4 text-orange-600" />}
              variant="warning"
            />
            <FinancialCard
              title="Personal Expenses"
              amount={financialStats?.personalExpensesAmount || 0}
              subtitle={`${financialStats?.personalExpensesCount || 0} flagged`}
              icon={<CreditCard className="w-4 h-4 text-gray-600" />}
              variant="default"
            />
          </div>
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
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ready for Oracle</p>
                <p className="text-2xl font-bold text-green-600">{statsLoading ? "..." : stats?.readyCount || "0"}</p>
                <p className="text-xs text-gray-500">with complete data</p>
              </div>
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Badge className="bg-green-100 text-green-800 text-xs">{stats?.readyCount || "0"}</Badge>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-yellow-600">{statsLoading ? "..." : stats?.processingCount || "0"}</p>
                <p className="text-xs text-gray-500">being processed</p>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Receipt Management</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.click();
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      UPLOAD
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setShowCsvModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      IMPORT
                    </Button>
                    <Link to="/matching">
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        EXPORT
                        <Badge className="ml-2 bg-green-100 text-green-800">
                          {stats?.readyCount || 0} ready
                        </Badge>
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FileUploadZone />
              </CardContent>
            </Card>

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
                      <div
                        key={statement.id}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          statement.isActive
                            ? "bg-primary/5 border border-primary/20"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div>
                          <p className={`font-medium ${statement.isActive ? "text-primary" : "text-gray-900"}`}>
                            {statement.periodName}
                          </p>
                          <p className={`text-sm ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            {new Date(statement.startDate).toLocaleDateString()} -{" "}
                            {new Date(statement.endDate).toLocaleDateString()}
                            {statement.isActive && " (Current)"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${statement.isActive ? "text-primary" : "text-gray-900"}`}>
                            ${((statement.totalAmount || 0) - (statement.personalExpensesAmount || 0)).toLocaleString()}
                          </p>
                          <p className={`text-xs ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            business expenses
                          </p>
                          <p className={`text-xs ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            {statement.matchedCount || 0}/{statement.totalCharges || 0} matched
                          </p>
                        </div>
                      </div>
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
