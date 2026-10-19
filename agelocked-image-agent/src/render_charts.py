import math
from pathlib import Path
from .common import read_json


def validate_data(data):
    required = ['source', 'confirmed_by', 'title', 'x_label', 'y_label', 'unit', 'labels', 'series']
    if any(not data.get(k) for k in required):
        raise ValueError('CHART_DATA_NOT_CONFIRMED_OR_INCOMPLETE')
    n = len(data['labels'])
    for series in data['series']:
        values = series.get('values', [])
        if not series.get('name') or len(values) != n or any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
            raise ValueError('CHART_VALUES_INVALID_NO_IMPUTATION')
        if 'errors' in series:
            if not data.get('error_definition') or len(series['errors']) != n or any(type(v) not in (int,float) or not math.isfinite(v) or v < 0 for v in series['errors']):
                raise ValueError('ERROR_BARS_REQUIRE_CONFIRMED_DEFINITION')
        if data.get('kind') == 'forest':
            intervals = series.get('intervals', [])
            if not data.get('error_definition') or len(intervals) != n:
                raise ValueError('CONFIDENCE_INTERVALS_REQUIRED')
            for value, interval in zip(values, intervals):
                if len(interval) != 2 or any(type(v) not in (int,float) or not math.isfinite(v) for v in interval) or not interval[0] <= value <= interval[1]:
                    raise ValueError('CONFIDENCE_INTERVAL_INVALID')
    if data.get('kind', 'line') not in {'line', 'bar', 'forest'}:
        raise ValueError('UNSUPPORTED_CHART_KIND')


def render_chart(data_path, font_path, output, size=(2400,1350)):
    data = read_json(data_path, {})
    validate_data(data)
    if not Path(font_path).is_file():
        raise ValueError('NOTO_SANS_TC_FONT_MISSING')
    if Path(output).exists():
        raise ValueError('OUTPUT_EXISTS_NO_OVERWRITE')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.font_manager import FontProperties
    font = FontProperties(fname=str(font_path))
    fig, ax = plt.subplots(figsize=(size[0]/150, size[1]/150), dpi=150)
    try:
        fig.patch.set_facecolor('#FAF7F2')
        ax.set_facecolor('#FAF7F2')
        colors = ['#1F5C5C', '#E0A43A', '#8FB9A8', '#2E8B8B']
        for i, series in enumerate(data['series']):
            x = list(range(len(data['labels'])))
            if data.get('kind') == 'forest':
                low = [v-ci[0] for v,ci in zip(series['values'],series['intervals'])]
                high = [ci[1]-v for v,ci in zip(series['values'],series['intervals'])]
                ax.errorbar(series['values'],x,xerr=[low,high],fmt='o',color=colors[i % len(colors)],capsize=8,markersize=12,label=series['name'])
                for row,(value,ci) in enumerate(zip(series['values'],series['intervals'])):
                    ax.annotate(f'{value:.3f} [{ci[0]:.3f}, {ci[1]:.3f}]',(value,row),xytext=(0,25),textcoords='offset points',ha='center',fontsize=15)
                ax.axvline(0,color='#999999',linestyle='--',linewidth=1)
                ax.set_ylim(-.65,max(x)+.65)
                ax.set_yticks(x,data['labels'],fontproperties=font,fontsize=16)
                ax.set_xlabel(data['x_label']+' ('+data['unit']+')',fontproperties=font,fontsize=15)
                ax.set_ylabel(data['y_label'],fontproperties=font,fontsize=15)
            elif data.get('kind') == 'bar':
                width = .8 / len(data['series'])
                ax.bar([v - .4 + width/2 + i*width for v in x], series['values'], width,
                       yerr=series.get('errors'), label=series['name'], color=colors[i % len(colors)])
            else:
                ax.errorbar(x, series['values'], yerr=series.get('errors'), label=series['name'], color=colors[i % len(colors)], marker='o')
        if data.get('kind') != 'forest':
            ax.set_xticks(range(len(data['labels'])), data['labels'], fontproperties=font)
            ax.set_xlabel(data['x_label'], fontproperties=font)
            ax.set_ylabel(data['y_label'] + ' (' + data['unit'] + ')', fontproperties=font)
        ax.set_title(data['title'], fontproperties=font,fontsize=22,pad=28)
        for side in ['top','right']:
            ax.spines[side].set_visible(False)
        ax.legend(prop=font)
        fig.text(.02, .02, '資料來源：' + data['source'], fontproperties=font, fontsize=9)
        fig.tight_layout(rect=(0,.06,1,1))
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        with Path(output).open('xb') as stream:
            fig.savefig(stream, format='png', dpi=150)
    finally:
        plt.close(fig)
