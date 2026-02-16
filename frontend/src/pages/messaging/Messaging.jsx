import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import { Plus, Send, MessageCircle, ArrowLeft, Users, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Messaging() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewConv, setShowNewConv] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [convForm, setConvForm] = useState({ name: '', type: 'family', participant_ids: [] });
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get('/messages/conversations');
      setConversations(res.data.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (conv) => {
    setActiveConv(conv);
    try {
      const res = await API.get(`/messages/conversations/${conv.id}`);
      setMessages(res.data.messages);
      setParticipants(res.data.participants);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error('Failed to load conversation');
    }
  };

  // Polling
  useEffect(() => {
    if (!activeConv) return;
    pollRef.current = setInterval(async () => {
      try {
        const lastMsg = messages[messages.length - 1];
        const after = lastMsg?.created_at || '';
        const res = await API.get(`/messages/conversations/${activeConv.id}/poll`, { params: { after } });
        if (res.data.messages.length > 0) {
          setMessages(prev => [...prev, ...res.data.messages.filter(m => !prev.find(p => p.id === m.id))]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      } catch {} // eslint-disable-line no-empty
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeConv, messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeConv) return;
    try {
      await API.post(`/messages/conversations/${activeConv.id}/messages`, { body: newMsg });
      setNewMsg('');
      const res = await API.get(`/messages/conversations/${activeConv.id}`);
      setMessages(res.data.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error('Failed to send');
    }
  };

  const createConversation = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/messages/conversations', convForm);
      setShowNewConv(false);
      setConvForm({ name: '', type: 'family', participant_ids: [] });
      fetchConversations();
      openConversation(res.data.conversation);
      toast.success('Conversation created');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const reportMessage = async (msgId) => {
    if (!window.confirm('Report this message?')) return;
    await API.post(`/messages/messages/${msgId}/report`, { reason: 'Inappropriate content' });
    toast.success('Message reported');
  };

  const loadFamilyMembers = async () => {
    try {
      const res = await API.get('/families/current');
      setFamilyMembers(res.data.members || []);
    } catch {} // eslint-disable-line no-empty
  };

  const isParent = user?.role === 'parent' || user?.role === 'superadmin';

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="messaging-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Messages</h1>
        {isParent && (
          <button data-testid="new-conversation-btn" onClick={() => { setShowNewConv(true); loadFamilyMembers(); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> New Chat
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
        {/* Conversation List */}
        <div className={`lg:col-span-4 ${activeConv ? 'hidden lg:block' : ''}`}>
          <div className="card-boma h-full overflow-y-auto p-0">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle size={40} className="text-[#E8D5B5] mx-auto mb-3" />
                <p className="text-[#2A2A2A]/40 text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  data-testid={`conversation-${conv.id}`}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 border-b border-[#E8D5B5]/30 hover:bg-[#E8D5B5]/10 transition-colors duration-200 ${activeConv?.id === conv.id ? 'bg-[#E8D5B5]/20' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2D4F3F]/10 flex items-center justify-center">
                      {conv.type === 'family' ? <Users size={16} className="text-[#2D4F3F]" /> : <MessageCircle size={16} className="text-[#2D4F3F]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#2A2A2A] truncate">{conv.name}</p>
                      {conv.last_message && (
                        <p className="text-xs text-[#2A2A2A]/40 truncate mt-0.5">{conv.last_message.body}</p>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#C06C47] text-white text-[10px] font-bold flex items-center justify-center">{conv.unread_count}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className={`lg:col-span-8 ${!activeConv ? 'hidden lg:flex' : 'flex'} flex-col`}>
          {activeConv ? (
            <div className="card-boma flex flex-col h-full p-0 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-[#E8D5B5]/50 flex items-center gap-3">
                <button onClick={() => setActiveConv(null)} className="lg:hidden p-1"><ArrowLeft size={18} /></button>
                <h3 className="font-bold text-[#2A2A2A]">{activeConv.name}</h3>
                <span className="text-xs text-[#2A2A2A]/40">{participants.length} members</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="message-thread">
                {messages.map(msg => {
                  const isMe = msg.user_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                        {!isMe && (
                          <p className="text-[10px] font-bold text-[#2A2A2A]/40 mb-1 ml-1">{msg.sender_name}</p>
                        )}
                        <div
                          data-testid={`message-${msg.id}`}
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe ? 'bg-[#2D4F3F] text-white rounded-br-lg' : 'bg-[#E8D5B5]/30 text-[#2A2A2A] rounded-bl-lg'
                          }`}
                        >
                          {msg.body}
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[10px] text-[#2A2A2A]/30">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isMe && (
                            <button onClick={() => reportMessage(msg.id)} className="text-[10px] text-[#2A2A2A]/20 hover:text-[#E05A6D]">
                              <AlertTriangle size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <form onSubmit={sendMessage} className="p-4 border-t border-[#E8D5B5]/50 flex gap-3" data-testid="message-composer">
                <input
                  data-testid="message-input"
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  className="input-boma flex-1"
                  placeholder="Type a message..."
                />
                <button data-testid="send-message-btn" type="submit" className="btn-primary px-4 py-3" disabled={!newMsg.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full card-boma">
              <div className="text-center">
                <MessageCircle size={48} className="text-[#E8D5B5] mx-auto mb-3" />
                <p className="text-[#2A2A2A]/40">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createConversation} className="card-boma w-full max-w-md space-y-4" data-testid="new-conversation-form">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>New Conversation</h3>
              <button type="button" onClick={() => setShowNewConv(false)}><X size={18} /></button>
            </div>
            <input type="text" value={convForm.name} onChange={e => setConvForm({...convForm, name: e.target.value})} className="input-boma" placeholder="Conversation name" required />
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-1 block">Type</label>
              <select value={convForm.type} onChange={e => setConvForm({...convForm, type: e.target.value})} className="input-boma">
                <option value="family">Family Group</option>
                <option value="direct">Direct Message</option>
                <option value="siblings">Siblings Only</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-[#2D4F3F] mb-2 block">Add Members</label>
              <div className="flex gap-2 flex-wrap">
                {familyMembers.filter(m => m.id !== user?.id).map(m => (
                  <button key={m.id} type="button"
                    onClick={() => setConvForm(prev => ({
                      ...prev,
                      participant_ids: prev.participant_ids.includes(m.id)
                        ? prev.participant_ids.filter(id => id !== m.id)
                        : [...prev.participant_ids, m.id]
                    }))}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${convForm.participant_ids.includes(m.id) ? 'bg-[#2D4F3F] text-white' : 'bg-[#E8D5B5]/30 text-[#2A2A2A]/60'}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" data-testid="create-conversation-btn">Create</button>
          </form>
        </div>
      )}
    </div>
  );
}
