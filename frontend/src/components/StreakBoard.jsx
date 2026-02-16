import React, { useState, useEffect } from 'react';
import API from '../api';
import { Flame, Trophy, Shield, Crown, Sparkles, Star } from 'lucide-react';

const BADGE_ICONS = { shield: Shield, crown: Crown, sparkles: Sparkles, trophy: Trophy };

export default function StreakBoard() {
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/streaks').then(res => {
      setStreaks(res.data.streaks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (streaks.length === 0) return null;

  return (
    <div className="card-boma mb-8 animate-slide-up" data-testid="streak-board">
      <div className="flex items-center gap-2 mb-4">
        <Flame size={20} className="text-[#C06C47]" />
        <h2 className="text-lg font-bold text-[#2A2A2A]" style={{fontFamily: 'Fraunces, serif'}}>Family Streak Board</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {streaks.map((s, i) => {
          const weekPct = s.week_total > 0 ? Math.round((s.week_total_done / s.week_total) * 100) : 0;
          return (
            <div key={s.child_id} data-testid={`streak-child-${s.child_id}`}
              className={`relative p-4 rounded-2xl border transition-all duration-300 ${
                i === 0 && (s.lesson_streak + s.chore_streak) > 0
                  ? 'bg-gradient-to-br from-[#F4C542]/10 to-[#C06C47]/5 border-[#F4C542]/30'
                  : 'bg-white border-[#E8D5B5]/50'
              }`}>
              {i === 0 && (s.lesson_streak + s.chore_streak) > 0 && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#F4C542] flex items-center justify-center shadow-md">
                  <Trophy size={14} className="text-white" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.avatar_color }}>
                  {s.child_name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#2A2A2A]">{s.child_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.lesson_streak > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#C06C47]">
                        <Flame size={10} /> {s.lesson_streak}d lessons
                      </span>
                    )}
                    {s.chore_streak > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#88C477]">
                        <Star size={10} /> {s.chore_streak}d chores
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Week progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[#2A2A2A]/40 uppercase tracking-wider">This Week</span>
                  <span className="text-xs font-bold text-[#2D4F3F]">{s.week_total_done}/{s.week_total}</span>
                </div>
                <div className="w-full bg-[#E8D5B5]/30 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-700 bg-gradient-to-r from-[#2D4F3F] to-[#88C477]" style={{ width: `${weekPct}%` }} />
                </div>
              </div>

              {/* Badges */}
              {s.badges.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {s.badges.map((badge, bi) => {
                    const BadgeIcon = BADGE_ICONS[badge.icon] || Star;
                    return (
                      <span key={bi} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: badge.color + '15', color: badge.color }}>
                        <BadgeIcon size={10} /> {badge.name}
                      </span>
                    );
                  })}
                </div>
              )}

              {s.lesson_streak === 0 && s.chore_streak === 0 && s.badges.length === 0 && (
                <p className="text-[10px] text-[#2A2A2A]/30 italic">Complete tasks to start a streak!</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
