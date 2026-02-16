import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.family_id) {
        navigate('/today');
      } else {
        navigate('/setup-family');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex" data-testid="login-page">
      <div className="noise-overlay" />

      {/* Left: Decorative */}
      <div className="hidden lg:flex w-1/2 bg-[#2D4F3F] relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[#C06C47]" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#E8D5B5]" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-[#88C477]" />
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-8">
            <GraduationCap className="text-white" size={40} />
          </div>
          <h2 className="text-5xl font-bold text-white mb-4" style={{fontFamily: 'Fraunces, serif'}}>BOMA</h2>
          <p className="text-xl text-white/70" style={{fontFamily: 'Fraunces, serif'}}>The Homeschool Hearth</p>
          <p className="mt-6 text-white/50 max-w-md leading-relaxed">
            Where families come together to learn, grow, and thrive. Manage curriculum, chores, allowance, and stay connected.
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 rounded-2xl bg-[#2D4F3F] flex items-center justify-center">
              <GraduationCap className="text-white" size={26} />
            </div>
            <h1 className="text-3xl font-bold text-[#2D4F3F]" style={{fontFamily: 'Fraunces, serif'}}>BOMA</h1>
          </div>

          <h2 className="text-3xl font-bold text-[#2A2A2A] mb-2" style={{fontFamily: 'Fraunces, serif'}}>Welcome back</h2>
          <p className="text-[#2A2A2A]/50 mb-8">Sign in to your family account</p>

          {error && (
            <div data-testid="login-error" className="mb-6 p-4 bg-[#E05A6D]/10 border border-[#E05A6D]/20 rounded-2xl text-[#E05A6D] text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#2D4F3F] mb-2">Email</label>
              <input
                data-testid="login-email-input"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-boma"
                placeholder="Email or username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#2D4F3F] mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-boma pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2A2A2A]/30 hover:text-[#2A2A2A]/60"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-[#2A2A2A]/50">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-[#C06C47] hover:underline" data-testid="register-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
