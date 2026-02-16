import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { Plus, Trash2, Calendar, BookOpen, Pencil, X, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function Curriculum() {
  const [tab, setTab] = useState('terms');
  const [terms, setTerms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTermForm, setShowTermForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [termForm, setTermForm] = useState({ name: '', start_date: '', end_date: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', color: '#2D4F3F', description: '' });
  const [generateForm, setGenerateForm] = useState({ child_id: '', subject_id: '', term_id: '', title_prefix: 'Lesson' });
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [breakForm, setBreakForm] = useState({ name: '', start_date: '', end_date: '' });
  const [showBreakForm, setShowBreakForm] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [t, s, c] = await Promise.all([
        API.get('/curriculum/terms'),
        API.get('/curriculum/subjects'),
        API.get('/children')
      ]);
      setTerms(t.data.terms);
      setSubjects(s.data.subjects);
      setChildren(c.data.children);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createTerm = async (e) => {
    e.preventDefault();
    try {
      await API.post('/curriculum/terms', termForm);
      toast.success('Term created');
      setTermForm({ name: '', start_date: '', end_date: '' });
      setShowTermForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const deleteTerm = async (id) => {
    if (!window.confirm('Delete this term and all its breaks?')) return;
    await API.delete(`/curriculum/terms/${id}`);
    toast.success('Term deleted');
    fetchData();
  };

  const createBreak = async (e, termId) => {
    e.preventDefault();
    try {
      await API.post(`/curriculum/terms/${termId}/breaks`, breakForm);
      toast.success('Break added');
      setBreakForm({ name: '', start_date: '', end_date: '' });
      setShowBreakForm(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const deleteBreak = async (breakId) => {
    await API.delete(`/curriculum/breaks/${breakId}`);
    toast.success('Break removed');
    fetchData();
  };

  const createSubject = async (e) => {
    e.preventDefault();
    try {
      await API.post('/curriculum/subjects', subjectForm);
      toast.success('Subject created');
      setSubjectForm({ name: '', color: '#2D4F3F', description: '' });
      setShowSubjectForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    await API.delete(`/curriculum/subjects/${id}`);
    toast.success('Subject deleted');
    fetchData();
  };

  const generateLessons = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/curriculum/lessons/generate', generateForm);
      setGenerateResult(res.data);
      toast.success(`Generated ${res.data.generated_count} lessons for ${res.data.child_name}`);
      setShowGenerateForm(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate');
    }
  };

  const SUBJECT_COLORS = ['#2D4F3F', '#C06C47', '#4F9DCE', '#88C477', '#E05A6D', '#F4C542', '#9B59B6', '#1ABC9C'];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="curriculum-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Curriculum</h1>
        <button
          data-testid="generate-lessons-btn"
          onClick={() => setShowGenerateForm(true)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Zap size={16} /> Generate Lessons
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#E8D5B5]/30 p-1 rounded-2xl mb-6 w-fit">
        {['terms', 'subjects'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`tab-${t}`}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-colors duration-200 ${tab === t ? 'bg-white text-[#2D4F3F] shadow-sm' : 'text-[#2A2A2A]/50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Terms Tab */}
      {tab === 'terms' && (
        <div>
          <button
            data-testid="add-term-btn"
            onClick={() => setShowTermForm(true)}
            className="card-boma flex items-center gap-3 mb-4 cursor-pointer border-dashed border-2 border-[#E8D5B5] hover:border-[#2D4F3F]/30 bg-transparent w-full"
          >
            <Plus size={18} className="text-[#2D4F3F]" />
            <span className="font-bold text-sm text-[#2A2A2A]/50">Add Term</span>
          </button>

          {showTermForm && (
            <form onSubmit={createTerm} className="card-boma mb-4 space-y-4" data-testid="term-form">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#2A2A2A]">New Term</h3>
                <button type="button" onClick={() => setShowTermForm(false)}><X size={18} /></button>
              </div>
              <input type="text" value={termForm.name} onChange={e => setTermForm({...termForm, name: e.target.value})} className="input-boma" placeholder="Term name" required />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Start Date</label>
                  <input type="date" value={termForm.start_date} onChange={e => setTermForm({...termForm, start_date: e.target.value})} className="input-boma" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">End Date</label>
                  <input type="date" value={termForm.end_date} onChange={e => setTermForm({...termForm, end_date: e.target.value})} className="input-boma" required />
                </div>
              </div>
              <button type="submit" className="btn-primary text-sm" data-testid="save-term-btn">Save Term</button>
            </form>
          )}

          {terms.length === 0 ? (
            <div className="card-boma text-center py-10">
              <Calendar size={40} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40">No terms yet. Add your first term to start planning.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {terms.map(term => (
                <div key={term.id} className="card-boma" data-testid={`term-card-${term.id}`}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedTerm(expandedTerm === term.id ? null : term.id)}>
                    <div>
                      <h3 className="font-bold text-[#2A2A2A]">{term.name}</h3>
                      <p className="text-xs text-[#2A2A2A]/40">{term.start_date} to {term.end_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {term.breaks?.length > 0 && <span className="text-xs bg-[#F4C542]/20 text-[#F4C542] px-2 py-0.5 rounded-full font-bold">{term.breaks.length} breaks</span>}
                      <button onClick={(e) => { e.stopPropagation(); deleteTerm(term.id); }} className="p-1.5 rounded-lg hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]">
                        <Trash2 size={14} />
                      </button>
                      {expandedTerm === term.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expandedTerm === term.id && (
                    <div className="mt-4 pt-4 border-t border-[#E8D5B5]/50">
                      <h4 className="text-sm font-bold text-[#2A2A2A]/60 mb-3">Term Breaks</h4>
                      {term.breaks?.map(b => (
                        <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-[#F4C542]/5 rounded-xl mb-2">
                          <div>
                            <span className="text-sm font-bold text-[#2A2A2A]">{b.name}</span>
                            <span className="text-xs text-[#2A2A2A]/40 ml-2">{b.start_date} to {b.end_date}</span>
                          </div>
                          <button onClick={() => deleteBreak(b.id)} className="text-[#E05A6D]/50 hover:text-[#E05A6D]"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      {showBreakForm === term.id ? (
                        <form onSubmit={(e) => createBreak(e, term.id)} className="space-y-3 mt-3">
                          <input type="text" value={breakForm.name} onChange={e => setBreakForm({...breakForm, name: e.target.value})} className="input-boma" placeholder="Break name" required />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={breakForm.start_date} onChange={e => setBreakForm({...breakForm, start_date: e.target.value})} className="input-boma" required min={term.start_date} max={term.end_date} />
                            <input type="date" value={breakForm.end_date} onChange={e => setBreakForm({...breakForm, end_date: e.target.value})} className="input-boma" required min={term.start_date} max={term.end_date} />
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowBreakForm(null)} className="text-sm font-bold text-[#2A2A2A]/40">Cancel</button>
                            <button type="submit" className="btn-primary text-sm py-2" data-testid="save-break-btn">Add Break</button>
                          </div>
                        </form>
                      ) : (
                        <button onClick={() => setShowBreakForm(term.id)} className="text-sm font-bold text-[#2D4F3F] mt-2 flex items-center gap-1" data-testid="add-break-btn">
                          <Plus size={14} /> Add Break
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subjects Tab */}
      {tab === 'subjects' && (
        <div>
          <button
            data-testid="add-subject-btn"
            onClick={() => setShowSubjectForm(true)}
            className="card-boma flex items-center gap-3 mb-4 cursor-pointer border-dashed border-2 border-[#E8D5B5] hover:border-[#2D4F3F]/30 bg-transparent w-full"
          >
            <Plus size={18} className="text-[#2D4F3F]" />
            <span className="font-bold text-sm text-[#2A2A2A]/50">Add Subject</span>
          </button>

          {showSubjectForm && (
            <form onSubmit={createSubject} className="card-boma mb-4 space-y-4" data-testid="subject-form">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#2A2A2A]">New Subject</h3>
                <button type="button" onClick={() => setShowSubjectForm(false)}><X size={18} /></button>
              </div>
              <input type="text" value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} className="input-boma" placeholder="Subject name" required />
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setSubjectForm({...subjectForm, color: c})} className={`w-8 h-8 rounded-full border-2 ${subjectForm.color === c ? 'border-[#2A2A2A] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary text-sm" data-testid="save-subject-btn">Save Subject</button>
            </form>
          )}

          {subjects.length === 0 ? (
            <div className="card-boma text-center py-10">
              <BookOpen size={40} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40">No subjects yet. Add subjects to organize your curriculum.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(subj => (
                <div key={subj.id} className="card-boma flex items-center gap-4" data-testid={`subject-card-${subj.id}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: subj.color }}>
                    {subj.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#2A2A2A]">{subj.name}</p>
                    {subj.description && <p className="text-xs text-[#2A2A2A]/40">{subj.description}</p>}
                  </div>
                  <button onClick={() => deleteSubject(subj.id)} className="p-1.5 rounded-lg hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Lessons Modal */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGenerateForm(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={generateLessons} className="card-boma w-full max-w-md space-y-4" data-testid="generate-lessons-form">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Generate Lessons</h3>
              <button type="button" onClick={() => setShowGenerateForm(false)}><X size={18} /></button>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Child</label>
              <select value={generateForm.child_id} onChange={e => setGenerateForm({...generateForm, child_id: e.target.value})} className="input-boma" required>
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Subject</label>
              <select value={generateForm.subject_id} onChange={e => setGenerateForm({...generateForm, subject_id: e.target.value})} className="input-boma" required>
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Term</label>
              <select value={generateForm.term_id} onChange={e => setGenerateForm({...generateForm, term_id: e.target.value})} className="input-boma" required>
                <option value="">Select term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name} ({t.start_date} to {t.end_date})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Lesson Title Prefix</label>
              <input type="text" value={generateForm.title_prefix} onChange={e => setGenerateForm({...generateForm, title_prefix: e.target.value})} className="input-boma" placeholder="Lesson" />
            </div>
            <button type="submit" className="btn-secondary w-full flex items-center justify-center gap-2" data-testid="generate-submit-btn">
              <Zap size={16} /> Generate
            </button>
          </form>
        </div>
      )}

      {/* Generate Result */}
      {generateResult && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setGenerateResult(null)}>
          <div onClick={e => e.stopPropagation()} className="card-boma w-full max-w-lg max-h-[80vh] overflow-y-auto" data-testid="generate-result">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Lessons Generated</h3>
              <button onClick={() => setGenerateResult(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-[#88C477]/10 p-4 rounded-2xl">
                <p className="font-bold text-[#2D4F3F]">{generateResult.generated_count} lessons created</p>
                <p className="text-sm text-[#2A2A2A]/50">For {generateResult.child_name} - {generateResult.subject_name}</p>
                <p className="text-xs text-[#2A2A2A]/40 mt-1">{generateResult.date_range}</p>
              </div>
              {generateResult.skipped?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#F4C542] mb-2">Skipped ({generateResult.skipped_count})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {generateResult.skipped.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#2A2A2A]/40 py-1">
                        <span>{s.date}</span>
                        <span className="text-[#F4C542] font-medium">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setGenerateResult(null)} className="btn-primary w-full mt-4 text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
