"""Inspect styles or make a legacy migration plan. Never generates or overwrites images."""
import argparse,json,hashlib,html
from pathlib import Path
import yaml
from src.style_profiles import load_profiles,select_profile,profile_anchors
from src.prompt_builder import build_prompt

def migration(root, tasks):
    config=load_profiles(root);templates=yaml.safe_load((root/'config/prompt_templates.yaml').read_text(encoding='utf-8'))
    rows=[]
    for t in tasks:
        profile=select_profile(t,config)
        if t.get('reuse_of'):method='reuse_after_source_approved';prompt=None
        elif t['type']=='C':method='local_redraw_verified_data_only';prompt=None
        elif t['type']=='D':method='background_plus_verified_product_artwork';prompt=build_prompt(t,templates,profile_root=root)
        elif profile=='minimal_infographic':method='editable_native_diagram_preferred';prompt=build_prompt(t,templates,profile_root=root)
        else:method='codex_builtin_illustration_or_reference_edit';prompt=build_prompt(t,templates,profile_root=root)
        rows.append({'id':t['id'],'slug':t['slug'],'filename':t['filename'],'position':t.get('position'),'type':t['type'],'current_status':t['status'],'migration_status':'PLANNED_NOT_GENERATED','style_profile':profile,'method':method,'reuse_of':t.get('reuse_of'),'current_png':t.get('png'),'current_webp':t.get('webp'),'anchors':profile_anchors(t,root,{}),'prompt_preview':prompt,'requirements':['保留原圖與原任務狀態','科學數據與官方包裝不可杜撰','封面完整標題最多兩行；內文只保留必要標籤','新圖審核通過才整合']})
    return rows

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent)
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--inspect',action='store_true');g.add_argument('--plan-legacy',action='store_true');args=p.parse_args();root=args.root.resolve()
    config=load_profiles(root);assert config,'STYLE_PROFILE_CONFIG_MISSING'
    summary={'system':config['name'],'description_zh':config['description_zh'],'profiles':{k:{'name_zh':v['name_zh'],'name_en':v['name_en'],'use_for':v['use_for']}for k,v in config['profiles'].items()},'rules':config['rules'],'paid_api_calls':0,'images_generated':0}
    if args.plan_legacy:
        source=root/'tasks/tasks.json';tasks=json.loads(source.read_text(encoding='utf-8'));assert len(tasks)==221 and len({x['id']for x in tasks})==221,'LEGACY_TASK_COUNT_MISMATCH'
        before=hashlib.sha256(source.read_bytes()).hexdigest();rows=migration(root,tasks);counts={}
        for row in rows:counts[row['method']]=counts.get(row['method'],0)+1
        folder=root/'outputs/reports/style-migration-20261025';folder.mkdir(parents=True,exist_ok=True)
        report={**summary,'task_count':len(rows),'counts':counts,'original_task_sha256':before,'tasks':rows,'note':'只有改版對照；221 張尚未重新製作。成本批准、原圖與數據檢查不會被略過。'}
        (folder/'plan.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        trs=''.join(f'<tr><td>{x["id"]}</td><td>{html.escape(x["slug"])}</td><td>{html.escape(x["filename"])}</td><td>{html.escape(x["style_profile"])}</td><td>{html.escape(x["method"])}</td><td>{html.escape(x["current_status"])}</td></tr>'for x in rows)
        page='<!doctype html><meta charset="utf-8"><title>原221張圖片風格改版對照</title><style>body{font-family:Microsoft JhengHei,sans-serif;background:#FAF7F2;color:#1F5C5C;padding:24px;line-height:1.7}td,th{padding:10px;border:1px solid #b9d1c4}table{border-collapse:collapse}h1{font-size:28px}</style><h1>原 221 張圖片：新風格改版對照</h1><p>本頁不是完成清單。原始任務狀態與原圖保留；尚未生成、改圖或付費呼叫。科學圖表只從核准數據本機重繪，產品保留核對過的原貌。實際整合還需核對目前文章版位。</p><table><tr><th>ID</th><th>文章</th><th>原檔名</th><th>目標樣式</th><th>處理方式</th><th>原狀態</th></tr>'+trs+'</table>'
        (folder/'review.html').write_text(page,encoding='utf-8');assert hashlib.sha256(source.read_bytes()).hexdigest()==before
        summary.update(task_count=221,counts=counts,report=str(folder/'review.html'),original_tasks_unchanged=True)
    print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
