import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, Receipt as ReceiptIcon, Eye } from "lucide-react";
import type { AmexStatement, AmexCharge, Receipt } from "@shared/schema";

interface StatementChargesDialogProps {
  statement: AmexStatement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StatementChargesDialog({ statement, open, onOpenChange }: StatementChargesDialogProps) {
  const { data: charges = [] } = useQuery<AmexCharge[]>({
    queryKey: ["/api/charges", statement.id],
    queryFn: () => fetch(`/api/statements/${statement.id}/charges`).then(res => res.json()),
    enabled: open,
  });

  const { data: receipts = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts", statement.id],
    queryFn: () => fetch(`/api/statements/${statement.id}/receipts`).then(res => res.json()),
    enabled: open,
  });

  // Get receipts in this period that don't match any charges
  const unmatchedReceipts = receipts.filter(receipt => !receipt.isMatched);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{statement.periodName} - Detailed View</span>
            <Badge variant="outline">
              {formatDate(statement.startDate)} - {formatDate(statement.endDate)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Charges</p>
                    <p className="text-2xl font-bold">{charges.length}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Matched</p>
                    <p className="text-2xl font-bold text-green-600">
                      {charges.filter(c => c.isMatched).length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Unmatched</p>
                    <p className="text-2xl font-bold text-red-600">
                      {charges.filter(c => !c.isMatched).length}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AMEX Charges Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>AMEX Charges</span>
                <Badge variant="secondary">{charges.length} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(charge.date)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium truncate">{charge.description}</p>
                            <p className="text-sm text-gray-500 truncate">{charge.cardMember}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(charge.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {charge.category || 'Uncategorized'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {charge.isMatched ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Unmatched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Additional Receipts (in period but don't match charges) */}
          {unmatchedReceipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span>Additional Receipts in Period</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    {unmatchedReceipts.length} found
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  These receipts fall within the billing period but don't match any AMEX charges
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedReceipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-mono text-sm">
                            {receipt.date ? formatDate(receipt.date) : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{receipt.merchant || 'Unknown'}</div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {receipt.amount ? formatCurrency(receipt.amount) : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {receipt.category || 'Uncategorized'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <ReceiptIcon className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{receipt.fileName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}