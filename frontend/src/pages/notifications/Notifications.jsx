import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api';
import { Bell, CheckCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id) => {
    await API.put(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await API.put('/notifications/read-all');
    toast.success('All marked as read');
    fetchNotifications();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-[#2D4F3F] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-[#C06C47] font-bold mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button data-testid="mark-all-read-btn" onClick={markAllRead} className="text-sm font-bold text-[#2D4F3F] flex items-center gap-1 hover:underline">
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card-boma text-center py-12">
          <Bell size={48} className="text-[#E8D5B5] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[#2A2A2A] mb-2" style={{fontFamily: 'Fraunces, serif'}}>All caught up</h3>
          <p className="text-[#2A2A2A]/40">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => (
            <button
              key={notif.id}
              data-testid={`notification-${notif.id}`}
              onClick={() => !notif.read && markRead(notif.id)}
              className={`card-boma w-full text-left flex items-start gap-4 animate-slide-up ${!notif.read ? 'bg-[#E8D5B5]/10 border-[#C06C47]/20' : ''}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!notif.read ? 'bg-[#C06C47]' : 'bg-[#E8D5B5]'}`} />
              <div className="flex-1">
                <p className={`text-sm font-bold ${!notif.read ? 'text-[#2A2A2A]' : 'text-[#2A2A2A]/60'}`}>{notif.title}</p>
                <p className="text-xs text-[#2A2A2A]/40 mt-0.5">{notif.message}</p>
                <p className="text-[10px] text-[#2A2A2A]/30 mt-1 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(notif.created_at).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
