import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import { CheckCircle2, Circle, BookOpen, ClipboardList, MessageSquare, ChevronRight, Sparkles, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import StreakBoard from '../../components/StreakBoard';

export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ lessons: [], chores: [], children: [], date: '' });
  const [selectedChild, setSelectedChild] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const params = selectedChild !== 'all' ? { child_id: selectedChild } : {};
      const res = await API.get('/curriculum/today', { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const toggleLesson = async (lesson) => {
    const newStatus = lesson.status === 'done' ? 'pending' : 'done';
    await API.put(`/curriculum/lessons/${lesson.id}`, { status: newStatus });
    fetchToday();
  };

  const toggleChore = async (chore) => {
    const newStatus = chore.status === 'done' ? 'pending' : 'done';
    await API.put(`/chores/instances/${chore.id}`, { status: newStatus });
    fetchToday();
  };

  const isParent = user?.role === 'parent' || user?.role === 'superadmin';
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const doneCount = data.lessons.filter(l => l.status === 'done').length + data.chores.filter(c => c.status === 'done').length;
  const totalCount = data.lessons.length + data.chores.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" data-testid="today-dashboard">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#2A2A2A] mb-1" style={{fontFamily: 'Fraunces, serif'}}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-[#2A2A2A]/50">{todayDate}</p>
      </div>

      {/* Progress */}
      <div className="card-boma mb-8 bg-gradient-to-br from-[#2D4F3F] to-[#223C30] text-white" data-testid="today-progress">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/60 text-sm font-medium">Today's Progress</p>
            <p className="text-3xl font-bold mt-1">{doneCount}/{totalCount}</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
            <span className="text-lg font-bold">{progressPct}%</span>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div className="bg-[#88C477] h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        {totalCount === 0 && (
          <p className="mt-4 text-white/60 text-sm">
            No tasks for today. {isParent && <Link to="/curriculum" className="text-[#88C477] hover:underline">Set up curriculum</Link>}
          </p>
        )}
      </div>

      {/* Child filter (parent only) */}
      {isParent && data.children.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap" data-testid="child-filter">
          <button
            onClick={() => setSelectedChild('all')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${selectedChild === 'all' ? 'bg-[#2D4F3F] text-white' : 'bg-white text-[#2A2A2A]/60 border border-[#E8D5B5]/50 hover:bg-[#E8D5B5]/30'}`}
          >
            All Children
          </button>
          {data.children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 flex items-center gap-2 ${selectedChild === child.id ? 'bg-[#2D4F3F] text-white' : 'bg-white text-[#2A2A2A]/60 border border-[#E8D5B5]/50 hover:bg-[#E8D5B5]/30'}`}
            >
              <div className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: child.avatar_color }}>
                {child.name.charAt(0)}
              </div>
              {child.name}
            </button>
          ))}
        </div>
      )}

      <StreakBoard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lessons */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-[#2D4F3F]" />
            <h2 className="text-lg font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Lessons</h2>
            <span className="text-xs font-bold bg-[#2D4F3F]/10 text-[#2D4F3F] px-2 py-0.5 rounded-full">{data.lessons.length}</span>
          </div>
          {data.lessons.length === 0 ? (
            <div className="card-boma text-center py-8">
              <Sparkles size={32} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40 text-sm">No lessons today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.lessons.map((lesson, i) => (
                <div
                  key={lesson.id}
                  data-testid={`lesson-card-${lesson.id}`}
                  onClick={() => navigate(`/lessons/${lesson.id}`)}
                  className="card-boma flex items-start gap-4 animate-slide-up cursor-pointer hover:shadow-md transition-shadow group"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <button
                    data-testid={`lesson-toggle-${lesson.id}`}
                    onClick={(e) => { e.stopPropagation(); toggleLesson(lesson); }}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {lesson.status === 'done' ? (
                      <CheckCircle2 size={22} className="text-[#88C477]" />
                    ) : (
                      <Circle size={22} className="text-[#2A2A2A]/20 hover:text-[#88C477]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${lesson.status === 'done' ? 'line-through text-[#2A2A2A]/30' : 'text-[#2A2A2A]'}`}>
                      {lesson.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: lesson.subject_color || '#2D4F3F' }} />
                      <span className="text-xs text-[#2A2A2A]/40">{lesson.subject_name}</span>
                      {lesson.child_name && <span className="text-xs text-[#2A2A2A]/30">- {lesson.child_name}</span>}
                      {lesson.quiz && lesson.quiz.length > 0 && (
                        <span className="bg-[#C06C47]/10 text-[#C06C47] px-2 py-0.5 rounded-full text-xs font-bold">
                          Quiz
                        </span>
                      )}
                    </div>
                  </div>
                  <Eye size={16} className="text-[#2A2A2A]/0 group-hover:text-[#2A2A2A]/30 flex-shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chores */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={18} className="text-[#C06C47]" />
            <h2 className="text-lg font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Chores</h2>
            <span className="text-xs font-bold bg-[#C06C47]/10 text-[#C06C47] px-2 py-0.5 rounded-full">{data.chores.length}</span>
          </div>
          {data.chores.length === 0 ? (
            <div className="card-boma text-center py-8">
              <ClipboardList size={32} className="text-[#E8D5B5] mx-auto mb-3" />
              <p className="text-[#2A2A2A]/40 text-sm">No chores today</p>
              {isParent && <Link to="/chores" className="text-xs text-[#C06C47] hover:underline mt-2 inline-block">Set up chores</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {data.chores.map((chore, i) => (
                <div
                  key={chore.id}
                  data-testid={`chore-card-${chore.id}`}
                  className="card-boma flex items-start gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <button
                    data-testid={`chore-toggle-${chore.id}`}
                    onClick={() => toggleChore(chore)}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {chore.status === 'done' || chore.status === 'approved' ? (
                      <CheckCircle2 size={22} className="text-[#88C477]" />
                    ) : (
                      <Circle size={22} className="text-[#2A2A2A]/20 hover:text-[#88C477]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${chore.status === 'done' ? 'line-through text-[#2A2A2A]/30' : 'text-[#2A2A2A]'}`}>
                      {chore.chore_name}
                    </p>
                    {chore.points > 0 && (
                      <span className="text-xs text-[#F4C542] font-bold">{chore.points} pts</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      {isParent && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/planner" data-testid="quick-link-planner" className="card-boma flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#4F9DCE]/10 flex items-center justify-center">
              <BookOpen size={18} className="text-[#4F9DCE]" />
            </div>
            <span className="font-bold text-sm text-[#2A2A2A]">Weekly Planner</span>
            <ChevronRight size={16} className="ml-auto text-[#2A2A2A]/20 group-hover:text-[#2A2A2A]/50" />
          </Link>
          <Link to="/messages" data-testid="quick-link-messages" className="card-boma flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#88C477]/10 flex items-center justify-center">
              <MessageSquare size={18} className="text-[#88C477]" />
            </div>
            <span className="font-bold text-sm text-[#2A2A2A]">Messages</span>
            <ChevronRight size={16} className="ml-auto text-[#2A2A2A]/20 group-hover:text-[#2A2A2A]/50" />
          </Link>
          <Link to="/reports" data-testid="quick-link-reports" className="card-boma flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#C06C47]/10 flex items-center justify-center">
              <ClipboardList size={18} className="text-[#C06C47]" />
            </div>
            <span className="font-bold text-sm text-[#2A2A2A]">Reports</span>
            <ChevronRight size={16} className="ml-auto text-[#2A2A2A]/20 group-hover:text-[#2A2A2A]/50" />
          </Link>
        </div>
      )}
    </div>
  );
}
