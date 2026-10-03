from pathlib import Path
import base64,json
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
js=(root/'app.js').read_text()
assets={}
for name in ['酒坊全院','蒸甑特写','看缸特写']:
    key='素材/'+name+'.png'
    assets[key]='data:image/png;base64,'+base64.b64encode((root/key).read_bytes()).decode()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('src="素材/酒坊全院.png"','src="'+assets['素材/酒坊全院.png']+'"')
for key in assets:
    js=js.replace("'"+key+"'",'OFFLINE_IMAGES['+json.dumps(key,ensure_ascii=False)+']')
html=html.replace('<script src="app.js"></script>','<script>const OFFLINE_IMAGES='+json.dumps(assets,ensure_ascii=False)+';\n'+js+'</script>')
(root/'直接打开.html').write_text(html)
print('离线样板已生成，三张场景和所有操作已放在同一个文件中。')
