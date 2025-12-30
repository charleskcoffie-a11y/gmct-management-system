import React, { useMemo } from 'react';
import type { Member } from '../types';

interface UpcomingBirthdaysProps {
  members: Member[];
}

const UpcomingBirthdays: React.FC<UpcomingBirthdaysProps> = ({ members }) => {
  // Window: first of this month through end of next month (local time)
  const startWindow = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const endDateObj = useMemo(() => {
    const start = startWindow;
    return new Date(start.getFullYear(), start.getMonth() + 2, 0); // last day of next month
  }, [startWindow]);

  const upcomingBirthdays = useMemo(() => {
    const list: {
      id: string;
      name: string;
      month: number;
      day: number;
      dateStr: string;
      classNumber?: string;
      email?: string;
      phone?: string;
      weekStartMs: number;
    }[] = [];

    members.forEach(m => {
      if (!m.dobMonth || !m.dobDay) return;
      const currentYear = startWindow.getFullYear();
      let bday = new Date(currentYear, m.dobMonth - 1, m.dobDay);
      const startMs = startWindow.getTime();
      const endMs = endDateObj.getTime();
      let bdayMs = bday.getTime();

      if (bdayMs < startMs) {
        bday = new Date(currentYear + 1, m.dobMonth - 1, m.dobDay);
        bdayMs = bday.getTime();
      }

      if (bdayMs >= startMs && bdayMs <= endMs) {
        const weekStart = new Date(bdayMs);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday anchor

        list.push({
          id: m.id,
          name: m.name,
          month: m.dobMonth,
          day: m.dobDay,
          dateStr: new Date(bdayMs).toISOString().slice(0, 10),
          classNumber: m.classNumber,
          email: m.email,
          phone: m.phone,
          weekStartMs: weekStart.getTime(),
        });
      }
    });

    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [members, startWindow, endDateObj]);

  const birthdaysByWeek = useMemo(() => {
    const grouped = new Map<number, { weekStartMs: number; birthdays: typeof upcomingBirthdays }>();

    upcomingBirthdays.forEach(b => {
      if (!grouped.has(b.weekStartMs)) {
        grouped.set(b.weekStartMs, { weekStartMs: b.weekStartMs, birthdays: [] });
      }
      grouped.get(b.weekStartMs)!.birthdays.push(b);
    });

    return Array.from(grouped.values())
      .map(group => ({
        ...group,
        birthdays: group.birthdays.sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
      }))
      .sort((a, b) => a.weekStartMs - b.weekStartMs);
  }, [upcomingBirthdays]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white rounded-xl shadow">
        <h3 className="text-lg font-bold">🎉 Upcoming Birthdays (Current + Next Month)</h3>
        <p className="text-sm opacity-90">Range: {startWindow.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (1st of this month) – {endDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
        <p className="text-xs opacity-80">Members with DOB: {members.filter(m => m.dobMonth && m.dobDay).length} · Showing: {upcomingBirthdays.length}</p>
      </div>

      {upcomingBirthdays.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-blue-200 shadow p-6 text-center text-slate-500">No upcoming birthdays in the current or next month.</div>
      ) : (
        birthdaysByWeek.map(week => {
          const sundayLabel = new Date(week.weekStartMs).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          const saturday = new Date(week.weekStartMs);
          saturday.setDate(saturday.getDate() + 6);
          const saturdayLabel = saturday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

          return (
            <div key={week.weekStartMs} className="bg-white rounded-xl border-2 border-blue-200 shadow">
              <div className="bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="font-bold text-slate-800">Week of Sunday {sundayLabel}</div>
                <div className="text-xs text-slate-600">Covers Sunday–Saturday: {sundayLabel} – {saturdayLabel}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-700">
                  <thead className="text-slate-700 text-sm uppercase font-bold bg-white">
                    <tr>
                      <th className="px-6 py-3">Member</th>
                      <th className="px-6 py-3">Class</th>
                      <th className="px-6 py-3">Birthday</th>
                      <th className="px-6 py-3">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {week.birthdays.map(b => (
                      <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-3 font-semibold">{b.name}</td>
                        <td className="px-6 py-3">{b.classNumber || '-'}</td>
                        <td className="px-6 py-3">{new Date(b.dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{b.email || b.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default UpcomingBirthdays;
