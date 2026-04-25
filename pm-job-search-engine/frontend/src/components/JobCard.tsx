import React from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash, Edit, Star, Zap } from 'lucide-react';

interface JobCardProps {
  job: any;
  onViewDetails: (jobId: string) => void;
  onEdit: (job: any) => void;
  onDelete: (jobId: string) => void;
  onJobMetaRefresh?: () => Promise<void> | void;
  isDragging?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onViewDetails,
  onEdit,
  onDelete,
  onJobMetaRefresh,
  isDragging = false,
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const interviewPrepStages = ['PHONE_SCREEN', 'RECRUITER_SCREEN', 'HIRING_MANAGER', 'PANEL', 'FINAL'];
  const availableInterviewPrepTypes = Array.isArray(job?.interviewPrepMeta?.availableTypes)
    ? job.interviewPrepMeta.availableTypes.map((value: unknown) => String(value || '').trim().toUpperCase())
    : [];
  const hasCurrentStageInterviewPrep = availableInterviewPrepTypes.includes(
    String(job?.stage || '').trim().toUpperCase(),
  );

  const handleInterviewPrep = async () => {
    if (!interviewPrepStages.includes(String(job.stage || ''))) {
      window.alert('Interview Prep is only available for active interview stages.');
      return;
    }

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      window.alert('Please sign in again.');
      return;
    }

    const escapeHtml = (value: string) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderList = (title: string, items: any[], showDetails: boolean = false) => {
      if (!Array.isArray(items) || !items.length) return '';

      const listItems = items
        .map((item: any) => {
          if (item && typeof item === 'object' && showDetails) {
            const question = escapeHtml(item.question || item.prompt || 'Question');
            const answer = escapeHtml(item.sampleAnswer || item.answerFramework || item.answer || '');
            const rationale = escapeHtml(item.rationale || '');
            const evidence = escapeHtml(item.evidence || '');
            const answerHtml = answer ? `<div style='margin-top:6px;color:#334155'><strong>Answer:</strong> ${answer}</div>` : '';
            const rationaleHtml = rationale ? `<div style='margin-top:6px;color:#475569'><strong>Rationale:</strong> ${rationale}</div>` : '';
            const evidenceHtml = evidence ? `<div style='margin-top:6px;color:#64748b'><strong>Evidence:</strong> ${evidence}</div>` : '';
            return `<li style='margin:12px 0;line-height:1.6;border-left:3px solid #3b82f6;padding-left:12px'><div style='font-weight:600;color:#0f172a'>${question}</div>${answerHtml}${rationaleHtml}${evidenceHtml}</li>`;
          }

          if (item && typeof item === 'object' && item.star && typeof item.star === 'object') {
            const question = escapeHtml(item.question || item.prompt || item.title || 'Question');
            const situation = escapeHtml(item.star.situation || '');
            const task = escapeHtml(item.star.task || '');
            const action = escapeHtml(item.star.action || '');
            const result = escapeHtml(item.star.result || '');
            const talkTrack = escapeHtml(item.talkTrack || item.answer || '');

            const starRows = [
              situation ? `<div style='margin-top:6px;color:#334155'><strong>Situation:</strong> ${situation}</div>` : '',
              task ? `<div style='margin-top:6px;color:#334155'><strong>Task:</strong> ${task}</div>` : '',
              action ? `<div style='margin-top:6px;color:#334155'><strong>Action:</strong> ${action}</div>` : '',
              result ? `<div style='margin-top:6px;color:#334155'><strong>Result:</strong> ${result}</div>` : '',
              talkTrack ? `<div style='margin-top:8px;color:#0f766e'><strong>Talk Track:</strong> ${talkTrack}</div>` : '',
            ].join('');

            return `<li style='margin:12px 0;line-height:1.6;border-left:3px solid #14b8a6;padding-left:12px'><div style='font-weight:600;color:#0f172a'>${question}</div>${starRows}</li>`;
          }

          if (item && typeof item === 'object') {
            const question = escapeHtml(item.question || item.prompt || item.title || 'Question');
            const answer = escapeHtml(item.sampleAnswer || item.answerFramework || item.answer || item.result || item.relevance || '');
            return `<li style='margin:8px 0;line-height:1.5'><div style='font-weight:600'>${question}</div>${answer ? `<div style='margin-top:4px;color:#334155'>${answer}</div>` : ''}</li>`;
          }
          return `<li style='margin:6px 0;line-height:1.5'>${escapeHtml(String(item || ''))}</li>`;
        })
        .join('');

      return `<div style='background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(15,23,42,.06)'><h2 style='font-size:16px;margin:0 0 8px;color:#0f172a'>${escapeHtml(title)}</h2><ul style='margin:0;padding-left:20px'>${listItems}</ul></div>`;
    };

    const openInterviewPrepOverlay = (prep: any): Promise<'close' | 'update'> =>
      new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.82);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:32px 16px';

        const overview = prep?.overview
          ? `<div style='background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:12px'><h2 style='font-size:16px;margin:0 0 8px;color:#1d4ed8'>Overview</h2><p style='margin:0;line-height:1.6;color:#1e3a8a'>${escapeHtml(String(prep.overview))}</p></div>`
          : '';
        const evidenceHighlights = renderList('Evidence Highlights', prep?.evidenceHighlights);
        const researchHighlights = renderList('Research Highlights', prep?.researchHighlights);

        const sectionsHtml = [
          renderList('Question and Answer Pairs', prep?.questionAnswerPairs, true),
          renderList('Behavioral Questions', prep?.behavioralQuestions),
          renderList('Product Questions', prep?.productQuestions),
          renderList('Company Questions', prep?.companyQuestions),
          renderList('Story Bank', prep?.storyBank),
        ].join('');

        const notes = prep?.mockTips ? `<div style='background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;margin-bottom:12px'><h2 style='font-size:16px;margin:0 0 8px;color:#9a3412'>Coaching Tips</h2><p style='margin:0;line-height:1.5;color:#7c2d12'>${escapeHtml(String(prep.mockTips))}</p></div>` : '';
        const interviewType = escapeHtml(String(prep?.interviewType || job.stage || 'INTERVIEW'));

        overlay.innerHTML = `<div style='background:#f8fafc;border-radius:12px;max-width:900px;width:100%;padding:24px 28px;font-family:ui-sans-serif,system-ui,-apple-system;color:#0f172a;position:relative'>
          <button id='interview-prep-close' style='position:absolute;top:16px;right:16px;background:#e2e8f0;border:0;border-radius:6px;cursor:pointer;padding:6px 10px;font-size:14px;color:#334155'>✕ Close</button>
          <h1 style='font-size:24px;margin:0 0 6px'>Interview Prep</h1>
          <div style='font-size:12px;color:#64748b;margin-bottom:10px'>${escapeHtml(job.company || 'Company')} · ${escapeHtml(job.title || 'Role')} · ${interviewType.replace(/_/g, ' ')}</div>
          <div style='display:flex;justify-content:flex-end;margin-bottom:16px'>
            <button type='button' id='interview-prep-update' style='padding:9px 12px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-size:13px;cursor:pointer'>Regenerate For This Stage</button>
          </div>
          ${overview}
          ${evidenceHighlights}
          ${researchHighlights}
          ${notes}
          ${sectionsHtml || `<div style='background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px'>No interview prep content was returned.</div>`}
        </div>`;

        document.body.appendChild(overlay);
        const close = () => {
          overlay.parentNode?.removeChild(overlay);
          resolve('close');
        };
        const update = () => {
          overlay.parentNode?.removeChild(overlay);
          resolve('update');
        };

        document.getElementById('interview-prep-close')?.addEventListener('click', close);
        document.getElementById('interview-prep-update')?.addEventListener('click', update);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) close();
        });
      });

    const getInterviewInput = () =>
      new Promise<{ contextPrompt: string; cancelled: boolean }>((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);z-index:100000;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `<div style='background:#ffffff;border-radius:12px;padding:20px;max-width:640px;width:calc(100% - 32px);box-shadow:0 20px 45px rgba(15,23,42,.25)'><div style='font-size:18px;font-weight:700;color:#0f172a;margin-bottom:8px'>Customize Interview Prep</div><p style='font-size:13px;color:#475569;margin:0 0 14px'>Add optional context for ${String(job.stage || '').replace(/_/g, ' ')} prep.</p><label style='display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:6px'>Context Prompt</label><textarea id='interview-prep-context' style='width:100%;min-height:92px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin-bottom:12px;resize:vertical;box-sizing:border-box' placeholder='Include interviewer background, concerns, or specific topics to emphasize'></textarea><div style='display:flex;justify-content:flex-end;gap:10px;margin-top:16px'><button type='button' id='interview-prep-cancel' style='padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer'>Cancel</button><button type='button' id='interview-prep-submit' style='padding:10px 14px;border-radius:8px;border:0;background:#2563eb;color:#fff;cursor:pointer'>Generate Interview Prep</button></div></div>`;
        document.body.appendChild(modal);

        const cleanup = () => {
          modal.parentNode?.removeChild(modal);
        };

        const submit = () => {
          const promptField = document.getElementById('interview-prep-context') as HTMLTextAreaElement;
          cleanup();
          resolve({ contextPrompt: promptField?.value || '', cancelled: false });
        };

        const cancel = () => {
          cleanup();
          resolve({ contextPrompt: '', cancelled: true });
        };

        document.getElementById('interview-prep-submit')?.addEventListener('click', submit);
        document.getElementById('interview-prep-cancel')?.addEventListener('click', cancel);
        modal.addEventListener('click', (event) => {
          if (event.target === modal) cancel();
        });

        const promptField = document.getElementById('interview-prep-context') as HTMLTextAreaElement;
        promptField?.focus();
      });

    let loading: HTMLElement | null = null;

    const showLoading = () => {
      loading = document.createElement('div');
      loading.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.68);z-index:99999;display:flex;align-items:center;justify-content:center';
      loading.innerHTML = `<div style='background:#0b1220;border:1px solid #334155;border-radius:12px;padding:18px 20px;min-width:360px;color:#e2e8f0'><div style='font-size:16px;font-weight:700;margin-bottom:8px'>Generating Interview Prep</div><div style='font-size:13px;color:#cbd5e1'>Building stage-specific questions and answer frameworks...</div></div>`;
      document.body.appendChild(loading);
    };

    const hideLoading = () => {
      if (loading && loading.parentNode) {
        loading.parentNode.removeChild(loading);
        loading = null;
      }
    };

    const fetchLatestPrep = async () => {
      const resp = await fetch(`${apiUrl}/api/ai/interview-prep/${job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload?.error || 'Unable to fetch existing interview prep');
      }
      return payload;
    };

    try {
      let latestPrepPayload: any = null;
      try {
        latestPrepPayload = await fetchLatestPrep();
      } catch {
        latestPrepPayload = null;
      }

      if (latestPrepPayload?.prep) {
        const action = await openInterviewPrepOverlay(latestPrepPayload.prep);
        if (action !== 'update') return;
      }

      const { contextPrompt, cancelled } = await getInterviewInput();
      if (cancelled) return;

      showLoading();
      const resp = await fetch(`${apiUrl}/api/ai/interview-prep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          interviewType: job.stage,
          contextPrompt,
          company: job.company,
          role: job.title,
        }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload?.error || 'Unable to generate interview prep');
      }

      hideLoading();
      await onJobMetaRefresh?.();
      await openInterviewPrepOverlay(payload?.prep || payload);
    } catch (error) {
      console.error('Interview prep error:', error);
      window.alert(`Interview Prep failed: ${(error as Error)?.message || String(error)}`);
    } finally {
      hideLoading();
    }
  };

  const handleResearchDeck = async () => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      window.alert('Please sign in again.');
      return;
    }

    const openDeckOverlay = (deck: any): Promise<'close' | 'update'> =>
      new Promise((resolve) => {
      const sections = Array.isArray(deck?.sections) ? deck.sections : [];
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.82);z-index:100001;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:32px 16px';
      const sectionsHtml = sections
        .map(
          (section: any) =>
            `<div style='background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(15,23,42,.06)'><h2 style='font-size:18px;margin:0 0 8px;color:#4c1d95'>${section.title || 'Section'}</h2><ul style='margin:0;padding-left:20px'>${(Array.isArray(section.bullets) ? section.bullets : []).map((b: string) => `<li style='margin:5px 0;line-height:1.5'>${b}</li>`).join('')}</ul></div>`
        )
        .join('');
      const versionLabel = deck?.metadata?.versionNumber ? `Version ${deck.metadata.versionNumber}` : '';
      overlay.innerHTML = `<div style='background:#f8fafc;border-radius:12px;max-width:860px;width:100%;padding:24px 28px;font-family:ui-sans-serif,system-ui,-apple-system;color:#0f172a;position:relative'>
        <button id='deck-overlay-close' style='position:absolute;top:16px;right:16px;background:#e2e8f0;border:0;border-radius:6px;cursor:pointer;padding:6px 10px;font-size:14px;color:#334155'>✕ Close</button>
        <h1 style='font-size:24px;margin:0 0 6px'>${deck?.title || 'Research Deck'}</h1>
        <div style='font-size:12px;color:#64748b;margin-bottom:10px'>Generated for ${job.company || 'Company'} · ${job.title || 'Role'} ${versionLabel ? `· ${versionLabel}` : ''}</div>
        <div style='display:flex;justify-content:flex-end;margin-bottom:16px'>
          <button type='button' id='deck-overlay-update' style='padding:9px 12px;border-radius:8px;border:0;background:#7c3aed;color:#fff;font-size:13px;cursor:pointer'>Update Deck With New Input</button>
        </div>
        ${sectionsHtml}
      </div>`;
      document.body.appendChild(overlay);
      const close = () => {
        overlay.parentNode?.removeChild(overlay);
        resolve('close');
      };
      const update = () => {
        overlay.parentNode?.removeChild(overlay);
        resolve('update');
      };
      document.getElementById('deck-overlay-close')?.addEventListener('click', close);
      document.getElementById('deck-overlay-update')?.addEventListener('click', update);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    });

    const getDeckInput = () =>
      new Promise<{
        userPrompt: string;
        extensionTechData: string;
        cancelled: boolean;
      }>((resolve) => {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15, 23, 42, 0.72)';
        modal.style.zIndex = '100000';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `<div style='background:#ffffff;border-radius:12px;padding:20px;max-width:640px;width:calc(100% - 32px);box-shadow:0 20px 45px rgba(15,23,42,.25)'><div style='font-size:18px;font-weight:700;color:#0f172a;margin-bottom:8px'>Customize Research Deck</div><p style='font-size:13px;color:#475569;margin:0 0 14px'>Add optional context before generation. If a deck already exists, this will update it.</p><label style='display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:6px'>Opportunity Context Prompt</label><textarea id='research-deck-user-prompt' style='width:100%;min-height:88px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin-bottom:12px;resize:vertical;box-sizing:border-box' placeholder='Add anything specific you want considered (team, product area, APIs, AI, etc.)'></textarea><label style='display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:6px'>Tech signals</label><textarea id='research-deck-tech-signals' style='width:100%;min-height:88px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;resize:vertical;box-sizing:border-box' placeholder='Paste Wappalyzer, Ful.io, or W3Techs notes'></textarea><div style='display:flex;justify-content:flex-end;gap:10px;margin-top:16px'><button type='button' id='research-deck-cancel' style='padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer'>Cancel</button><button type='button' id='research-deck-submit' style='padding:10px 14px;border-radius:8px;border:0;background:#7c3aed;color:#fff;cursor:pointer'>Generate Research Deck</button></div></div>`;
        document.body.appendChild(modal);

        const cleanup = () => {
          modal.parentNode?.removeChild(modal);
          document.removeEventListener('keydown', handleKeyDown);
        };

        const submit = () => {
          const promptField = document.getElementById('research-deck-user-prompt') as HTMLTextAreaElement;
          const techField = document.getElementById('research-deck-tech-signals') as HTMLTextAreaElement;
          cleanup();
          resolve({
            userPrompt: promptField?.value || '',
            extensionTechData: techField?.value || '',
            cancelled: false,
          });
        };

        const cancel = () => {
          cleanup();
          resolve({
            userPrompt: '',
            extensionTechData: '',
            cancelled: true,
          });
        };

        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') cancel();
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit();
        };

        const submitBtn = document.getElementById('research-deck-submit');
        const cancelBtn = document.getElementById('research-deck-cancel');
        submitBtn?.addEventListener('click', submit);
        cancelBtn?.addEventListener('click', cancel);
        modal.addEventListener('click', (event) => {
          if (event.target === modal) cancel();
        });
        document.addEventListener('keydown', handleKeyDown);

        const promptField = document.getElementById('research-deck-user-prompt') as HTMLTextAreaElement;
        promptField?.focus();
      });

    let loading: HTMLElement | null = null;
    let statusTimer: NodeJS.Timeout | null = null;

    const showLoading = () => {
      loading = document.createElement('div');
      loading.style.position = 'fixed';
      loading.style.inset = '0';
      loading.style.background = 'rgba(2, 6, 23, 0.68)';
      loading.style.zIndex = '99999';
      loading.style.display = 'flex';
      loading.style.alignItems = 'center';
      loading.style.justifyContent = 'center';
      loading.innerHTML = `<div style='background:#0b1220;border:1px solid #334155;border-radius:12px;padding:18px 20px;min-width:360px;color:#e2e8f0'><div style='font-size:16px;font-weight:700;margin-bottom:8px'>Generating Research Deck</div><div style='width:100%;height:6px;background:#1e293b;border-radius:9999px;overflow:hidden;margin:0 0 12px'><div style='height:100%;width:42%;background:linear-gradient(90deg,#7c3aed,#60a5fa);animation:research-progress 1.2s ease-in-out infinite alternate'></div></div><div id='research-deck-status-text' style='font-size:13px;color:#c4b5fd'>Analyzing company tech stack...</div></div>`;
      if (!document.getElementById('research-deck-keyframes')) {
        const keyframes = document.createElement('style');
        keyframes.id = 'research-deck-keyframes';
        keyframes.textContent = '@keyframes research-progress{from{transform:translateX(0)}to{transform:translateX(130%)}}';
        document.head.appendChild(keyframes);
      }
      document.body.appendChild(loading);

      const statusMessages = [
        'Analyzing company tech stack...',
        'Mapping architecture...',
        'Evaluating improvement opportunities...',
        'Generating CTO-ready presentation...',
      ];
      let statusIndex = 0;
      statusTimer = setInterval(() => {
        statusIndex = (statusIndex + 1) % statusMessages.length;
        const statusEl = document.getElementById('research-deck-status-text');
        if (statusEl) statusEl.textContent = statusMessages[statusIndex];
      }, 1800);
    };

    const hideLoading = () => {
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
      }
      if (loading && loading.parentNode) {
        loading.parentNode.removeChild(loading);
        loading = null;
      }
    };

    const fetchLatestDeck = async () => {
      const existingResp = await fetch(`${apiUrl}/api/ai/research-deck/${job.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const existingPayload = await existingResp.json();
      if (!existingResp.ok) {
        throw new Error(existingPayload?.error || 'Unable to fetch existing research deck');
      }
      return existingPayload;
    };

    try {
      let existingDeckPayload: any = null;
      try {
        existingDeckPayload = await fetchLatestDeck();
      } catch {
        existingDeckPayload = null;
      }

      if (existingDeckPayload?.deck) {
        const action = await openDeckOverlay(existingDeckPayload.deck);
        if (action !== 'update') return;
      }

      const { userPrompt, extensionTechData, cancelled } = await getDeckInput();
      if (cancelled) return;

      showLoading();
      const response = await fetch(`${apiUrl}/api/ai/generate-research-deck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          userPrompt,
          extensionTechData,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to generate research deck');
      }

      const deck = payload?.deck || payload;
      if (deck && typeof deck === 'object') {
        deck.metadata = {
          ...(deck.metadata || {}),
          versionNumber: payload?.latestVersion?.versionNumber || deck?.metadata?.versionNumber,
        };
      }

      hideLoading();
      await openDeckOverlay(deck);
    } catch (error) {
      console.error('Research deck error:', error);
      window.alert(`Research Deck failed: ${(error as Error)?.message || String(error)}`);
    } finally {
      hideLoading();
    }
  };

  const stageColors: Record<string, string> = {
    SAVED: 'bg-gray-100 text-gray-800',
    APPLIED: 'bg-blue-100 text-blue-800',
    PHONE_SCREEN: 'bg-teal-100 text-teal-800',
    RECRUITER_SCREEN: 'bg-cyan-100 text-cyan-800',
    HIRING_MANAGER: 'bg-purple-100 text-purple-800',
    TAKE_HOME: 'bg-amber-100 text-amber-800',
    PANEL: 'bg-indigo-100 text-indigo-800',
    FINAL: 'bg-yellow-100 text-yellow-800',
    OFFER: 'bg-green-100 text-green-800',
    NEGOTIATION: 'bg-lime-100 text-lime-800',
    ACCEPTED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    WITHDRAWN: 'bg-orange-100 text-orange-800',
    ARCHIVED: 'bg-slate-100 text-slate-800',
  };

  const priorityColors: Record<string, string> = {
    HIGH: 'text-red-600',
    MEDIUM: 'text-yellow-600',
    LOW: 'text-gray-600',
  };

  const renderStars = (rating: number | null | undefined) => {
    const r = rating || 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i <= r ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        {r > 0 && <span className="text-xs text-gray-500 ml-1">{r}/5</span>}
      </div>
    );
  };

  return (
    <Card
      className={`cursor-grab active:cursor-grabbing transition ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{job.title}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{job.company}</p>
            {job.hasResearchDeck && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 border border-purple-200">
                Research Ready
              </span>
            )}
          </div>
          <Badge className={stageColors[job.stage] || 'bg-gray-100'}>
            {job.stage.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {job.salary && (
          <p className="text-sm font-semibold text-green-700">{job.salary}</p>
        )}

        {job.location && (
          <p className="text-sm text-gray-600">📍 {job.location}</p>
        )}

        {job.recruiter && (
          <p className="text-sm text-gray-600">
            👤 <strong>Recruiter:</strong> {job.recruiter}
          </p>
        )}

        {job.followUpDate && (
          <p className="text-sm text-gray-600">
            📅 <strong>Follow-up:</strong> {format(new Date(job.followUpDate), 'MMM dd')}
          </p>
        )}

        {job.notes && (
          <p className="text-sm text-gray-600 line-clamp-2">
            <strong>Notes:</strong> {job.notes}
          </p>
        )}

        {/* Alignment Rating */}
        <div className="pt-1">
          {renderStars(job.alignmentRating)}
        </div>

        <div className="flex items-center gap-1.5 pt-2">
          {interviewPrepStages.includes(String(job.stage || '')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleInterviewPrep}
              className={`flex-1 text-xs ${
                hasCurrentStageInterviewPrep
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
              title={
                hasCurrentStageInterviewPrep
                  ? 'Open saved interview prep for this stage'
                  : 'Generate stage-specific interview prep'
              }
            >
              <Zap className="w-3 h-3 mr-1 shrink-0" />
              {hasCurrentStageInterviewPrep ? 'View Interview Prep' : 'Interview Prep'}
            </Button>
          )}
          {job.stage === 'HIRING_MANAGER' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResearchDeck}
              className="flex-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              title={job.hasResearchDeck ? 'View or update existing research deck' : 'Generate company research deck'}
            >
              {job.hasResearchDeck ? 'View Research Deck' : 'Research Deck'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(job)}
            className="shrink-0 h-7 w-7 p-0 text-gray-500 hover:text-gray-800"
            title="Edit job"
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(job.id)}
            className="shrink-0 h-7 w-7 p-0 text-gray-400 hover:text-red-600"
            title="Delete job"
          >
            <Trash className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCard;
