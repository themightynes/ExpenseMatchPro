import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Mail, Settings, Search, Upload, CheckCircle, AlertCircle, FileText, Paperclip } from 'lucide-react';

interface EmailPreview {
  id: string;
  subject: string;
  sender: string;
  receivedDateTime: string;
  attachmentCount: number;
  attachments: Array<{
    name: string;
    contentType: string;
    size: number;
  }>;
  hasReceiptContent: boolean;
}

interface SearchResult {
  emails: EmailPreview[];
  totalFound: number;
  searchPeriod: string;
}

export default function EmailImport() {
  const [setupData, setSetupData] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: '',
    userEmail: ''
  });
  const [searchData, setSearchData] = useState({
    userEmail: '',
    daysBack: 30
  });
  const [isSetup, setIsSetup] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  // Setup email service
  const setupMutation = useMutation({
    mutationFn: (data: { clientId: string; clientSecret: string; tenantId: string }) =>
      apiRequest('/api/email/setup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setIsSetup(true);
    },
  });

  // Search emails
  const searchMutation = useMutation({
    mutationFn: (data: { userEmail: string; daysBack: number }) =>
      apiRequest('/api/email/search', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result: SearchResult) => {
      setSearchResults(result);
    },
  });

  // Import emails
  const importMutation = useMutation({
    mutationFn: (data: { userEmail: string; daysBack: number }) =>
      apiRequest('/api/email/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });

  const handleSetup = () => {
    if (!setupData.clientId || !setupData.clientSecret || !setupData.tenantId) {
      return;
    }
    setupMutation.mutate({
      clientId: setupData.clientId,
      clientSecret: setupData.clientSecret,
      tenantId: setupData.tenantId,
    });
  };

  const handleSearch = () => {
    if (!searchData.userEmail) return;
    searchMutation.mutate(searchData);
  };

  const handleImport = () => {
    if (!searchData.userEmail) return;
    importMutation.mutate(searchData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Receipt Import</h1>
        <p className="text-gray-600">
          Import receipts from your Outlook emails, including both attachments and receipts embedded in email content.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setup Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Microsoft Graph API Setup
            </CardTitle>
            <CardDescription>
              Configure your Microsoft Graph API credentials to access Outlook emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSetup ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={setupData.clientId}
                    onChange={(e) => setSetupData(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Your Azure App Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    value={setupData.clientSecret}
                    onChange={(e) => setSetupData(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Your Azure App Client Secret"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant ID</Label>
                  <Input
                    id="tenantId"
                    value={setupData.tenantId}
                    onChange={(e) => setSetupData(prev => ({ ...prev, tenantId: e.target.value }))}
                    placeholder="Your Azure Tenant ID"
                  />
                </div>
                <Button 
                  onClick={handleSetup} 
                  disabled={setupMutation.isPending}
                  className="w-full"
                >
                  {setupMutation.isPending ? 'Setting up...' : 'Setup Email Service'}
                </Button>
                {setupMutation.error && (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      Setup failed: {setupMutation.error instanceof Error ? setupMutation.error.message : 'Unknown error'}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium">Email service is configured!</p>
                <p className="text-sm text-gray-600">You can now search and import receipts.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search & Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Receipt Import
            </CardTitle>
            <CardDescription>
              Search for and import receipts from your Outlook emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userEmail">User Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={searchData.userEmail}
                onChange={(e) => setSearchData(prev => ({ ...prev, userEmail: e.target.value }))}
                placeholder="user@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daysBack">Search Period (Days)</Label>
              <Input
                id="daysBack"
                type="number"
                value={searchData.daysBack}
                onChange={(e) => setSearchData(prev => ({ ...prev, daysBack: parseInt(e.target.value) || 30 }))}
                min="1"
                max="365"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={!isSetup || !searchData.userEmail || searchMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                <Search className="w-4 h-4 mr-2" />
                {searchMutation.isPending ? 'Searching...' : 'Preview Emails'}
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!isSetup || !searchData.userEmail || importMutation.isPending}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                {importMutation.isPending ? 'Importing...' : 'Import Receipts'}
              </Button>
            </div>

            {searchMutation.error && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Search failed: {searchMutation.error instanceof Error ? searchMutation.error.message : 'Unknown error'}
                </AlertDescription>
              </Alert>
            )}

            {importMutation.isSuccess && (
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  {importMutation.data?.message || 'Import completed successfully!'}
                </AlertDescription>
              </Alert>
            )}

            {importMutation.error && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Import failed: {importMutation.error instanceof Error ? importMutation.error.message : 'Unknown error'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search Results */}
      {searchResults && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Email Search Results
              </span>
              <Badge variant="secondary">
                {searchResults.totalFound} emails found
              </Badge>
            </CardTitle>
            <CardDescription>
              Found {searchResults.totalFound} emails with potential receipts from the last {searchResults.searchPeriod}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.emails.map((email) => (
                <div key={email.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{email.subject}</h4>
                      <p className="text-sm text-gray-600">From: {email.sender}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(email.receivedDateTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {email.hasReceiptContent && (
                        <Badge variant="default" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          Receipt Content
                        </Badge>
                      )}
                      {email.attachmentCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {email.attachmentCount} files
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {email.attachments.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">Attachments:</p>
                        {email.attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{attachment.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {attachment.contentType.split('/')[0]}
                              </Badge>
                              <span className="text-gray-500">{formatFileSize(attachment.size)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}