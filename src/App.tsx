import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  FileText, 
  BookOpen, 
  Download, 
  Copy, 
  Check, 
  Github, 
  AlertTriangle, 
  Search, 
  Eye, 
  Edit2, 
  Split, 
  RefreshCw, 
  Globe, 
  FileDown, 
  FileCode, 
  ChevronRight, 
  Settings, 
  AlertOctagon, 
  ArrowRight,
  Sparkles,
  Info,
  X,
  CopyCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Bold,
  Italic,
  Link,
  Code2,
  List,
  ListOrdered,
  PlusSquare,
  HelpCircle,
  Activity,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import { 
  Severity, 
  DraftReport, 
  GithubTemplate, 
  FALLBACK_TEMPLATES 
} from './types';
import { Analytics } from '@vercel/analytics/react';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

const DEFAULT_WELCOME_DRAFT: DraftReport = {
  id: 'welcome-draft',
  title: 'Welcome to BugReport',
  vulnType: 'IDOR',
  target: 'https://api.example.com',
  severity: 'High',
  markdown: `# IDOR on \`/api/v1/users/{id}/profile\` allows unauthorized access to user PII

## Description

The \`/api/v1/users/{id}/profile\` endpoint fails to verify that the authenticated user matches the requested \`{id}\` parameter. By changing the user ID to another user's ID, an attacker can read that user's full profile, including name, email, phone number, and home address.

## Proof of Concept

\`\`\`
GET /api/v1/users/1337/profile HTTP/2
Host: app.example.com
Authorization: Bearer eyJ...
Content-Type: application/json

---

HTTP/2 200 OK

{
  "id": 1337,
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "+1-555-5555",
  "address": "123 Secure Lane"
}
\`\`\`

## Steps to Reproduce

1. Log in as user A (attacker) at \`app.example.com/login\`.
2. Navigate to your own profile and intercept the request to \`/api/v1/users/{your_id}/profile\`.
3. Change the user ID in the path to another user's ID (e.g., \`1337\`).
4. Observe the full profile data of user 1337 in the response.

## Impact

Any authenticated user can read the full personal profile (name, email, phone, home address) of any other user on the platform by iterating over user IDs. Excellent candidate for immediate fix!

## Remediation

Implement a robust user authority check inside the backend controller, verifying that the session user matches the requested profile's user resource.
`,
  createdAt: new Date().toISOString(),
  lastSaved: new Date().toISOString()
};

export default function App() {
  // --- Persistent Storage State ---
  const [drafts, setDrafts] = useState<DraftReport[]>(() => {
    const saved = localStorage.getItem('bb_drafts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse drafts', e);
      }
    }
    return [DEFAULT_WELCOME_DRAFT];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    const savedActive = localStorage.getItem('bb_active_draft_id');
    return savedActive || 'welcome-draft';
  });

  // --- UI Layout state ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editorMode, setEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [searchDraftQuery, setSearchDraftQuery] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'info' | 'error'} | null>(null);
  
  // --- GitHub Templates State ---
  const [githubTemplates, setGithubTemplates] = useState<GithubTemplate[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');
  const [importOption, setImportOption] = useState<'create' | 'append' | 'overwrite'>('create');
  
  // --- Copied State for Indicators ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync drafts to local storage
  useEffect(() => {
    localStorage.setItem('bb_drafts', JSON.stringify(drafts));
  }, [drafts]);

  // Sync active draft ID to local storage
  useEffect(() => {
    localStorage.setItem('bb_active_draft_id', activeDraftId);
  }, [activeDraftId]);

  // Fetch GitHub templates automatically on load
  useEffect(() => {
    fetchGithubTemplates();
  }, []);

  const triggerNotification = (message: string, type: 'success' | 'info' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(v => v?.message === message ? null : v);
    }, 4000);
  };

  // Fetch templates listing from secops-templates/report-templates
  const fetchGithubTemplates = async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const res = await fetch('https://api.github.com/repos/dewcode91/report-templates/contents');
      if (!res.ok) {
        throw new Error(`GitHub API returned status ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        // Find markdown templates (excluding README or specific non-template files, or keep README as a reference)
        const templates = data.filter(file => file.name.endsWith('.md') && file.type === 'file') as GithubTemplate[];
        setGithubTemplates(templates);
        setSyncStatus('success');
      } else {
        throw new Error('Unexpected format returned from GitHub API');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus('failed');
      setSyncError(err.message || 'Verification of external server failed');
    }
  };

  // Find active draft
  const activeDraft = drafts.find(d => d.id === activeDraftId) || drafts[0] || DEFAULT_WELCOME_DRAFT;

  // Handle draft edits
  const updateDraft = (fields: Partial<DraftReport>) => {
    setDrafts(prev => prev.map(draft => {
      if (draft.id === activeDraft.id) {
        // Extract title from first line of markdown if title hasn't been set or matches title outline
        let computedTitle = draft.title;
        if (fields.markdown !== undefined) {
          const firstLine = fields.markdown.trim().split('\n')[0];
          if (firstLine && firstLine.startsWith('# ')) {
            computedTitle = firstLine.replace('# ', '').trim();
          }
        }
        
        return {
          ...draft,
          ...fields,
          title: fields.title !== undefined ? fields.title : computedTitle,
          lastSaved: new Date().toISOString()
        };
      }
      return draft;
    }));
  };

  // Create new blank draft
  const handleCreateDraft = (initialTitle = 'Untitled Report', initialMarkdown = '', severity: Severity = 'Medium', vulnType = 'OWASP A01') => {
    const newId = `draft-${Date.now()}`;
    const newDraft: DraftReport = {
      id: newId,
      title: initialTitle,
      markdown: initialMarkdown || `# ${initialTitle}\n\n## Description\n\n[Provide vulnerability description...]\n\n## Steps to Reproduce\n\n1. \n\n## Impact\n\n`,
      severity,
      vulnType,
      target: 'https://',
      createdAt: new Date().toISOString(),
      lastSaved: new Date().toISOString()
    };
    setDrafts(prev => [newDraft, ...prev]);
    setActiveDraftId(newId);
    triggerNotification(`Created draft: "${initialTitle}"`, 'success');
  };

  // Delete a draft report
  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (drafts.length <= 1) {
      triggerNotification("Cannot delete the last remaining draft report.", "error");
      return;
    }
    const filtered = drafts.filter(d => d.id !== id);
    setDrafts(filtered);
    if (activeDraftId === id) {
      setActiveDraftId(filtered[0].id);
    }
    triggerNotification("Draft moved to trash", "info");
  };

  // Duplicate a draft report
  const handleDuplicateDraft = (draft: DraftReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `draft-${Date.now()}`;
    const duplicated: DraftReport = {
      ...draft,
      id: newId,
      title: `${draft.title} (Copy)`,
      createdAt: new Date().toISOString(),
      lastSaved: new Date().toISOString()
    };
    setDrafts(prev => [duplicated, ...prev]);
    setActiveDraftId(newId);
    triggerNotification(`Duplicated "${draft.title}"`, 'success');
  };

  // Grab the content of a remote template and apply it to editor
  const handleImportTemplate = async (templateName: string, downloadUrl: string) => {
    try {
      let markdownContent = '';
      
      // Try local fallback seed first if matched to save network latency or blockages
      const preloaded = FALLBACK_TEMPLATES.find(f => f.name === templateName);
      if (preloaded) {
        markdownContent = preloaded.markdown;
      } else {
        // Fetch from raw GitHub usercontent
        triggerNotification(`Fetching raw template "${templateName}"...`, 'info');
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error("Could not fetch remote raw content");
        markdownContent = await res.text();
      }

      const cleanTitle = templateName.replace('.md', '').replaceAll('-', ' ');
      const capitalizeTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      if (importOption === 'create') {
        // Create new draft with it
        handleCreateDraft(capitalizeTitle, markdownContent, 'High', 'Vulnerability');
      } else if (importOption === 'overwrite') {
        // Overwrite the current active draft
        updateDraft({
          title: capitalizeTitle,
          markdown: markdownContent
        });
        triggerNotification(`Overwrite complete using "${templateName}"`, 'success');
      } else {
        // Append to the bottom of the current markdown
        updateDraft({
          markdown: `${activeDraft.markdown}\n\n---\n\n${markdownContent}`
        });
        triggerNotification(`Appended template to the current workspace`, 'success');
      }
      setIsTemplateModalOpen(false);
    } catch (err) {
      console.error(err);
      // Fallback: If we had a network error and couldn't fetch, load report from available fallbacks
      const randomFallback = FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
      triggerNotification("offline mode: loaded localized fallback template.", "info");
      
      if (importOption === 'create') {
        handleCreateDraft(randomFallback.title, randomFallback.markdown, randomFallback.severity, randomFallback.vulnType);
      } else if (importOption === 'overwrite') {
        updateDraft({
          title: randomFallback.title,
          markdown: randomFallback.markdown,
          severity: randomFallback.severity,
          vulnType: randomFallback.vulnType
        });
      } else {
        updateDraft({
          markdown: `${activeDraft.markdown}\n\n---\n\n${randomFallback.markdown}`
        });
      }
      setIsTemplateModalOpen(false);
    }
  };

  // Copy raw Markdown compilation to user's system clipboard
  const handleCopyClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    triggerNotification("Copied to clipboard successfully!", "success");
    setTimeout(() => {
      setCopiedKey(prev => prev === key ? null : prev);
    }, 2000);
  };

  // Download draft as `.md` report
  const handleDownloadFile = () => {
    const blob = new Blob([activeDraft.markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Sluggify title
    const filename = `${activeDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'bug-report'}.md`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification(`Downloaded "${filename}"`, 'success');
  };

  // Quick insertion editor helpers
  const insertMarkdownText = (before: string, after: string = '') => {
    const textarea = document.getElementById('md-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = before + (selected || 'text') + after;
    const newMarkdown = text.substring(0, start) + replacement + text.substring(end);
    
    updateDraft({ markdown: newMarkdown });
    
    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected || 'text').length);
    }, 50);
  };

  // Filter drafts based on search
  const filteredDrafts = drafts.filter(draft => {
    const text = (draft.title + draft.markdown + draft.vulnType + draft.severity).toLowerCase();
    return text.includes(searchDraftQuery.toLowerCase());
  });

  // Calculate stats
  const charCount = activeDraft.markdown.length;
  const wordCount = activeDraft.markdown.trim() ? activeDraft.markdown.trim().split(/\s+/).length : 0;
  const readTimeMins = Math.ceil(wordCount / 200);

  // Render markdown safely using marked
  const renderedHTML = (() => {
    try {
      return marked.parse(activeDraft.markdown) as string;
    } catch (e) {
      return `<p class="text-red-400">Error parsing Markdown: ${(e as Error).message}</p>`;
    }
  })();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-800">
      
      {/* --- Notification Banner --- */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              notification.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-lg' 
                : notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-lg'
                : 'bg-blue-50 border-blue-200 text-blue-800 shadow-lg'
            }`}
          >
            {notification.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Left Sidebar (Manage Drafts) --- */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 330, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col h-full bg-slate-50 border-r border-slate-200 shrink-0 select-none overflow-hidden"
          >
            {/* Sidebar Branding */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/20">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h1 className="font-bold text-sm text-slate-800 tracking-tight leading-none">BugReport</h1>
                  <span className="text-[10px] text-blue-600 font-mono font-bold tracking-wider">WORKSPACE</span>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-4 space-y-3 shrink-0">
              <button 
                onClick={() => handleCreateDraft()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                Create New Draft
              </button>

              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center gap-2 border border-slate-300 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
              >
                <BookOpen className="w-4 h-4 text-blue-600" />
                Import Templates Catalogue
              </button>
            </div>

            {/* Sync Repository Badge Banner */}
            <div className="px-4 pb-2 shrink-0">
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Github className="w-4 h-4 text-slate-600 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-mono text-[10px] text-slate-700 truncate">secops-templates/report-templates</p>
                    <p className="text-[9px] text-slate-500 flex items-center gap-1">
                      {syncStatus === 'success' && (
                        <>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-emerald-700 font-medium">Templates synced</span>
                        </>
                      )}
                      {syncStatus === 'syncing' && (
                        <>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          <span className="text-amber-700 font-medium">Syncing...</span>
                        </>
                      )}
                      {syncStatus === 'failed' && (
                        <>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="text-slate-500 font-medium">Loaded backup cache</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={fetchGithubTemplates} 
                  disabled={syncStatus === 'syncing'}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 hover:rotate-180 transition-all duration-300 disabled:opacity-50"
                  title="Force Re-Sync Repository"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search list */}
            <div className="px-4 py-2 shrink-0 relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={searchDraftQuery}
                  onChange={(e) => setSearchDraftQuery(e.target.value)}
                  placeholder="Search local reports..."
                  className="w-full pl-9 pr-4 py-2 bg-white text-slate-800 placeholder-slate-400 rounded-lg text-xs outline-none border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all shadow-inner"
                />
                {searchDraftQuery && (
                  <button 
                    onClick={() => setSearchDraftQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Draft list items */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1 custom-scrollbar">
              {filteredDrafts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <p className="font-semibold text-slate-500">No active reports</p>
                  <p className="mt-1">Try starting a draft or importing some template headers.</p>
                </div>
              ) : (
                filteredDrafts.map(draft => {
                  const isActive = draft.id === activeDraft.id;
                  let sevColor = "bg-slate-100 text-slate-600";
                  if (draft.severity === 'Critical') sevColor = "bg-rose-50 text-rose-700 border border-rose-200/50";
                  else if (draft.severity === 'High') sevColor = "bg-amber-50 text-amber-700 border border-amber-200/50";
                  else if (draft.severity === 'Medium') sevColor = "bg-yellow-50 text-yellow-700 border border-yellow-200/50";
                  else if (draft.severity === 'Low') sevColor = "bg-blue-50 text-blue-700 border border-blue-200/50";

                  return (
                    <div 
                      key={draft.id}
                      onClick={() => setActiveDraftId(draft.id)}
                      className={`group p-3 rounded-lg transition-all cursor-pointer flex flex-col gap-1 border ${
                        isActive 
                          ? 'bg-blue-50/60 border-blue-200 text-blue-950 shadow-sm font-medium border-l-4 border-l-blue-600' 
                          : 'bg-transparent border-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <h3 className={`text-xs leading-none truncate max-w-[150px] ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {draft.title || 'Untitled Report'}
                          </h3>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${sevColor}`}>
                          {draft.severity}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="font-mono text-slate-500">{draft.vulnType || 'OWASP'}</span>
                        <span className="italic text-[9px]">
                          {new Date(draft.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="flex items-center justify-end gap-1.5 mt-2 pt-1.5 border-t border-slate-200/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleDuplicateDraft(draft, e)}
                          className="px-2 py-0.5 text-[9px] font-bold text-slate-500 hover:text-blue-600 hover:bg-white rounded border border-slate-200 shadow-sm"
                          title="Duplicate draft"
                        >
                          Duplicate
                        </button>
                        <button 
                          onClick={(e) => handleDeleteDraft(draft.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-100 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-slate-700 font-medium truncate text-[11px]">System: Connected</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Operator: analyst@secops.local</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* --- Main Document Workspace --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#F8FAFC]">
        
        {/* Workspace Toolbar Control Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition shrink-0"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4.5 h-4.5" />
              </button>
            )}
            <div className="overflow-hidden">
              <input 
                type="text" 
                value={activeDraft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="Vulnerability Title"
                className="font-bold text-slate-900 text-sm md:text-base outline-none bg-transparent w-full border-b border-transparent focus:border-slate-300 pb-0.5 transition-colors"
              />
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                <span className="font-semibold text-blue-600">ACTIVE DRAFT:</span>
                <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-600 border border-slate-200">{activeDraft.id}</span>
                <span>•</span>
                <span>Saved {new Date(activeDraft.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Split controls (Mode select) */}
            <div className="bg-slate-100 p-1 border border-slate-200 rounded-lg flex items-center text-xs shrink-0">
              <button 
                onClick={() => setEditorMode('edit')}
                className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                  editorMode === 'edit' ? 'bg-white text-blue-600 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Code editor mode"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Editor</span>
              </button>
              <button 
                onClick={() => setEditorMode('split')}
                className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                  editorMode === 'split' ? 'bg-white text-blue-600 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Horizontal split view"
              >
                <Split className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Split view</span>
              </button>
              <button 
                onClick={() => setEditorMode('preview')}
                className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                  editorMode === 'preview' ? 'bg-white text-blue-600 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Interactive compiled preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Preview</span>
              </button>
            </div>

            {/* Submissions Export Actions */}
            <div className="relative group shrink-0">
              <button 
                onClick={handleDownloadFile}
                className="p-2 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-slate-500 transition border border-slate-200 bg-white shadow-sm"
                title="Download draft report (.md)"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => handleCopyClipboard(activeDraft.markdown, 'raw_md')}
              className="py-1.5 px-3 md:px-4 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Copy Raw Markdown"
            >
              {copiedKey === 'raw_md' ? <Check className="w-3.5 h-3.5 text-emerald-100" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">Copy Markdown</span>
            </button>
          </div>
        </header>

        {/* --- Metadata Configurations Card --- */}
        <section className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap gap-4 items-center shrink-0">
          
          {/* Target input */}
          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">Scope Target</label>
            <input 
              type="text" 
              value={activeDraft.target || ''}
              onChange={(e) => updateDraft({ target: e.target.value })}
              placeholder="e.g. https://domain.com/endpoint"
              className="flex-1 bg-white px-3 py-1.5 text-xs text-slate-800 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg outline-none font-mono shadow-sm transition-all"
            />
          </div>

          {/* Vulnerability category */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">Category</label>
            <input 
              type="text" 
              value={activeDraft.vulnType || ''}
              onChange={(e) => updateDraft({ vulnType: e.target.value })}
              placeholder="e.g. IDOR, XSS, CSRF"
              className="bg-white px-3 py-1.5 text-xs text-slate-800 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg outline-none font-semibold w-[140px] shadow-sm transition-all"
            />
          </div>

          {/* Severity selector dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono text-center">Severity</label>
            <div className="flex gap-1 bg-white p-1 border border-slate-200 rounded-lg shadow-sm">
              {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map(sev => {
                const isActive = activeDraft.severity === sev;
                let activeStyle = '';
                if (sev === 'Critical') activeStyle = 'bg-rose-500 text-white shadow-sm border-rose-500';
                else if (sev === 'High') activeStyle = 'bg-amber-500 text-white shadow-sm border-amber-500';
                else if (sev === 'Medium') activeStyle = 'bg-yellow-500 text-slate-950 shadow-sm border-yellow-500';
                else if (sev === 'Low') activeStyle = 'bg-slate-600 text-white shadow-sm border-slate-600';

                return (
                  <button
                    key={sev}
                    onClick={() => updateDraft({ severity: sev })}
                    className={`py-1 px-2.5 text-[10px] font-bold rounded-md leading-none transition-all cursor-pointer ${
                      isActive 
                        ? activeStyle 
                        : 'bg-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* --- Split Workspace Area --- */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* EDITOR COLUMN */}
          {(editorMode === 'split' || editorMode === 'edit') && (
            <div className="flex-1 flex flex-col h-full bg-white border-r border-slate-200 relative">
              
              {/* Editor rich formatting toolbar */}
              <div className="h-10 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => insertMarkdownText('**', '**')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition" 
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('*', '*')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('\n# ', '')}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded text-[11px] font-extrabold transition"
                    title="Heading 1"
                  >
                    H1
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('\n## ', '')}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded text-[11px] font-extrabold transition"
                    title="Heading 2"
                  >
                    H2
                  </button>
                  <span className="w-px h-4 bg-slate-200 mx-1"></span>
                  <button 
                    onClick={() => insertMarkdownText('[', '](https://url)')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                    title="Hyperlink"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('`', '`')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                    title="Inline Code"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('\n```\n', '\n```')}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded text-[10px] font-mono font-bold transition"
                    title="Code block"
                  >
                    [ Block ]
                  </button>
                  <span className="w-px h-4 bg-slate-200 mx-1"></span>
                  <button 
                    onClick={() => insertMarkdownText('\n- ', '')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                    title="Unordered list"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('\n1. ', '')}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                    title="Ordered list"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => insertMarkdownText('\n> ', '')}
                    className="px-2 py-0.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded text-sm font-extrabold leading-none transition"
                    title="Blockquote"
                  >
                    ”
                  </button>
                </div>
                
                {/* Stats panel summary */}
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span>{wordCount} words</span>
                  <span>{charCount} chars</span>
                  <span className="hidden sm:inline">{readTimeMins} min read</span>
                </div>
              </div>

              {/* Textarea drafting panel */}
              <div className="flex-1 flex overflow-hidden p-1 bg-white">
                
                {/* Simulated editor line numbers */}
                <div className="w-12 text-right select-none font-mono text-[11px] text-slate-300 pt-3 pr-3 border-r border-slate-100 bg-slate-50/50 leading-[20px] hidden sm:block">
                  {Array.from({ length: Math.max(activeDraft.markdown.split('\n').length, 30) }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Editor input */}
                <textarea
                  id="md-textarea"
                  value={activeDraft.markdown}
                  onChange={(e) => updateDraft({ markdown: e.target.value })}
                  placeholder="# IDOR Title..."
                  className="flex-1 h-full resize-none bg-transparent outline-none p-3 font-mono text-xs md:text-sm text-slate-800 leading-[20px] caret-blue-600 placeholder-slate-300"
                />
              </div>
            </div>
          )}

          {/* PREVIEW COLUMN */}
          {(editorMode === 'split' || editorMode === 'preview') && (
            <div className="flex-1 flex flex-col h-full bg-slate-100/60 overflow-hidden">
              <div className="h-10 bg-slate-50 border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase font-mono">Report Live Preview</span>
                </div>

              </div>

              {/* RENDER VIEW CARD CONTAINER */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                
                {/* Mock Submissions Platform Header Frame Layout */}
                <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 text-xs font-mono font-bold">
                        BG
                      </div>
                      <span className="font-mono text-[11px] text-slate-700 font-bold">Draft Vulnerability Report</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                      FORMAT: GITHUB MARKETED
                    </span>
                  </div>

                  {/* Submission Meta Tags Layout */}
                  <div className="p-4 md:p-6 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border-b border-slate-200 text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Target Scope Affected</p>
                      <p className="font-mono text-slate-700 mt-1 truncate bg-white py-1.5 px-3 rounded border border-slate-200 select-all shadow-sm">
                        {activeDraft.target || 'N/A (Provide target asset)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Report Category</p>
                      <p className="font-semibold text-blue-700 mt-1 bg-white py-1.5 px-3 rounded border border-slate-200 truncate shadow-sm">
                        {activeDraft.vulnType || 'N/A (Provide category tag)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Severity Breakdown</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block py-1.5 px-3 text-xs font-bold rounded border ${
                          activeDraft.severity === 'Critical' ? 'bg-rose-50 text-rose-700 border-rose-200/50' :
                          activeDraft.severity === 'High' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                          activeDraft.severity === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200/50' :
                          'bg-blue-50 text-blue-700 border-blue-400/20'
                        }`}>
                          {activeDraft.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* HTML Live Render Box */}
                  <div className="p-6 md:p-8 bg-white">
                    {activeDraft.markdown.trim() === '' ? (
                      <div className="py-20 text-center text-slate-400 font-mono text-xs">
                        <AlertTriangle className="w-8 h-8 text-yellow-500/60 mx-auto mb-2" />
                        <p>Draft contains no markdown.</p>
                      </div>
                    ) : (
                      <div 
                        className="markdown-preview select-text leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderedHTML }}
                      />
                    )}
                  </div>
                </div>

                {/* Internal security submission workflow recommendation banner */}
                <div className="max-w-3xl mx-auto p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex gap-3 mb-10 shadow-sm">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold mb-1">Submitting to External Teams?</h5>
                    <p className="text-slate-600 leading-normal">
                      Always double-check that your report contains no hardcoded session values, client identifiers, or production API tokens. Use dummy placeholder strings (e.g. <code className="text-blue-700 font-mono">app.example.com</code> or <code className="text-blue-700 font-mono">Authorization: Bearer eyJ...</code>) in descriptions and Proof of Concepts to protect real user credentials.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- TEMPLATES EXPLORER INTERACTIVE DRAWER/MODAL --- */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden relative z-10"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg">
                    <Github className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                       GitHub Templates Catalog
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      Querying repository raw assets from <span className="text-blue-600 font-bold">secops-templates/report-templates</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Import Options Radio controls */}
              <div className="p-4 bg-slate-100 border-b border-slate-200/80 flex flex-wrap gap-4 items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500">IMPORT BEHAVIOR:</span>
                  <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <button 
                      onClick={() => setImportOption('create')}
                      className={`px-2 py-1 rounded font-semibold text-[11px] cursor-pointer ${importOption === 'create' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      Create as New Draft
                    </button>
                    <button 
                      onClick={() => setImportOption('overwrite')}
                      className={`px-2 py-1 rounded font-semibold text-[11px] cursor-pointer ${importOption === 'overwrite' ? 'bg-amber-500 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      Overwrite Active Draft
                    </button>
                    <button 
                      onClick={() => setImportOption('append')}
                      className={`px-2 py-1 rounded font-semibold text-[11px] cursor-pointer ${importOption === 'append' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      Append to Active Draft
                    </button>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={searchTemplateQuery}
                    onChange={(e) => setSearchTemplateQuery(e.target.value)}
                    placeholder="Search vulnerabilities templates..."
                    className="w-full pl-9 pr-6 py-1.5 bg-white text-slate-800 placeholder-slate-400 rounded-lg font-mono text-xs border border-slate-200 outline-none focus:border-blue-500"
                  />
                  {searchTemplateQuery && (
                    <button onClick={() => setSearchTemplateQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Templates Catalog Grid and list inside */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[50vh] custom-scrollbar bg-slate-50/50">
                
                {/* Fallback alert inside catalogue to indicate connection mode */}
                {syncStatus === 'failed' && (
                  <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs flex gap-3 select-none">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Offline / Rate-limited fallback mode active</span>
                      <p className="text-slate-600 mt-1 select-none">
                        Our dynamic connector was unable to fetch directory listings from github.com due to standard access policy controls or sandbox rate-limits. To keep you crafting, we have preloaded our localized premium template catalog!
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Dynamic Catalog Files merged with cached fallback */}
                  {syncStatus === 'success' ? (
                    (() => {
                      const allRepoFiles = githubTemplates.filter(t => t.name.toLowerCase().includes(searchTemplateQuery.toLowerCase()));
                      if (allRepoFiles.length === 0) {
                        return <div className="col-span-2 text-center py-10 text-xs text-slate-400">No matching templates found in secops-templates repo.</div>;
                      }
                      return allRepoFiles.map(temp => {
                        const isPreloaded = FALLBACK_TEMPLATES.some(f => f.name === temp.name);
                        return (
                          <div 
                            key={temp.name}
                            onClick={() => handleImportTemplate(temp.name, temp.download_url)}
                            className="p-4 bg-white border border-slate-200 rounded-xl hover:bg-blue-50/30 hover:border-blue-300/60 hover:shadow-md transition cursor-pointer flex flex-col justify-between group h-36 shadow-sm"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-bold">
                                  GitHub Live Template
                                </span>
                                {isPreloaded && (
                                  <span className="text-[9px] text-emerald-600 font-mono font-bold uppercase bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                    Pre-fetched
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-xs text-slate-800 capitalize tracking-tight group-hover:text-blue-600 transition-colors mt-2">
                                {temp.name.replace('.md', '').replaceAll('-', ' ')}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-1 truncate">
                                Path: {temp.path} • {Math.round(Math.random() * 2 + 1)} min read template
                              </p>
                            </div>
                            <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                              <span className="font-mono font-medium text-slate-500">Ready to import</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1.5 transition-all" />
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    // Fallback Catalogue rendering
                    FALLBACK_TEMPLATES.filter(f => f.title.toLowerCase().includes(searchTemplateQuery.toLowerCase()) || f.vulnType.toLowerCase().includes(searchTemplateQuery.toLowerCase())).map(temp => (
                      <div 
                        key={temp.name}
                        onClick={() => handleImportTemplate(temp.name, '')}
                        className="p-4 bg-white border border-slate-200 rounded-xl hover:bg-blue-50/30 hover:border-blue-300/60 hover:shadow-md transition cursor-pointer flex flex-col justify-between group h-36 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200 font-bold">
                              Cached Template
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${
                              temp.severity === 'Critical' ? 'bg-rose-50 text-rose-700' :
                              temp.severity === 'High' ? 'bg-amber-50 text-amber-700' :
                              'bg-yellow-50 text-yellow-700'
                            }`}>
                              {temp.severity}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors mt-2">
                            {temp.title}
                          </h4>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                          <span className="font-semibold text-blue-600 font-mono tracking-wider">{temp.vulnType}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1.5 transition-all" />
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add direct URL custom load section */}
                  <div className="col-span-1 md:col-span-2 mt-4 p-4 rounded-xl border border-dashed border-slate-300 text-center bg-slate-50">
                    <h5 className="text-xs font-bold text-slate-700">Need to fetch a private template or custom repository?</h5>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Our in-app importer supports any repository standard markdown formatting. To connect another public templates bundle, just specify the username and repository on the Sync banner on your sidebar.
                    </p>
                  </div>

                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Total available templates: {syncStatus === 'success' ? githubTemplates.length : FALLBACK_TEMPLATES.length} loaded
                </span>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs cursor-pointer active:scale-[0.98] transition-all"
                >
                  Close Catalog
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Analytics />
    </div>
  );
}
