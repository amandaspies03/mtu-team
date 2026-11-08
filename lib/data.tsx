'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Attendance, Compliance, Course, MatchTeam, MatchTeamMember, Member, Profile, Score, TeamEvent } from './types';

export type TeamData = {
  sb: SupabaseClient;
  me: Profile;
  isStaff: boolean;
  members: Member[];
  compliance: Compliance[];
  events: TeamEvent[];
  attendance: Attendance[];
  courses: Course[];
  scores: Score[];
  teams: MatchTeam[];
  teamMembers: MatchTeamMember[];
  profiles: Profile[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  memberById: (id: string | null | undefined) => Member | undefined;
};

const Ctx = createContext<TeamData | null>(null);

export function useTeam() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeam outside provider');
  return v;
}

async function all<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function TeamProvider({ sb, me, children }: { sb: SupabaseClient; me: Profile; children: React.ReactNode }) {
  const isStaff = me.role === 'staff' && me.approved;
  const [state, setState] = useState<Omit<TeamData, 'sb' | 'me' | 'isStaff' | 'reload' | 'memberById' | 'loading' | 'error'>>({
    members: [], compliance: [], events: [], attendance: [], courses: [], scores: [], teams: [], teamMembers: [], profiles: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const [members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles] = await Promise.all([
        all<Member>(sb.from('members').select('*').order('last_name').order('first_name')),
        all<Compliance>(sb.from('member_compliance').select('*')),
        all<TeamEvent>(sb.from('events').select('*').order('start_date')),
        all<Attendance>(sb.from('attendance').select('*')),
        all<Course>(sb.from('courses').select('*').order('sort')),
        all<Score>(sb.from('scores').select('*').order('shot_on', { ascending: true, nullsFirst: true }).limit(10000)),
        all<MatchTeam>(sb.from('match_teams').select('*').order('name')),
        all<MatchTeamMember>(sb.from('match_team_members').select('*')),
        isStaff ? all<Profile>(sb.from('profiles').select('*').order('created_at', { ascending: false })) : Promise.resolve([] as Profile[]),
      ]);
      setState({ members, compliance, events, attendance, courses, scores, teams, teamMembers, profiles });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load team data');
    } finally {
      setLoading(false);
    }
  }, [sb, isStaff]);

  useEffect(() => { reload(); }, [reload]);

  const memberById = useCallback((id: string | null | undefined) => state.members.find(m => m.id === id), [state.members]);

  return <Ctx.Provider value={{ sb, me, isStaff, ...state, loading, error, reload, memberById }}>{children}</Ctx.Provider>;
}
