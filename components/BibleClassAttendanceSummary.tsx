import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Settings, SyncStatus } from '../types';
import { loadAttendanceReport } from '../services/supabase';

interface BibleClassAttendanceSummaryProps {
    settings: Settings;
    syncStatus?: SyncStatus;
}

type ServiceFilter = 'all' | 'sunday' | 'bible-study';

const BibleClassAttendanceSummary: React.FC<BibleClassAttendanceSummaryProps> = ({ settings, syncStatus }) => {
    const getMondayWeekStart = (isoDate: string) => {
        const date = new Date(`${isoDate}T00:00:00`);
        const day = date.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(date);
        monday.setUTCDate(date.getUTCDate() + diffToMonday);
        return monday.toISOString().slice(0, 10);
    };

    const todayIso = new Date().toISOString().slice(0, 10);
    const currentWeekStart = getMondayWeekStart(todayIso);

    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [rangeMode, setRangeMode] = useState<'month' | 'all'>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceFilter>('bible-study');
    const [classFilter, setClassFilter] = useState('all');
    const [weekRangeStart, setWeekRangeStart] = useState<string>(currentWeekStart);
    const [weekRangeEnd, setWeekRangeEnd] = useState<string>(currentWeekStart);
    const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStart);
    const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [isClassSectionExpanded, setIsClassSectionExpanded] = useState(true);
    const [isQuarterlySectionExpanded, setIsQuarterlySectionExpanded] = useState(true);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    const getDateRange = () => {
        if (rangeMode === 'all') {
            return { startDate: '2000-01-01', endDate: '2100-12-31' };
        }

        const [yearText, monthText] = selectedMonth.split('-');
        const year = Number(yearText);
        const monthIndex = Number(monthText) - 1;
        const start = new Date(Date.UTC(year, monthIndex, 1));
        const end = new Date(Date.UTC(year, monthIndex + 1, 0));
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
        };
    };

    const addDays = (isoDate: string, days: number) => {
        const date = new Date(`${isoDate}T00:00:00`);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    };

    const formatWeekRange = (weekStart: string) => {
        const weekEnd = addDays(weekStart, 6);
        return `${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(`${weekEnd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    };

    const getIsoWeekInputValue = (weekStart: string) => {
        const date = new Date(`${weekStart}T00:00:00`);
        const thursday = new Date(date);
        thursday.setUTCDate(date.getUTCDate() + 3);
        const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
        const firstThursdayDay = firstThursday.getUTCDay() || 7;
        firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 4);
        const weekNumber = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return `${thursday.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    };

    const parseIsoWeekInputValue = (value: string) => {
        const match = /^(\d{4})-W(\d{2})$/.exec(value);
        if (!match) return '';
        const year = Number(match[1]);
        const week = Number(match[2]);
        const januaryFourth = new Date(Date.UTC(year, 0, 4));
        const day = januaryFourth.getUTCDay() || 7;
        const weekOneMonday = new Date(januaryFourth);
        weekOneMonday.setUTCDate(januaryFourth.getUTCDate() - day + 1);
        const monday = new Date(weekOneMonday);
        monday.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);
        return monday.toISOString().slice(0, 10);
    };

    useEffect(() => {
        if (!isConnected) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const { startDate, endDate } = getDateRange();
                const rows = await loadAttendanceReport(settings.supabaseUrl, settings.supabaseKey, startDate, endDate);
                setAttendanceData(rows || []);
            } catch (err) {
                console.error('Failed to load attendance summary:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [isConnected, rangeMode, selectedMonth, settings.supabaseUrl, settings.supabaseKey]);

    const filteredAttendance = useMemo(() => {
        return attendanceData.filter((record) => {
            if (serviceTypeFilter !== 'all' && record.service_type !== serviceTypeFilter) return false;
            if (classFilter !== 'all' && record.class_number !== classFilter) return false;

            const recordWeekStart = getMondayWeekStart(record.attendance_date);
            if (weekRangeStart && recordWeekStart < weekRangeStart) return false;
            if (weekRangeEnd && recordWeekStart > weekRangeEnd) return false;

            return true;
        });
    }, [attendanceData, serviceTypeFilter, classFilter, weekRangeStart, weekRangeEnd]);

    const chartData = useMemo(() => {
        const byWeek: Record<string, { week: string; weekStart: string; present: number; absent: number; total: number; [key: string]: any }> = {};

        filteredAttendance.forEach((record) => {
            const weekStart = getMondayWeekStart(record.attendance_date);
            if (!byWeek[weekStart]) {
                byWeek[weekStart] = {
                    week: formatWeekRange(weekStart),
                    weekStart,
                    present: 0,
                    absent: 0,
                    total: 0,
                };
            }

            const classKey = `Class${record.class_number}`;
            if (!byWeek[weekStart][classKey]) {
                byWeek[weekStart][classKey] = 0;
            }

            if (record.status === 'present') {
                byWeek[weekStart].present += 1;
                byWeek[weekStart][classKey] += 1;
            } else if (record.status === 'absent') {
                byWeek[weekStart].absent += 1;
            }

            byWeek[weekStart].total += 1;
        });

        return Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    }, [filteredAttendance]);

    const overallStats = useMemo(() => {
        let totalPresent = 0;
        let totalAbsent = 0;

        filteredAttendance.forEach((record) => {
            if (record.status === 'present') totalPresent += 1;
            if (record.status === 'absent') totalAbsent += 1;
        });

        const total = totalPresent + totalAbsent;
        return {
            totalPresent,
            totalAbsent,
            total,
            rate: total > 0 ? ((totalPresent / total) * 100).toFixed(1) : '0',
        };
    }, [filteredAttendance]);

    const classOptions = useMemo(() => {
        const classes = Array.from(new Set(attendanceData.map((row) => row.class_number).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
        return ['all', ...classes];
    }, [attendanceData]);

    const weeklyRows = useMemo(() => {
        return chartData.map((item) => ({
            weekStart: item.weekStart,
            week: item.week,
            present: item.present,
            absent: item.absent,
            total: item.total,
            rate: item.total > 0 ? ((item.present / item.total) * 100).toFixed(1) : '0',
        }));
    }, [chartData]);

    useEffect(() => {
        if (weeklyRows.length === 0) {
            setSelectedWeek('');
            return;
        }
        setSelectedWeek((prev) => {
            if (prev && weeklyRows.some((row) => row.weekStart === prev)) return prev;
            return weeklyRows[0].weekStart;
        });
    }, [weeklyRows]);

    const presentTotalsByService = useMemo(() => {
        let sundayPresent = 0;
        let biblePresent = 0;

        filteredAttendance.forEach((record) => {
            if (record.status !== 'present') return;
            if (record.service_type === 'sunday') sundayPresent += 1;
            if (record.service_type === 'bible-study') biblePresent += 1;
        });

        return {
            sundayPresent,
            biblePresent,
            totalPresent: sundayPresent + biblePresent,
        };
    }, [filteredAttendance]);

    const selectedWeekServiceTotals = useMemo(() => {
        if (!selectedWeek) {
            return {
                weekLabel: 'No week selected',
                sundayPresent: 0,
                biblePresent: 0,
                totalPresent: 0,
            };
        }

        let sundayPresent = 0;
        let biblePresent = 0;

        filteredAttendance.forEach((record) => {
            const recordWeekStart = getMondayWeekStart(record.attendance_date);
            if (recordWeekStart !== selectedWeek) return;
            if (record.status !== 'present') return;
            if (record.service_type === 'sunday') sundayPresent += 1;
            if (record.service_type === 'bible-study') biblePresent += 1;
        });

        return {
            weekLabel: formatWeekRange(selectedWeek),
            sundayPresent,
            biblePresent,
            totalPresent: sundayPresent + biblePresent,
        };
    }, [filteredAttendance, selectedWeek]);

    const weeklyGroupedByYearMonth = useMemo(() => {
        const years = new Map<string, Map<string, { monthLabel: string; rows: typeof weeklyRows }>>();

        weeklyRows.forEach((row) => {
            const date = new Date(`${row.weekStart}T00:00:00`);
            const yearKey = String(date.getUTCFullYear());
            const monthNumber = date.getUTCMonth() + 1;
            const monthKey = `${yearKey}-${String(monthNumber).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('en-US', { month: 'long' });

            if (!years.has(yearKey)) years.set(yearKey, new Map());
            const months = years.get(yearKey)!;
            if (!months.has(monthKey)) {
                months.set(monthKey, { monthLabel, rows: [] });
            }
            months.get(monthKey)!.rows.push(row);
        });

        return Array.from(years.entries())
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([year, monthsMap]) => ({
                year,
                months: Array.from(monthsMap.entries())
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([monthKey, data]) => ({
                        monthKey,
                        monthLabel: data.monthLabel,
                        rows: [...data.rows].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
                    })),
            }));
    }, [weeklyRows]);

    const classDetails = useMemo(() => {
        const byClass: Record<string, {
            classNumber: string;
            present: number;
            absent: number;
            total: number;
            sundayPresent: number;
            sundayAbsent: number;
            biblePresent: number;
            bibleAbsent: number;
            weekly: Record<string, { weekStart: string; week: string; present: number; absent: number; total: number }>;
        }> = {};

        filteredAttendance.forEach((record) => {
            const classNumber = record.class_number;
            if (!byClass[classNumber]) {
                byClass[classNumber] = {
                    classNumber,
                    present: 0,
                    absent: 0,
                    total: 0,
                    sundayPresent: 0,
                    sundayAbsent: 0,
                    biblePresent: 0,
                    bibleAbsent: 0,
                    weekly: {},
                };
            }

            const target = byClass[classNumber];
            const weekStart = getMondayWeekStart(record.attendance_date);
            if (!target.weekly[weekStart]) {
                target.weekly[weekStart] = {
                    weekStart,
                    week: formatWeekRange(weekStart),
                    present: 0,
                    absent: 0,
                    total: 0,
                };
            }

            if (record.status === 'present') {
                target.present += 1;
                target.weekly[weekStart].present += 1;
                if (record.service_type === 'sunday') target.sundayPresent += 1;
                if (record.service_type === 'bible-study') target.biblePresent += 1;
            }
            if (record.status === 'absent') {
                target.absent += 1;
                target.weekly[weekStart].absent += 1;
                if (record.service_type === 'sunday') target.sundayAbsent += 1;
                if (record.service_type === 'bible-study') target.bibleAbsent += 1;
            }
            target.total += 1;
            target.weekly[weekStart].total += 1;
        });

        return Object.values(byClass)
            .sort((a, b) => Number(a.classNumber) - Number(b.classNumber))
            .map((item) => ({
                ...item,
                rate: item.total > 0 ? ((item.present / item.total) * 100).toFixed(1) : '0',
                weeklyRows: Object.values(item.weekly).sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
            }));
    }, [filteredAttendance]);

    const quarterlyComparison = useMemo(() => {
        const scopedRows = attendanceData.filter((record) => {
            if (serviceTypeFilter !== 'all' && record.service_type !== serviceTypeFilter) return false;
            if (classFilter !== 'all' && record.class_number !== classFilter) return false;
            return true;
        });

        const latestDate = scopedRows.length > 0
            ? scopedRows.reduce((latest: string, row: any) => (row.attendance_date > latest ? row.attendance_date : latest), scopedRows[0].attendance_date)
            : todayIso;

        const latest = new Date(`${latestDate}T00:00:00`);
        const currentQuarter = Math.floor(latest.getUTCMonth() / 3) + 1;
        const currentYear = latest.getUTCFullYear();
        const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
        const previousYear = currentQuarter === 1 ? currentYear - 1 : currentYear;

        const byClass: Record<string, { current: number; previous: number }> = {};

        scopedRows.forEach((row: any) => {
            if (row.status !== 'present') return;

            const classNum = String(row.class_number);
            if (!byClass[classNum]) {
                byClass[classNum] = { current: 0, previous: 0 };
            }

            const rowDate = new Date(`${row.attendance_date}T00:00:00`);
            const rowQuarter = Math.floor(rowDate.getUTCMonth() / 3) + 1;
            const rowYear = rowDate.getUTCFullYear();

            if (rowQuarter === currentQuarter && rowYear === currentYear) {
                byClass[classNum].current += 1;
            }
            if (rowQuarter === previousQuarter && rowYear === previousYear) {
                byClass[classNum].previous += 1;
            }
        });

        const rows = Object.keys(byClass)
            .sort((a, b) => Number(a) - Number(b))
            .map((classNum) => {
                const current = byClass[classNum].current;
                const previous = byClass[classNum].previous;
                const change = current - previous;
                const changePct = previous > 0 ? ((change / previous) * 100).toFixed(1) : (current > 0 ? '100.0' : '0.0');
                return {
                    classNumber: classNum,
                    classLabel: `Class ${classNum}`,
                    current,
                    previous,
                    change,
                    changePct,
                };
            });

        const currentTotal = rows.reduce((sum, row) => sum + row.current, 0);
        const previousTotal = rows.reduce((sum, row) => sum + row.previous, 0);
        const totalChange = currentTotal - previousTotal;
        const totalChangePct = previousTotal > 0 ? ((totalChange / previousTotal) * 100).toFixed(1) : (currentTotal > 0 ? '100.0' : '0.0');

        return {
            currentQuarterLabel: `Q${currentQuarter} ${currentYear}`,
            previousQuarterLabel: `Q${previousQuarter} ${previousYear}`,
            rows,
            currentTotal,
            previousTotal,
            totalChange,
            totalChangePct,
        };
    }, [attendanceData, serviceTypeFilter, classFilter, todayIso]);

    useEffect(() => {
        if (weeklyGroupedByYearMonth.length === 0) {
            setExpandedYears(new Set());
            setExpandedMonths(new Set());
            return;
        }

        setExpandedYears((prev) => {
            if (prev.size > 0) return prev;
            const currentYear = new Date(`${currentWeekStart}T00:00:00`).getUTCFullYear().toString();
            const matchingYear = weeklyGroupedByYearMonth.find((item) => item.year === currentYear)?.year;
            return new Set([matchingYear || weeklyGroupedByYearMonth[0].year]);
        });

        setExpandedMonths((prev) => {
            if (prev.size > 0) return prev;
            const currentMonthKey = currentWeekStart.slice(0, 7);
            for (const yearBlock of weeklyGroupedByYearMonth) {
                const matchingMonth = yearBlock.months.find((month) => month.monthKey === currentMonthKey)?.monthKey;
                if (matchingMonth) {
                    return new Set([matchingMonth]);
                }
            }

            const firstMonth = weeklyGroupedByYearMonth[0]?.months[0]?.monthKey;
            return firstMonth ? new Set([firstMonth]) : prev;
        });
    }, [weeklyGroupedByYearMonth]);

    useEffect(() => {
        if (classDetails.length === 0) {
            setExpandedClasses(new Set());
        }
    }, [classDetails]);

    const toggleYear = (year: string) => {
        setExpandedYears((prev) => {
            const next = new Set(prev);
            if (next.has(year)) next.delete(year);
            else next.add(year);
            return next;
        });
    };

    const toggleMonth = (monthKey: string) => {
        setExpandedMonths((prev) => {
            const next = new Set(prev);
            if (next.has(monthKey)) next.delete(monthKey);
            else next.add(monthKey);
            return next;
        });
    };

    const toggleClass = (classNumber: string) => {
        setExpandedClasses((prev) => {
            const next = new Set(prev);
            if (next.has(classNumber)) next.delete(classNumber);
            else next.add(classNumber);
            return next;
        });
    };

    const chartSeriesKeys = useMemo(() => {
        return Array.from(new Set(chartData.flatMap((row) => Object.keys(row).filter((key) => key.startsWith('Class')))))
            .sort((left, right) => Number(left.replace('Class', '')) - Number(right.replace('Class', '')));
    }, [chartData]);

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#eab308', '#84cc16', '#6366f1'];

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-100 shadow-xl">
                <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_right,#fde68a_0%,transparent_35%),radial-gradient(circle_at_bottom_left,#dbeafe_0%,transparent_40%)]" />
                <div className="relative flex items-center justify-between gap-6 p-8">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-slate-300 bg-slate-800 p-4 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Attendance Filing Desk</p>
                            <h2 className="mt-1 text-3xl font-black text-slate-800">Attendance Summary</h2>
                            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-600">Structured for real-world record filing: intake filters, weekly ledgers, and class folders with service-level totals.</p>
                        </div>
                    </div>
                    <div className="hidden rounded-2xl border border-slate-300 bg-white/80 px-5 py-4 text-right shadow md:block">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Filing Mode</div>
                        <div className="mt-1 text-lg font-extrabold text-slate-800">Weekly Ledger</div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <div className="bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-100">Record Intake Filters</div>
                <div className="p-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:items-end">
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Range</label>
                        <div className="flex overflow-hidden rounded-lg border-2 border-slate-200">
                            <button
                                onClick={() => setRangeMode('month')}
                                className={`flex-1 px-4 py-2 font-bold transition ${rangeMode === 'month' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => setRangeMode('all')}
                                className={`flex-1 px-4 py-2 font-bold transition ${rangeMode === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                All
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Select Month</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={rangeMode === 'all'}
                            className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Service</label>
                        <select
                            value={serviceTypeFilter}
                            onChange={(e) => setServiceTypeFilter(e.target.value as ServiceFilter)}
                            className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none"
                        >
                            <option value="all">All Services</option>
                            <option value="sunday">Sunday Service</option>
                            <option value="bible-study">Tuesday Bible Class</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Class</label>
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none"
                        >
                            {classOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option === 'all' ? 'All Classes' : `Class ${option}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Grouping</label>
                        <div className="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-700">
                            Weekly (Mon-Sun)
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Week Range Start</label>
                        <input
                            type="week"
                            value={weekRangeStart ? getIsoWeekInputValue(weekRangeStart) : ''}
                            onChange={(e) => setWeekRangeStart(parseIsoWeekInputValue(e.target.value))}
                            className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Week Range End</label>
                        <input
                            type="week"
                            value={weekRangeEnd ? getIsoWeekInputValue(weekRangeEnd) : ''}
                            onChange={(e) => setWeekRangeEnd(parseIsoWeekInputValue(e.target.value))}
                            className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {rangeMode === 'all'
                        ? 'Showing all attendance records grouped by week.'
                        : `Showing weekly attendance for ${new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`}
                </div>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-800 to-slate-700 p-6 text-white shadow-lg">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-200">Filed Present Totals</div>
                    <div className="mt-2 text-4xl font-black">{presentTotalsByService.totalPresent}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-300">Sunday: {presentTotalsByService.sundayPresent} | Bible Class: {presentTotalsByService.biblePresent}</div>
                </div>
                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-lg md:col-span-2">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[220px]">
                            <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-600">Selected Week (Service Totals)</label>
                            <select
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 font-semibold text-slate-700 focus:border-slate-500 focus:outline-none"
                            >
                                {weeklyRows.length === 0 ? (
                                    <option value="">No weeks available</option>
                                ) : (
                                    weeklyRows.map((row) => (
                                        <option key={row.weekStart} value={row.weekStart}>
                                            {row.week}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Selected Week Present Totals</div>
                            <div className="mt-1 text-sm font-semibold text-slate-800">{selectedWeekServiceTotals.weekLabel}</div>
                            <div className="mt-2 text-sm text-slate-700">Sunday: <span className="font-bold text-green-600">{selectedWeekServiceTotals.sundayPresent}</span> | Tuesday Bible Class: <span className="font-bold text-indigo-600">{selectedWeekServiceTotals.biblePresent}</span> | Total: <span className="font-black text-slate-900">{selectedWeekServiceTotals.totalPresent}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white shadow-lg">
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-100">Overall Rate</div>
                    <div className="mt-2 text-4xl font-black">{overallStats.rate}%</div>
                </div>
                <div className="rounded-xl border border-blue-300 bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-lg">
                    <div className="text-xs font-black uppercase tracking-widest text-blue-100">Total Present</div>
                    <div className="mt-2 text-4xl font-black">{overallStats.totalPresent}</div>
                </div>
                <div className="rounded-xl border border-orange-300 bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white shadow-lg">
                    <div className="text-xs font-black uppercase tracking-widest text-orange-100">Total Absent</div>
                    <div className="mt-2 text-4xl font-black">{overallStats.totalAbsent}</div>
                </div>
                <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-500 to-fuchsia-600 p-6 text-white shadow-lg">
                    <div className="text-xs font-black uppercase tracking-widest text-violet-100">Total Records</div>
                    <div className="mt-2 text-4xl font-black">{overallStats.total}</div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <div className="bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-100">Filed Weekly Ledger</div>
                <div className="p-6">
                <h3 className="mb-4 text-xl font-black text-slate-800">Weekly Attendance Groupings (Year &gt; Month &gt; Week)</h3>
                {weeklyGroupedByYearMonth.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No attendance records for the selected filters</div>
                ) : (
                    <div className="space-y-3">
                        {weeklyGroupedByYearMonth.map((yearBlock) => {
                            const yearOpen = expandedYears.has(yearBlock.year);
                            const yearWeekCount = yearBlock.months.reduce((sum, month) => sum + month.rows.length, 0);
                            return (
                                <div key={yearBlock.year} className="overflow-hidden rounded-xl border-2 border-slate-200">
                                    <button
                                        onClick={() => toggleYear(yearBlock.year)}
                                        className="w-full bg-slate-100 px-5 py-4 transition hover:bg-slate-200 flex items-center justify-between"
                                    >
                                        <span className="font-bold text-slate-800">{yearBlock.year}</span>
                                        <span className="text-sm font-semibold text-slate-600">{yearWeekCount} week(s) {yearOpen ? '▼' : '▶'}</span>
                                    </button>
                                    {yearOpen && (
                                        <div className="bg-white p-3 space-y-3">
                                            {yearBlock.months.map((monthBlock) => {
                                                const monthOpen = expandedMonths.has(monthBlock.monthKey);
                                                return (
                                                    <div key={monthBlock.monthKey} className="overflow-hidden rounded-lg border border-slate-200">
                                                        <button
                                                            onClick={() => toggleMonth(monthBlock.monthKey)}
                                                            className="w-full bg-slate-50 px-4 py-3 transition hover:bg-slate-100 flex items-center justify-between"
                                                        >
                                                            <span className="font-semibold text-slate-800">{monthBlock.monthLabel}</span>
                                                            <span className="text-xs font-semibold text-slate-600">{monthBlock.rows.length} week(s) {monthOpen ? '▼' : '▶'}</span>
                                                        </button>
                                                        {monthOpen && (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="bg-slate-100 border-b border-slate-200">
                                                                            <th className="text-left px-3 py-2 font-bold text-slate-700">Week</th>
                                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Present</th>
                                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Absent</th>
                                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Total</th>
                                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Rate</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {monthBlock.rows.map((row) => (
                                                                            <tr key={`${monthBlock.monthKey}-${row.weekStart}`} className="border-b border-slate-100 hover:bg-slate-50">
                                                                                <td className="px-3 py-2 font-semibold text-slate-800">{row.week}</td>
                                                                                <td className="text-center px-3 py-2 text-green-600 font-semibold">{row.present}</td>
                                                                                <td className="text-center px-3 py-2 text-red-600 font-semibold">{row.absent}</td>
                                                                                <td className="text-center px-3 py-2 text-slate-700 font-semibold">{row.total}</td>
                                                                                <td className="text-center px-3 py-2"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{row.rate}%</span></td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <div className="bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-100">Class Folders</div>
                <div className="p-6">
                <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="text-xl font-black text-slate-800">Attendance by Class (Collapsed)</h3>
                    <button
                        onClick={() => setIsClassSectionExpanded(prev => !prev)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                        {isClassSectionExpanded ? 'Collapse All Classes' : 'Expand Class Section'}
                    </button>
                </div>
                {!isClassSectionExpanded ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
                        All class folders are collapsed.
                    </div>
                ) : classDetails.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No attendance data for the selected filters</div>
                ) : (
                    <div className="space-y-3">
                        {classDetails.map((classItem) => {
                            const isOpen = expandedClasses.has(classItem.classNumber);
                            return (
                                <div key={classItem.classNumber} className="overflow-hidden rounded-xl border-2 border-slate-200">
                                    <button
                                        onClick={() => toggleClass(classItem.classNumber)}
                                        className="w-full bg-slate-50 px-5 py-4 transition hover:bg-slate-100 flex items-center justify-between"
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-slate-800">Class {classItem.classNumber}</div>
                                            <div className="text-xs text-slate-600">Present {classItem.present} • Absent {classItem.absent} • Total {classItem.total} • Rate {classItem.rate}%</div>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-600">{isOpen ? '▼' : '▶'}</span>
                                    </button>
                                    {isOpen && (
                                        <div className="p-4 space-y-4 bg-white">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                                    <div className="text-xs font-bold text-indigo-700 uppercase">Sunday Service</div>
                                                    <div className="text-sm text-slate-700 mt-1">Present: <span className="font-bold text-green-600">{classItem.sundayPresent}</span> • Absent: <span className="font-bold text-red-600">{classItem.sundayAbsent}</span></div>
                                                </div>
                                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                    <div className="text-xs font-bold text-purple-700 uppercase">Tuesday Bible Class</div>
                                                    <div className="text-sm text-slate-700 mt-1">Present: <span className="font-bold text-green-600">{classItem.biblePresent}</span> • Absent: <span className="font-bold text-red-600">{classItem.bibleAbsent}</span></div>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-100 border-b border-slate-200">
                                                            <th className="text-left px-3 py-2 font-bold text-slate-700">Week</th>
                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Present</th>
                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Absent</th>
                                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {classItem.weeklyRows.map((weekRow) => (
                                                            <tr key={`${classItem.classNumber}-${weekRow.weekStart}`} className="border-b border-slate-100 hover:bg-slate-50">
                                                                <td className="px-3 py-2 font-semibold text-slate-800">{weekRow.week}</td>
                                                                <td className="text-center px-3 py-2 text-green-600 font-semibold">{weekRow.present}</td>
                                                                <td className="text-center px-3 py-2 text-red-600 font-semibold">{weekRow.absent}</td>
                                                                <td className="text-center px-3 py-2 text-slate-700 font-semibold">{weekRow.total}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <div className="bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-100">Trend Analysis</div>
                <div className="p-6">
                <h3 className="mb-4 text-xl font-black text-slate-800">Weekly Attendance Trend</h3>
                {loading ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
                ) : chartData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">No data available for selected filters</div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip labelFormatter={(value) => `Week: ${value}`} />
                            <Legend />
                            {classFilter === 'all'
                                ? chartSeriesKeys.map((key, idx) => <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} />)
                                : [
                                    <Bar key="present" dataKey="present" fill="#10b981" name="Present" />,
                                    <Bar key="absent" dataKey="absent" fill="#ef4444" name="Absent" />,
                                ]}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
                <div className="bg-slate-800 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-100">Quarterly Comparison</div>
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <h3 className="text-xl font-black text-slate-800">Class-to-Class Quarterly Trend</h3>
                        <button
                            onClick={() => setIsQuarterlySectionExpanded(prev => !prev)}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                            {isQuarterlySectionExpanded ? 'Collapse Quarterly Comparison' : 'Expand Quarterly Comparison'}
                        </button>
                    </div>

                    {!isQuarterlySectionExpanded ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
                            Quarterly comparison is collapsed.
                        </div>
                    ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4">
                            <div className="text-xs font-black uppercase tracking-wider text-indigo-700">Current Quarter</div>
                            <div className="mt-1 text-sm font-bold text-slate-800">{quarterlyComparison.currentQuarterLabel}</div>
                            <div className="mt-2 text-3xl font-black text-indigo-700">{quarterlyComparison.currentTotal}</div>
                        </div>
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-600">Previous Quarter</div>
                            <div className="mt-1 text-sm font-bold text-slate-800">{quarterlyComparison.previousQuarterLabel}</div>
                            <div className="mt-2 text-3xl font-black text-slate-700">{quarterlyComparison.previousTotal}</div>
                        </div>
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                            <div className="text-xs font-black uppercase tracking-wider text-emerald-700">Net Change</div>
                            <div className={`mt-2 text-3xl font-black ${quarterlyComparison.totalChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {quarterlyComparison.totalChange >= 0 ? '+' : ''}{quarterlyComparison.totalChange}
                            </div>
                        </div>
                        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4">
                            <div className="text-xs font-black uppercase tracking-wider text-blue-700">Trend %</div>
                            <div className={`mt-2 text-3xl font-black ${Number(quarterlyComparison.totalChangePct) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                {Number(quarterlyComparison.totalChangePct) >= 0 ? '+' : ''}{quarterlyComparison.totalChangePct}%
                            </div>
                        </div>
                    </div>

                    {quarterlyComparison.rows.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-slate-400">No quarterly data for current filters</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={quarterlyComparison.rows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="classLabel" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [value, name]}
                                        labelFormatter={(value) => `${value}`}
                                    />
                                    <Legend />
                                    <Bar dataKey="previous" name={quarterlyComparison.previousQuarterLabel} fill="#94a3b8" />
                                    <Bar dataKey="current" name={quarterlyComparison.currentQuarterLabel} fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200">
                                            <th className="text-left px-3 py-2 font-bold text-slate-700">Class</th>
                                            <th className="text-center px-3 py-2 font-bold text-slate-700">{quarterlyComparison.previousQuarterLabel}</th>
                                            <th className="text-center px-3 py-2 font-bold text-slate-700">{quarterlyComparison.currentQuarterLabel}</th>
                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Change</th>
                                            <th className="text-center px-3 py-2 font-bold text-slate-700">Trend %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quarterlyComparison.rows.map((row) => (
                                            <tr key={row.classNumber} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-3 py-2 font-semibold text-slate-800">{row.classLabel}</td>
                                                <td className="text-center px-3 py-2 text-slate-700 font-semibold">{row.previous}</td>
                                                <td className="text-center px-3 py-2 text-blue-700 font-semibold">{row.current}</td>
                                                <td className={`text-center px-3 py-2 font-bold ${row.change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {row.change >= 0 ? '+' : ''}{row.change}
                                                </td>
                                                <td className={`text-center px-3 py-2 font-bold ${Number(row.changePct) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {Number(row.changePct) >= 0 ? '+' : ''}{row.changePct}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BibleClassAttendanceSummary;
