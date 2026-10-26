import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import yaml
from src.style_profiles import load_profiles,select_profile,profile_anchors
from src.prompt_builder import build_prompt
from src.pipeline import production_fingerprint
from style_tools import migration

ROOT=Path(__file__).resolve().parents[1]
CONFIG=load_profiles(ROOT)
TEMPLATES=yaml.safe_load((ROOT/'config/prompt_templates.yaml').read_text(encoding='utf-8'))
def task(kind='B',name='器官結構.png'):
 return {'id':1,'type':kind,'filename':name,'action':'新產','prompt':'原始主題，不得改成其他疾病。','slug':'example','status':'COMPLETED','article_title':'完整文章標題','references':[]}

class StyleTests(unittest.TestCase):
 def test_cover_is_warm(self):self.assertEqual(select_profile(task('A'),CONFIG),'warm_editorial')
 def test_anatomy_is_warm(self):self.assertEqual(select_profile(task(),CONFIG),'warm_editorial')
 def test_flow_is_minimal(self):self.assertEqual(select_profile(task(name='量測步驟流程.png'),CONFIG),'minimal_infographic')
 def test_explicit_visual_kind(self):
  t=task();t['visual_kind']='worksheet';self.assertEqual(select_profile(t,CONFIG),'minimal_infographic')
 def test_explicit_profile(self):
  t=task();t['style_profile']='minimal_infographic';self.assertEqual(select_profile(t,CONFIG),'minimal_infographic')
 def test_unknown_profile_rejected(self):
  t=task();t['style_profile']='unknown'
  with self.assertRaisesRegex(ValueError,'UNKNOWN_STYLE_PROFILE'):select_profile(t,CONFIG)
 def test_chart_not_generated(self):
  with self.assertRaises(ValueError):build_prompt(task('C'),TEMPLATES)
 def test_chart_cannot_use_warm_profile(self):
  t=task('C');t['style_profile']='warm_editorial'
  with self.assertRaises(ValueError):select_profile(t,CONFIG)
 def test_body_keeps_labels(self):
  p=build_prompt(task(),TEMPLATES,profile_root=ROOT);self.assertIn('Never leave blank label boxes',p);self.assertIn('Do not add an article headline',p);self.assertIn('原始主題',p)
 def test_cover_keeps_title(self):
  p=build_prompt(task('A'),TEMPLATES,profile_root=ROOT);self.assertIn('完整文章標題',p);self.assertIn('TWO lines',p)
 def test_products_only_background(self):
  p=build_prompt(task('D'),TEMPLATES,profile_root=ROOT);self.assertIn('Style ONLY the permitted background',p);self.assertIn('Never redraw, stretch, invent or relabel packaging',p)
 def test_all_five_anchors_present(self):
  paths={p for profile in CONFIG['profiles'].values() for p in profile['anchors']};self.assertEqual(len(paths),5);self.assertTrue(all((ROOT/p).exists()for p in paths))
 def test_missing_config_falls_back(self):
  with tempfile.TemporaryDirectory()as d:self.assertEqual(profile_anchors(task(),d,{'general_anchors':['old.png']}),['old.png'])
 def test_legacy_plan_preserves_input(self):
  tasks=[task()];snapshot=copy.deepcopy(tasks);rows=migration(ROOT,tasks);self.assertEqual(tasks,snapshot);self.assertEqual(rows[0]['current_status'],'COMPLETED');self.assertEqual(rows[0]['migration_status'],'PLANNED_NOT_GENERATED')
 def test_reuse_plan_does_not_request_generation(self):
  t=task();t['reuse_of']=9;row=migration(ROOT,[t])[0];self.assertEqual(row['method'],'reuse_after_source_approved');self.assertIsNone(row['prompt_preview'])
 def test_chart_plan_is_local(self):
  row=migration(ROOT,[task('C')])[0];self.assertEqual(row['method'],'local_redraw_verified_data_only');self.assertIsNone(row['prompt_preview'])
 def test_style_change_invalidates_cost_fingerprint(self):
  s={'model':'m','quality':'medium','api_size':'1536x1024','max_budget_usd':10,'pricing':{},'request_reserve_usd':.25,'style_profiles_sha256':'one'}
  a=production_fingerprint(task(),s);s['style_profiles_sha256']='two';self.assertNotEqual(a,production_fingerprint(task(),s))
