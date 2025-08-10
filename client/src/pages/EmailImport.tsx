import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Mail, Forward, Copy, Upload, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';

interface EmailData {
  subject: string;
  sender: string;
  body: string;
  receivedDate: string;
}

export default function EmailImport() {
  const [emailData, setEmailData] = useState<EmailData>({
    subject: '',
    sender: '',
    body: '',
    receivedDate: ''
  });
  // Process email content
  const processEmailMutation = useMutation({
    mutationFn: async (data: EmailData) => {
      const response = await fetch('/api/email/process-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to process email');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setEmailData({ subject: '', sender: '', body: '', receivedDate: '' });
    },
  });

  const handleProcessEmail = () => {
    if (!emailData.subject || !emailData.body) return;
    processEmailMutation.mutate(emailData);
  };

  const generateForwardEmail = () => {
    return `receipts+import@${window.location.hostname}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader 
        title="Email Receipt Import"
        showBack={true}
        onBack={() => window.history.back()}
      />
      
      <div className="px-4 py-6">
        <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Import</TabsTrigger>
          <TabsTrigger value="forward">Email Forwarding</TabsTrigger>
        </TabsList>
        
        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Copy & Paste Email Content
              </CardTitle>
              <CardDescription>
                Copy the email content from your secure work email and paste it here to extract receipt information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={emailData.subject}
                    onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Receipt from Restaurant XYZ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender">From Email</Label>
                  <Input
                    id="sender"
                    value={emailData.sender}
                    onChange={(e) => setEmailData(prev => ({ ...prev, sender: e.target.value }))}
                    placeholder="noreply@restaurant.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receivedDate">Received Date</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={emailData.receivedDate}
                  onChange={(e) => setEmailData(prev => ({ ...prev, receivedDate: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="body">Email Content</Label>
                <Textarea
                  id="body"
                  value={emailData.body}
                  onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Paste the entire email content here, including any receipt details, amounts, merchant names, dates, etc."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              
              <Button 
                onClick={handleProcessEmail} 
                disabled={!emailData.subject || !emailData.body || processEmailMutation.isPending}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                {processEmailMutation.isPending ? 'Processing...' : 'Extract Receipt Information'}
              </Button>

              {processEmailMutation.error && (
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    Processing failed: {processEmailMutation.error instanceof Error ? processEmailMutation.error.message : 'Unknown error'}
                  </AlertDescription>
                </Alert>
              )}

              {processEmailMutation.isSuccess && (
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    Email processed successfully! Receipt information has been extracted and saved.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="forward" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Forward className="w-5 h-5" />
                Email Forwarding Setup
              </CardTitle>
              <CardDescription>
                Forward receipt emails to a special address for automatic processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Forward Receipt Emails To:</h4>
                <div className="flex items-center gap-2">
                  <Input
                    value={generateForwardEmail()}
                    readOnly
                    className="font-mono bg-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generateForwardEmail())}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">How to use:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Copy the email address above</li>
                  <li>When you receive a receipt email, forward it to this address</li>
                  <li>The system will automatically extract receipt information</li>
                  <li>Check your receipts page to see the imported data</li>
                </ol>
              </div>
              
              <Alert>
                <Mail className="w-4 h-4" />
                <AlertDescription>
                  This feature requires email server configuration. Contact your system administrator to set up email forwarding rules.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Alternative Methods</CardTitle>
              <CardDescription>
                Other ways to import receipts from secure email systems.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Save as EML File</h4>
                    <p className="text-sm text-gray-600">Save the email as an .eml file and upload it using the regular file upload feature.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Screenshot Method</h4>
                    <p className="text-sm text-gray-600">Take a screenshot of the receipt email and upload it as an image for OCR processing.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Copy className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Manual Entry</h4>
                    <p className="text-sm text-gray-600">Use the manual import tab above to copy and paste email content directly.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}