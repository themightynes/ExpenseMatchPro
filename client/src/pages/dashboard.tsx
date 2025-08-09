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
            className="p-1 h-8 w-8"
          >
            <Upload className="w-4 h-4" />
          </Button>
        }
      />

      <div className="px-4 py-6 space-y-6">
        {/* Quick Balance Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Financial Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <FinancialCard
              title="Total Expenses"
              amount={financialStats?.totalStatementAmount || 0}
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

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              icon={<PlusCircle className="w-5 h-5" />}
              label="Upload Receipt"
              variant="primary"
              onClick={() => {/* Handle upload */}}
            />
            <QuickAction
              icon={<Upload className="w-5 h-5" />}
              label="Import CSV"
              variant="default"
              onClick={() => setShowCsvModal(true)}
            />
            <Link href="/matching">
              <QuickAction
                icon={<BarChart3 className="w-5 h-5" />}
                label="Match Receipts"
                variant="default"
                badge={stats?.readyCount}
                onClick={() => {}}
                className="w-full"
              />
            </Link>
            <Link href="/statements">
              <QuickAction
                icon={<FileText className="w-5 h-5" />}
                label="View Statements"
                variant="default"
                onClick={() => {}}
                className="w-full"
              />
            </Link>
          </div>
        </div>

        {/* Legacy Stats Grid - Hidden on Mobile */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <StatsCard
            icon="fas fa-credit-card"
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            title="Total Statement Amount"
            value={financialStatsLoading ? "..." : `$${financialStats?.totalStatementAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            subtitle={`${financialStats?.totalCharges || 0} charges`}
          />
          <StatsCard
            icon="fas fa-check-circle"
            iconColor="text-green-600"
            iconBg="bg-green-50"
            title="Matched Amount"
            value={financialStatsLoading ? "..." : `$${financialStats?.totalMatchedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            subtitle={`${financialStats?.matchedCount || 0} receipts matched`}
          />
          <StatsCard
            icon="fas fa-receipt"
            iconColor="text-orange-600"
            iconBg="bg-orange-50"
            title="Unmatched Receipts"
            value={financialStatsLoading ? "..." : `$${financialStats?.totalUnmatchedReceiptAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            subtitle={`${financialStats?.unmatchedReceiptCount || 0} need matching`}
          />
          <StatsCard
            icon="fas fa-exclamation-triangle"
            iconColor="text-red-600"
            iconBg="bg-red-50"
            title="Missing Receipts"
            value={financialStatsLoading ? "..." : `$${financialStats?.totalMissingReceiptAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            subtitle={`${financialStats?.missingReceiptCount || 0} charges without receipts`}
          />
          <StatsCard
            icon="fas fa-user"
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
            title="Personal Expenses"
            value={financialStatsLoading ? "..." : `$${financialStats?.personalExpensesAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
            subtitle={`${financialStats?.personalExpensesCount || 0} charges flagged`}
          />
        </div>

        {/* Matching Progress */}
        {!financialStatsLoading && financialStats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Matching Progress</span>
                <Badge variant={financialStats.matchingPercentage === 100 ? "default" : "secondary"} className="text-lg px-3 py-1">
                  {financialStats.matchingPercentage.toFixed(1)}% Complete
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${financialStats.matchingPercentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Matched: ${financialStats.totalMatchedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span>Remaining: ${(financialStats.totalStatementAmount - financialStats.totalMatchedAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {financialStats.matchingPercentage < 100 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-orange-600">⚠️</span>
                      <span>Complete your matching to get 100% expense tracking accuracy</span>
                    </div>
                    <div className="flex gap-2">
                      {financialStats.unmatchedReceiptCount > 0 && (
                        <Link to="/matching">
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50">
                            Match {financialStats.unmatchedReceiptCount} Receipts
                          </Button>
                        </Link>
                      )}
                      {financialStats.missingReceiptCount > 0 && (
                        <Link to="/receipts">
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                            Upload {financialStats.missingReceiptCount} Missing Receipts
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {financialStats.matchingPercentage === 100 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <span>✅</span>
                      <span>Perfect! All expenses are matched and ready for reporting</span>
                    </div>
                    <Link to="/templates">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        Generate Expense Report
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon="fas fa-upload"
            iconColor="text-primary"
            iconBg="bg-primary/10"
            title="Total Receipts"
            value={statsLoading ? "..." : stats?.processedCount.toString() || "0"}
            subtitle="uploaded this period"
          />
          <StatsCard
            icon="fas fa-check-circle"
            iconColor="text-green-500"
            iconBg="bg-green-50"
            title="Ready for Oracle"
            value={statsLoading ? "..." : stats?.readyCount.toString() || "0"}
            subtitle="with complete data"
          />
          <StatsCard
            icon="fas fa-clock"
            iconColor="text-yellow-500"
            iconBg="bg-yellow-50"
            title="Processing"
            value={statsLoading ? "..." : stats?.processingCount.toString() || "0"}
            subtitle="being processed"
          />
          <StatsCard
            icon="fas fa-exclamation-triangle"
            iconColor="text-orange-500"
            iconBg="bg-orange-50"
            title="Need Attention"
            value={statsLoading ? "..." : stats?.pendingCount.toString() || "0"}
            subtitle="require manual entry"
          />
        </div>

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
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
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
                            {statement.receiptCount || 0} receipts
                          </p>
                          <p className={`text-xs ${statement.isActive ? "text-primary/70" : "text-gray-500"}`}>
                            {statement.matchedCount || 0} matched
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link to="/statements">
                  <Button variant="outline" className="w-full mt-4">
                    View All Periods
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/matching">
                    <Button variant="outline" className="w-full justify-between bg-warning-50 border-warning-200 text-warning-700 hover:bg-warning-100">
                      <div className="flex items-center">
                        <i className="fas fa-heart mr-3"></i>
                        <span className="font-medium">Match Receipts</span>
                      </div>
                      <Badge variant="secondary" className="bg-warning-100 text-warning-800">
                        {financialStats?.unmatchedReceiptCount || 0} unmatched
                      </Badge>
                    </Button>
                  </Link>

                  <Link href="/templates">
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center">
                        <i className="fas fa-download mr-3"></i>
                        <span className="font-medium">Export to Oracle</span>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {financialStats?.matchedCount || 0} ready
                      </Badge>
                    </Button>
                  </Link>

                  <Link href="/statements" className="w-full">
                    <Button variant="outline" className="w-full justify-start">
                      <i className="fas fa-chart-line mr-3"></i>
                      <span className="font-medium">View Statements</span>
                    </Button>
                  </Link>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowCsvModal(true)}
                  >
                    <i className="fas fa-upload mr-3"></i>
                    <span className="font-medium">Import AMEX CSV</span>
                  </Button>
                </div>
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
