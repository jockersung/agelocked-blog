"""Approved two-track visual system; independent of image providers or billing."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]

def load_profiles(root=None):
    path=Path(root or ROOT)/'config/style_profiles.yaml'
    if not path.exists():return None
    config=yaml.safe_load(path.read_text(encoding='utf-8'))
    if not isinstance(config,dict) or set(config.get('profiles',{}))!={'warm_editorial','minimal_infographic'}:
        raise ValueError('INVALID_STYLE_PROFILE_CONFIG')
    return config

def select_profile(task, config=None):
    config=config or load_profiles()
    if not config:return None
    explicit=task.get('style_profile')
    if explicit and explicit not in config['profiles']:raise ValueError('UNKNOWN_STYLE_PROFILE')
    if task.get('type')=='C':
        if explicit and explicit!='minimal_infographic':raise ValueError('CHART_STYLE_MUST_BE_INFOGRAPHIC')
        return 'minimal_infographic'
    if explicit:return explicit
    if task.get('type') in {'A','D'}:return 'warm_editorial'
    kind=task.get('visual_kind','').lower()
    if kind in {'workflow','comparison','worksheet','units','chart','infographic'}:return 'minimal_infographic'
    if kind in {'scene','anatomy','ingredients','illustration','mechanism'}:return 'warm_editorial'
    # Classify by the actual task, not unrelated style boilerplate in Excel prompts.
    text=' '.join(str(task.get(k,'')) for k in ['filename','action','subject']) .lower()
    return 'minimal_infographic' if any(k.lower() in text for k in config['diagram_keywords']) else 'warm_editorial'

def profile_anchors(task, root, styles):
    config=load_profiles(root)
    if not config:return styles.get('product_anchors' if task.get('type')=='D' else 'general_anchors',[])
    if task.get('type')=='D':return list(dict.fromkeys(styles.get('product_anchors',[])+config['product_background_anchors']))
    return config['profiles'][select_profile(task,config)]['anchors']

def apply_profile(task, prompt, root=None):
    config=load_profiles(root)
    if not config:return prompt
    profile=select_profile(task,config)
    if task.get('type')=='C' or task.get('reuse_of'):raise ValueError('TASK_DOES_NOT_USE_GENERATIVE_IMAGE_API')
    parts=[prompt,'APPROVED VISUAL STYLE OVERRIDE (visual presentation only; do not change the subject, science, data or composition requirements):\n'+config['profiles'][profile]['guidance']]
    if task['type']=='D':
        parts.append('PRODUCT SAFETY: Style ONLY the permitted background. Never redraw, stretch, invent or relabel packaging. Preserve verified official or explicitly approved product artwork in a separate composition step.')
    elif task['type']=='A':
        parts.append('COVER: Only the complete requested article title may be added as a large headline, maximum two lines; no extra slogans or labels.')
    else:
        parts.append('BODY FIGURE: Keep all necessary original scientific names, explanatory labels, units, axes and legends accurate. Never leave blank label boxes. Do not add an article headline or invent numerical data.')
    parts.append('Use the supplied approved references for color, texture and typography; keep characters and line/shadow choices consistent within the same article.')
    return '\n\n'.join(parts)
