import React, { useEffect, useState, useMemo } from 'react';

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Word-level diff: returns JSX spans highlighting words present in `revised` but NOT in `original`.
 * Unchanged words render normally; new/changed words get a green highlight.
 */
const renderWordDiff = (original: string, revised: string): React.ReactNode => {
  if (!original || !revised) return revised;
  const origWords = new Set(original.toLowerCase().split(/\s+/).filter(Boolean));
  const revisedTokens = revised.split(/(\s+)/); // preserve whitespace
  return revisedTokens.map((token, i) => {
    if (/^\s+$/.test(token)) return token; // whitespace
    const isNew = !origWords.has(token.toLowerCase().replace(/[.,;:!?'"()[\]{}]/g, ''));
    return isNew ? (
      <span key={i} className="bg-emerald-100 text-emerald-900 rounded px-0.5">{token}</span>
    ) : (
      <span key={i}>{token}</span>
    );
  });
};

/**
 * Find the best-matching original bullet for a rewritten bullet using word overlap.
 */
const findClosestBullet = (rewritten: string, originals: string[]): string | null => {
  if (!originals.length) return null;
  const rWords = new Set(rewritten.toLowerCase().split(/\s+/));
  let best = '';
  let bestScore = 0;
  for (const orig of originals) {
    const oWords = orig.toLowerCase().split(/\s+/);
    const overlap = oWords.filter((w) => rWords.has(w)).length;
    const score = overlap / Math.max(oWords.length, 1);
    if (score > bestScore) {
      bestScore = score;
      best = orig;
    }
  }
  return bestScore > 0.15 ? best : null;
};

/** Safely convert an AI response item to a renderable string. */
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

const ResumeSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-4">
    <div className="border-b border-slate-300 pb-0.5 mb-2">
      <p className="text-xs font-bold uppercase tracking-widest text-[#1e3a5f]">{title}</p>
    </div>
    {children}
  </div>
);

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Loader } from 'lucide-react';
import { toast } from 'sonner';

interface ResumeTailorProps {
  onTailor: (data: any) => Promise<any>;
  onPreviewExport: (jobId: string, selectedKeywords?: string[]) => Promise<any>;
  onProviderStatus: (jobId: string) => Promise<any>;
  onDiagnostics: () => Promise<any>;
  onUpdateDiagnostics: (provider: string, model: string) => Promise<any>;
  onExportWord: (jobId: string) => Promise<void>;
  onExportPdf: (jobId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ResumeTailor: React.FC<ResumeTailorProps> = ({
  onTailor,
  onPreviewExport,
  onProviderStatus,
  onDiagnostics,
  onUpdateDiagnostics,
  onExportWord,
  onExportPdf,
  isLoading = false,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const [formData, setFormData] = useState({
    jobId: '',
    primaryResumeId: '',
    templateResumeId: '',
  });
  const [jobs, setJobs] = useState<any[]>([]);
  const [primaryResumes, setPrimaryResumes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(isLoading);
  const [preview, setPreview] = useState<any>(null);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [savingDiagnostics, setSavingDiagnostics] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [applyingKeywords, setApplyingKeywords] = useState(false);
  const [savedKeywordsLoaded, setSavedKeywordsLoaded] = useState<string | null>(null);
  const [cachedFingerprint, setCachedFingerprint] = useState<{
    primaryResumeId: string | null;
    templateResumeId: string | null;
    selectedKeywords: string[];
  } | null>(null);
  const [loadingCached, setLoadingCached] = useState(false);
  const [atsFeedback, setAtsFeedback] = useState('');
  const [submittingAtsFeedback, setSubmittingAtsFeedback] = useState(false);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast.error('Please log in first');
          return;
        }

        setLoadingSources(true);
        const [jobsResponse, resumesResponse] = await Promise.all([
          fetch(`${apiUrl}/api/jobs?stage=SAVED`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/api/resumes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!jobsResponse.ok || !resumesResponse.ok) {
          throw new Error('Failed to load saved jobs or templates');
        }

        const jobsData = await jobsResponse.json();
        const resumesData = await resumesResponse.json();
        const primaryResumesList = resumesData.filter((resume: any) => resume.isPrimary);
        const templateResumes = resumesData.filter((resume: any) => !resume.isPrimary);

        setJobs(jobsData);
        setPrimaryResumes(primaryResumesList);
        setTemplates(templateResumes);
        setFormData((prev) => ({
          jobId: prev.jobId || jobsData[0]?.id || '',
          primaryResumeId: prev.primaryResumeId || primaryResumesList[0]?.id || '',
          templateResumeId: prev.templateResumeId || templateResumes[0]?.id || '',
        }));
      } catch (error: any) {
        toast.error(error.message || 'Failed to load saved jobs and templates');
      } finally {
        setLoadingSources(false);
      }
    };

    loadSources();
  }, [apiUrl]);

  useEffect(() => {
    let mounted = true;

    const loadDiagnostics = async () => {
      try {
        setLoadingDiagnostics(true);
        const data = await onDiagnostics();
        if (mounted) {
          setDiagnostics(data);
          if (data) {
            setSelectedProvider(data.provider || 'anthropic');
            setSelectedModel(data.effective?.model || '');
          }
        }
      } finally {
        if (mounted) setLoadingDiagnostics(false);
      }
    };

    loadDiagnostics();
    return () => {
      mounted = false;
    };
  }, [onDiagnostics]);

  // Load saved keyword selections when the resolved job ID changes
  const resolvedJobId = result?.jobId || formData.jobId;
  useEffect(() => {
    if (!resolvedJobId || savedKeywordsLoaded === resolvedJobId) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    (async () => {
      try {
        const resp = await fetch(`${apiUrl}/api/jobs/${resolvedJobId}/selected-keywords`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.selectedKeywords) && data.selectedKeywords.length > 0) {
            setSelectedKeywords(new Set(data.selectedKeywords));
          }
          setSavedKeywordsLoaded(resolvedJobId);
        }
      } catch {
        // silently ignore — keyword loading is non-critical
      }
    })();
  }, [resolvedJobId, apiUrl, savedKeywordsLoaded]);

  // Auto-load cached tailored resume when the job selection changes
  useEffect(() => {
    if (!formData.jobId) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingCached(true);
        const resp = await fetch(`${apiUrl}/api/jobs/${formData.jobId}/cached-preview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        if (cancelled) return;
        if (data.cached) {
          setPreview(data);
          // Populate result-level data so the keyword chips and export buttons appear
          setResult({
            jobId: formData.jobId,
            jobTitle: data.targetRole || '',
            company: data.targetCompany || '',
            missingKeywords: data.missingKeywords || [],
            provider: data.generationProvider || 'unknown',
          });
          if (data.fingerprint) {
            setCachedFingerprint(data.fingerprint);
          }
          // Load saved keyword selections from fingerprint
          if (data.fingerprint?.selectedKeywords?.length > 0) {
            setSelectedKeywords(new Set(data.fingerprint.selectedKeywords));
            setSavedKeywordsLoaded(formData.jobId);
          }
        }
      } catch {
        // non-critical — user can still generate fresh
      } finally {
        if (!cancelled) setLoadingCached(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formData.jobId, apiUrl]);

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTailor = async () => {
    if (!formData.jobId || !formData.primaryResumeId || !formData.templateResumeId) {
      toast.error('Please select a saved job, a primary resume, and a resume template');
      return;
    }

    try {
      setLoading(true);
      // Run the job workflow analysis first, then tailor
      const resolvedId = formData.jobId;
      if (resolvedId) {
        const token = localStorage.getItem('authToken');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        await fetch(`${apiUrl}/api/jobs/${resolvedId}/analyze`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      }
      const data = await onTailor(formData);
      setResult(data);
      setPreview(null);
      // Update fingerprint to reflect what was just generated
      setCachedFingerprint({
        primaryResumeId: formData.primaryResumeId,
        templateResumeId: formData.templateResumeId,
        selectedKeywords: Array.from(selectedKeywords),
      });
      // Reset keyword load tracking so saved keywords are fetched for the (potentially new) job
      setSavedKeywordsLoaded(null);
      toast.success('Tailored resume generated from saved job and uploaded template.');
    } catch {
      // error already toasted by the caller
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!resolvedJobId) return;
    try {
      setLoadingPreview(true);
      setPreview(null);
      setPreviewError('');
      const keywords = selectedKeywords.size > 0 ? Array.from(selectedKeywords) : [];
      const data = await onPreviewExport(resolvedJobId, keywords);
      setPreview(data);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load export preview';
      setPreviewError(errorMsg);
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApplyKeywords = async () => {
    if (!resolvedJobId || selectedKeywords.size === 0) return;
    try {
      setApplyingKeywords(true);
      setPreview(null);
      setPreviewError('');
      const keywords = Array.from(selectedKeywords);
      // POST triggers both persistence and AI synthesis with selected keywords
      const data = await onPreviewExport(resolvedJobId, keywords);
      setPreview(data);
      toast.success(`Applied ${keywords.length} keywords — resume regenerated.`);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to apply keywords';
      setPreviewError(errorMsg);
      setPreview(null);
    } finally {
      setApplyingKeywords(false);
    }
  };

  const handleExportWord = async () => {
    if (!resolvedJobId) return;
    try {
      setExportingWord(true);
      await onExportWord(resolvedJobId);
    } finally {
      setExportingWord(false);
    }
  };

  const handleExportPdf = async () => {
    if (!resolvedJobId) return;
    try {
      setExportingPdf(true);
      await onExportPdf(resolvedJobId);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleAtsFeedback = async (unappliedRecs: string[]) => {
    if (!resolvedJobId || !atsFeedback.trim()) return;
    try {
      setSubmittingAtsFeedback(true);
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${apiUrl}/api/ai/ats-feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: resolvedJobId,
          recommendations: unappliedRecs,
          feedback: atsFeedback.trim(),
        }),
      });
      if (!resp.ok) throw new Error('Failed to process feedback');
      const data = await resp.json();
      if (data.atsRecommendations) {
        setResult((prev: any) => ({ ...prev, atsRecommendations: data.atsRecommendations }));
        setAtsFeedback('');
        toast.success('ATS recommendations updated based on your feedback.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process ATS feedback');
    } finally {
      setSubmittingAtsFeedback(false);
    }
  };

  // Determine whether the cached resume is still current (no input changes)
  const isCachedCurrent = !!cachedFingerprint &&
    cachedFingerprint.primaryResumeId === formData.primaryResumeId &&
    cachedFingerprint.templateResumeId === formData.templateResumeId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Resume Tailor Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-800 mb-2">AI Diagnostics</p>
            {loadingDiagnostics ? (
              <p className="text-slate-600">Checking provider and model configuration...</p>
            ) : diagnostics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => {
                        const newProvider = e.target.value;
                        setSelectedProvider(newProvider);
                        const providerModels = diagnostics.providers?.[newProvider]?.models || [];
                        const currentModel = diagnostics.providers?.[newProvider]?.model || '';
                        setSelectedModel(providerModels.includes(currentModel) ? currentModel : providerModels[0] || '');
                      }}
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="openai">OpenAI (GPT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(diagnostics.providers?.[selectedProvider]?.models || []).map((m: string) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>
                      Key:{' '}
                      <span className={`font-medium ${diagnostics.providers?.[selectedProvider]?.keyPresent ? 'text-emerald-700' : 'text-red-700'}`}>
                        {diagnostics.providers?.[selectedProvider]?.keyPresent ? 'Present' : 'Missing'}
                      </span>
                    </span>
                    <span>
                      Status:{' '}
                      <span className={`font-medium ${diagnostics.providers?.[selectedProvider]?.keyPresent ? 'text-emerald-700' : 'text-red-700'}`}>
                        {diagnostics.providers?.[selectedProvider]?.keyPresent ? 'Ready' : 'Not Ready'}
                      </span>
                    </span>
                  </div>
                  {(selectedProvider !== diagnostics.provider || selectedModel !== diagnostics.effective?.model) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingDiagnostics}
                      onClick={async () => {
                        setSavingDiagnostics(true);
                        try {
                          const updated = await onUpdateDiagnostics(selectedProvider, selectedModel);
                          if (updated) setDiagnostics(updated);
                        } finally {
                          setSavingDiagnostics(false);
                        }
                      }}
                    >
                      {savingDiagnostics ? 'Saving...' : 'Apply'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-red-700">Unable to load diagnostics status.</p>
            )}
          </div>

          {loadingSources ? (
            <div className="py-6 text-sm text-gray-600">Loading saved jobs and uploaded templates...</div>
          ) : (
            <>
              <div>
                <Label htmlFor="jobId">Saved Job Description</Label>
                <select
                  id="jobId"
                  name="jobId"
                  value={formData.jobId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a saved job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} at {job.company}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Job description is sourced from jobs you already added.
                </p>
              </div>

              <div>
                <Label htmlFor="primaryResumeId">Primary Resume</Label>
                <select
                  id="primaryResumeId"
                  name="primaryResumeId"
                  value={formData.primaryResumeId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select your primary resume</option>
                  {primaryResumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.fileName || 'Primary Resume'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Your base resume content used for AI analysis and tailoring.
                </p>
              </div>

              <div>
                <Label htmlFor="templateResumeId">Resume Template</Label>
                <select
                  id="templateResumeId"
                  name="templateResumeId"
                  value={formData.templateResumeId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a template for export formatting</option>
                  {templates.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.fileName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The uploaded template controls export formatting and structure.
                </p>
              </div>

              {!primaryResumes.length && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No primary resume found. Set one in Settings under Primary Resume.
                </div>
              )}
              {!templates.length && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No template resumes found. Upload one in Settings under Template Resume.
                </div>
              )}
            </>
          )}

          <Button
            onClick={handleTailor}
            disabled={loading || loadingSources || loadingCached || !formData.jobId || !formData.primaryResumeId || !formData.templateResumeId || isCachedCurrent}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : loadingCached ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading cached resume...
              </>
            ) : isCachedCurrent ? (
              '✓ Tailored Resume is Current'
            ) : cachedFingerprint ? (
              'Regenerate Tailored Resume'
            ) : (
              'Generate Tailored Resume'
            )}
          </Button>

          {(result || preview) && resolvedJobId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Button
                onClick={handlePreview}
                disabled={loadingPreview || exportingWord || exportingPdf}
                variant="outline"
              >
                {loadingPreview ? 'Loading Preview...' : 'Preview Export'}
              </Button>
              <Button
                onClick={handleExportWord}
                disabled={loadingPreview || exportingWord || exportingPdf}
              >
                {exportingWord ? 'Exporting Word...' : 'Export to Word'}
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={loadingPreview || exportingWord || exportingPdf}
                variant="outline"
              >
                {exportingPdf ? 'Exporting PDF...' : 'Export to PDF'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {(result.jobTitle || result.company) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Selected Job</CardTitle>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    result.provider === 'anthropic'
                      ? 'bg-orange-100 text-orange-800'
                      : result.provider === 'openai'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {result.provider === 'anthropic' ? 'Claude' : result.provider === 'openai' ? 'OpenAI' : 'AI Provider Unknown'}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  {result.jobTitle} {result.company ? `at ${result.company}` : ''}
                </p>
              </CardContent>
            </Card>
          )}

          {result.missingKeywords && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Missing Keywords</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Select keywords that apply to your experience — selected keywords will be prioritized in the export.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(result.missingKeywords)
                    ? result.missingKeywords
                    : String(result.missingKeywords).split(/\n|,|;/).map((item) => item.trim()).filter(Boolean)
                  ).map((keyword: string, idx: number) => {
                    const isSelected = selectedKeywords.has(keyword);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedKeywords((prev) => {
                            const next = new Set(prev);
                            if (next.has(keyword)) next.delete(keyword);
                            else next.add(keyword);
                            return next;
                          });
                        }}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{keyword}
                      </button>
                    );
                  })}
                </div>
                {selectedKeywords.size > 0 && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between gap-3">
                    <div>
                      <strong>{selectedKeywords.size}</strong> keyword{selectedKeywords.size !== 1 ? 's' : ''} selected
                      <button
                        type="button"
                        onClick={() => setSelectedKeywords(new Set())}
                        className="ml-2 underline hover:no-underline"
                      >
                        Clear all
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleApplyKeywords}
                      disabled={applyingKeywords || loadingPreview}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    >
                      {applyingKeywords ? (
                        <><Loader className="w-3 h-3 animate-spin mr-1" /> Applying…</>
                      ) : (
                        'Apply Keywords'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(result.bulletRewrites || result.summaryRewrite || result.skillsOptimization) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Changes from Primary Resume</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Summary of what the AI changed or optimized compared to your primary resume.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* ── Summary Changes ── */}
                {result.summaryRewrite && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Summary</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(result.summaryRewrite)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    {preview?.parsedResume?.summary && (
                      <div className="mb-2 rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Original</p>
                        <p className="text-gray-400 leading-relaxed text-sm line-through">{preview.parsedResume.summary}</p>
                      </div>
                    )}
                    <div className="rounded border border-emerald-200 bg-emerald-50/30 p-2">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">Tailored</p>
                      <p className="text-gray-700 leading-relaxed text-sm">
                        {preview?.parsedResume?.summary
                          ? renderWordDiff(preview.parsedResume.summary, result.summaryRewrite)
                          : result.summaryRewrite}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Skills Changes ── */}
                {preview?.skills && preview?.parsedResume?.skills ? (() => {
                  const normalize = (s: string) => s.toLowerCase().trim();
                  const tailoredSkills: string[] = preview.skills || [];
                  const primarySkills: string[] = preview.parsedResume.skills || [];
                  const primarySet = new Set(primarySkills.map(normalize));
                  const tailoredSet = new Set(tailoredSkills.map(normalize));
                  const added = tailoredSkills.filter(s => !primarySet.has(normalize(s)));
                  const removed = primarySkills.filter(s => !tailoredSet.has(normalize(s)));
                  if (added.length === 0 && removed.length === 0) return null;
                  return (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Skills Changes</p>
                      {added.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Added to match JD:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {added.map((skill, idx) => (
                              <span key={`add-${idx}`} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-xs border border-emerald-200">
                                + {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {removed.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Removed from primary resume:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {removed.map((skill, idx) => (
                              <span key={`rm-${idx}`} className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs border border-red-200 line-through">
                                − {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : result.skillsOptimization && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        let items: string[];
                        if (Array.isArray(result.skillsOptimization)) {
                          items = result.skillsOptimization.map(toDisplayString);
                        } else if (typeof result.skillsOptimization === 'string') {
                          items = result.skillsOptimization.split(/\n|,|;/).map((s: string) => s.trim()).filter(Boolean);
                        } else if (typeof result.skillsOptimization === 'object' && result.skillsOptimization !== null) {
                          const vals = Object.values(result.skillsOptimization);
                          items = vals.flatMap((v: any) =>
                            Array.isArray(v) ? v.map(toDisplayString) : [toDisplayString(v)]
                          );
                        } else {
                          items = [toDisplayString(result.skillsOptimization)];
                        }
                        return items.filter(Boolean).map((skill: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-xs border border-blue-200">
                            {skill}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Bullet Rewrites ── */}
                {result.bulletRewrites && (() => {
                  const rewrittenBullets = (Array.isArray(result.bulletRewrites)
                    ? result.bulletRewrites
                    : Array.isArray(result.bulletRewrites?.roles)
                      ? result.bulletRewrites.roles.flatMap((role: any) => role.bullets || [])
                      : []
                  ).map(toDisplayString);

                  // Collect all original bullets from primary resume
                  const allOriginalBullets: string[] = preview?.parsedResume?.workEntries
                    ?.flatMap((e: any) => e.bullets || []) || [];

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Rewritten Bullets</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(rewrittenBullets.join('\n'))}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <ul className="space-y-3">
                        {rewrittenBullets.map((bullet: string, idx: number) => {
                          const closestOriginal = findClosestBullet(bullet, allOriginalBullets);
                          return (
                            <li key={idx} className="text-sm">
                              {closestOriginal && (
                                <div className="flex gap-2 mb-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                  <span className="text-slate-400 font-bold shrink-0">•</span>
                                  <span className="text-gray-400 line-through">{closestOriginal}</span>
                                </div>
                              )}
                              <div className="flex gap-2 rounded border border-emerald-200 bg-emerald-50/30 px-2 py-1">
                                <span className="text-emerald-600 font-bold shrink-0">•</span>
                                <span>{closestOriginal ? renderWordDiff(closestOriginal, bullet) : bullet}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {result.atsRecommendations && (() => {
            const allRecs = (Array.isArray(result.atsRecommendations)
              ? result.atsRecommendations
              : String(result.atsRecommendations).split(/\n|,|;/).map((item: string) => item.trim()).filter(Boolean)
            ).map(toDisplayString);

            // Build a lowercase version of the preview content for matching
            const appliedContent = preview
              ? [
                  preview.summary || '',
                  ...(preview.skills || []),
                  ...(preview.experience?.flatMap((e: any) => e.bullets || []) || []),
                  preview.headline || '',
                ].join(' ').toLowerCase()
              : '';

            const unappliedRecs = preview
              ? allRecs.filter((rec: string) => {
                  // Extract quoted terms like 'healthcare compliance' from recommendation text
                  const quotedTerms = rec.match(/['"]([^'"]+)['"]/g)?.map((m: string) => m.replace(/['"]/g, '').toLowerCase()) || [];
                  // If any quoted term already appears in the output, consider it applied
                  if (quotedTerms.length > 0 && quotedTerms.every((term: string) => appliedContent.includes(term))) {
                    return false;
                  }
                  return true;
                })
              : allRecs;

            return unappliedRecs.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Remaining ATS Recommendations</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Actions that have not yet been applied to the tailored output.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {unappliedRecs.map((tip: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Provide Feedback</p>
                    <p className="text-xs text-gray-500">
                      Tell the AI which recommendations are applicable, which to ignore, or provide additional context. The recommendations will be re-analyzed.
                    </p>
                    <textarea
                      value={atsFeedback}
                      onChange={(e) => setAtsFeedback(e.target.value)}
                      placeholder="e.g., 'I don't have healthcare compliance experience — remove that. Focus more on data analytics and stakeholder management.'"
                      className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAtsFeedback(unappliedRecs)}
                      disabled={submittingAtsFeedback || !atsFeedback.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {submittingAtsFeedback ? (
                        <><Loader className="w-3 h-3 animate-spin mr-1" /> Re-analyzing…</>
                      ) : (
                        'Re-analyze with Feedback'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {previewError && !preview && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-900">Export Preview Issue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-amber-800">
                <p className="text-sm font-medium">{previewError}</p>
                <div className="bg-white border border-amber-200 rounded p-3 text-xs space-y-1">
                  <p>
                    <strong>To improve scores:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Select applicable missing keywords above, then regenerate</li>
                    <li>Review the Analyze tab for detailed feedback on each section</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewError('')}
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {preview && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Export Preview</CardTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      preview.generationProvider === 'anthropic'
                        ? 'bg-orange-100 text-orange-800'
                        : preview.generationProvider === 'openai'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Provider: {preview.generationProvider === 'anthropic' ? 'Claude' : preview.generationProvider === 'openai' ? 'OpenAI' : 'Unknown'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreview(null);
                    setProviderStatus(null);
                    setPreviewError('');
                  }}
                >
                  Close Preview
                </Button>
              </CardHeader>
              <CardContent className="p-6 text-sm text-gray-800 font-['Georgia',_serif]">
                {preview.qualityGate && (
                  <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Job-Specific Quality Gate
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          preview.qualityGate.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {preview.qualityGate.passed ? 'Passed' : 'Needs Improvement'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="rounded bg-white border border-slate-200 px-3 py-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">ATS Score</p>
                        <p className="font-semibold text-slate-800">
                          {preview.qualityGate.atsScore}/100
                          <span className="font-normal text-slate-500"> (min {preview.qualityGate.minAtsScore})</span>
                        </p>
                      </div>
                      <div className="rounded bg-white border border-slate-200 px-3 py-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">AI Reviewer Score</p>
                        <p className="font-semibold text-slate-800">
                          {preview.qualityGate.aiReviewerScore}/100
                          <span className="font-normal text-slate-500"> (min {preview.qualityGate.minAiReviewerScore})</span>
                        </p>
                      </div>
                    </div>
                    {!preview.qualityGate.passed && preview.qualityGateMessage && (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <p className="font-semibold mb-1">Quality gate not met — this is a draft preview. Improve scores before final export:</p>
                        <p>{preview.qualityGateMessage}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Name & Contact ── */}
                <div className="text-center mb-4">
                  {preview.parsedResume?.name && (
                    <p className="text-2xl font-bold text-[#1e3a5f] tracking-wide">
                      {preview.parsedResume.name}
                    </p>
                  )}
                  {preview.parsedResume?.contactLine && (
                    <p className="text-xs text-gray-500 mt-1">{preview.parsedResume.contactLine}</p>
                  )}
                  {preview.parsedResume?.contactLine2 && (
                    <p className="text-xs text-gray-500 mt-0.5">{preview.parsedResume.contactLine2}</p>
                  )}
                  {preview.headline && (
                    <p className="text-sm italic text-[#334155] mt-1">{preview.headline}</p>
                  )}
                </div>

                {/* ── Professional Summary ── */}
                <ResumeSection title="Professional Summary">
                  <p className="leading-relaxed">{preview.summary || 'Not available'}</p>
                </ResumeSection>

                {/* ── Core Skills ── */}
                {preview.skills?.length > 0 && (
                  <ResumeSection title="Core Skills">
                    {chunkArray(preview.skills, 4).map((row: any[], i: number) => (
                      <p key={i} className="mb-1">{row.map(toDisplayString).join('  |  ')}</p>
                    ))}
                  </ResumeSection>
                )}

                {/* ── Professional Experience ── */}
                <ResumeSection title="Professional Experience">
                  {/* Use AI-structured experience when available, fall back to parsed resume */}
                  {preview.experience?.length > 0
                    ? preview.experience.map((entry: any, idx: number) => (
                        <div key={idx} className="mb-4">
                          <div className="flex flex-wrap items-baseline gap-1">
                            {entry.title && <span className="font-semibold">{entry.title}</span>}
                            {entry.company && <span className="text-gray-600"> – {entry.company}</span>}
                            {entry.location && <span className="text-gray-500 text-xs">, {entry.location}</span>}
                            {entry.dates && <span className="text-gray-400 italic text-xs ml-auto">{entry.dates}</span>}
                          </div>
                          {entry.scope && (
                            <p className="text-gray-600 text-sm italic mt-0.5 ml-1">{entry.scope}</p>
                          )}
                          {entry.bullets?.map((b: any, bi: number) => (
                            <div key={bi} className="flex gap-2 mt-1 ml-3">
                              <span className="text-gray-500 flex-shrink-0">•</span>
                              <span>{toDisplayString(b)}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    : preview.parsedResume?.workEntries?.length > 0
                      ? preview.parsedResume.workEntries.slice(0, 6).map((entry: any, idx: number) => (
                          <div key={idx} className="mb-4">
                            <div className="flex flex-wrap items-baseline gap-1">
                              {entry.title && <span className="font-semibold">{entry.title}</span>}
                              {entry.company && <span className="text-gray-600"> – {entry.company}</span>}
                              {entry.dates && <span className="text-gray-400 italic text-xs ml-auto">{entry.dates}</span>}
                            </div>
                            {entry.bullets?.slice(0, 5).map((b: any, bi: number) => (
                              <div key={bi} className="flex gap-2 mt-1 ml-3">
                                <span className="text-gray-500 flex-shrink-0">•</span>
                                <span>{toDisplayString(b)}</span>
                              </div>
                            ))}
                          </div>
                        ))
                      : preview.experienceBullets?.length > 0
                        ? preview.experienceBullets.map((b: any, bi: number) => (
                            <div key={bi} className="flex gap-2 mt-1 ml-3">
                              <span className="text-gray-500 flex-shrink-0">•</span>
                              <span>{toDisplayString(b)}</span>
                            </div>
                          ))
                        : <p className="text-gray-400 italic">No experience data available</p>}
                </ResumeSection>

                {/* ── Education ── */}
                {(preview.education?.length > 0 || preview.parsedResume?.educationLines?.length > 0) && (
                  <ResumeSection title="Education">
                    {preview.education?.length > 0
                      ? preview.education.map((ed: any, i: number) => (
                          <p key={i} className="mb-1">
                            {ed.degree}{ed.institution ? ` — ${ed.institution}` : ''}{ed.year ? ` (${ed.year})` : ''}
                          </p>
                        ))
                      : preview.parsedResume?.educationLines?.map((line: string, i: number) => (
                          <p key={i} className="mb-1">{line}</p>
                        ))}
                  </ResumeSection>
                )}

                {/* ── Certifications ── */}
                {preview.certifications?.length > 0 && (
                  <ResumeSection title="Certifications">
                    {preview.certifications.map((cert: string, i: number) => (
                      <p key={i} className="mb-1">{cert}</p>
                    ))}
                  </ResumeSection>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ResumeTailor;
