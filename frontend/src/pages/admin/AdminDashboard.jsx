import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { Shield, Users, BookOpen, MessageCircle, ClipboardList, AlertTriangle, Settings, Eye, ChevronRight, Key, Mail, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [familyDetail, setFamilyDetail] = useState(null);
  const [reportedMsgs, setReportedMsgs] = useState([]);
  const [apiSettings, setApiSettings] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [keyForm, setKeyForm] = useState({
    payfast_merchant_id: '', payfast_merchant_key: '', payfast_passphrase: '', payfast_sandbox: true,
    resend_api_key: '', sender_email: 'onboarding@resend.dev'
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await API.get('/admin/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const viewFamily = async (familyId) => {
    const res = await API.get(`/admin/families/${familyId}`);
    setFamilyDetail(res.data);
  };

  const fetchReported = async () => {
    const res = await API.get('/admin/reported-messages');
    setReportedMsgs(res.data.messages);
  };

  const fetchSettings = async () => {
    const res = await API.get('/admin/settings');
    setApiSettings(res.data.settings);
  };

  const fetchEmailLogs = async () => {
    const res = await API.get('/email/log');
    setEmailLogs(res.data.logs);
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'reports') fetchReported();
    if (t === 'keys') fetchSettings();
    if (t === 'emails') fetchEmailLogs();
  };

  const saveApiKeys = async (e) => {
    e.preventDefault();
    try {
      const payload = {};
      Object.entries(keyForm).forEach(([k, v]) => { if (v !== '') payload[k] = v; });
      await API.put('/admin/settings', payload);
      toast.success('API keys updated');
      fetchSettings();
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const handleMessageAction = async (msgId, action) => {
    await API.put(`/admin/messages/${msgId}/action`, { action });
    toast.success(`Message ${action}d`);
    fetchReported();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'families', label: 'Families', icon: Users },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'emails', label: 'Email Log', icon: Mail },
  ];

  return (
    <div className="animate-fade-in" data-testid="admin-dashboard">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#E05A6D]/10 flex items-center justify-center">
          <Shield size={20} className="text-[#E05A6D]" />
        </div>
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>SuperAdmin</h1>
      </div>

      <div className="flex gap-1 bg-[#E8D5B5]/30 p-1 rounded-2xl mb-6 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)} data-testid={`admin-tab-${t.id}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-200 flex items-center gap-2 ${tab === t.id ? 'bg-white text-[#2D4F3F] shadow-sm' : 'text-[#2A2A2A]/50'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Families', value: dashboard.stats.total_families, color: '#2D4F3F', icon: Users },
              { label: 'Users', value: dashboard.stats.total_users, color: '#4F9DCE', icon: Users },
              { label: 'Children', value: dashboard.stats.total_children, color: '#88C477', icon: Users },
              { label: 'Lessons', value: dashboard.stats.total_lessons, color: '#C06C47', icon: BookOpen },
              { label: 'Chores', value: dashboard.stats.total_chores, color: '#F4C542', icon: ClipboardList },
              { label: 'Messages', value: dashboard.stats.total_messages, color: '#4F9DCE', icon: MessageCircle },
              { label: 'Reported', value: dashboard.stats.reported_messages, color: '#E05A6D', icon: AlertTriangle },
            ].map(s => (
              <div key={s.label} className="card-boma text-center">
                <s.icon size={20} className="mx-auto mb-2" style={{ color: s.color }} />
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-[#2A2A2A]/40 font-medium uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Families */}
      {tab === 'families' && dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-[#2A2A2A]">All Families</h3>
            {dashboard.families.map(f => (
              <button key={f.id} onClick={() => viewFamily(f.id)} data-testid={`admin-family-${f.id}`}
                className={`card-boma w-full text-left flex items-center justify-between ${familyDetail?.family?.id === f.id ? 'ring-2 ring-[#2D4F3F]' : ''}`}>
                <div>
                  <p className="font-bold text-[#2A2A2A]">{f.name}</p>
                  <p className="text-xs text-[#2A2A2A]/40">{f.member_count} members, {f.children_count} children</p>
                  <p className="text-xs capitalize mt-1"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.plan === 'full' ? 'bg-[#2D4F3F]/10 text-[#2D4F3F]' : f.plan === 'chat_only' ? 'bg-[#C06C47]/10 text-[#C06C47]' : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/40'}`}>{f.plan || 'free'}</span></p>
                </div>
                <ChevronRight size={16} className="text-[#2A2A2A]/20" />
              </button>
            ))}
          </div>
          {familyDetail && (
            <div className="card-boma">
              <h3 className="font-bold text-[#2A2A2A] mb-4">{familyDetail.family.name}</h3>
              <div className="space-y-3">
                <p className="text-xs text-[#2A2A2A]/40">Invite Code: <span className="font-bold text-[#C06C47]">{familyDetail.family.invite_code}</span></p>
                <p className="text-xs text-[#2A2A2A]/40">Lessons: <span className="font-bold">{familyDetail.lesson_count}</span></p>
                <h4 className="font-bold text-sm text-[#2A2A2A] mt-3">Members</h4>
                {familyDetail.members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: m.avatar_color || '#2D4F3F' }}>{m.name?.charAt(0)}</div>
                    <span className="text-sm text-[#2A2A2A]">{m.name}</span>
                    <span className="text-[10px] text-[#2A2A2A]/40 capitalize">{m.role}</span>
                  </div>
                ))}
                <h4 className="font-bold text-sm text-[#2A2A2A] mt-3">Children</h4>
                {familyDetail.children.map(c => (
                  <div key={c.id} className="flex items-center gap-2 py-1">
                    <div className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: c.avatar_color || '#4F9DCE' }}>{c.name?.charAt(0)}</div>
                    <span className="text-sm text-[#2A2A2A]">{c.name}</span>
                    <span className="text-[10px] text-[#2A2A2A]/40">{c.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reported Messages */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reportedMsgs.length === 0 ? (
            <div className="card-boma text-center py-10"><p className="text-[#2A2A2A]/40">No reported messages</p></div>
          ) : reportedMsgs.map(msg => (
            <div key={msg.id} className="card-boma flex items-start justify-between" data-testid={`reported-msg-${msg.id}`}>
              <div>
                <p className="font-bold text-sm text-[#2A2A2A]">{msg.sender_name}</p>
                <p className="text-sm text-[#2A2A2A]/60 mt-1">{msg.body}</p>
                <p className="text-xs text-[#E05A6D] mt-2">Reason: {msg.report_reason || 'N/A'}</p>
                <p className="text-[10px] text-[#2A2A2A]/30 mt-1">Reported: {new Date(msg.reported_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleMessageAction(msg.id, 'dismiss')} className="text-xs font-bold text-[#88C477] px-3 py-1.5 rounded-lg bg-[#88C477]/10">Dismiss</button>
                <button onClick={() => handleMessageAction(msg.id, 'delete')} className="text-xs font-bold text-[#E05A6D] px-3 py-1.5 rounded-lg bg-[#E05A6D]/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Keys */}
      {tab === 'keys' && (
        <div className="space-y-6">
          {apiSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={`card-boma ${apiSettings.has_payfast ? 'border-[#88C477]/30 bg-[#88C477]/5' : 'border-[#E05A6D]/30 bg-[#E05A6D]/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard size={16} className={apiSettings.has_payfast ? 'text-[#88C477]' : 'text-[#E05A6D]'} />
                  <span className="font-bold text-sm text-[#2A2A2A]">PayFast</span>
                </div>
                <p className="text-xs text-[#2A2A2A]/40">{apiSettings.has_payfast ? 'Configured' : 'Not configured (using stub mode)'}</p>
              </div>
              <div className={`card-boma ${apiSettings.has_resend ? 'border-[#88C477]/30 bg-[#88C477]/5' : 'border-[#E05A6D]/30 bg-[#E05A6D]/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={16} className={apiSettings.has_resend ? 'text-[#88C477]' : 'text-[#E05A6D]'} />
                  <span className="font-bold text-sm text-[#2A2A2A]">Resend Email</span>
                </div>
                <p className="text-xs text-[#2A2A2A]/40">{apiSettings.has_resend ? 'Configured' : 'Not configured (using stub mode)'}</p>
              </div>
            </div>
          )}
          <form onSubmit={saveApiKeys} className="card-boma space-y-6" data-testid="api-keys-form">
            <h3 className="font-bold text-[#2A2A2A] flex items-center gap-2" style={{fontFamily: 'Fraunces, serif'}}>
              <Key size={18} className="text-[#C06C47]" /> Integration Keys
            </h3>
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[#2D4F3F] flex items-center gap-2"><CreditCard size={14} /> PayFast</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Merchant ID</label>
                  <input data-testid="payfast-merchant-id" type="text" value={keyForm.payfast_merchant_id} onChange={e => setKeyForm({...keyForm, payfast_merchant_id: e.target.value})} className="input-boma" placeholder="e.g. 10000100" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Merchant Key</label>
                  <input data-testid="payfast-merchant-key" type="password" value={keyForm.payfast_merchant_key} onChange={e => setKeyForm({...keyForm, payfast_merchant_key: e.target.value})} className="input-boma" placeholder="Your merchant key" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Passphrase</label>
                  <input type="password" value={keyForm.payfast_passphrase} onChange={e => setKeyForm({...keyForm, payfast_passphrase: e.target.value})} className="input-boma" placeholder="Security passphrase" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={keyForm.payfast_sandbox} onChange={e => setKeyForm({...keyForm, payfast_sandbox: e.target.checked})} className="w-4 h-4 rounded" />
                    <span className="text-sm font-bold text-[#2D4F3F]">Sandbox Mode</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-[#E8D5B5]/50">
              <h4 className="font-bold text-sm text-[#2D4F3F] flex items-center gap-2"><Mail size={14} /> Resend (Email)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">API Key</label>
                  <input data-testid="resend-api-key" type="password" value={keyForm.resend_api_key} onChange={e => setKeyForm({...keyForm, resend_api_key: e.target.value})} className="input-boma" placeholder="re_..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2D4F3F] mb-1 block">Sender Email</label>
                  <input type="email" value={keyForm.sender_email} onChange={e => setKeyForm({...keyForm, sender_email: e.target.value})} className="input-boma" placeholder="onboarding@resend.dev" />
                </div>
              </div>
            </div>
            <button type="submit" className="btn-primary text-sm" data-testid="save-api-keys-btn">Save API Keys</button>
          </form>
        </div>
      )}

      {/* Email Logs */}
      {tab === 'emails' && (
        <div className="space-y-3">
          {emailLogs.length === 0 ? (
            <div className="card-boma text-center py-10"><p className="text-[#2A2A2A]/40">No emails sent yet</p></div>
          ) : emailLogs.map(log => (
            <div key={log.id} className="card-boma flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'sent' ? 'bg-[#88C477]' : log.status === 'stub' ? 'bg-[#F4C542]' : 'bg-[#E05A6D]'}`} />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#2A2A2A]">{log.subject}</p>
                <p className="text-xs text-[#2A2A2A]/40">To: {log.to}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.status === 'sent' ? 'bg-[#88C477]/10 text-[#88C477]' : log.status === 'stub' ? 'bg-[#F4C542]/10 text-[#F4C542]' : 'bg-[#E05A6D]/10 text-[#E05A6D]'}`}>{log.status}</span>
              <span className="text-[10px] text-[#2A2A2A]/30">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
