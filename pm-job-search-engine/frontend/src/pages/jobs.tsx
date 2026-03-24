import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { JobForm } from '@/components/JobForm';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

type JobStage =
  | 'SAVED'
  | 'APPLIED'
  | 'PHONE_SCREEN'
  | 'RECRUITER_SCREEN'
  | 'HIRING_MANAGER'
  | 'TAKE_HOME'
  | 'PANEL'
  | 'FINAL'
  | 'OFFER'
  | 'NEGOTIATION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'ARCHIVED';

type Job = {
  id: string;
  stage: JobStage;
  [key: string]: any;
};

type GroupedJobs = Record<JobStage, Job[]>;

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<GroupedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      console.log('Fetching jobs from:', `${apiUrl}/api/jobs`);
      
      const response = await fetch(`${apiUrl}/api/jobs`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Jobs response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to fetch jobs: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          const text = await response.text();
          console.error('Response text:', text);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Jobs data:', data);

      // Group by stage
      const grouped: GroupedJobs = {
        SAVED: [],
        APPLIED: [],
        PHONE_SCREEN: [],
        RECRUITER_SCREEN: [],
        HIRING_MANAGER: [],
        TAKE_HOME: [],
        PANEL: [],
        FINAL: [],
        OFFER: [],
        NEGOTIATION: [],
        ACCEPTED: [],
        REJECTED: [],
        WITHDRAWN: [],
        ARCHIVED: [],
      };

      data.forEach((job: Job) => {
        if (grouped[job.stage]) {
          grouped[job.stage].push(job);
        }
      });

      setJobs(grouped);
    } catch (error: any) {
      console.error('Jobs error:', error);
      toast.error(error.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (jobData: any) => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to create job');
      }
      await response.json();
      setFormOpen(false);
      setEditingJob(null);
      toast.success('Job saved to board.');
      await fetchJobs();
    } catch (error: any) {
      console.error('Create job error:', error);
      toast.error(error.message || 'Failed to add job');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateJob = async (jobData: any) => {
    if (!editingJob?.id) return;

    try {
      setIsSaving(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const {
        title,
        company,
        companyUrl,
        location,
        jobUrl,
        linkedinProfileUrl,
        jobDescription,
        salary,
        stage,
        priority,
      } = jobData;
      const payload = {
        title,
        company,
        companyUrl,
        location,
        jobUrl,
        linkedinProfileUrl,
        jobDescriptionText: jobDescription,
        salary,
        stage,
        priority,
      };

      const response = await fetch(`${apiUrl}/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to update job');
      }
      await fetchJobs();
      setFormOpen(false);
      setEditingJob(null);
      toast.success('Job saved successfully.');
    } catch (error: any) {
      console.error('Update job error:', error);
      toast.error(error.message || 'Failed to update job');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchJobs();
      toast.success('Job deleted');
    } catch (error: any) {
      console.error('Delete job error:', error);
      toast.error(error.message || 'Failed to delete job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block mb-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-600">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!jobs) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Jobs Yet</h2>
            <p className="text-gray-600 mb-4">Start tracking your job applications.</p>
            <Button onClick={fetchJobs} className="bg-blue-600 text-white hover:bg-blue-700">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Pipeline</h1>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Job
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <KanbanBoard
          jobs={jobs}
          onJobsUpdate={setJobs}
          onViewDetails={(jobId) => console.log('View:', jobId)}
          onEdit={(job) => {
            setEditingJob(job);
            setFormOpen(true);
          }}
          onDelete={handleDeleteJob}
          isLoading={loading}
        />

        <JobForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingJob(null);
          }}
          onSubmit={editingJob ? handleUpdateJob : handleCreateJob}
          initialData={editingJob || undefined}
          isLoading={isSaving}
        />
      </div>
    </div>
  );
}
