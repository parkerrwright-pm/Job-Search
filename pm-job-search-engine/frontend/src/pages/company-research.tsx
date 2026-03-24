import React from 'react';
import Navbar from '@/components/Navbar';
import CompanyResearch from '@/components/CompanyResearch';
import { toast } from 'sonner';

export default function CompanyResearchPage() {
  const handleResearch = async (company: string, jobDescription: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Please log in first');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/ai/company-research`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company, jobDescription }),
      });

      if (!response.ok) throw new Error('Failed to research company');
      return await response.json();
    } catch (error: any) {
      console.error('Research error:', error);
      toast.error(error.message || 'Failed to research company');
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Research</h1>
        <p className="text-gray-600 mb-8">
          Get comprehensive research on companies, including business model, product strategy,
          competitors, and strategic insights to help you prepare for interviews.
        </p>

        <CompanyResearch onResearch={handleResearch} />
      </div>
    </div>
  );
}
