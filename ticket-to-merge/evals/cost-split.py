# Split one ship-ticket stream-json run into cost per stage (build / review / fix) and per agent.
# Stage = the phase the orchestrator last set (test, implement -> build; review -> review; anything after the
# first review -> fix). Messages are deduped by id. Tokens are weighted by the standard price ratios
# (input 1, output 5, cache read 0.1, cache write 1.25 / 2) and scaled to each model's reported cost.
import json, sys, collections, re
agents = {}; msgs = collections.OrderedDict(); result = None
for l in open(sys.argv[1]):
    try: e = json.loads(l)
    except: continue
    if e.get('type') == 'result': result = e
    if e.get('type') != 'assistant': continue
    m = e['message']
    phase = None
    for c in m.get('content', []):
        if c.get('type') == 'tool_use':
            if c.get('name') in ('Agent', 'Task'): agents[c['id']] = c['input'].get('subagent_type', '?').split(':')[-1]
            if c.get('name') == 'Bash':
                g = re.search(r'phase\.mjs"?\s+(\w+)', c['input'].get('command', ''))
                if g: phase = g.group(1)
    prev = msgs.get(m['id'])
    msgs[m['id']] = dict(parent=e.get('parent_tool_use_id'), u=m.get('usage', {}), model=m.get('model'), phase=phase or (prev and prev['phase']))
def toks(u):
    cc = u.get('cache_creation') or {}
    cw1 = cc.get('ephemeral_1h_input_tokens', 0); cw5 = cc.get('ephemeral_5m_input_tokens', u.get('cache_creation_input_tokens', 0) - cw1)
    return dict(inp=u.get('input_tokens', 0), out=u.get('output_tokens', 0), cr=u.get('cache_read_input_tokens', 0), cw5=cw5, cw1=cw1)
w = lambda t: t['inp'] + 5*t['out'] + 0.1*t['cr'] + 1.25*t['cw5'] + 2*t['cw1']
stage, reviewed = 'build', False
rows = collections.OrderedDict()
agent_stage = {}
for mid, m in msgs.items():
    if not m['parent']:
        if m['phase'] == 'review': stage, reviewed = 'review', True
        elif m['phase'] in ('test', 'implement'): stage = 'fix' if reviewed else 'build'
        who = 'orchestrator'; st = stage
    else:
        who = agents.get(m['parent'], '?'); st = agent_stage.setdefault(m['parent'], stage)
    r = rows.setdefault((st, who, m['model']), collections.Counter()); r.update(toks(m['u']))
bymodel = collections.Counter()
for (st, who, model), t in rows.items(): bymodel[model] += w(t)
cost = {k: v['costUSD'] for k, v in result['modelUsage'].items()}
def price(model, t):
    key = next((k for k in cost if k in (model or '') or (model or '') in k), None)
    return cost.get(key, 0) * w(t) / bymodel[model] if bymodel[model] else 0
print(f"total ${result['total_cost_usd']:.2f}  by model: " + ", ".join(f"{k} ${v:.2f}" for k, v in cost.items()))
stages = collections.OrderedDict()
for (st, who, model), t in rows.items():
    c = price(model, t); allin = t['inp'] + t['cr'] + t['cw5'] + t['cw1']
    print(f"  {st:7s} {who:20s} {model:22s} ${c:.3f}  cache-hit {100*t['cr']/max(allin,1):3.0f}%")
    s = stages.setdefault(st, dict(c=0, cr=0, allin=0, models=set())); s['c'] += c; s['cr'] += t['cr']; s['allin'] += allin; s['models'].add(model)
for st, s in stages.items():
    print(f"STAGE {st:7s} ${s['c']:.2f}  cache-hit {100*s['cr']/max(s['allin'],1):.0f}%  models {', '.join(sorted(s['models']))}")
