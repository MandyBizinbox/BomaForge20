import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import { Copy, Users, CreditCard, Activity, CheckCircle2, Sparkles, UserPlus, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user, family, loadUser } = useAuth();
  const [familyData, setFamilyData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [billingStatus, setBillingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [tab, setTab] = useState('family');
  const [showChildAccount, setShowChildAccount] = useState(false);
  const [childAccountForm, setChildAccountForm] = useState({ child_id: '', username: '', password: '' });

  const fetchData = useCallback(async () => {
    try {
      const [fam, act, bill] = await Promise.all([
        API.get('/families/current'),
        API.get('/notifications/activity', { params: { limit: 30 } }),
        API.get('/billing/status')
      ]);
      setFamilyData(fam.data);
      setActivities(act.data.activities);
      setBillingStatus(bill.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyInviteCode = () => {
    if (familyData?.family?.invite_code) {
      navigator.clipboard.writeText(familyData.family.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const subscribePlan = async (planId) => {
    setSubscribing(true);
    try {
      const res = await API.post('/billing/subscribe', { plan_id: planId, email: user?.email });
      if (res.data.mode === 'redirect') {
        window.location.href = res.data.redirect_url;
      } else {
        toast.success(res.data.message);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm('Cancel your subscription? You will have 7 days of grace period.')) return;
    try {
      const res = await API.post('/billing/cancel', { reason: '' });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const createChildAccount = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/child-account', childAccountForm);
      toast.success('Child login account created!');
      setShowChildAccount(false);
      setChildAccountForm({ child_id: '', username: '', password: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="settings-page">
      <h1 className="text-3xl font-bold text-[#2A2A2A] mb-6" style={{fontFamily: 'Fraunces, serif'}}>Settings</h1>

      <div className="flex gap-1 bg-[#E8D5B5]/30 p-1 rounded-2xl mb-6 w-fit flex-wrap">
        {['family', 'accounts', 'billing', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`settings-tab-${t}`}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-colors duration-200 ${tab === t ? 'bg-white text-[#2D4F3F] shadow-sm' : 'text-[#2A2A2A]/50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'family' && familyData?.family && (
        <div className="space-y-6">
          <div className="card-boma">
            <h3 className="font-bold text-[#2A2A2A] mb-4 flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
              <Users size={18} className="text-[#2D4F3F]" /> Family Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Family Name</label>
                <p className="text-lg font-bold text-[#2A2A2A]">{familyData.family.name}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Invite Code</label>
                <div className="flex items-center gap-3">
                  <code className="text-xl font-bold text-[#C06C47] tracking-widest bg-[#C06C47]/5 px-4 py-2 rounded-xl">{familyData.family.invite_code}</code>
                  <button onClick={copyInviteCode} data-testid="copy-invite-code" className="p-2 rounded-xl hover:bg-[#E8D5B5]/30 text-[#2A2A2A]/40 hover:text-[#2D4F3F]">
                    <Copy size={18} />
                  </button>
                </div>
                <p className="text-xs text-[#2A2A2A]/40 mt-1">Share this code for family members to join</p>
              </div>
            </div>
          </div>

          <div className="card-boma">
            <h3 className="font-bold text-[#2A2A2A] mb-4">Family Members</h3>
            <div className="space-y-3">
              {familyData.members?.map(member => (
                <div key={member.id} className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: member.avatar_color || '#2D4F3F' }}>
                    {member.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#2A2A2A]">{member.name}</p>
                    <p className="text-xs text-[#2A2A2A]/40 capitalize">{member.role}</p>
                  </div>
                  {member.id === familyData.family.owner_id && (
                    <span className="text-xs bg-[#2D4F3F]/10 text-[#2D4F3F] px-2 py-0.5 rounded-full font-bold ml-auto">Owner</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="space-y-6">
          <div className="card-boma">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#2A2A2A] flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
                <UserPlus size={18} className="text-[#2D4F3F]" /> Child Login Accounts
              </h3>
              <button data-testid="create-child-account-btn" onClick={() => setShowChildAccount(true)} className="btn-primary text-sm flex items-center gap-2">
                <UserPlus size={14} /> Create Account
              </button>
            </div>
            <p className="text-sm text-[#2A2A2A]/50 mb-4">Create login accounts for children so they can sign in and view their tasks, chat, and wallet.</p>
            {familyData?.children?.map(child => (
              <div key={child.id} className="flex items-center gap-3 py-3 border-b border-[#E8D5B5]/30 last:border-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: child.avatar_color || '#4F9DCE' }}>
                  {child.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-[#2A2A2A]">{child.name}</p>
                  <p className="text-xs text-[#2A2A2A]/40">{child.grade || 'No grade'}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${child.user_id ? 'bg-[#88C477]/10 text-[#88C477]' : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/40'}`}>
                  {child.user_id ? 'Has account' : 'No account'}
                </span>
              </div>
            ))}
          </div>

          {showChildAccount && (
            <form onSubmit={createChildAccount} className="card-boma space-y-4" data-testid="child-account-form">
              <h3 className="font-bold text-[#2A2A2A]">Create Child Login</h3>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Child</label>
                <select value={childAccountForm.child_id} onChange={e => setChildAccountForm({...childAccountForm, child_id: e.target.value})} className="input-boma" required>
                  <option value="">Select child</option>
                  {familyData?.children?.filter(c => !c.user_id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Username (used to sign in)</label>
                <input data-testid="child-username-input" type="text" value={childAccountForm.username} onChange={e => setChildAccountForm({...childAccountForm, username: e.target.value})} className="input-boma" placeholder="emma.smith" required />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Password</label>
                <input type="password" value={childAccountForm.password} onChange={e => setChildAccountForm({...childAccountForm, password: e.target.value})} className="input-boma" placeholder="At least 4 characters" required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowChildAccount(false)} className="text-sm font-bold text-[#2A2A2A]/40">Cancel</button>
                <button type="submit" className="btn-primary text-sm" data-testid="save-child-account-btn">Create Account</button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-6">
          <div className="card-boma">
            <h3 className="font-bold text-[#2A2A2A] mb-4 flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
              <CreditCard size={18} className="text-[#C06C47]" /> Subscription
            </h3>
            {billingStatus?.subscription ? (
              <div className="bg-[#2D4F3F] text-white p-6 rounded-2xl mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Current Plan</p>
                    <p className="text-2xl font-bold mt-1 capitalize">{billingStatus.plan || 'free'}</p>
                    <p className="text-white/50 text-sm mt-1">
                      Status: <span className={`font-bold ${billingStatus.plan_status === 'active' ? 'text-[#88C477]' : 'text-[#F4C542]'}`}>{billingStatus.plan_status}</span>
                    </p>
                    {billingStatus.subscription.next_billing_date && (
                      <p className="text-white/40 text-xs mt-2">Next billing: {new Date(billingStatus.subscription.next_billing_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <CheckCircle2 size={32} className="text-[#88C477]" />
                </div>
                <button onClick={cancelSubscription} className="mt-4 text-sm text-white/40 hover:text-white/70 underline">Cancel subscription</button>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[#2D4F3F] to-[#223C30] text-white p-6 rounded-2xl mb-4">
                <p className="text-white/60 text-sm">Current Plan</p>
                <p className="text-2xl font-bold mt-1">Free</p>
                <p className="text-white/50 text-sm mt-2">All features available. Subscribe to support BOMA!</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-boma border-2 border-[#E8D5B5]/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#C06C47]/5 rounded-bl-full" />
              <h4 className="font-bold text-[#2A2A2A] text-lg" style={{fontFamily: 'Fraunces, serif'}}>Chat Only</h4>
              <p className="text-3xl font-bold text-[#C06C47] mt-2">R15<span className="text-sm text-[#2A2A2A]/40 font-normal">/month</span></p>
              <ul className="mt-4 space-y-2 text-sm text-[#2A2A2A]/60">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Family messaging</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> 6 months message history</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Parental controls</li>
              </ul>
              <button data-testid="subscribe-chat-btn" onClick={() => subscribePlan('chat_only')} disabled={subscribing || billingStatus?.plan === 'chat_only'}
                className={`mt-6 w-full btn-secondary text-sm ${billingStatus?.plan === 'chat_only' ? 'opacity-50' : ''}`}>
                {billingStatus?.plan === 'chat_only' ? 'Current Plan' : subscribing ? 'Processing...' : 'Subscribe'}
              </button>
            </div>

            <div className="card-boma border-2 border-[#2D4F3F] relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-[#2D4F3F] text-white text-[10px] font-bold rounded-bl-xl">POPULAR</div>
              <h4 className="font-bold text-[#2A2A2A] text-lg" style={{fontFamily: 'Fraunces, serif'}}>Full Plan</h4>
              <p className="text-3xl font-bold text-[#2D4F3F] mt-2">R65<span className="text-sm text-[#2A2A2A]/40 font-normal">/month</span></p>
              <ul className="mt-4 space-y-2 text-sm text-[#2A2A2A]/60">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Everything in Chat Only</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Curriculum planner</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Chores + Allowance</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> Reports + PDF export</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#88C477]" /> 1 year message history</li>
              </ul>
              <button data-testid="subscribe-full-btn" onClick={() => subscribePlan('full')} disabled={subscribing || billingStatus?.plan === 'full'}
                className={`mt-6 w-full btn-primary text-sm ${billingStatus?.plan === 'full' ? 'opacity-50' : ''}`}>
                {billingStatus?.plan === 'full' ? 'Current Plan' : subscribing ? 'Processing...' : 'Subscribe'}
              </button>
            </div>
          </div>

          <p className="text-xs text-[#2A2A2A]/40 text-center italic">
            <Sparkles size={12} className="inline mr-1" />
            {billingStatus?.subscription?.payfast_subscription_id?.startsWith('stub_')
              ? 'Running in stub mode. Add PayFast API keys in SuperAdmin settings to enable real payments.'
              : 'Payments processed securely via PayFast.'}
          </p>
        </div>
      )}

      {tab === 'activity' && (
        <div className="card-boma">
          <h3 className="font-bold text-[#2A2A2A] mb-4 flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
            <Activity size={18} className="text-[#2D4F3F]" /> Activity Log
          </h3>
          {activities.length === 0 ? (
            <p className="text-[#2A2A2A]/40 text-sm">No activity recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activities.map(act => (
                <div key={act.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#E8D5B5]/10">
                  <div className="w-2 h-2 rounded-full bg-[#2D4F3F]/30 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-[#2A2A2A]">{act.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-[#2A2A2A]/40">{new Date(act.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
