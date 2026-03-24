import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyResearchProps {
  onResearch: (company: string, jobDescription: string) => Promise<any>;
  isLoading?: boolean;
}

export const CompanyResearch: React.FC<CompanyResearchProps> = ({ onResearch, isLoading = false }) => {
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(isLoading);

  const handleResearch = async () => {
    if (!company) {
      toast.error('Please enter a company name');
      return;
    }

    try {
      setLoading(true);
      const data = await onResearch(company, jobDescription);
      setResult(data);
      toast.success('Company research completed!');
    } catch (error) {
      toast.error('Failed to research company');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Research Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="company">Company Name *</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., OpenAI, Stripe, Figma"
            />
          </div>

          <div>
            <Label htmlFor="jobDescription">Job Description (optional)</Label>
            <Textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste any relevant job description to enhance research..."
              rows={5}
            />
          </div>

          <Button
            onClick={handleResearch}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Researching...
              </>
            ) : (
              'Research Company'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {result.overview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{result.overview}</p>
              </CardContent>
            </Card>
          )}

          {result.businessModel && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Model</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{result.businessModel}</p>
              </CardContent>
            </Card>
          )}

          {result.productStrategy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{result.productStrategy}</p>
              </CardContent>
            </Card>
          )}

          {result.targetCustomers && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{result.targetCustomers}</p>
              </CardContent>
            </Card>
          )}

          {result.competitors && result.competitors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Competitors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {result.competitors.map((competitor: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">{competitor}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.challenges && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Strategic Challenges</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {typeof result.challenges === 'string' ? result.challenges : JSON.stringify(result.challenges)}
                </p>
              </CardContent>
            </Card>
          )}

          {result.opportunities && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Strategic Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {typeof result.opportunities === 'string' ? result.opportunities : JSON.stringify(result.opportunities)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyResearch;
