import React from 'react';
import Navbar from '@/components/Navbar';
import ResumeTailor from '@/components/ResumeTailor';
import { toast } from 'sonner';

export default function AITailorPage() {
  const getAuthToken = () => localStorage.getItem('authToken') || '';

  const handleTailor = async (data: any) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in first');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/ai/tailor-resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let message = 'Failed to tailor resume';
        try {
          const errorBody = await response.json();
          const apiMessage =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : typeof errorBody?.error === 'string'
                ? errorBody.error
                : '';
          if (apiMessage) message = apiMessage;
        } catch {
          // keep generic message
        }
        toast.error(message);
        throw new Error(message);
      }
      return await response.json();
    } catch (error: any) {
      if (!error._toasted) {
        console.error('Tailor error:', error);
      }
      throw error;
    }
  };

  const handlePreviewExport = async (jobId: string, selectedKeywords: string[] = []) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in first');
        return null;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const usePost = selectedKeywords.length > 0;
      const response = await fetch(`${apiUrl}/api/jobs/${jobId}/outputs/preview`, {
        method: usePost ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(usePost ? { body: JSON.stringify({ selectedKeywords }) } : {}),
      });

      if (!response.ok) {
        let message = 'Failed to load export preview';
        try {
          const errorBody = await response.json();
          const apiMessage =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : typeof errorBody?.error === 'string'
                ? errorBody.error
                : '';
          if (apiMessage) message = apiMessage;
        } catch {
          // keep generic message
        }
        // Show error as a toast with action hint
        if (message.includes('Quality gate not met')) {
          toast.error(
            `${message} Try regenerating the analysis or adjusting quality gate settings.`,
            { duration: 5000 }
          );
        } else {
          toast.error(message);
        }
        throw new Error(message);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Preview export error:', error);
      // Don't double-toast if we already toasted above
      if (!error.message?.includes('Quality gate')) {
        toast.error(error.message || 'Failed to load export preview');
      }
      throw error;
    }
  };

  const handleProviderStatus = async (jobId: string) => {
    try {
      const token = getAuthToken();
      if (!token) return null;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/${jobId}/outputs/provider-status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  const handleAiDiagnostics = async () => {
    try {
      const token = getAuthToken();
      if (!token) return null;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/ai/diagnostics`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  const handleUpdateDiagnostics = async (provider: string, model: string) => {
    try {
      const token = getAuthToken();
      if (!token) return null;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/ai/diagnostics`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Failed to update AI configuration');
        return null;
      }
      const data = await response.json();
      toast.success(`Switched to ${data.provider} / ${data.effective.model}`);
      return data;
    } catch {
      toast.error('Failed to update AI configuration');
      return null;
    }
  };

  const handleDownloadExport = async (jobId: string, format: 'word' | 'pdf') => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in first');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/${jobId}/outputs/${format}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = `Failed to export ${format.toUpperCase()}`;
        try {
          const errorBody = await response.json();
          const apiMessage =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : typeof errorBody?.error === 'string'
                ? errorBody.error
                : '';
          if (apiMessage) {
            message = apiMessage;
          }
        } catch {
          // Best-effort: keep the generic message when response is not JSON.
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
      const fileName = match?.[1] || `tailored-resume.${format === 'word' ? 'docx' : 'pdf'}`;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(format === 'word' ? 'Word export downloaded.' : 'PDF export downloaded.');
    } catch (error: any) {
      console.error(`${format} export error:`, error);
      toast.error(error.message || `Failed to export ${format.toUpperCase()}`);
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Tailor</h1>
        <p className="text-gray-600 mb-8">
          Select a saved job description and an uploaded resume template to generate a tailored
          resume using your primary resume content, with ATS-focused bullet rewrites and summary updates.
        </p>

        <ResumeTailor
          onTailor={handleTailor}
          onPreviewExport={handlePreviewExport}
          onProviderStatus={handleProviderStatus}
          onDiagnostics={handleAiDiagnostics}
          onUpdateDiagnostics={handleUpdateDiagnostics}
          onExportWord={(jobId) => handleDownloadExport(jobId, 'word')}
          onExportPdf={(jobId) => handleDownloadExport(jobId, 'pdf')}
        />
      </div>
    </div>
  );
}
