import{g as B,j as e,f as y}from"./index-Dsn-kzhU.js";import{r as x}from"./react-AIrFsuJV.js";import"./supabase-BeVaYiBZ.js";import"./recharts-BWiuoP76.js";const O=l=>{let n=0;for(let o=0;o<l.length;o++)n=(n<<5)-n+l.charCodeAt(o),n|=0;return Math.abs(n)},E=(l,n)=>{const o=`${n}-${l}`,r=O(o).toString().padStart(8,"0");return`${n}-${l.slice(0,4).toUpperCase()}-${r.slice(-4)}`},P=({serial:l})=>{const n=x.useMemo(()=>{const d=l+"-barcode";return Array.from(d).map(p=>p.charCodeAt(0)).map((p,b)=>({width:2+p%4,height:30+p%20,odd:b%2===0}))},[l]);let o=0;const r=n.map((d,i)=>{const p=e.jsx("rect",{x:o,y:50-d.height,width:d.width,height:d.height,fill:d.odd?"#111827":"#4b5563"},i);return o+=d.width+1,p});return e.jsxs("svg",{width:o,height:60,"aria-label":`Barcode ${l}`,className:"mt-2",children:[r,e.jsx("text",{x:o/2,y:58,textAnchor:"middle",fontSize:"8",fill:"#374151",fontFamily:"monospace",children:l})]})},L=({entries:l,harvestEntries:n,members:o,settings:r})=>{const d=new Date().getFullYear().toString(),[i,p]=x.useState(d),[b,C]=x.useState("all"),[g,A]=x.useState(20),k=x.useMemo(()=>["all",...Array.from({length:r.maxClasses},(a,t)=>String(t+1))],[r.maxClasses]),N=x.useMemo(()=>{const a=n.map(t=>({id:t.id,date:t.date,memberID:t.memberID,memberName:t.memberName,classNumber:t.classNumber,type:"harvest-levy",fund:"harvest levy",method:"other",amount:t.amount,note:t.note,createdAt:t.createdAt,deleted:t.deleted}));return[...l,...a].filter(t=>!t.deleted).map(t=>({...t,type:B(t.type)}))},[l,n]),S=x.useMemo(()=>{const a=new Set;return N.forEach(t=>{t.date&&a.add(t.date.substring(0,4))}),a.has(d)||a.add(d),Array.from(a).sort((t,s)=>s.localeCompare(t))},[N,d]);x.useMemo(()=>`${i}-01-01 to ${i}-12-31`,[i]);const j=x.useMemo(()=>new Map(o.map(a=>[a.id,a])),[o]),v=x.useMemo(()=>{const a=new Map;for(const t of N){if(!t.date.startsWith(i))continue;const s=j.get(t.memberID),f=(s==null?void 0:s.classNumber)||t.classNumber;if(b!=="all"&&f!==b)continue;const c=a.get(t.memberID)||{memberId:t.memberID,memberName:(s==null?void 0:s.name)||t.memberName||"Unknown Member",memberNumber:s==null?void 0:s.memberNumber,classNumber:f,total:0,entries:[],serial:E(t.memberID,i),quarterlyBreakdown:{"Jan-Mar":0,"Apr-Jun":0,"Jul-Sep":0,"Oct-Dec":0},categoriesBreakdown:{}};c.total+=t.amount,c.entries.push(t);const m=parseInt(t.date.substring(5,7),10);m>=1&&m<=3?c.quarterlyBreakdown["Jan-Mar"]+=t.amount:m>=4&&m<=6?c.quarterlyBreakdown["Apr-Jun"]+=t.amount:m>=7&&m<=9?c.quarterlyBreakdown["Jul-Sep"]+=t.amount:m>=10&&m<=12&&(c.quarterlyBreakdown["Oct-Dec"]+=t.amount);const h=t.type.replace(/-/g," ").replace(/\b\w/g,u=>u.toUpperCase());c.categoriesBreakdown[h]=(c.categoriesBreakdown[h]||0)+t.amount,a.set(t.memberID,c)}return Array.from(a.values()).filter(t=>t.total>=g).sort((t,s)=>t.classNumber&&s.classNumber&&t.classNumber!==s.classNumber?t.classNumber.localeCompare(s.classNumber):t.memberName.localeCompare(s.memberName))},[N,j,g,b,i]),D=()=>window.print(),I=r.orgName||"Ghana Methodist Church of Toronto",M=r.orgAddress||"69 Milvan Drive, Toronto, ON M9L 1Y8, Canada",R=r.orgPhone||"416-901-5900";r.orgEmail;const T=r.charityNumber||"873990964RP0001";return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-wrap justify-between gap-4 items-end no-print",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-3xl font-extrabold text-slate-900",children:"Annual Tax Receipts"}),e.jsxs("p",{className:"text-slate-600",children:["Generate CRA/charity receipts per member (≥ $",g.toFixed(0),") for ",i,"."]})]}),e.jsx("div",{className:"flex gap-2",children:e.jsx("button",{onClick:D,className:"px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow",children:"Print / Save PDF"})})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow border border-slate-200 no-print",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Year"}),e.jsx("select",{value:i,onChange:a=>p(a.target.value),className:"w-full border-slate-300 rounded-lg shadow-sm",children:S.map(a=>e.jsx("option",{value:a,children:a},a))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Class"}),e.jsx("select",{value:b,onChange:a=>C(a.target.value),className:"w-full border-slate-300 rounded-lg shadow-sm",children:k.map(a=>e.jsx("option",{value:a,children:a==="all"?"All Classes":`Class ${a}`},a))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-xs font-bold text-slate-500 uppercase mb-1",children:"Min Amount"}),e.jsx("input",{type:"number",value:g,onChange:a=>A(Number(a.target.value)||0),className:"w-full border-slate-300 rounded-lg shadow-sm",min:0,step:5})]}),e.jsx("div",{className:"text-sm text-slate-600 flex items-end",children:e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-lg p-3 w-full",children:[e.jsx("div",{className:"font-bold text-slate-800",children:"Ready Receipts"}),e.jsx("div",{className:"text-lg font-extrabold text-indigo-700",children:v.length}),e.jsx("div",{className:"text-xs text-slate-500",children:"Members meeting threshold"})]})})]}),v.length===0?e.jsxs("div",{className:"bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 no-print",children:["No members meet the criteria for ",i,". Adjust filters or threshold."]}):e.jsx("div",{className:"space-y-4 print-receipts",children:v.map(a=>{const t=j.get(a.memberId),s=(t==null?void 0:t.address)||"",f=Object.entries(a.categoriesBreakdown).sort((h,u)=>u[1]-h[1]),c=new Date().toISOString().split("T")[0],m=({copyLabel:h})=>e.jsxs("div",{className:"p-2",children:[e.jsxs("div",{className:"text-center mb-2 pb-1 border-b border-slate-300",children:[e.jsx("h2",{className:"text-sm font-extrabold text-slate-900",children:"OFFICIAL RECEIPT FOR INCOME TAX PURPOSES"}),e.jsxs("p",{className:"text-[9px] text-slate-600",children:["Receipt No: ",a.serial," | Tax Year: ",i]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 mb-2 text-[10px]",children:[e.jsxs("div",{children:[e.jsx("div",{className:"font-bold text-[9px] uppercase text-slate-500 mb-0.5",children:"Charity"}),e.jsxs("div",{className:"text-[10px]",children:[e.jsx("p",{className:"font-bold text-slate-900 text-sm",children:I}),e.jsx("p",{className:"text-slate-700",children:M}),e.jsxs("p",{className:"text-slate-600",children:["Phone: ",R]}),e.jsxs("p",{className:"font-mono font-bold text-slate-800",children:["BN: ",T]})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"font-bold text-[9px] uppercase text-slate-500 mb-0.5",children:"Donor"}),e.jsxs("div",{className:"flex justify-between items-start gap-2",children:[e.jsxs("div",{className:"text-[10px] flex-1",children:[e.jsx("p",{className:"font-bold text-slate-900",children:a.memberName.toUpperCase()}),e.jsxs("p",{className:"text-slate-600",children:["ID: ",a.memberNumber||a.memberId.substring(0,8)]}),e.jsx("p",{className:"text-slate-700 text-[10px]",children:s||"No address on file"}),e.jsxs("p",{className:"text-slate-600",children:["Issue Date: ",c]})]}),e.jsx("div",{className:"flex-shrink-0",children:e.jsx(P,{serial:a.serial})})]})]})]}),e.jsxs("div",{className:"mt-2 flex justify-between items-center",children:[e.jsxs("div",{className:"text-[9px]",children:[r.signatureImage&&e.jsx("img",{src:r.signatureImage,alt:"Signature",className:"h-8 object-contain mb-1"}),e.jsx("div",{className:"font-bold text-slate-900",children:"Peggy Asary, Treasurer"})]}),e.jsxs("div",{className:"bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded p-2 text-center",children:[e.jsx("div",{className:"text-[9px] text-slate-600 uppercase font-bold",children:"Total Eligible Amount"}),e.jsx("div",{className:"text-2xl font-extrabold text-green-700",children:y(a.total,r.currency||"CAD")}),e.jsx("div",{className:"text-[9px] text-slate-600",children:r.currency||"CAD"})]})]})]});return e.jsxs("div",{className:"bg-white rounded-lg shadow-lg border-2 border-slate-300 p-2 receipt-card",children:[e.jsx(m,{copyLabel:"CRA Copy - Official Tax Receipt"}),e.jsx("div",{className:"border-t-2 border-dashed border-slate-400 my-2 relative",children:e.jsx("div",{className:"absolute left-0 right-0 -top-2 text-center",children:e.jsx("span",{className:"bg-white px-2 text-[8px] text-slate-500",children:"✂ Cut Here"})})}),e.jsx(m,{copyLabel:"Donor Copy - Official Tax Receipt"}),e.jsx("div",{className:"border-t-2 border-dashed border-slate-400 my-2 relative",children:e.jsx("div",{className:"absolute left-0 right-0 -top-2 text-center",children:e.jsx("span",{className:"bg-white px-2 text-[8px] text-slate-500",children:"✂ Cut Here"})})}),e.jsxs("div",{className:"p-2",children:[e.jsxs("div",{className:"text-center mb-2 pb-1 border-b border-slate-300",children:[e.jsx("div",{className:"bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-widest py-0.5 px-2 inline-block rounded mb-0.5",children:"Detailed Breakdown"}),e.jsxs("p",{className:"text-[10px] text-slate-700",children:["For: ",a.memberName," | Receipt No: ",a.serial]})]}),e.jsxs("div",{className:"mb-2",children:[e.jsx("div",{className:"text-[9px] uppercase text-slate-500 font-bold mb-1",children:"Donation Categories"}),e.jsx("div",{className:"bg-white rounded border border-slate-300 overflow-hidden",children:e.jsxs("table",{className:"w-full text-[10px]",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-slate-700 text-white",children:[e.jsx("th",{className:"text-left px-2 py-1 font-bold border-r border-slate-600",children:"#"}),e.jsx("th",{className:"text-left px-2 py-1 font-bold border-r border-slate-600",children:"Category"}),e.jsx("th",{className:"text-right px-2 py-1 font-bold",children:"Amount"})]})}),e.jsxs("tbody",{children:[f.map(([h,u],w)=>e.jsxs("tr",{className:w%2===0?"bg-slate-50":"bg-white",children:[e.jsx("td",{className:"px-2 py-1 border-r border-slate-200 text-slate-600",children:w+1}),e.jsx("td",{className:"px-2 py-1 border-r border-slate-200 text-slate-800",children:h}),e.jsx("td",{className:"px-2 py-1 text-right font-bold text-slate-900",children:y(u,r.currency||"CAD")})]},h)),e.jsxs("tr",{className:"bg-green-100 border-t-2 border-green-400",children:[e.jsx("td",{colSpan:2,className:"px-2 py-1 font-bold text-slate-900 border-r border-green-300",children:"TOTAL"}),e.jsx("td",{className:"px-2 py-1 text-right font-extrabold text-green-800",children:y(a.total,r.currency||"CAD")})]})]})]})})]}),e.jsxs("div",{className:"bg-yellow-50 border-l-4 border-yellow-400 p-2 text-[9px] text-slate-700",children:[e.jsx("p",{className:"font-bold text-yellow-900",children:"Canada Revenue Agency Information"}),e.jsx("p",{children:"For information on registered charities: www.canada.ca/charities-giving"})]}),e.jsx("div",{className:"mt-2 text-center text-[8px] text-slate-400",children:e.jsxs("span",{children:["Auto-generated: ",new Date().toISOString()]})})]})]},a.memberId)})}),e.jsx("style",{children:`@media print {
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
                }`})]})};export{L as default};
