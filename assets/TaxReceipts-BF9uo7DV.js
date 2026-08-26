import{g as R,j as e,f as w}from"./index-0C0FoIkB.js";import{r as x}from"./react-AIrFsuJV.js";import"./supabase-BeVaYiBZ.js";import"./recharts-CFm0CClf.js";const B=n=>{let i=0;for(let o=0;o<n.length;o++)i=(i<<5)-i+n.charCodeAt(o),i|=0;return Math.abs(i)},$=(n,i)=>{const o=`${i}-${n}`,l=B(o).toString().padStart(8,"0");return`${i}-${n.slice(0,4).toUpperCase()}-${l.slice(-4)}`},F=({serial:n})=>{const i=x.useMemo(()=>{const c=n+"-barcode";return Array.from(c).map(b=>b.charCodeAt(0)).map((b,u)=>({width:2+b%4,height:30+b%20,odd:u%2===0}))},[n]);let o=0;const l=i.map((c,d)=>{const b=e.jsx("rect",{x:o,y:50-c.height,width:c.width,height:c.height,fill:c.odd?"#111827":"#4b5563"},d);return o+=c.width+1,b});return e.jsxs("svg",{width:o,height:60,"aria-label":`Barcode ${n}`,className:"mt-2",children:[l,e.jsx("text",{x:o/2,y:58,textAnchor:"middle",fontSize:"8",fill:"#374151",fontFamily:"monospace",children:n})]})},H=({entries:n,harvestEntries:i,members:o,settings:l})=>{const c=new Date().getFullYear().toString(),[d,b]=x.useState(c),[u,C]=x.useState("all"),[f,k]=x.useState(20),S=x.useMemo(()=>["all",...Array.from({length:l.maxClasses},(a,s)=>String(s+1))],[l.maxClasses]),N=x.useMemo(()=>{const a=Array.isArray(n)?n:[],r=(Array.isArray(i)?i:[]).map(t=>({id:(t==null?void 0:t.id)||"",date:typeof(t==null?void 0:t.date)=="string"?t.date:"",memberID:(t==null?void 0:t.memberID)||"",memberName:(t==null?void 0:t.memberName)||"Unknown Member",classNumber:(t==null?void 0:t.classNumber)||"",type:"harvest-levy",fund:"harvest levy",method:"other",amount:Number(t==null?void 0:t.amount)||0,note:(t==null?void 0:t.note)||"",createdAt:(t==null?void 0:t.createdAt)||"",deleted:!!(t!=null&&t.deleted)}));return[...a,...r].filter(t=>!!t&&typeof t=="object"&&typeof t.date=="string"&&t.date.length>=8).filter(t=>!t.deleted).map(t=>({...t,type:R(t.type)}))},[n,i]),M=x.useMemo(()=>{const a=new Set;return N.forEach(s=>{typeof(s==null?void 0:s.date)=="string"&&s.date.length>=4&&a.add(s.date.substring(0,4))}),a.has(c)||a.add(c),Array.from(a).sort((s,r)=>r.localeCompare(s))},[N,c]);x.useMemo(()=>`${d}-01-01 to ${d}-12-31`,[d]);const y=x.useMemo(()=>new Map(o.map(a=>[a.id,a])),[o]),v=x.useMemo(()=>{const a=new Map;for(const s of N){if(!(s!=null&&s.date)||typeof s.date!="string"||!s.date.startsWith(d))continue;const r=s.memberID||"";if(!r)continue;const t=y.get(r),j=(t==null?void 0:t.classNumber)||s.classNumber;if(u!=="all"&&j!==u)continue;const p=a.get(r)||{memberId:r,memberName:(t==null?void 0:t.name)||s.memberName||"Unknown Member",memberNumber:t==null?void 0:t.memberNumber,classNumber:j,total:0,entries:[],serial:$(r,d),quarterlyBreakdown:{"Jan-Mar":0,"Apr-Jun":0,"Jul-Sep":0,"Oct-Dec":0},categoriesBreakdown:{}};p.total+=s.amount,p.entries.push(s);const m=parseInt(s.date.substring(5,7),10);m>=1&&m<=3?p.quarterlyBreakdown["Jan-Mar"]+=s.amount:m>=4&&m<=6?p.quarterlyBreakdown["Apr-Jun"]+=s.amount:m>=7&&m<=9?p.quarterlyBreakdown["Jul-Sep"]+=s.amount:m>=10&&m<=12&&(p.quarterlyBreakdown["Oct-Dec"]+=s.amount);const h=s.type.replace(/-/g," ").replace(/\b\w/g,g=>g.toUpperCase());p.categoriesBreakdown[h]=(p.categoriesBreakdown[h]||0)+s.amount,a.set(r,p)}return Array.from(a.values()).filter(s=>s.total>=f).sort((s,r)=>s.classNumber&&r.classNumber&&s.classNumber!==r.classNumber?s.classNumber.localeCompare(r.classNumber):s.memberName.localeCompare(r.memberName))},[N,y,f,u,d]),D=()=>window.print(),I=l.orgName||"Ghana Methodist Church of Toronto",O=l.orgAddress||"69 Milvan Drive, Toronto, ON M9L 1Y8, Canada",T=l.orgPhone||"416-901-5900";l.orgEmail;const E=l.charityNumber||"873990964RP0001";return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-wrap justify-between gap-4 items-end no-print",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-3xl font-extrabold text-slate-900",children:"Annual Tax Receipts"}),e.jsxs("p",{className:"text-slate-600",children:["Generate CRA/charity receipts per member (≥ $",f.toFixed(0),") for ",d,"."]})]}),e.jsx("div",{className:"flex gap-2",children:e.jsx("button",{onClick:D,className:"px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow",children:"Print / Save PDF"})})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow border border-slate-200 no-print",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Year"}),e.jsx("select",{value:d,onChange:a=>b(a.target.value),className:"w-full border-slate-300 rounded-lg shadow-sm",children:M.map(a=>e.jsx("option",{value:a,children:a},a))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Class"}),e.jsx("select",{value:u,onChange:a=>C(a.target.value),className:"w-full border-slate-300 rounded-lg shadow-sm",children:S.map(a=>e.jsx("option",{value:a,children:a==="all"?"All Classes":`Class ${a}`},a))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Min Amount"}),e.jsx("input",{type:"number",value:f,onChange:a=>k(Number(a.target.value)||0),className:"w-full border-slate-300 rounded-lg shadow-sm",min:0,step:5})]}),e.jsx("div",{className:"text-sm text-slate-600 flex items-end",children:e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-lg p-3 w-full",children:[e.jsx("div",{className:"font-bold text-slate-800",children:"Ready Receipts"}),e.jsx("div",{className:"text-lg font-extrabold text-indigo-700",children:v.length}),e.jsx("div",{className:"text-xs text-slate-500",children:"Members meeting threshold"})]})})]}),v.length===0?e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 no-print",children:["No members meet the criteria for ",d,". Adjust filters or threshold."]}):e.jsx("div",{className:"space-y-4 print-receipts",children:v.map(a=>{const s=y.get(a.memberId),r=(s==null?void 0:s.address)||"",t=!!(r&&r.trim().length>0),j=Object.entries(a.categoriesBreakdown).sort((h,g)=>g[1]-h[1]),p=new Date().toISOString().split("T")[0],m=({copyLabel:h})=>e.jsxs("div",{className:"p-2",children:[e.jsxs("div",{className:"text-center mb-2 pb-1 border-b border-slate-300",children:[e.jsx("h2",{className:"text-sm font-extrabold text-slate-900",children:"OFFICIAL RECEIPT FOR INCOME TAX PURPOSES"}),e.jsxs("p",{className:"text-[9px] text-slate-600",children:["Receipt No: ",a.serial," | Tax Year: ",d]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 mb-2 text-[10px]",children:[e.jsxs("div",{children:[e.jsx("div",{className:"font-bold text-[9px] uppercase text-slate-500 mb-0.5",children:"Charity"}),e.jsxs("div",{className:"text-[10px]",children:[e.jsx("p",{className:"font-bold text-slate-900 text-sm",children:I}),e.jsx("p",{className:"text-slate-700",children:O}),e.jsxs("p",{className:"text-slate-600",children:["Phone: ",T]}),e.jsxs("p",{className:"font-mono font-bold text-slate-800",children:["BN: ",E]})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"font-bold text-[9px] uppercase text-slate-500 mb-0.5",children:"Donor"}),e.jsxs("div",{className:"flex justify-between items-start gap-2",children:[e.jsxs("div",{className:"text-[10px] flex-1",children:[e.jsx("p",{className:"font-bold text-slate-900",children:a.memberName.toUpperCase()}),e.jsxs("p",{className:"text-slate-600",children:["ID: ",a.memberNumber||a.memberId.substring(0,8)]}),e.jsx("p",{className:`text-[10px] ${t?"text-slate-700":"text-red-700 font-bold"}`,children:t?r:"No official address on file — receipt is not official"}),e.jsxs("p",{className:"text-slate-600",children:["Issue Date: ",p]})]}),e.jsx("div",{className:"flex-shrink-0",children:e.jsx(F,{serial:a.serial})})]})]})]}),e.jsxs("div",{className:"mt-2 flex justify-between items-center",children:[e.jsxs("div",{className:"text-[9px]",children:[l.signatureImage&&e.jsx("img",{src:l.signatureImage,alt:"Signature",className:"h-8 object-contain mb-1"}),e.jsx("div",{className:"font-bold text-slate-900",children:"Peggy Asary, Treasurer"})]}),e.jsxs("div",{className:"bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded p-2 text-center",children:[e.jsx("div",{className:"text-[9px] text-slate-600 uppercase font-bold",children:"Total Eligible Amount"}),e.jsx("div",{className:"text-2xl font-extrabold text-green-700",children:w(a.total,l.currency||"CAD")}),e.jsx("div",{className:"text-[9px] text-slate-600",children:l.currency||"CAD"})]})]})]});return e.jsxs("div",{className:`bg-white rounded-lg shadow-lg border-2 p-2 receipt-card ${t?"border-slate-300":"border-red-300 bg-red-50/40"}`,children:[!t&&e.jsx("div",{className:"mb-2 rounded border border-red-300 bg-red-50 text-red-700 text-[9px] font-extrabold uppercase tracking-wide px-2 py-1 text-center",children:"NOTE: NOT OFFICIAL — Missing donor address. Update member profile with the official mailing address before issuing this receipt."}),!t&&e.jsx("div",{className:"pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 print:opacity-100",children:e.jsx("span",{className:"transform rotate-45 border-2 border-red-500 px-8 py-2 text-[28px] font-black uppercase tracking-[0.25em] text-red-500/90",children:"Not Official"})}),e.jsx(m,{copyLabel:"CRA Copy - Official Tax Receipt"}),e.jsx("div",{className:"border-t-2 border-dashed border-slate-400 my-2 relative",children:e.jsx("div",{className:"absolute left-0 right-0 -top-2 text-center",children:e.jsx("span",{className:"bg-white px-2 text-[8px] text-slate-500",children:"✂ Cut Here"})})}),e.jsx(m,{copyLabel:"Donor Copy - Official Tax Receipt"}),e.jsx("div",{className:"border-t-2 border-dashed border-slate-400 my-2 relative",children:e.jsx("div",{className:"absolute left-0 right-0 -top-2 text-center",children:e.jsx("span",{className:"bg-white px-2 text-[8px] text-slate-500",children:"✂ Cut Here"})})}),e.jsxs("div",{className:"p-2",children:[e.jsxs("div",{className:"text-center mb-2 pb-1 border-b border-slate-300",children:[e.jsx("div",{className:"bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-widest py-0.5 px-2 inline-block rounded mb-0.5",children:"Detailed Breakdown"}),e.jsxs("p",{className:"text-[10px] text-slate-700",children:["For: ",a.memberName," | Receipt No: ",a.serial]})]}),e.jsxs("div",{className:"mb-2",children:[e.jsx("div",{className:"text-[9px] uppercase text-slate-500 font-bold mb-1",children:"Donation Categories"}),e.jsx("div",{className:"bg-white rounded border border-slate-300 overflow-hidden",children:e.jsxs("table",{className:"w-full text-[10px]",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-slate-700 text-white",children:[e.jsx("th",{className:"text-left px-2 py-1 font-bold border-r border-slate-600",children:"#"}),e.jsx("th",{className:"text-left px-2 py-1 font-bold border-r border-slate-600",children:"Category"}),e.jsx("th",{className:"text-right px-2 py-1 font-bold",children:"Amount"})]})}),e.jsxs("tbody",{children:[j.map(([h,g],A)=>e.jsxs("tr",{className:A%2===0?"bg-slate-50":"bg-white",children:[e.jsx("td",{className:"px-2 py-1 border-r border-slate-200 text-slate-600",children:A+1}),e.jsx("td",{className:"px-2 py-1 border-r border-slate-200 text-slate-800",children:h}),e.jsx("td",{className:"px-2 py-1 text-right font-bold text-slate-900",children:w(g,l.currency||"CAD")})]},h)),e.jsxs("tr",{className:"bg-green-100 border-t-2 border-green-400",children:[e.jsx("td",{colSpan:2,className:"px-2 py-1 font-bold text-slate-900 border-r border-green-300",children:"TOTAL"}),e.jsx("td",{className:"px-2 py-1 text-right font-extrabold text-green-800",children:w(a.total,l.currency||"CAD")})]})]})]})})]}),e.jsx("div",{className:"mt-2 text-center text-[8px] text-slate-400",children:e.jsxs("span",{children:["Auto-generated: ",new Date().toISOString()]})})]})]},a.memberId)})}),e.jsx("style",{children:`@media print {
                    @page {
                        size: letter;
                        margin: 0.3in 0.4in;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    /* Hide app header, navigation, and all controls */
                    header, nav, .header, .navigation, .navbar, .sidebar,
                    .no-print, button, select, input, label {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    /* Hide everything except receipts */
                    body > *:not(.print-receipts):not(style) {
                        display: none !important;
                    }
                    
                    /* Show only receipts container */
                    .print-receipts, .print-receipts * {
                        display: block !important;
                        visibility: visible !important;
                    }
                    
                    /* Force one receipt per page with tight fit */
                    .receipt-card {
                        position: relative !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-before: auto !important;
                        margin: 0 !important;
                        padding: 0.25in !important;
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        max-height: 10in !important;
                        overflow: hidden !important;
                        transform: scale(0.95);
                        transform-origin: top left;
                    }

                    .receipt-card .absolute {
                        position: absolute !important;
                    }

                    .receipt-card .pointer-events-none {
                        pointer-events: none !important;
                    }

                    .receipt-card .opacity-30 {
                        opacity: 0.30 !important;
                    }

                    .receipt-card .print:opacity-100 {
                        opacity: 1 !important;
                    }
                    
                    .receipt-card:first-child {
                        page-break-before: avoid !important;
                    }
                    
                    .receipt-card:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    
                    /* Remove all spacing between receipts */
                    .space-y-4, .space-y-6 {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .space-y-4 > *, .space-y-6 > * {
                        margin: 0 !important;
                    }
                    
                    /* Ensure compact layout for print */
                    .receipt-card * {
                        max-width: 100% !important;
                    }
                    
                    /* Make table text smaller if needed */
                    table {
                        font-size: 10px !important;
                    }
                }`})]})};export{H as default};
