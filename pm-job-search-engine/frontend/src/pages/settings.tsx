import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import { Upload, File, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface UserSettings {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  bio?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  preferredLLM?: string;
  aiPreferences?: {
    qualityGate?: {
      minAtsScore?: number;
      minAiReviewerScore?: number;
      maxIterations?: number;
      truthfulnessGuardrail?: boolean;
    };
  };
}

interface Resume {
  id: string;
  fileName: string;
  version: number;
  isPrimary: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPopulateMessage, setAutoPopulateMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [formData, setFormData] = useState<Partial<UserSettings>>({});
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
  const [qualityGate, setQualityGate] = useState({
    minAtsScore: 80,
    minAiReviewerScore: 90,
    maxIterations: 3,
    truthfulnessGuardrail: true,
  });
  const [linkedInProfile, setLinkedInProfile] = useState<{
    hasProfileData: boolean;
    scrapedAt: string | null;
    profileSummary: {
      fullName: string | null;
      headline: string | null;
      location: string | null;
      skillsCount: number;
      experienceCount: number;
      educationCount: number;
    } | null;
  } | null>(null);
  const [rescrapingLinkedIn, setRescrapingLinkedIn] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchResumes();
    fetchLinkedInProfile();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSettings(response.data);
      setFormData(response.data);
      setQualityGate({
        minAtsScore: Number(response.data?.aiPreferences?.qualityGate?.minAtsScore ?? 80),
        minAiReviewerScore: Number(response.data?.aiPreferences?.qualityGate?.minAiReviewerScore ?? 90),
        maxIterations: Number(response.data?.aiPreferences?.qualityGate?.maxIterations ?? 3),
        truthfulnessGuardrail:
          response.data?.aiPreferences?.qualityGate?.truthfulnessGuardrail !== undefined
            ? Boolean(response.data.aiPreferences.qualityGate.truthfulnessGuardrail)
            : true,
      });
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResumes = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setResumes(response.data);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    }
  };

  const fetchLinkedInProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings/linkedin-profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLinkedInProfile(response.data);
    } catch (err) {
      console.error('Failed to fetch LinkedIn profile status:', err);
    }
  };

  const handleRescrapeLinkedIn = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      setRescrapingLinkedIn(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings/linkedin-rescrape`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        await fetchLinkedInProfile();
        setAutoPopulateMessage('LinkedIn profile re-scraped. All job alignment ratings are being refreshed.');
        setTimeout(() => setAutoPopulateMessage(null), 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to re-scrape LinkedIn profile');
    } finally {
      setRescrapingLinkedIn(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const normalizeLinkedInUrl = (url: string): string => {
    if (!url) return '';
    
    // If it already has a protocol, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it starts with "linkedin.com", prepend https://
    if (url.startsWith('linkedin.com')) {
      return `https://${url}`;
    }
    
    // If it's just "in/username", prepend the full LinkedIn domain
    if (url.startsWith('in/')) {
      return `https://linkedin.com/${url}`;
    }
    
    // Default: assume it's a LinkedIn URL and prepend https://
    return `https://${url}`;
  };

  const autoPopulateProfile = async (linkedinUrlInput?: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const linkedInValue = linkedinUrlInput || formData.linkedinUrl;
    if (!linkedInValue) return;

    try {
      setAutoPopulating(true);
      setAutoPopulateMessage(null);

      const normalizedLinkedIn = normalizeLinkedInUrl(linkedInValue);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings/auto-populate-profile`,
        { linkedinUrl: normalizedLinkedIn },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data?.user) {
        setSettings(response.data.user);
        setFormData(response.data.user);
        setAutoPopulateMessage('Headline and bio were auto-filled from your primary resume and LinkedIn profile.');
      }
    } catch (err: any) {
      const status = err?.response?.status;

      // Expected while one required source is missing. Keep save/upload successful and non-blocking.
      if (status !== 400) {
        setAutoPopulateMessage('We saved your changes, but auto-fill could not run right now.');
      }
    } finally {
      setAutoPopulating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png'].includes(file.type)) {
        setError('File must be PDF, Word, or PNG');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];

          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/upload`,
            {
              fileName: selectedFile.name,
              fileData: base64,
              fileSize: selectedFile.size,
              mimeType: selectedFile.type,
              title: selectedFile.name,
              isPrimary: true,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          setSuccess(true);
          setSelectedFile(null);
          setError(null);
          await fetchResumes();
          if (formData.linkedinUrl) {
            await autoPopulateProfile(formData.linkedinUrl);
          }
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to upload resume');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setUploading(false);
    }
  };

  const handleTemplateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png'].includes(file.type)) {
        setError('File must be PDF, Word, or PNG');
        return;
      }
      setSelectedTemplateFile(file);
      setError(null);
    }
  };

  const handleUploadTemplateResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateFile) return;

    try {
      setTemplateUploading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];

          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/upload`,
            {
              fileName: selectedTemplateFile.name,
              fileData: base64,
              fileSize: selectedTemplateFile.size,
              mimeType: selectedTemplateFile.type,
              title: 'Template Resume',
              isPrimary: false,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          setSuccess(true);
          setSelectedTemplateFile(null);
          setError(null);
          await fetchResumes();
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to upload template resume');
        } finally {
          setTemplateUploading(false);
        }
      };
      reader.readAsDataURL(selectedTemplateFile);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setTemplateUploading(false);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!confirm('Delete this resume?')) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${resumeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchResumes();
    } catch (err) {
      console.error('Failed to delete resume:', err);
      setError('Failed to delete resume');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Normalize LinkedIn URL if provided
      const dataToSubmit = {
        ...formData,
        linkedinUrl: formData.linkedinUrl 
          ? normalizeLinkedInUrl(formData.linkedinUrl) 
          : undefined,
        aiPreferences: {
          ...(formData.aiPreferences || {}),
          qualityGate: {
            minAtsScore: Math.max(50, Math.min(100, Number(qualityGate.minAtsScore) || 80)),
            minAiReviewerScore: Math.max(50, Math.min(100, Number(qualityGate.minAiReviewerScore) || 90)),
            maxIterations: Math.max(1, Math.min(6, Number(qualityGate.maxIterations) || 3)),
            truthfulnessGuardrail: Boolean(qualityGate.truthfulnessGuardrail),
          },
        },
      };

      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings`,
        dataToSubmit,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSettings(response.data);
      setFormData(response.data);
      setSuccess(true);

      if (dataToSubmit.linkedinUrl) {
        await autoPopulateProfile(dataToSubmit.linkedinUrl);
        // Refresh LinkedIn profile status after a delay (scrape runs in background)
        setTimeout(() => fetchLinkedInProfile(), 5000);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Profile Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">Settings saved successfully!</p>
                </div>
              )}

              {autoPopulating && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm">Generating headline and bio from your resume and LinkedIn profile...</p>
                </div>
              )}

              {autoPopulateMessage && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-md">
                  <p className="text-indigo-800 text-sm">{autoPopulateMessage}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName || ''}
                      onChange={handleChange}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName || ''}
                      onChange={handleChange}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email (read-only)</Label>
                  <Input
                    id="email"
                    value={formData.email || ''}
                    disabled
                    className="opacity-50"
                  />
                </div>

                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    name="headline"
                    value={formData.headline || ''}
                    onChange={handleChange}
                    placeholder="Product Manager at Tech Company"
                  />
                </div>

                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio || ''}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input
                    id="linkedinUrl"
                    name="linkedinUrl"
                    type="text"
                    value={formData.linkedinUrl || ''}
                    onChange={handleChange}
                    placeholder="linkedin.com/in/yourprofile"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Accepted formats: linkedin.com/in/handle, in/handle, or full URL
                  </p>

                  {/* LinkedIn Profile Scrape Status */}
                  {linkedInProfile && formData.linkedinUrl && (
                    <div className={`mt-2 p-3 rounded-md border text-sm ${
                      linkedInProfile.hasProfileData
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {linkedInProfile.hasProfileData ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                          )}
                          <span className={linkedInProfile.hasProfileData ? 'text-green-800' : 'text-amber-800'}>
                            {linkedInProfile.hasProfileData
                              ? 'LinkedIn profile synced'
                              : 'Profile not yet synced (will sync on save)'}
                          </span>
                        </div>
                        {linkedInProfile.hasProfileData && (
                          <button
                            type="button"
                            onClick={handleRescrapeLinkedIn}
                            disabled={rescrapingLinkedIn}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${rescrapingLinkedIn ? 'animate-spin' : ''}`} />
                            {rescrapingLinkedIn ? 'Syncing...' : 'Re-sync'}
                          </button>
                        )}
                      </div>
                      {linkedInProfile.hasProfileData && linkedInProfile.profileSummary && (
                        <div className="mt-2 text-xs text-green-700 space-y-0.5">
                          {linkedInProfile.profileSummary.fullName && (
                            <p>{linkedInProfile.profileSummary.fullName}{linkedInProfile.profileSummary.headline ? ` - ${linkedInProfile.profileSummary.headline}` : ''}</p>
                          )}
                          <p>
                            {linkedInProfile.profileSummary.skillsCount} skills,{' '}
                            {linkedInProfile.profileSummary.experienceCount} positions,{' '}
                            {linkedInProfile.profileSummary.educationCount} education entries
                          </p>
                          {linkedInProfile.scrapedAt && (
                            <p className="text-green-600">
                              Last synced: {new Date(linkedInProfile.scrapedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="portfolioUrl">Portfolio URL</Label>
                  <Input
                    id="portfolioUrl"
                    name="portfolioUrl"
                    type="url"
                    value={formData.portfolioUrl || ''}
                    onChange={handleChange}
                    placeholder="https://yourportfolio.com"
                  />
                </div>

                <div>
                  <Label htmlFor="preferredLLM">Preferred AI Model</Label>
                  <select
                    id="preferredLLM"
                    name="preferredLLM"
                    value={formData.preferredLLM || 'gpt-5.4-mini'}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gpt-5.4-mini">GPT-5.4 Mini (Recommended)</option>
                    <option value="gpt-5.4">GPT-5.4 (Advanced)</option>
                  </select>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Quality Gate Configuration</h3>
                  <p className="text-xs text-gray-600">
                    Controls the ATS and AI reviewer thresholds used by iterative analysis refinement.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="minAtsScore">Min ATS Score</Label>
                      <Input
                        id="minAtsScore"
                        type="number"
                        min={50}
                        max={100}
                        value={qualityGate.minAtsScore}
                        onChange={(e) =>
                          setQualityGate((prev) => ({
                            ...prev,
                            minAtsScore: Number(e.target.value),
                          }))
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="minAiReviewerScore">Min AI Score</Label>
                      <Input
                        id="minAiReviewerScore"
                        type="number"
                        min={50}
                        max={100}
                        value={qualityGate.minAiReviewerScore}
                        onChange={(e) =>
                          setQualityGate((prev) => ({
                            ...prev,
                            minAiReviewerScore: Number(e.target.value),
                          }))
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="maxIterations">Max Iterations</Label>
                      <Input
                        id="maxIterations"
                        type="number"
                        min={1}
                        max={6}
                        value={qualityGate.maxIterations}
                        onChange={(e) =>
                          setQualityGate((prev) => ({
                            ...prev,
                            maxIterations: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={qualityGate.truthfulnessGuardrail}
                      onChange={(e) =>
                        setQualityGate((prev) => ({
                          ...prev,
                          truthfulnessGuardrail: e.target.checked,
                        }))
                      }
                    />
                    Enable truthfulness guardrail
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Resume Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadResume} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">Resume uploaded successfully!</p>
                </div>
              )}

              <div>
                <Label htmlFor="resume">Upload Resume (PDF, Word, or PNG)</Label>
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="resume"
                    name="resume"
                    type="file"
                    accept=".pdf,.doc,.docx,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="resume" className="cursor-pointer">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                      {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, or PNG files up to 10MB</p>
                  </label>
                </div>
              </div>

              {selectedFile && (
                <Button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </Button>
              )}
            </form>

            {/* Resumes List (Primary only) */}
            {resumes.filter((r) => r.isPrimary).length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Resumes</h3>
                <div className="space-y-3">
                  {resumes.filter((r) => r.isPrimary).map((resume) => (
                    <div
                      key={resume.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{resume.fileName}</p>
                          <p className="text-xs text-gray-500">
                            v{resume.version} {resume.isPrimary && '• Primary'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResume(resume.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Resume Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Template Resume</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Download merge-ready template */}
            <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-800 mb-1">Step 1 — Download the merge-ready template</p>
              <p className="text-xs text-blue-600 mb-3">
                Your uploaded resume needs <strong>{'{{placeholder}}'}</strong> fields so the AI export can inject tailored content.
                Download the template below, customize its look in Word, then upload it back here.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-blue-400 text-blue-700 hover:bg-blue-100"
                onClick={async () => {
                  try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                    const token = localStorage.getItem('authToken') || '';
                    const resp = await fetch(`${apiUrl}/api/resumes/merge-template`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!resp.ok) throw new Error('Download failed');
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'resume-merge-template.docx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch {
                    alert('Could not download template. Make sure you are logged in.');
                  }
                }}
              >
                Download Merge-Ready Template (.docx)
              </Button>
            </div>

            <form onSubmit={handleUploadTemplateResume} className="space-y-6">
              <div>
                <Label htmlFor="templateResume">Step 2 — Upload your customized template (Word only)</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Upload the <strong>.docx</strong> file that contains <strong>{'{{placeholder}}'}</strong> fields. The AI export will inject tailored content into those fields.
                </p>
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="templateResume"
                    name="templateResume"
                    type="file"
                    accept=".pdf,.doc,.docx,.png"
                    onChange={handleTemplateFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="templateResume" className="cursor-pointer">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                      {selectedTemplateFile ? selectedTemplateFile.name : 'Click to upload your template resume'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, or PNG files up to 10MB</p>
                  </label>
                </div>
              </div>

              {selectedTemplateFile && (
                <Button
                  type="submit"
                  disabled={templateUploading}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {templateUploading ? 'Uploading Template...' : 'Upload Template Resume'}
                </Button>
              )}
            </form>

            {/* Templates List */}
            {resumes.filter((r) => !r.isPrimary).length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Templates</h3>
                <div className="space-y-3">
                  {resumes.filter((r) => !r.isPrimary).map((resume) => (
                    <div
                      key={resume.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{resume.fileName}</p>
                          <p className="text-xs text-gray-500">v{resume.version}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResume(resume.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
