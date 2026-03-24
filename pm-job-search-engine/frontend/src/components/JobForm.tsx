import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface JobFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (jobData: any) => void;
  initialData?: any;
  isLoading?: boolean;
}

export const JobForm: React.FC<JobFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const emptyForm = {
    title: '',
    company: '',
    companyUrl: '',
    location: '',
    jobUrl: '',
    linkedinProfileUrl: '',
    jobDescription: '',
    salary: '',
    stage: 'SAVED',
    priority: 'MEDIUM',
  };

  const [formData, setFormData] = useState(initialData || emptyForm);
  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    if (!initialData) {
      setFormData(emptyForm);
      return;
    }

    setFormData({
      ...emptyForm,
      ...initialData,
      jobDescription: initialData.jobDescription ?? initialData.jobDescriptionText ?? '',
      location: initialData.location ?? '',
      salary: initialData.salary ?? '',
      jobUrl: initialData.jobUrl ?? '',
      companyUrl: initialData.companyUrl ?? initialData.customFields?.companyUrl ?? '',
      linkedinProfileUrl:
        initialData.linkedinProfileUrl ?? initialData.customFields?.linkedinProfileUrl ?? '',
      priority: initialData.priority ?? 'MEDIUM',
      stage: initialData.stage ?? 'SAVED',
    });
  }, [initialData, open]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if (!isEditMode) {
      setFormData(emptyForm);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Update Job' : 'Add New Job'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="jobUrl">Job URL</Label>
              <Input
                id="jobUrl"
                name="jobUrl"
                type="url"
                value={formData.jobUrl}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="companyUrl">Company URL</Label>
              <Input
                id="companyUrl"
                name="companyUrl"
                type="url"
                value={formData.companyUrl}
                onChange={handleChange}
                placeholder="https://company.com"
              />
            </div>

            <div>
              <Label htmlFor="linkedinProfileUrl">LinkedIn Profile URL</Label>
              <Input
                id="linkedinProfileUrl"
                name="linkedinProfileUrl"
                type="url"
                value={formData.linkedinProfileUrl}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>

            {isEditMode && (
              <>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    placeholder="e.g., $120k-150k"
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {!isEditMode && (
            <p className="text-sm text-gray-600">
              Location, salary, and priority will be inferred from the job description and can be edited later from the job list.
            </p>
          )}

          <div>
            <Label htmlFor="jobDescription">Job Description</Label>
            <Textarea
              id="jobDescription"
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              rows={5}
              placeholder="Paste the job description here"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JobForm;
