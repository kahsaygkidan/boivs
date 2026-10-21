import { useMemo, useRef, useState } from "react";

/* ---------- tree helpers ---------- */
const mapNode = (n, id, fn) =>
  n.id === id ? fn(n) : { ...n, children: n.children.map((c) => mapNode(c, id, fn)) };
const dropNode = (n, id) => ({
  ...n,
  children: n.children.filter((c) => c.id !== id).map((c) => dropNode(c, id)),
});

// Walk the tree: effective % = product of every % along the chain.
function collect(node, mult = 1, chain = [], out = { ubos: [], open: [], over: [] }) {
  const eff = mult * (node.pct / 100);
  const path = [...chain, node.name || "Unnamed"];
  if (node.type === "person") out.ubos.push({ node, eff: eff * 100, path });
  else if (node.children.length === 0) out.open.push(node);
  if (node.children.reduce((s, c) => s + Number(c.pct || 0), 0) > 100) out.over.push(node);
  node.children.forEach((c) => collect(c, eff, path, out));
  return out;
}

const initial = {
  id: "root", name: "ABC Manufacturing PLC", type: "company", pct: 100,
  children: [
    { id: "n1", name: "XYZ Holdings Ltd", type: "company", pct: 60,
      children: [{ id: "n2", name: "Mr. A", type: "person", pct: 70, children: [], control: false }] },
    { id: "n3", name: "Mr. B", type: "person", pct: 40, children: [], control: false },
  ],
};

/* ---------- small UI parts ---------- */
const Chip = ({ tone = "gray", children }) => {
  const t = {
    gray: "bg-[#E6EAF2] text-[#2A3550]",
    green: "bg-[#DDF3E6] text-[#14532D]",
    amber: "bg-[#FDEBC8] text-[#6B3F05]",
    red: "bg-[#FBE0E0] text-[#7A1A1A]",
  }[tone];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
};

const field = "min-h-[44px] w-full rounded-lg border border-[#B9C0CE] bg-white px-3 text-[#1A1F2B] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]";
const btn = "min-h-[44px] rounded-lg border border-[#B9C0CE] bg-white px-4 text-sm font-semibold text-[#1A1F2B] hover:bg-[#F4F5F8] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]";

/* ---------- recursive tree row ---------- */
function NodeRow({ node, parentMult, depth, ctx }) {
  const eff = parentMult * (node.pct / 100) * 100;
  const isRoot = node.id === "root";
  const isUbo = node.type === "person" && (eff >= ctx.threshold || node.control);
  const unresolved = node.type === "company" && node.children.length === 0;

  return (
    <div style={{ marginLeft: depth ? 24 : 0 }} className="flex flex-col gap-2">
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 ${isUbo ? "border-[#14532D]" : unresolved ? "border-[#B7791F]" : "border-[#DDE1E8]"}`}>
        <input aria-label="Name" className={`${field} min-w-[160px] flex-1`} value={node.name}
          onChange={(e) => ctx.edit(node.id, { name: e.target.value })} />
        {!isRoot && (
          <select aria-label="Type" className={`${field} w-auto`} value={node.type}
            onChange={(e) => ctx.edit(node.id, { type: e.target.value })}>
            <option value="company">Company</option>
            <option value="person">Natural person</option>
          </select>
        )}
        {!isRoot && (
          <label className="flex items-center gap-1 text-sm text-[#566075]">
            <input aria-label="Percent of parent" type="number" min="0" max="100" className={`${field} w-20`}
              value={node.pct} onChange={(e) => ctx.edit(node.id, { pct: Number(e.target.value) })} />
            % of parent
          </label>
        )}
        {!isRoot && <span className="text-sm text-[#566075]">{eff.toFixed(1)}% effective</span>}
        {node.type === "person" && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-[#566075]">
            <input type="checkbox" checked={!!node.control} onChange={(e) => ctx.edit(node.id, { control: e.target.checked })} />
            Has control rights
          </label>
        )}
        {isUbo && <Chip tone="green">UBO</Chip>}
        {unresolved && <Chip tone="amber">Trace owners</Chip>}
        <div className="ml-auto flex gap-2">
          {node.type === "company" && <button className={btn} onClick={() => ctx.add(node.id)}>Add owner</button>}
          {!isRoot && <button className={btn} aria-label={`Remove ${node.name}`} onClick={() => ctx.remove(node.id)}>Remove</button>}
        </div>
      </div>
      {node.children.map((c) => (
        <NodeRow key={c.id} node={c} parentMult={parentMult * (node.pct / 100)} depth={depth + 1} ctx={ctx} />
      ))}
    </div>
  );
}

/* ---------- verification panel ---------- */
function VerifyPanel({ ubo, data, onChange, onClose }) {
  const d = data || {};
  const ready = d.dob && d.idDoc && d.address && d.pep && d.sanctions;
  const text = (k, label, ph) => (
    <div>
      <label htmlFor={k} className="mb-1 block text-sm text-[#566075]">{label}</label>
      <input id={k} className={field} placeholder={ph} value={d[k] || ""} onChange={(e) => onChange({ [k]: e.target.value, verified: false })} />
    </div>
  );
  return (
    <section className="rounded-xl border border-[#DDE1E8] bg-white p-5" aria-label={`Verify ${ubo.node.name}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Verify {ubo.node.name}</h3>
        <button className={btn} onClick={onClose}>Close</button>
      </div>
      <p className="mb-4 text-sm text-[#566075]">{ubo.eff.toFixed(1)}% effective: {ubo.path.join(" → ")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("dob", "Date of birth", "DD/MM/YYYY")}
        {text("idDoc", "ID or passport reference", "Verified document")}
        <div className="sm:col-span-2">{text("address", "Residential address", "Address")}</div>
        {text("sow", "Source of wealth (where required)", "")}
        {text("sof", "Source of funds (where required)", "")}
      </div>
      <div className="mt-4 flex flex-wrap gap-6">
        {[["pep", "PEP screening done"], ["sanctions", "Sanctions screening done"]].map(([k, l]) => (
          <label key={k} className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" checked={!!d[k]} onChange={(e) => onChange({ [k]: e.target.checked, verified: false })} />
            {l}
          </label>
        ))}
      </div>
      <button disabled={!ready} onClick={() => onChange({ verified: true })}
        className="mt-4 min-h-[44px] rounded-lg bg-[#1F3A5F] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1F3A5F]">
        Mark as verified
      </button>
      {!ready && <p className="mt-2 text-sm text-[#566075]">Complete identity fields and both screenings first.</p>}
    </section>
  );
}

/* ---------- main module ---------- */
export default function UboModule() {
  const [root, setRoot] = useState(initial);
  const [threshold, setThreshold] = useState(25);
  const [selected, setSelected] = useState(null);
  const [checks, setChecks] = useState({});
  const [smo, setSmo] = useState({ name: "", capacity: "" });
  const [submitted, setSubmitted] = useState(false);
  const seq = useRef(10);

  const ctx = {
    threshold,
    edit: (id, patch) => setRoot((r) => mapNode(r, id, (n) => ({ ...n, ...patch }))),
    add: (id) => setRoot((r) => mapNode(r, id, (n) => ({
      ...n, children: [...n.children, { id: `n${++seq.current}`, name: "New owner", type: "person", pct: 0, children: [], control: false }],
    }))),
    remove: (id) => setRoot((r) => dropNode(r, id)),
  };

  const { ubos, open, over } = useMemo(() => collect(root), [root]);
  const uboList = ubos.filter((u) => u.eff >= threshold || u.node.control);
  const needsFallback = open.length === 0 && uboList.length === 0;
  const unverified = uboList.filter((u) => !checks[u.node.id]?.verified);

  const blockers = [
    open.length > 0 && `${open.length} company branch(es) not traced to a natural person`,
    over.length > 0 && "Shareholdings under one company add up to more than 100%",
    needsFallback && !(smo.name && smo.capacity) && "No UBO found: record a senior managing official and capacity",
    unverified.length > 0 && `${unverified.length} UBO(s) not verified`,
  ].filter(Boolean);

  const sel = uboList.find((u) => u.node.id === selected);

  return (
    <div className="min-h-screen bg-[#F4F5F8] p-6 font-sans text-[#1A1F2B]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[#566075]">KYC / Customers / {root.name}</p>
            <h1 className="text-2xl font-semibold">Beneficial ownership</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#566075]">
              Ownership threshold %
              <input type="number" min="1" max="100" className={`${field} w-20`} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))} />
            </label>
            <button disabled={blockers.length > 0} onClick={() => setSubmitted(true)}
              className="min-h-[44px] rounded-lg bg-[#1F3A5F] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1F3A5F]">
              Submit for approval
            </button>
          </div>
        </header>

        {submitted && <div role="status" className="rounded-lg bg-[#DDF3E6] p-3 text-sm text-[#14532D]">Submitted for approval.</div>}

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <section className="flex flex-col gap-3 rounded-xl border border-[#DDE1E8] bg-white p-5">
            <h2 className="text-lg font-semibold">Ownership tree</h2>
            <NodeRow node={root} parentMult={1} depth={0} ctx={ctx} />
          </section>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2 rounded-xl border border-[#DDE1E8] bg-white p-5">
              <h2 className="text-lg font-semibold">Identified UBOs</h2>
              {uboList.length === 0 && <p className="text-sm text-[#566075]">None yet. Trace each company to its owners.</p>}
              {uboList.map((u) => (
                <div key={u.node.id} className="flex items-center gap-3 rounded-lg border border-[#DDE1E8] p-3">
                  <div className="flex-1">
                    <p className="font-semibold">{u.node.name}: {u.eff.toFixed(1)}%{u.path.length > 2 ? " indirect" : ""}</p>
                    <p className="text-sm text-[#566075]">{u.path.join(" → ")}</p>
                  </div>
                  {checks[u.node.id]?.verified ? <Chip tone="green">Verified</Chip> : <Chip tone="amber">Pending</Chip>}
                  <button className={btn} onClick={() => setSelected(u.node.id)}>Verify</button>
                </div>
              ))}
            </section>

            {needsFallback && (
              <section className="flex flex-col gap-3 rounded-xl border border-[#B7791F] bg-white p-5">
                <h2 className="text-lg font-semibold">Senior managing official</h2>
                <p className="text-sm text-[#566075]">Use only after reasonable measures found no controlling person. This is not a UBO.</p>
                <input aria-label="Official name" className={field} placeholder="Name" value={smo.name} onChange={(e) => setSmo({ ...smo, name: e.target.value })} />
                <input aria-label="Capacity" className={field} placeholder="Capacity, e.g. CEO" value={smo.capacity} onChange={(e) => setSmo({ ...smo, capacity: e.target.value })} />
              </section>
            )}

            <section className="rounded-xl border border-[#DDE1E8] bg-white p-5">
              <h2 className="mb-2 text-lg font-semibold">Before you submit</h2>
              {blockers.length === 0 ? <Chip tone="green">All checks passed</Chip> : (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-[#7A1A1A]">
                  {blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          </div>
        </div>

        {sel && (
          <VerifyPanel ubo={sel} data={checks[sel.node.id]} onClose={() => setSelected(null)}
            onChange={(patch) => setChecks((c) => ({ ...c, [sel.node.id]: { ...c[sel.node.id], ...patch } }))} />
        )}
      </div>
    </div>
  );
}
