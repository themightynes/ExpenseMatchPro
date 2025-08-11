import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AmexStatement } from "@shared/schema";

interface ManualChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  statements: AmexStatement[];
  defaultStatementId?: string;
}

export default function ManualChargeModal({ 
  isOpen, 
  onClose, 
  statements,
  defaultStatementId 
}: ManualChargeModalProps) {
  const [formData, setFormData] = useState({
    date: new Date(),
    description: "",
    cardMember: "",
    accountNumber: "",
    amount: "",
    extendedDetails: "",
    statementAs: "",
    address: "",
    cityState: "",
    zipCode: "",
    country: "",
    reference: "",
    category: "",
    statementId: defaultStatementId || "",
  });

  const [dateOpen, setDateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createChargeMutation = useMutation({
    mutationFn: async (chargeData: any) => {
      const response = await fetch("/api/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...chargeData,
          date: chargeData.date.toISOString(),
          isMatched: false,
          receiptId: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create charge");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Charge Added Successfully",
        description: "The missing charge has been added to your statement.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/charges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statements"] });
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error("Create charge error:", error);
      toast({
        title: "Failed to Add Charge",
        description: "There was an error adding the charge. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      date: new Date(),
      description: "",
      cardMember: "",
      accountNumber: "",
      amount: "",
      extendedDetails: "",
      statementAs: "",
      address: "",
      cityState: "",
      zipCode: "",
      country: "",
      reference: "",
      category: "",
      statementId: defaultStatementId || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || !formData.statementId) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in Description, Amount, and Statement.",
        variant: "destructive",
      });
      return;
    }

    createChargeMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Missing Charge Manually</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statement">Statement *</Label>
              <Select
                value={formData.statementId}
                onValueChange={(value) => handleInputChange("statementId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select statement" />
                </SelectTrigger>
                <SelectContent>
                  {statements.map((statement) => (
                    <SelectItem key={statement.id} value={statement.id}>
                      {statement.periodName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "MM/dd/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => {
                      if (date) {
                        setFormData(prev => ({ ...prev, date }));
                        setDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Merchant name or charge description"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardMember">Card Member</Label>
              <Input
                id="cardMember"
                value={formData.cardMember}
                onChange={(e) => handleInputChange("cardMember", e.target.value)}
                placeholder="Card member name"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Optional Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                  placeholder="Last 4 digits"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  placeholder="Expense category"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statementAs">Appears On Statement As</Label>
              <Input
                id="statementAs"
                value={formData.statementAs}
                onChange={(e) => handleInputChange("statementAs", e.target.value)}
                placeholder="How it appears on your statement"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extendedDetails">Extended Details</Label>
              <Textarea
                id="extendedDetails"
                value={formData.extendedDetails}
                onChange={(e) => handleInputChange("extendedDetails", e.target.value)}
                placeholder="Additional charge details"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cityState">City/State</Label>
                <Input
                  id="cityState"
                  value={formData.cityState}
                  onChange={(e) => handleInputChange("cityState", e.target.value)}
                  placeholder="City, State"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange("zipCode", e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createChargeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createChargeMutation.isPending}
            >
              {createChargeMutation.isPending ? "Adding..." : "Add Charge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}