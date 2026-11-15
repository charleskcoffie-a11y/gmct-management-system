import React from 'react';

const paths = {
    church: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6M12 4V1M10 2h4',
    pages: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 7h6M9 11h6M9 15h3',
    plus: 'M12 5v14M5 12h14',
    finance: 'M12 3v18M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    reports: 'M4 3v18h17M8 16v-4M13 16V8M18 16V5',
    property: 'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M9 21v-3h2v3',
};
export default function SettingsSymbol({ name, small = false }: { name: keyof typeof paths; small?: boolean }) {
    return <svg aria-hidden="true" className={small ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
