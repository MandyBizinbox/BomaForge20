import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { Plus, Trash2, CheckCircle2, Circle, ClipboardList, X, Zap, Users } from 'lucide-react';
import { toast } from 'sonner';

const FREQ_OPTIONS = [
  { value: 'weekdays', label: 'Every Weekday' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekends', label: 'Weekends Only' },
  { value: 'mwf', label: 'Mon / Wed / Fri' },
  { value: 'tth', label: 'Tue / Thu' },
  { value: 'once', label: 'Once-off' },
];

const CATEGORIES = ['general', 'kitchen', 'bedroom', 'bathroom', 'garden', 'pets', 'laundry', 'homework'];

export default function Chores() {
  const [tab, setTab] = useState('today');
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', category: 'general', points: 0, frequency: 'weekdays' });
  const [assignForm, setAssignForm] = useState({ template_id: '', child_ids: [], start_date: '', end_date: '' });

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    try {
      const [t, i, c] = await Promise.all([
        API.get('/chores/templates'),
        API.get('/chores/instances', { params: { date: tab === 'today' ? today : undefined } }),
        API.get('/children')
      ]);
      setTemplates(t.data.templates);
      setInstances(i.data.instances);
      setChildren(c.data.children);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/chores/templates', { ...templateForm, points: parseInt(templateForm.points) || 0 });
      toast.success('Chore template created');
      setTemplateForm({ name: '', description: '', category: 'general', points: 0, frequency: 'weekdays' });
      setShowTemplateForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this chore template?')) return;
    await API.delete(`/chores/templates/${id}`);
    toast.success('Template deleted');
    fetchData();
  };

  const assignChore = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/chores/assign', assignForm);
      toast.success(res.data.message);
      setAssignForm({ template_id: '', child_ids: [], start_date: '', end_date: '' });
      setShowAssignForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const toggleInstance = async (instance) => {
    const newStatus = instance.status === 'done' ? 'pending' : 'done';
    await API.put(`/chores/instances/${instance.id}`, { status: newStatus });
    fetchData();
  };

  const toggleChildId = (childId) => {
    setAssignForm(prev => ({
      ...prev,
      child_ids: prev.child_ids.includes(childId)
        ? prev.child_ids.filter(id => id !== childId)
        : [...prev.child_ids, childId]
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="chores-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Chores</h1>
        <div className="flex gap-2">
          <button data-testid="add-chore-template-btn" onClick={() => setShowTemplateForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> New Chore
          </button>
          <button data-testid="assign-chore-btn" onClick={() => setShowAssignForm(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Zap size={16} /> Assign
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#E8D5B5]/30 p-1 rounded-2xl mb-6 w-fit">
        {['today', 'templates', 'all'].map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`chore-tab-${t}`}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-colors duration-200 ${tab === t ? 'bg-white text-[#2D4F3F] shadow-sm' : 'text-[#2A2A2A]/50'}`}>
            {t === 'today' ? "Today's" : t}
          </button>
        ))}
      </div>

      {/* Today instances */}
      {tab === 'today' && (
        <div>
          {instances.length === 0 ? (
            <div className="card-boma text-center py-10">
              <ClipboardList size={40} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40">No chores for today. Create and assign chores to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst, i) => {
                const child = children.find(c => c.id === inst.child_id);
                return (
                  <div key={inst.id} data-testid={`chore-instance-${inst.id}`} className="card-boma flex items-center gap-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <button onClick={() => toggleInstance(inst)} className="flex-shrink-0">
                      {inst.status === 'done' || inst.status === 'approved' ? (
                        <CheckCircle2 size={22} className="text-[#88C477]" />
                      ) : (
                        <Circle size={22} className="text-[#2A2A2A]/20 hover:text-[#88C477]" />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${inst.status === 'done' ? 'line-through text-[#2A2A2A]/30' : 'text-[#2A2A2A]'}`}>{inst.chore_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {child && <span className="text-xs text-[#2A2A2A]/40">{child.name}</span>}
                        {inst.points > 0 && <span className="text-xs text-[#F4C542] font-bold">{inst.points} pts</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Templates */}
      {tab === 'templates' && (
        <div>
          {showTemplateForm && (
            <form onSubmit={createTemplate} className="card-boma mb-4 space-y-4" data-testid="chore-template-form">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#2A2A2A]">New Chore Template</h3>
                <button type="button" onClick={() => setShowTemplateForm(false)}><X size={18} /></button>
              </div>
              <input type="text" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} className="input-boma" placeholder="Chore name" required />
              <textarea value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} className="input-boma" placeholder="Description (optional)" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Category</label>
                  <select value={templateForm.category} onChange={e => setTemplateForm({...templateForm, category: e.target.value})} className="input-boma">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Points</label>
                  <input type="number" value={templateForm.points} onChange={e => setTemplateForm({...templateForm, points: e.target.value})} className="input-boma" min="0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Frequency</label>
                <select value={templateForm.frequency} onChange={e => setTemplateForm({...templateForm, frequency: e.target.value})} className="input-boma">
                  {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary text-sm" data-testid="save-chore-template-btn">Save Template</button>
            </form>
          )}
          {templates.length === 0 ? (
            <div className="card-boma text-center py-10">
              <ClipboardList size={40} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40">No chore templates. Create one to start assigning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(t => (
                <div key={t.id} data-testid={`chore-template-${t.id}`} className="card-boma">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-[#2A2A2A]">{t.name}</h3>
                      <p className="text-xs text-[#2A2A2A]/40 mt-1">{t.description || 'No description'}</p>
                    </div>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs bg-[#E8D5B5]/40 text-[#2D4F3F] px-2 py-0.5 rounded-full font-bold capitalize">{t.category}</span>
                    <span className="text-xs bg-[#F4C542]/20 text-[#F4C542] px-2 py-0.5 rounded-full font-bold">{t.points} pts</span>
                    <span className="text-xs text-[#2A2A2A]/40">{FREQ_OPTIONS.find(f => f.value === t.frequency)?.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All instances */}
      {tab === 'all' && (
        <div className="space-y-3">
          {instances.length === 0 ? (
            <div className="card-boma text-center py-10"><p className="text-[#2A2A2A]/40">No chore instances yet</p></div>
          ) : instances.map(inst => {
            const child = children.find(c => c.id === inst.child_id);
            return (
              <div key={inst.id} className="card-boma flex items-center gap-4">
                <button onClick={() => toggleInstance(inst)}>
                  {inst.status === 'done' ? <CheckCircle2 size={20} className="text-[#88C477]" /> : <Circle size={20} className="text-[#2A2A2A]/20" />}
                </button>
                <div className="flex-1">
                  <p className="font-bold text-sm text-[#2A2A2A]">{inst.chore_name}</p>
                  <p className="text-xs text-[#2A2A2A]/40">{inst.planned_date} {child ? `- ${child.name}` : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssignForm(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={assignChore} className="card-boma w-full max-w-md space-y-4" data-testid="assign-chore-form">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Assign Chore</h3>
              <button type="button" onClick={() => setShowAssignForm(false)}><X size={18} /></button>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Chore</label>
              <select value={assignForm.template_id} onChange={e => setAssignForm({...assignForm, template_id: e.target.value})} className="input-boma" required>
                <option value="">Select chore</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-2 block">Assign to</label>
              <div className="flex gap-2 flex-wrap">
                {children.map(c => (
                  <button key={c.id} type="button" onClick={() => toggleChildId(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${assignForm.child_ids.includes(c.id) ? 'bg-[#2D4F3F] text-white' : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/60'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Start</label>
                <input type="date" value={assignForm.start_date} onChange={e => setAssignForm({...assignForm, start_date: e.target.value})} className="input-boma" required />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">End</label>
                <input type="date" value={assignForm.end_date} onChange={e => setAssignForm({...assignForm, end_date: e.target.value})} className="input-boma" required />
              </div>
            </div>
            <button type="submit" className="btn-secondary w-full" data-testid="assign-chore-submit-btn">Assign</button>
          </form>
        </div>
      )}
    </div>
  );
}
