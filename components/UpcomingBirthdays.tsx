import React, { useMemo } from 'react';
import type { Member } from '../types';

interface UpcomingBirthdaysProps {
  members: Member[];
}

function nextSunday(base: Date) {
  const d = new Date(base);
  const day = d.getDay();
  if (day === 0) return d;
  d.setDate(d.getDate() + (7 - day));
  return d;
}

const UpcomingBirthdays: React.FC<UpcomingBirthdaysProps> = ({ members }) => {
  const startSunday = useMemo(() => nextSunday(new Date()), []);
  const endDateObj = useMemo(() => {
    const e = new Date(startSunday);
    e.setDate(e.getDate() + 27);
    return e;
  }, [startSunday]);

  const upcomingBirthdays = useMemo(() => {
    const list: { id: string; name: string; month: number; day: number; dateStr: string; week: number; classNumber?: string; email?: string; phone?: string }[] = [];
    members.forEach(m => {
      if (!m.dobMonth || !m.dobDay) return;
      const currentYear = startSunday.getFullYear();
      let bday = new Date(Date.UTC(currentYear, m.dobMonth - 1, m.dobDay));
      const startUTC = Date.UTC(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate());
      const endUTC = Date.UTC(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
      let bdayUTC = Date.UTC(bday.getUTCFullYear(), bday.getUTCMonth(), bday.getUTCDate());
      if (bdayUTC < startUTC) {
        bday = new Date(Date.UTC(currentYear + 1, m.dobMonth - 1, m.dobDay));
        bdayUTC = Date.UTC(bday.getUTCFullYear(), bday.getUTCMonth(), bday.getUTCDate());
      }
      if (bdayUTC >= startUTC && bdayUTC <= endUTC) {
        const week = Math.floor((bdayUTC - startUTC) / (7 * 24 * 60 * 60 * 1000));
        list.push({
          id: m.id,
          name: m.name,
          month: m.dobMonth,
          day: m.dobDay,
          dateStr: new Date(bdayUTC).toISOString().slice(0, 10),
          week: Math.min(Math.max(week, 0), 3),
          classNumber: m.classNumber,
          email: m.email,
          phone: m.phone,
        });
      }
    });
    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [members, startSunday, endDateObj]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white rounded-xl shadow">
        <h3 className="text-lg font-bold">🎉 Upcoming Birthdays (Next 4 Weeks)</h3>
        <p className="text-sm opacity-90">Starting Sunday {startSunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
      </div>
      <div className="bg-white rounded-xl border-2 border-blue-200 shadow p-6">
        {upcomingBirthdays.length === 0 ? (
          <div className="text-center text-slate-500 p-8">No upcoming birthdays in the next four weeks.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-700">
              <thead className="bg-gradient-to-r from-blue-100 to-indigo-100 text-slate-700 text-sm uppercase font-bold">
                <tr>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">Birthday</th>
                  <th className="px-6 py-3">Week</th>
                  <th className="px-6 py-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingBirthdays.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-3 font-semibold">{b.name}</td>
                    <td className="px-6 py-3">{b.classNumber || '-'}</td>
                    <td className="px-6 py-3">{new Date(b.dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</td>
                    <td className="px-6 py-3"><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">Week {b.week + 1}</span></td>
                    <td className="px-6 py-3 text-sm text-slate-600">{b.email || b.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingBirthdays;
