import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, Pencil, BookOpen, Calendar, User, 
  CheckCircle2, Circle, Trash2, Plus, X, GripVertical,
  FileText, MessageSquare, HelpCircle, Check
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image'],
    ['clean']
  ],
};

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isParent = user?.role === 'parent' || user?.role === 'superadmin';
  
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [content, setContent] = useState('');
  const [quiz, setQuiz] = useState([]);
  
  // Quiz taking state (for children)
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  const fetchLesson = useCallback(async () => {
    try {
      const res = await API.get(`/curriculum/lessons/${lessonId}`);
      const l = res.data.lesson;
      setLesson(l);
      setTitle(l.title || '');
      setDescription(l.description || '');
      setInstructions(l.instructions || '');
      setContent(l.content || '');
      setQuiz(l.quiz || []);
      
      // Check if quiz already submitted by this child
      if (l.submissions && l.submissions.length > 0) {
        const mySubmission = l.submissions.find(s => s.child_id === user?.child_id);
        if (mySubmission) {
          setQuizSubmitted(true);
          setQuizResult(mySubmission);
        }
      }
    } catch (err) {
      toast.error('Failed to load lesson');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [lessonId, navigate, user?.child_id]);

  useEffect(() => { fetchLesson(); }, [fetchLesson]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/curriculum/lessons/${lessonId}`, {
        title, description, instructions, content
      });
      // Save quiz separately if changed
      if (quiz.length > 0) {
        await API.put(`/curriculum/lessons/${lessonId}/quiz`, { quiz });
      }
      toast.success('Lesson saved');
      setEditMode(false);
      fetchLesson();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const newStatus = lesson.status === 'done' ? 'pending' : 'done';
    try {
      await API.put(`/curriculum/lessons/${lessonId}`, { status: newStatus });
      fetchLesson();
      toast.success(newStatus === 'done' ? 'Marked complete!' : 'Marked incomplete');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this lesson? This cannot be undone.')) return;
    try {
      await API.delete(`/curriculum/lessons/${lessonId}`);
      toast.success('Lesson deleted');
      navigate(-1);
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // Quiz builder functions
  const addQuestion = (type) => {
    setQuiz([...quiz, {
      id: `q_${Date.now()}`,
      question: '',
      type,
      options: type === 'radio' ? ['', '', '', ''] : [],
      correct_answer: ''
    }]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...quiz];
    updated[index][field] = value;
    setQuiz(updated);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...quiz];
    updated[qIndex].options[oIndex] = value;
    setQuiz(updated);
  };

  const removeQuestion = (index) => {
    setQuiz(quiz.filter((_, i) => i !== index));
  };

  const addOption = (qIndex) => {
    const updated = [...quiz];
    updated[qIndex].options.push('');
    setQuiz(updated);
  };

  const removeOption = (qIndex, oIndex) => {
    const updated = [...quiz];
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== oIndex);
    setQuiz(updated);
  };

  // Quiz submission (child)
  const submitQuiz = async () => {
    try {
      const res = await API.post(`/curriculum/lessons/${lessonId}/submit-quiz`, {
        answers: quizAnswers
      });
      setQuizResult(res.data.submission);
      setQuizSubmitted(true);
      toast.success(`Quiz submitted! Score: ${res.data.submission.percentage}%`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quiz');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto" data-testid="lesson-detail-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 rounded-xl hover:bg-[#E8D5B5]/30"
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          {editMode ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-boma text-2xl font-bold"
              placeholder="Lesson title"
              data-testid="lesson-title-input"
            />
          ) : (
            <h1 className="text-2xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>
              {lesson.title}
            </h1>
          )}
          <div className="flex items-center gap-3 mt-1 text-sm text-[#2A2A2A]/50">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lesson.subject_color }} />
              {lesson.subject_name}
            </span>
            <span className="flex items-center gap-1">
              <User size={14} /> {lesson.child_name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={14} /> {lesson.planned_date}
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              lesson.status === 'done' 
                ? 'bg-[#88C477]/10 text-[#88C477]' 
                : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/60 hover:bg-[#88C477]/10 hover:text-[#88C477]'
            }`}
            data-testid="toggle-status-btn"
          >
            {lesson.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {lesson.status === 'done' ? 'Complete' : 'Mark Done'}
          </button>
          
          {isParent && (
            <>
              {editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-[#2A2A2A]/40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 text-sm"
                    data-testid="save-lesson-btn"
                  >
                    <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    className="btn-secondary flex items-center gap-2 text-sm"
                    data-testid="edit-lesson-btn"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 rounded-xl hover:bg-[#E05A6D]/10 text-[#2A2A2A]/30 hover:text-[#E05A6D]"
                    data-testid="delete-lesson-btn"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#E8D5B5]/30 p-1 rounded-2xl mb-6 w-fit">
        {[
          { id: 'content', label: 'Content', icon: FileText },
          { id: 'instructions', label: 'Instructions', icon: MessageSquare },
          { id: 'quiz', label: 'Quiz', icon: HelpCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors duration-200 ${
              activeTab === tab.id 
                ? 'bg-white text-[#2D4F3F] shadow-sm' 
                : 'text-[#2A2A2A]/50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.id === 'quiz' && quiz.length > 0 && (
              <span className="bg-[#C06C47] text-white text-xs px-1.5 py-0.5 rounded-full">
                {quiz.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="card-boma" data-testid="content-section">
          {editMode ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-[#2D4F3F] mb-2 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-boma min-h-[80px]"
                  placeholder="Brief lesson description..."
                  data-testid="description-input"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-[#2D4F3F] mb-2 block">Lesson Content</label>
                <div className="bg-white rounded-xl border border-[#E8D5B5]/50 overflow-hidden">
                  <ReactQuill
                    value={content}
                    onChange={setContent}
                    modules={QUILL_MODULES}
                    placeholder="Write your lesson content here..."
                    className="quill-boma"
                    data-testid="content-editor"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              {description && (
                <p className="text-[#2A2A2A]/60 mb-4">{description}</p>
              )}
              {content ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                  data-testid="content-display"
                />
              ) : (
                <div className="text-center py-10 text-[#2A2A2A]/30">
                  <BookOpen size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No content added yet.</p>
                  {isParent && (
                    <button 
                      onClick={() => setEditMode(true)}
                      className="text-[#C06C47] font-bold mt-2"
                    >
                      Add content
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions Tab */}
      {activeTab === 'instructions' && (
        <div className="card-boma" data-testid="instructions-section">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-[#C06C47]" />
            <h3 className="font-bold text-[#2A2A2A]">Parent Instructions</h3>
          </div>
          {editMode ? (
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="input-boma min-h-[150px]"
              placeholder="Add instructions or notes for your child about this lesson..."
              data-testid="instructions-input"
            />
          ) : instructions ? (
            <div className="bg-[#C06C47]/5 p-4 rounded-xl border border-[#C06C47]/10">
              <p className="text-[#2A2A2A] whitespace-pre-wrap">{instructions}</p>
            </div>
          ) : (
            <div className="text-center py-10 text-[#2A2A2A]/30">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-50" />
              <p>No instructions added yet.</p>
              {isParent && (
                <button 
                  onClick={() => setEditMode(true)}
                  className="text-[#C06C47] font-bold mt-2"
                >
                  Add instructions
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quiz Tab */}
      {activeTab === 'quiz' && (
        <div className="space-y-4" data-testid="quiz-section">
          {isParent && editMode ? (
            // Quiz Builder (Parent)
            <>
              {quiz.map((q, qIndex) => (
                <div key={q.id} className="card-boma" data-testid={`quiz-question-${qIndex}`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[#E8D5B5]/30 text-[#2A2A2A]/40">
                      <GripVertical size={16} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2D4F3F] bg-[#2D4F3F]/10 px-2 py-1 rounded-lg uppercase">
                          {q.type === 'radio' ? 'Multiple Choice' : 'Text Answer'}
                        </span>
                        <button 
                          onClick={() => removeQuestion(qIndex)}
                          className="ml-auto text-[#E05A6D]/50 hover:text-[#E05A6D]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                        className="input-boma"
                        placeholder="Enter question..."
                      />
                      
                      {q.type === 'radio' && (
                        <div className="space-y-2 ml-4">
                          {q.options.map((opt, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct_${q.id}`}
                                checked={q.correct_answer === opt && opt !== ''}
                                onChange={() => updateQuestion(qIndex, 'correct_answer', opt)}
                                className="w-4 h-4 text-[#2D4F3F]"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                className="input-boma flex-1"
                                placeholder={`Option ${oIndex + 1}`}
                              />
                              {q.options.length > 2 && (
                                <button 
                                  onClick={() => removeOption(qIndex, oIndex)}
                                  className="text-[#E05A6D]/50 hover:text-[#E05A6D]"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(qIndex)}
                            className="text-sm text-[#2D4F3F] font-bold flex items-center gap-1"
                          >
                            <Plus size={14} /> Add option
                          </button>
                        </div>
                      )}
                      
                      {q.type === 'text' && (
                        <div className="ml-4">
                          <label className="text-xs font-bold text-[#2A2A2A]/50 mb-1 block">
                            Correct answer (for auto-grading)
                          </label>
                          <input
                            type="text"
                            value={q.correct_answer || ''}
                            onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                            className="input-boma"
                            placeholder="Enter correct answer..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add question buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => addQuestion('radio')}
                  className="card-boma flex items-center gap-3 flex-1 cursor-pointer border-dashed border-2 border-[#E8D5B5] hover:border-[#2D4F3F]/30 bg-transparent"
                  data-testid="add-radio-question-btn"
                >
                  <Plus size={18} className="text-[#2D4F3F]" />
                  <span className="font-bold text-sm text-[#2A2A2A]/50">Add Multiple Choice</span>
                </button>
                <button
                  onClick={() => addQuestion('text')}
                  className="card-boma flex items-center gap-3 flex-1 cursor-pointer border-dashed border-2 border-[#E8D5B5] hover:border-[#2D4F3F]/30 bg-transparent"
                  data-testid="add-text-question-btn"
                >
                  <Plus size={18} className="text-[#2D4F3F]" />
                  <span className="font-bold text-sm text-[#2A2A2A]/50">Add Text Question</span>
                </button>
              </div>
            </>
          ) : quiz.length > 0 ? (
            // Quiz Taker (Child) or Quiz View (Parent non-edit)
            <>
              {quizSubmitted && quizResult ? (
                // Show results
                <div className="card-boma bg-[#88C477]/5 border-[#88C477]/20" data-testid="quiz-results">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#88C477] flex items-center justify-center">
                      <Check size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2A2A2A]">Quiz Completed!</h3>
                      <p className="text-sm text-[#2A2A2A]/50">
                        Score: {quizResult.score}/{quizResult.total} ({quizResult.percentage}%)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {quizResult.results.map((r, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-xl ${r.is_correct ? 'bg-[#88C477]/10' : 'bg-[#E05A6D]/10'}`}
                      >
                        <p className="font-bold text-sm text-[#2A2A2A]">{r.question}</p>
                        <p className="text-sm mt-1">
                          Your answer: <span className={r.is_correct ? 'text-[#88C477]' : 'text-[#E05A6D]'}>{r.user_answer || '(no answer)'}</span>
                        </p>
                        {!r.is_correct && r.correct_answer && (
                          <p className="text-sm text-[#88C477]">Correct: {r.correct_answer}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Quiz form
                <>
                  {quiz.map((q, qIndex) => (
                    <div key={q.id} className="card-boma" data-testid={`quiz-take-${qIndex}`}>
                      <p className="font-bold text-[#2A2A2A] mb-3">
                        {qIndex + 1}. {q.question}
                      </p>
                      {q.type === 'radio' ? (
                        <div className="space-y-2 ml-4">
                          {q.options.filter(o => o).map((opt, oIndex) => (
                            <label key={oIndex} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#E8D5B5]/20 cursor-pointer">
                              <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                checked={quizAnswers[q.id] === opt}
                                onChange={(e) => setQuizAnswers({...quizAnswers, [q.id]: e.target.value})}
                                className="w-4 h-4 text-[#2D4F3F]"
                                disabled={!isParent && quizSubmitted}
                              />
                              <span className="text-[#2A2A2A]">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={quizAnswers[q.id] || ''}
                          onChange={(e) => setQuizAnswers({...quizAnswers, [q.id]: e.target.value})}
                          className="input-boma ml-4"
                          placeholder="Type your answer..."
                          disabled={!isParent && quizSubmitted}
                        />
                      )}
                    </div>
                  ))}
                  
                  {!isParent && !quizSubmitted && (
                    <button
                      onClick={submitQuiz}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                      data-testid="submit-quiz-btn"
                    >
                      <Check size={18} /> Submit Quiz
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="card-boma text-center py-10 text-[#2A2A2A]/30">
              <HelpCircle size={40} className="mx-auto mb-3 opacity-50" />
              <p>No quiz questions added yet.</p>
              {isParent && (
                <button 
                  onClick={() => setEditMode(true)}
                  className="text-[#C06C47] font-bold mt-2"
                >
                  Create quiz
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom Quill CSS */}
      <style>{`
        .quill-boma .ql-container {
          min-height: 200px;
          font-family: inherit;
        }
        .quill-boma .ql-editor {
          min-height: 200px;
        }
        .quill-boma .ql-toolbar {
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          border-color: rgba(232, 213, 181, 0.5);
        }
        .quill-boma .ql-container {
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          border-color: rgba(232, 213, 181, 0.5);
        }
      `}</style>
    </div>
  );
}
