import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Plus, UserPlus } from 'lucide-react';

export default function SetupFamily() {
  const { createFamily, joinFamily } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createFamily(name);
      navigate('/today');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await joinFamily(code);
      navigate('/today');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6" data-testid="setup-family-page">
      <div className="noise-overlay" />
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#2D4F3F] flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Set up your family</h1>
          <p className="text-[#2A2A2A]/50 mt-2">Create a new family or join an existing one</p>
        </div>

        {error && (
          <div data-testid="family-setup-error" className="mb-6 p-4 bg-[#E05A6D]/10 border border-[#E05A6D]/20 rounded-2xl text-[#E05A6D] text-sm font-medium text-center">
            {error}
          </div>
        )}

        {!mode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              data-testid="create-family-option"
              onClick={() => setMode('create')}
              className="card-boma text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#2D4F3F]/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#2D4F3F]/20 transition-colors duration-200">
                <Plus size={24} className="text-[#2D4F3F]" />
              </div>
              <h3 className="text-lg font-bold text-[#2A2A2A] mb-1">Create Family</h3>
              <p className="text-sm text-[#2A2A2A]/50">Start a new family space</p>
            </button>
            <button
              data-testid="join-family-option"
              onClick={() => setMode('join')}
              className="card-boma text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#C06C47]/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#C06C47]/20 transition-colors duration-200">
                <UserPlus size={24} className="text-[#C06C47]" />
              </div>
              <h3 className="text-lg font-bold text-[#2A2A2A] mb-1">Join Family</h3>
              <p className="text-sm text-[#2A2A2A]/50">Use an invite code</p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="card-boma space-y-5">
            <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Create your family</h3>
            <div>
              <label className="block text-sm font-bold text-[#2D4F3F] mb-2">Family Name</label>
              <input
                data-testid="family-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-boma"
                placeholder="The Smith Family"
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode(null)} className="btn-secondary flex-1 bg-gray-200 text-[#2A2A2A] shadow-none">Back</button>
              <button data-testid="create-family-btn" type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="card-boma space-y-5">
            <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Join a family</h3>
            <div>
              <label className="block text-sm font-bold text-[#2D4F3F] mb-2">Invite Code</label>
              <input
                data-testid="invite-code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="input-boma text-center text-lg tracking-widest font-bold"
                placeholder="ABCD1234"
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode(null)} className="btn-secondary flex-1 bg-gray-200 text-[#2A2A2A] shadow-none">Back</button>
              <button data-testid="join-family-btn" type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
