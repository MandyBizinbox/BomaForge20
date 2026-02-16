import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Plus, Eye } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => formatDate(getMonday(new Date())));
  const [lessons, setLessons] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { week_start: weekStart };
      if (selectedChild !== 'all') params.child_id = selectedChild;
      const [lessonRes, childRes] = await Promise.all([
        API.get('/curriculum/lessons', { params }),
        API.get('/children')
      ]);
      setLessons(lessonRes.data.lessons);
      setChildren(childRes.data.children);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [weekStart, selectedChild]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(formatDate(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(formatDate(d));
  };

  const goToday = () => setWeekStart(formatDate(getMonday(new Date())));

  const toggleLesson = async (lesson) => {
    const newStatus = lesson.status === 'done' ? 'pending' : 'done';
    await API.put(`/curriculum/lessons/${lesson.id}`, { status: newStatus });
    fetchData();
  };

  const weekDates = WEEKDAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return formatDate(d);
  });

  const today = formatDate(new Date());

  return (
    <div className="animate-fade-in" data-testid="weekly-planner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Weekly Planner</h1>
        <div className="flex items-center gap-2">
          <button onClick={goToday} data-testid="planner-today-btn" className="px-4 py-2 rounded-full text-sm font-bold bg-[#E8D5B5]/40 text-[#2D4F3F] hover:bg-[#E8D5B5]/60 transition-colors duration-200">
            Today
          </button>
          <button onClick={prevWeek} data-testid="planner-prev-btn" className="p-2 rounded-xl hover:bg-[#E8D5B5]/30 transition-colors duration-200">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-[#2A2A2A] min-w-[180px] text-center">
            {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weekDates[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button onClick={nextWeek} data-testid="planner-next-btn" className="p-2 rounded-xl hover:bg-[#E8D5B5]/30 transition-colors duration-200">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Child filter */}
      {children.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSelectedChild('all')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${selectedChild === 'all' ? 'bg-[#2D4F3F] text-white' : 'bg-white text-[#2A2A2A]/60 border border-[#E8D5B5]/50'}`}
          >
            All
          </button>
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 flex items-center gap-2 ${selectedChild === child.id ? 'bg-[#2D4F3F] text-white' : 'bg-white text-[#2A2A2A]/60 border border-[#E8D5B5]/50'}`}
            >
              <div className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: child.avatar_color }}>
                {child.name.charAt(0)}
              </div>
              {child.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3" data-testid="planner-grid">
          {WEEKDAYS.map((day, i) => {
            const date = weekDates[i];
            const isToday = date === today;
            const dayLessons = lessons.filter(l => l.planned_date === date);

            return (
              <div key={day} className="min-h-[200px]">
                <div className={`text-center mb-3 pb-2 border-b-2 ${isToday ? 'border-[#C06C47]' : 'border-[#E8D5B5]/50'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-[#C06C47]' : 'text-[#2A2A2A]/40'}`}>{day}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-[#C06C47]' : 'text-[#2A2A2A]'}`}>
                    {new Date(date + 'T00:00:00').getDate()}
                  </p>
                </div>
                <div className="space-y-2">
                  {dayLessons.map(lesson => (
                    <div
                      key={lesson.id}
                      data-testid={`planner-lesson-${lesson.id}`}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition-all duration-200 hover:shadow-sm group ${
                        lesson.status === 'done'
                          ? 'bg-[#88C477]/10 border-[#88C477]/30'
                          : 'bg-white border-[#E8D5B5]/50 hover:border-[#C06C47]/30'
                      }`}
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                    >
                      <div className="flex items-start gap-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLesson(lesson); }}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {lesson.status === 'done' ? (
                            <CheckCircle2 size={14} className="text-[#88C477]" />
                          ) : (
                            <Circle size={14} className="text-[#2A2A2A]/20" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold leading-tight ${lesson.status === 'done' ? 'line-through text-[#2A2A2A]/30' : 'text-[#2A2A2A]'}`}>
                            {lesson.title?.length > 25 ? lesson.title.slice(0, 25) + '...' : lesson.title}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lesson.subject_color || '#2D4F3F' }} />
                            <span className="text-[10px] text-[#2A2A2A]/40 truncate">{lesson.subject_name}</span>
                          </div>
                          {lesson.child_name && (
                            <span className="text-[10px] text-[#2A2A2A]/30">{lesson.child_name}</span>
                          )}
                        </div>
                        <Eye size={12} className="text-[#2A2A2A]/0 group-hover:text-[#2A2A2A]/30 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                  {dayLessons.length === 0 && (
                    <div className="text-center py-4 text-[#2A2A2A]/10">
                      <Plus size={16} className="mx-auto" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
