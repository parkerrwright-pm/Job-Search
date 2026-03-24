import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'sonner';

const toDisplayString = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (typeof obj.rewritten === 'string') return obj.rewritten;
    if (typeof obj.recommendation === 'string') {
      return obj.category ? `${obj.category}: ${obj.recommendation}` : obj.recommendation;
    }
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.value === 'string') return obj.value;
    return JSON.stringify(item);
  }
  return String(item);
};

interface AnalysisSection {
  atsVmockScore?: any;
  atsSystemDetection?: any;
  keywordDensityTargets?: any[];
  missingKeywords?: string;
  bulletRewrites?: any;
  mirroredBullets?: string;
  summaryOptions?: string;
  skillsSection?: string;
  companyPositioning?: any;
  companyStrategy?: any;
  strategyPositioning?: string;
  linkedinOptimization?: any;
  recruiterSearchKeywords?: string[];
  networkingMessages?: string;
  interviewTalkingPoints?: string;
  interviewQuestions?: string;
  hiringManagerPsychology?: string;
  jobMatchSummary?: string[];
}

interface Analysis {
  jobId: string;
  jobTitle: string;
  companyName: string;
  generatedAt: string;
  sections: AnalysisSection;
  workflow?: {
    qualityGate?: {
      minAtsScore: number;
      minAiReviewerScore: number;
      maxIterations: number;
      truthfulnessGuardrail: boolean;
    };
    scoreHistory?: Array<{
      iteration: number;
      atsScore: number;
      aiReviewerScore: number;
      passed: boolean;
      durationMs: number;
      generatedAt: string;
    }>;
    iterationsRun?: number;
    passed?: boolean;
    finalAtsScore?: number;
    finalAiReviewerScore?: number;
    nextAction?: string;
    supportingArchitecture?: {
      promptTemplateLibrary?: { connected: boolean; source?: string };
      resumeTemplateStore?: { connected: boolean; templateFound: boolean; templateFileName?: string };
      atsRulesDatabase?: { connected: boolean; version?: string };
      qualityGateConfig?: {
        connected: boolean;
        minAtsScore: number;
        minAiReviewerScore: number;
        maxIterations: number;
      };
      sessionStateStore?: { connected: boolean; mechanism?: string };
      exportEngine?: { connected: boolean; word: boolean; pdf: boolean };
      auditObservability?: { connected: boolean; analysisRunLogging: boolean; scoreHistory: boolean };
      errorHandling?: { connected: boolean; gracefulFallback: boolean };
      securityLayer?: { connected: boolean; authRequired: boolean };
    };
    sources?: {
      primaryResumeConnected?: boolean;
      templateResumeConnected?: boolean;
      companyUrlConnected?: boolean;
      linkedinConnected?: boolean;
    };
  };
}

interface ExportPreview {
  headline: string;
  summary: string;
  skills: string[];
  experienceBullets: string[];
  keywordsAdded: string[];
  atsRecommendations: string[];
  generatedAt: string;
  targetRole: string;
  targetCompany: string;
}

const isValidAnalysis = (value: any): value is Analysis => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.jobId === 'string' &&
      typeof value.jobTitle === 'string' &&
      value.sections &&
      typeof value.sections === 'object',
  );
};

export default function JobAnalyzePage() {
  const router = useRouter();
  const { id } = router.query;
  const jobId = typeof id === 'string' ? id : '';

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('authToken') || '';
  };

  const getErrorMessage = (err: any, fallback: string) => {
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      fallback
    );
  };

  useEffect(() => {
    if (!router.isReady || !jobId) return;
    if (router.query.autoGenerate === 'true') {
      setLoading(false);
      generateAnalysis();
    } else {
      fetchAnalysis();
    }
  }, [router.isReady, jobId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiUrl}/api/jobs/${jobId}/analyze`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      if (isValidAnalysis(response.data)) {
        setAnalysis(response.data);
        setError('');
      } else {
        setAnalysis(null);
        setError('Analysis data is malformed. Please regenerate analysis.');
      }
    } catch (err: any) {
      console.error('Error fetching analysis:', err);
      setError(getErrorMessage(err, 'Failed to load analysis'));
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    try {
      setGenerating(true);
      const response = await axios.post(`${apiUrl}/api/jobs/${jobId}/analyze`, {}, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      if (isValidAnalysis(response.data)) {
        setAnalysis(response.data);
        setError('');
        setActionStatus({ type: 'success', message: 'Analysis regenerated successfully.' });
        toast.success('Analysis regenerated successfully.');
      } else {
        setAnalysis(null);
        const malformed = 'Generated analysis data is malformed. Please try again.';
        setError(malformed);
        setActionStatus({ type: 'error', message: malformed });
        toast.error(malformed);
      }
    } catch (err: any) {
      console.error('Error generating analysis:', err);
      const message = getErrorMessage(err, 'Failed to generate analysis');
      setError(message);
      setActionStatus({ type: 'error', message });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadFile = async (format: 'word' | 'pdf') => {
    try {
      if (format === 'word') {
        setExportingWord(true);
      } else {
        setExportingPdf(true);
      }

      const response = await axios.get(`${apiUrl}/api/jobs/${jobId}/outputs/${format}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
      const fallbackName =
        format === 'word' ? `tailored-resume-${jobId}.docx` : `tailored-resume-${jobId}.pdf`;
      const fileName = match?.[1] || fallbackName;

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      setActionStatus({
        type: 'success',
        message: format === 'word' ? 'Word file downloaded.' : 'PDF file downloaded.',
      });
      toast.success(format === 'word' ? 'Word file downloaded.' : 'PDF file downloaded.');
    } catch (err: any) {
      console.error(`Error exporting ${format}:`, err);
      const message = getErrorMessage(err, `Failed to export ${format.toUpperCase()}`);
      setActionStatus({ type: 'error', message });
      toast.error(message);
    } finally {
      if (format === 'word') {
        setExportingWord(false);
      } else {
        setExportingPdf(false);
      }
    }
  };

  const loadExportPreview = async () => {
    try {
      setLoadingPreview(true);
      const response = await axios.get(`${apiUrl}/api/jobs/${jobId}/outputs/preview`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      setPreview(response.data as ExportPreview);
      setActionStatus({ type: 'success', message: 'Loaded export preview.' });
    } catch (err: any) {
      const message = getErrorMessage(err, 'Failed to load export preview');
      setActionStatus({ type: 'error', message });
      toast.error(message);
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading analysis...</div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-red-900">{error}</h3>
          {(error.includes('No analysis found') || error.includes('Failed to load analysis')) && (
            <button
              onClick={generateAnalysis}
              disabled={generating}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {generating ? 'Generating Analysis...' : 'Generate Analysis'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) {
    if (generating) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="inline-block mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Generating Your Analysis</h2>
            <p className="text-gray-500 text-sm">
              Running all 18 analysis sections — this usually takes 30–60 seconds.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={generateAnalysis}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          Generate 20-Section Analysis
        </button>
      </div>
    );
  }

  const tabs = [
    { id: '1', label: 'ATS Score', key: 'atsVmockScore' },
    { id: '2', label: 'ATS System', key: 'atsSystemDetection' },
    { id: '3', label: 'Keywords', key: 'keywordDensityTargets' },
    { id: '4', label: 'Missing Keywords', key: 'missingKeywords' },
    { id: '5', label: 'Resume Bullets', key: 'bulletRewrites' },
    { id: '6', label: 'Mirrored Bullets', key: 'mirroredBullets' },
    { id: '7', label: 'Summary', key: 'summaryOptions' },
    { id: '8', label: 'Skills', key: 'skillsSection' },
    { id: '9', label: 'Positioning', key: 'companyPositioning' },
    { id: '10', label: 'Company', key: 'companyStrategy' },
    { id: '11', label: 'Strategy', key: 'strategyPositioning' },
    { id: '12', label: 'LinkedIn', key: 'linkedinOptimization' },
    { id: '13', label: 'Recruiter', key: 'recruiterSearchKeywords' },
    { id: '14', label: 'Networking', key: 'networkingMessages' },
    { id: '15', label: 'Interview Stories', key: 'interviewTalkingPoints' },
    { id: '16', label: 'Questions', key: 'interviewQuestions' },
    { id: '17', label: 'Psychology', key: 'hiringManagerPsychology' },
    { id: '18', label: 'Match Summary', key: 'jobMatchSummary' },
  ];

  const getActiveContent = () => {
    const activeTab_obj = tabs.find(t => t.id === activeTab);
    if (!activeTab_obj || !analysis?.sections) return null;

    const content = analysis.sections[activeTab_obj.key as keyof AnalysisSection];

    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{activeTab_obj.label}</h3>
        <div className="prose prose-sm max-w-none">
          {typeof content === 'string' ? (
            <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {content}
            </pre>
          ) : Array.isArray(content) ? (
            <ul className="list-disc list-inside space-y-2">
              {content.map((item, idx) => (
                <li key={idx} className="text-gray-700">
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          ) : content && typeof content === 'object' ? (
            <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {JSON.stringify(content, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-blue-600 hover:underline mb-4">
          ← Back
        </button>
        <h1 className="text-3xl font-bold">
          {analysis.jobTitle} at {analysis.companyName}
        </h1>
        <p className="text-gray-600 mt-2">
          Analysis generated: {new Date(analysis.generatedAt).toLocaleDateString()}
        </p>
      </div>

      {analysis.workflow && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Workflow Quality Gate</h2>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                analysis.workflow.passed
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              {analysis.workflow.passed ? 'PASSED' : 'NOT MET'}
            </span>
          </div>

          <div className="grid sm:grid-cols-4 gap-3 text-sm mb-3">
            <div className="bg-white border rounded p-2">
              <p className="text-slate-500">Final ATS</p>
              <p className="font-semibold text-slate-900">{analysis.workflow.finalAtsScore ?? 0}</p>
            </div>
            <div className="bg-white border rounded p-2">
              <p className="text-slate-500">Final AI Score</p>
              <p className="font-semibold text-slate-900">{analysis.workflow.finalAiReviewerScore ?? 0}</p>
            </div>
            <div className="bg-white border rounded p-2">
              <p className="text-slate-500">Iterations Run</p>
              <p className="font-semibold text-slate-900">{analysis.workflow.iterationsRun ?? 0}</p>
            </div>
            <div className="bg-white border rounded p-2">
              <p className="text-slate-500">Thresholds</p>
              <p className="font-semibold text-slate-900">
                ATS {analysis.workflow.qualityGate?.minAtsScore ?? '-'} / AI {analysis.workflow.qualityGate?.minAiReviewerScore ?? '-'}
              </p>
            </div>
          </div>

          {analysis.workflow.scoreHistory?.length ? (
            <div className="bg-white border rounded p-3 text-sm">
              <p className="font-semibold text-slate-900 mb-2">Score History</p>
              <ul className="space-y-1 text-slate-700">
                {analysis.workflow.scoreHistory.map((entry) => (
                  <li key={entry.iteration}>
                    Iteration {entry.iteration}: ATS {entry.atsScore}, AI {entry.aiReviewerScore}, Duration {Math.round(entry.durationMs / 1000)}s
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.workflow.nextAction ? (
            <p className="mt-3 text-sm text-slate-700">{analysis.workflow.nextAction}</p>
          ) : null}

          {analysis.workflow.supportingArchitecture ? (
            <div className="mt-4 bg-white border rounded p-3 text-sm">
              <p className="font-semibold text-slate-900 mb-2">Supporting Architecture Connectivity</p>
              <ul className="space-y-1 text-slate-700">
                <li>Prompt Template Library: {analysis.workflow.supportingArchitecture.promptTemplateLibrary?.connected ? 'Connected' : 'Missing'}</li>
                <li>Resume Template Store: {analysis.workflow.supportingArchitecture.resumeTemplateStore?.templateFound ? 'Connected with template' : 'Connected (no template uploaded)'}</li>
                <li>ATS Rules Database: {analysis.workflow.supportingArchitecture.atsRulesDatabase?.connected ? 'Connected' : 'Missing'}</li>
                <li>Quality Gate Config: {analysis.workflow.supportingArchitecture.qualityGateConfig?.connected ? 'Connected' : 'Missing'}</li>
                <li>Session/State Store: {analysis.workflow.supportingArchitecture.sessionStateStore?.connected ? 'Connected' : 'Missing'}</li>
                <li>Export Engine: {analysis.workflow.supportingArchitecture.exportEngine?.connected ? 'Connected' : 'Missing'}</li>
                <li>Audit & Observability: {analysis.workflow.supportingArchitecture.auditObservability?.connected ? 'Connected' : 'Missing'}</li>
                <li>Error Handling: {analysis.workflow.supportingArchitecture.errorHandling?.connected ? 'Connected' : 'Missing'}</li>
                <li>Security Layer: {analysis.workflow.supportingArchitecture.securityLayer?.connected ? 'Connected' : 'Missing'}</li>
              </ul>
            </div>
          ) : null}

          {analysis.workflow.sources ? (
            <div className="mt-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900 mb-1">Input Source Connections</p>
              <p>
                Primary Resume: {analysis.workflow.sources.primaryResumeConnected ? 'Yes' : 'No'} | Template Resume: {analysis.workflow.sources.templateResumeConnected ? 'Yes' : 'No'} | Company URL: {analysis.workflow.sources.companyUrlConnected ? 'Yes' : 'No'} | LinkedIn: {analysis.workflow.sources.linkedinConnected ? 'Yes' : 'No'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mb-8">{getActiveContent()}</div>

      {actionStatus && (
        <div
          className={`mb-4 p-3 rounded-lg border text-sm ${
            actionStatus.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {actionStatus.message}
        </div>
      )}

      {preview && (
        <div className="mb-8 p-6 rounded-lg border border-indigo-200 bg-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-indigo-900">Export Preview</h3>
            <button
              onClick={() => setPreview(null)}
              className="px-3 py-1 text-sm bg-white border border-indigo-200 rounded-md text-indigo-700 hover:bg-indigo-100"
            >
              Close Preview
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-800">
            <div>
              <p className="font-semibold">Headline</p>
              <p>{preview.headline || 'Not available'}</p>
            </div>

            <div>
              <p className="font-semibold">Summary</p>
              <p className="whitespace-pre-wrap">{preview.summary || 'Not available'}</p>
            </div>

            <div>
              <p className="font-semibold">Skills</p>
              <ul className="list-disc list-inside">
                {preview.skills?.length ? preview.skills.map((skill, idx) => <li key={idx}>{toDisplayString(skill)}</li>) : <li>Not available</li>}
              </ul>
            </div>

            <div>
              <p className="font-semibold">Experience Highlights</p>
              <ul className="list-disc list-inside">
                {preview.experienceBullets?.length
                  ? preview.experienceBullets.map((bullet, idx) => <li key={idx}>{toDisplayString(bullet)}</li>)
                  : <li>Not available</li>}
              </ul>
            </div>

            <div>
              <p className="font-semibold">ATS Keywords Added</p>
              <ul className="list-disc list-inside">
                {preview.keywordsAdded?.length
                  ? preview.keywordsAdded.map((keyword, idx) => <li key={idx}>{toDisplayString(keyword)}</li>)
                  : <li>Not available</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="flex gap-4 mt-8 pt-6 border-t">
        <button
          onClick={loadExportPreview}
          disabled={loadingPreview || exportingWord || exportingPdf}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
        >
          {loadingPreview ? 'Loading Preview...' : 'Preview Export'}
        </button>
        <button
          onClick={() => downloadFile('word')}
          disabled={exportingWord || exportingPdf}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {exportingWord ? 'Exporting Word...' : 'Export to Word'}
        </button>
        <button
          onClick={() => downloadFile('pdf')}
          disabled={exportingWord || exportingPdf}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {exportingPdf ? 'Exporting PDF...' : 'Export to PDF'}
        </button>
        <button
          onClick={generateAnalysis}
          disabled={generating}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
        >
          {generating ? 'Regenerating...' : 'Regenerate Analysis'}
        </button>
      </div>
    </div>
  );
}
