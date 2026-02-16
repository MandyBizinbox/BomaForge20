import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api';
import { toast } from 'sonner';
import { 
  Plus, Search, Filter, BookOpen, Calendar, User, 
  CheckCircle2, Circle, Trash2, Eye, X, ChevronDown
} from 'lucide-react';

export default function Lessons() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [children, setChildren] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChild, setFilterChild] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    child_id: '',
    subject_id: '',
    term_id: '',
    title: '',
    description: '',
    planned_date: new Date().toISOString().split('T')[0]
  });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [lessonsRes, childrenRes, subjectsRes, termsRes] = await Promise.all([
        API.get('/curriculum/lessons'),
        API.get('/children'),
        API.get('/curriculum/subjects'),
        API.get('/curriculum/terms')
      ]);
      setLessons(lessonsRes.data.lessons);
      setChildren(childrenRes.data.children);
      setSubjects(subjectsRes.data.subjects);
      setTerms(termsRes.data.terms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLessons = lessons.filter(l => {
    if (searchQuery && !l.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterChild && l.child_id !== filterChild) return false;
    if (filterSubject && l.subject_id !== filterSubject) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const createLesson = async (e) => {
    e.preventDefault();
    if (!createForm.child_id || !createForm.subject_id || !createForm.title || !createForm.planned_date) {
      toast.error('Please fill all required fields');
      return;
    }
    setCreating(true);
    try {
      const res = await API.post('/curriculum/lessons', createForm);
      toast.success('Lesson created');
      setShowCreate(false);
      setCreateForm({
        child_id: '',
        subject_id: '',
        term_id: '',
        title: '',
        description: '',
        planned_date: new Date().toISOString().split('T')[0]
      });
      // Navigate to the new lesson
      navigate(`/lessons/${res.data.lesson.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const deleteLesson = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await API.delete(`/curriculum/lessons/${id}`);
      toast.success('Lesson deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const toggleStatus = async (lesson, e) => {
    e.stopPropagation();
    const newStatus = lesson.status === 'done' ? 'pending' : 'done';
    try {
      await API.put(`/curriculum/lessons/${lesson.id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterChild('');
    setFilterSubject('');
    setFilterStatus('');
  };

  const activeFilterCount = [filterChild, filterSubject, filterStatus].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" data-testid="lessons-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>
          Lessons
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm"
          data-testid="create-lesson-btn"
        >
          <Plus size={18} /> New Lesson
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2A2A2A]/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-boma pl-11 w-full"
            placeholder="Search lessons..."
            data-testid="search-input"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${
            activeFilterCount > 0 
              ? 'bg-[#C06C47] text-white' 
              : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/60'
          }`}
          data-testid="filter-btn"
        >
          <Filter size={16} /> 
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{activeFilterCount}</span>
          )}
          <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card-boma mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="filter-panel">
          <div>
            <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Child</label>
            <select
              value={filterChild}
              onChange={(e) => setFilterChild(e.target.value)}
              className="input-boma"
            >
              <option value="">All children</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Subject</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="input-boma"
            >
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-boma"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="done">Complete</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-[#E05A6D] font-bold sm:col-span-3"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-boma text-center py-4">
          <p className="text-2xl font-bold text-[#2D4F3F]">{filteredLessons.length}</p>
          <p className="text-xs text-[#2A2A2A]/40">Total</p>
        </div>
        <div className="card-boma text-center py-4">
          <p className="text-2xl font-bold text-[#88C477]">
            {filteredLessons.filter(l => l.status === 'done').length}
          </p>
          <p className="text-xs text-[#2A2A2A]/40">Complete</p>
        </div>
        <div className="card-boma text-center py-4">
          <p className="text-2xl font-bold text-[#C06C47]">
            {filteredLessons.filter(l => l.status === 'pending').length}
          </p>
          <p className="text-xs text-[#2A2A2A]/40">Pending</p>
        </div>
      </div>

      {/* Lessons List */}
      {filteredLessons.length === 0 ? (
        <div className="card-boma text-center py-16">
          <BookOpen size={48} className="text-[#E8D5B5] mx-auto mb-4" />
          <p className="text-[#2A2A2A]/40 mb-4">
            {lessons.length === 0 ? 'No lessons yet' : 'No lessons match your filters'}
          </p>
          {lessons.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-secondary text-sm"
            >
              Create your first lesson
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLessons.map(lesson => (
            <div
              key={lesson.id}
              onClick={() => navigate(`/lessons/${lesson.id}`)}
              className={`card-boma cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4 ${
                lesson.status === 'done' ? 'bg-[#88C477]/5' : ''
              }`}
              data-testid={`lesson-card-${lesson.id}`}
            >
              {/* Status toggle */}
              <button
                onClick={(e) => toggleStatus(lesson, e)}
                className={`p-2 rounded-xl transition-colors ${
                  lesson.status === 'done' 
                    ? 'text-[#88C477]' 
                    : 'text-[#2A2A2A]/20 hover:text-[#88C477]'
                }`}
              >
                {lesson.status === 'done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              
              {/* Subject color */}
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: lesson.subject_color || '#2D4F3F' }}
              >
                {lesson.subject_name?.charAt(0) || 'L'}
              </div>
              
              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-[#2A2A2A] truncate ${lesson.status === 'done' ? 'line-through opacity-50' : ''}`}>
                  {lesson.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#2A2A2A]/40">
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lesson.subject_color }} />
                    {lesson.subject_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={12} /> {lesson.child_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {lesson.planned_date}
                  </span>
                  {lesson.quiz && lesson.quiz.length > 0 && (
                    <span className="bg-[#C06C47]/10 text-[#C06C47] px-2 py-0.5 rounded-full font-bold">
                      Quiz
                    </span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/lessons/${lesson.id}`); }}
                  className="p-2 rounded-xl hover:bg-[#E8D5B5]/30 text-[#2A2A2A]/30 hover:text-[#2D4F3F]"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => deleteLesson(lesson.id, e)}
                  className="p-2 rounded-xl hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <form 
            onClick={(e) => e.stopPropagation()} 
            onSubmit={createLesson}
            className="card-boma w-full max-w-md space-y-4"
            data-testid="create-lesson-modal"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>
                New Lesson
              </h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Title *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                className="input-boma"
                placeholder="Lesson title"
                required
                data-testid="create-title-input"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Child *</label>
              <select
                value={createForm.child_id}
                onChange={(e) => setCreateForm({...createForm, child_id: e.target.value})}
                className="input-boma"
                required
                data-testid="create-child-select"
              >
                <option value="">Select child</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Subject *</label>
              <select
                value={createForm.subject_id}
                onChange={(e) => setCreateForm({...createForm, subject_id: e.target.value})}
                className="input-boma"
                required
                data-testid="create-subject-select"
              >
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Term (optional)</label>
              <select
                value={createForm.term_id}
                onChange={(e) => setCreateForm({...createForm, term_id: e.target.value})}
                className="input-boma"
              >
                <option value="">No term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Scheduled Date *</label>
              <input
                type="date"
                value={createForm.planned_date}
                onChange={(e) => setCreateForm({...createForm, planned_date: e.target.value})}
                className="input-boma"
                required
                data-testid="create-date-input"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Description (optional)</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                className="input-boma min-h-[80px]"
                placeholder="Brief description..."
              />
            </div>
            
            <button 
              type="submit" 
              disabled={creating}
              className="btn-primary w-full"
              data-testid="create-lesson-submit"
            >
              {creating ? 'Creating...' : 'Create Lesson'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
