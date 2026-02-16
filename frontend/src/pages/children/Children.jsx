import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { Plus, Trash2, Pencil, X, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Children() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editChild, setEditChild] = useState(null);
  const [form, setForm] = useState({ name: '', date_of_birth: '', grade: '', schedule_weekdays: [0, 1, 2, 3, 4] });

  const fetchChildren = useCallback(async () => {
    try {
      const res = await API.get('/children');
      setChildren(res.data.children);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editChild) {
        await API.put(`/children/${editChild.id}`, form);
        toast.success('Child updated');
      } else {
        await API.post('/children', form);
        toast.success('Child added');
      }
      resetForm();
      fetchChildren();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const deleteChild = async (id) => {
    if (!window.confirm('Remove this child? Their lessons will also be deleted.')) return;
    await API.delete(`/children/${id}`);
    toast.success('Child removed');
    fetchChildren();
  };

  const startEdit = (child) => {
    setEditChild(child);
    setForm({ name: child.name, date_of_birth: child.date_of_birth || '', grade: child.grade || '', schedule_weekdays: child.schedule_weekdays || [0, 1, 2, 3, 4] });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditChild(null);
    setForm({ name: '', date_of_birth: '', grade: '', schedule_weekdays: [0, 1, 2, 3, 4] });
    setShowForm(false);
  };

  const toggleWeekday = (day) => {
    setForm(prev => ({
      ...prev,
      schedule_weekdays: prev.schedule_weekdays.includes(day)
        ? prev.schedule_weekdays.filter(d => d !== day)
        : [...prev.schedule_weekdays, day].sort()
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="children-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Children</h1>
        <button data-testid="add-child-btn" onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <UserPlus size={16} /> Add Child
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card-boma mb-6 space-y-4" data-testid="child-form">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>{editChild ? 'Edit Child' : 'Add Child'}</h3>
            <button type="button" onClick={resetForm}><X size={18} /></button>
          </div>
          <input data-testid="child-name-input" type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-boma" placeholder="Child's name" required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="input-boma" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Grade</label>
              <input type="text" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} className="input-boma" placeholder="e.g. Grade 5" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[#2D4F3F] mb-2 block">Schedule Days</label>
            <div className="flex gap-2">
              {WEEKDAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`w-10 h-10 rounded-xl text-xs font-bold transition-colors duration-200 ${form.schedule_weekdays.includes(i) ? 'bg-[#2D4F3F] text-white' : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/40'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary text-sm" data-testid="save-child-btn">{editChild ? 'Update' : 'Add Child'}</button>
        </form>
      )}

      {children.length === 0 ? (
        <div className="card-boma text-center py-12">
          <Users size={48} className="text-[#E8D5B5] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[#2A2A2A] mb-2" style={{fontFamily: 'Fraunces, serif'}}>No children yet</h3>
          <p className="text-[#2A2A2A]/40">Add your children to start planning their education</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child, i) => (
            <div key={child.id} data-testid={`child-card-${child.id}`} className="card-boma animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: child.avatar_color }}>
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2A2A2A]">{child.name}</h3>
                    <p className="text-xs text-[#2A2A2A]/40">{child.grade || 'No grade set'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(child)} className="p-1.5 rounded-lg hover:bg-[#E8D5B5]/30 text-[#2A2A2A]/30 hover:text-[#2D4F3F]"><Pencil size={14} /></button>
                  <button onClick={() => deleteChild(child.id)} className="p-1.5 rounded-lg hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]"><Trash2 size={14} /></button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-[#2D4F3F] mb-2">Schedule Days</p>
                <div className="flex gap-1.5">
                  {WEEKDAY_NAMES.map((name, idx) => (
                    <span key={idx} className={`w-8 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center ${(child.schedule_weekdays || []).includes(idx) ? 'bg-[#2D4F3F] text-white' : 'bg-[#E8D5B5]/20 text-[#2A2A2A]/20'}`}>
                      {name.charAt(0)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
